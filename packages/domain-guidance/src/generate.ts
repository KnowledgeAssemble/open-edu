import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ProfilesFileSchema,
  QualityRubricFileSchema,
  ArtifactContractSchema,
  type QualityDimension,
  type LearnerProfileDefinition,
} from './types.js';
import { buildDerivedSchemaFacts } from './schema-facts.js';
import { getEngineSkillsData } from './engine-skills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Walk up from the package src/dist to the workspace root (`pnpm-workspace.yaml`). */
export function resolveRepoRoot(): string {
  let dir = join(__dirname, '..', '..', '..');
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Cannot locate the Open-Edu workspace root (pnpm-workspace.yaml not found).');
}

export const AUTHORED_PROMPT_RULES = [
  '1 to 6 lessons only (teachers build short courses).',
  'Exactly one activity per lesson with "type": "quiz"; its questions are multiple-choice with exactly 4 options each.',
  'Use measurable objectives, never "understand", "know", or "learn".',
  'Widget ids must be chosen from the AVAILABLE WIDGETS table in this prompt (canonical catalog ids); never "open-edu.*".',
  'All required fields above must be present and non-empty.',
];

function renderField(field: { name: string; type: string; required: boolean }): string {
  return `${field.name}: ${field.type} (${field.required ? 'required' : 'optional'})`;
}

/**
 * Authored prompt view: curated, model-facing phrasing layered over schema
 * facts derived at runtime from `CourseSpecJSONSchema`. The prose (JSON shape
 * example + RULES) is reviewed like golden copy; the schema section must never
 * be hand-edited here — it is introspected.
 */
export function buildAuthoredPromptView(): string {
  const facts = buildDerivedSchemaFacts();
  return `
Output ONLY a single JSON object that conforms EXACTLY to the derived course-spec schema below (no markdown, no comments, no extra text).

## Schema (derived from ${facts.provenance.package} ${facts.provenance.schema})

Top-level keys: ${facts.requiredTopLevelKeys.map((k) => `"${k}"`).join(', ')}

metadata: { ${facts.metadataFields.map(renderField).join(', ')} }
lesson: { ${facts.lessonFields.map(renderField).join(', ')} }
activity: { ${facts.activityFields.map(renderField).join(', ')} }
question: { ${facts.questionFields.map(renderField).join(', ')} }

Here is the exact JSON shape to produce:

{
  "format": "openedu-course-spec",
  "version": 1,
  "generatedAt": "<ISO 8601 timestamp>",
  "metadata": {
    "title": "<short course title>",
    "description": "<1-2 sentence summary>",
    "author": "OpenEdu Studio",
    "version": "1.0.0",
    "difficulty": "beginner | intermediate | advanced",
    "estimatedHours": <number, e.g. 1>,
    "generated": true
  },
  "lessons": [
    {
      "id": "<kebab-case lesson id>",
      "title": "<lesson title>",
      "objectives": ["<measurable objective, starts with an action verb like explain, identify, calculate, compare, construct — NEVER 'understand' or 'know'>"],
      "coreIdea": "<1-2 sentence core idea>",
      "examples": ["<example>"],
      "misconceptions": ["<common mistake>"],
      "estimatedMinutes": <5-45>,
      "activities": [
        {
          "step": "observe | guided_practice | independent_practice | mastery_check | positive_completion",
          "order": <1-based number>,
          "type": "reading | exercise | quiz | reflection | widget",
          "description": "<what the learner does>",
          "instructions": "<optional instructions>",
          "questions": [
            { "question": "<question>", "options": ["<exactly 4 options>"], "correctIndex": <0-3> }
          ],
          "widgetId": "<canonical-widget-id>",
          "widgetConfig": {}
        }
      ]
    }
  ]
}

RULES:
${AUTHORED_PROMPT_RULES.map((r: string) => `- ${r}`).join('\n')}
`.trim();
}

export function generateArtifactContractData() {
  const derivedSchemaFacts = buildDerivedSchemaFacts();
  return ArtifactContractSchema.parse({
    schemaVersion: 1,
    format: 'openedu-course-spec',
    version: 1,
    requiredTopLevelKeys: derivedSchemaFacts.requiredTopLevelKeys,
    derivedSchemaFacts,
    authoredPromptRules: AUTHORED_PROMPT_RULES,
  });
}

function generatedHeader(title: string, sourceFile: string): string {
  return `# ${title}

> GENERATED reference — do not hand-edit. Regenerate with \`pnpm --filter @open-edu/domain-guidance generate\`.
> Source of truth: \`${sourceFile}\`.
`;
}

function renderProfile(profile: LearnerProfileDefinition, isDefault: boolean): string {
  const lines = [
    `- key: ${profile.id}`,
    `- default: ${isDefault}`,
    `- name: ${profile.name}`,
    `- description: ${profile.description}`,
    `- accessibility: ${profile.accessibility.length > 0 ? profile.accessibility.join(', ') : 'none'}`,
    `- difficultyBias: ${profile.difficultyBias ?? 'none'}`,
    `- pacingRangeMinutes: ${profile.pacingRangeMinutes[0]}–${profile.pacingRangeMinutes[1]}`,
  ];
  if (profile.gradeBands) {
    lines.push('\n## Grade Bands');
    for (const [band, bandInfo] of Object.entries(profile.gradeBands)) {
      lines.push(
        `- \`${band}\` ${bandInfo.pacingRangeMinutes[0]}–${bandInfo.pacingRangeMinutes[1]} minutes`,
      );
    }
  }
  lines.push('\n## Guidance Deltas');
  lines.push(...(profile.guidanceDeltas ?? []).map((g: string) => `- ${g}`));
  lines.push('\n## Output Deltas');
  lines.push(...(profile.outputDeltas ?? []).map((o: string) => `- ${o}`));
  if (profile.promptInstructions) {
    lines.push('\n## Prompt Instructions');
    lines.push(profile.promptInstructions);
  }
  return lines.join('\n');
}

export function generateAll(): void {
  const repoRoot = resolveRepoRoot();
  const packageSrcDataDir = join(repoRoot, 'packages', 'domain-guidance', 'src', 'data');
  const skillRefDir = join(repoRoot, 'skills', 'openedu-course-authoring', 'references');

  mkdirSync(packageSrcDataDir, { recursive: true });
  mkdirSync(skillRefDir, { recursive: true });

  // 1. Artifact contract JSON (canonical, committed at src/data)
  const artifactContract = generateArtifactContractData();
  writeFileSync(
    join(packageSrcDataDir, 'artifact-contract.json'),
    JSON.stringify(artifactContract, null, 2) + '\n',
  );

  const parsedRubric = QualityRubricFileSchema.parse(
    JSON.parse(readFileSync(join(packageSrcDataDir, 'quality-rubric.json'), 'utf-8')),
  );
  const parsedProfiles = ProfilesFileSchema.parse(
    JSON.parse(readFileSync(join(packageSrcDataDir, 'profiles.json'), 'utf-8')),
  );

  // 2. Skill reference views (generated, committed, CI-freshness-checked)
  const facts = buildDerivedSchemaFacts();
  const view = buildAuthoredPromptView();

  const contractMd = [
    generatedHeader(
      'OpenEdu Course Spec Artifact Contract',
      'packages/domain-guidance/src/data/artifact-contract.json',
    ),
    `Schema: ${facts.provenance.package} \`${facts.provenance.schema}\` (derived by runtime Zod introspection)`,
    `Version: ${artifactContract.version}; Format: \`${artifactContract.format}\``,
    '',
    '## Top-Level Required Keys',
    ...facts.requiredTopLevelKeys.map((k: string) => `- \`${k}\``),
    '',
    '## Derived Schema Structure',
    '```json',
    JSON.stringify(facts, null, 2),
    '```',
    '',
    '## Authored Model Prompt Rules',
    ...artifactContract.authoredPromptRules.map((r: string) => `- ${r}`),
    '',
    '## Authored Prompt View',
    '```',
    view,
    '```',
    '',
  ].join('\n');
  writeFileSync(join(skillRefDir, 'artifact-contract.md'), contractMd + '\n');

  const rubricMd = [
    generatedHeader(
      'OpenEdu Quality Rubric Reference',
      'packages/domain-guidance/src/data/quality-rubric.json',
    ),
    `Schema Version: ${parsedRubric.schemaVersion}`,
    '',
    '## Dimensions',
    '',
    ...parsedRubric.dimensions.map((d: QualityDimension) =>
      [
        `### ${d.title} (\`${d.id}\`)`,
        `- **Description**: ${d.description}`,
        `- **Failing Message**: ${d.failingMessage}`,
        `- **Prompt Guidance**: ${d.promptGuidance}`,
        d.thresholds ? `- **Thresholds**: \`${JSON.stringify(d.thresholds)}\`` : '',
        '',
      ].join('\n'),
    ),
    '',
  ].join('\n');
  writeFileSync(join(skillRefDir, 'quality-rubric.md'), rubricMd + '\n');

  const profilesMd = [
    generatedHeader(
      'OpenEdu Learner Profiles Reference',
      'packages/domain-guidance/src/data/profiles.json',
    ),
    `Schema Version: ${parsedProfiles.schemaVersion}`,
    `Default Profile: \`${parsedProfiles.defaultProfile}\``,
    '',
    ...Object.values(parsedProfiles.profiles).map((p: LearnerProfileDefinition) =>
      [
        `### ${p.name} (\`${p.id}\`)`,
        renderProfile(p, p.id === parsedProfiles.defaultProfile),
        '',
      ].join('\n'),
    ),
    '',
  ].join('\n');
  writeFileSync(join(skillRefDir, 'profiles.md'), profilesMd + '\n');

  for (const [id, profile] of Object.entries(parsedProfiles.profiles)) {
    const singleProfileMd = [
      generatedHeader(
        `Profile: ${profile.name}`,
        'packages/domain-guidance/src/data/profiles.json',
      ),
      renderProfile(profile, id === parsedProfiles.defaultProfile),
      '',
    ].join('\n');
    writeFileSync(join(skillRefDir, `profile-${id}.md`), singleProfileMd + '\n');
  }

  console.log(`Generated domain guidance artifacts -> ${packageSrcDataDir}`);
  console.log(`Generated skill reference views -> ${skillRefDir}`);

  // 3. Engine skills derived view (committed at src/data)
  const engineSkillsData = getEngineSkillsData();
  writeFileSync(
    join(packageSrcDataDir, 'engine-skills.json'),
    JSON.stringify(engineSkillsData, null, 2) + '\n',
  );

  // 4. Engine skills reference (generated, committed, CI-freshness-checked)
  const engineSkillsMd = [
    generatedHeader(
      'OpenEdu Engine Skills Reference',
      '@knowledgeassemble/engine-skills manifest.json',
    ),
    `Package: \`@knowledgeassemble/engine-skills\` v${engineSkillsData.version}; Schema Version: ${engineSkillsData.schemaVersion}`,
    '',
    ...engineSkillsData.engines.map((e) =>
      [
        `### ${e.type} (\`${e.skill}\`)`,
        '',
        `- **Skill name:** \`${e.skill}\``,
        `- **Kinds:** ${e.kinds.length > 0 ? e.kinds.join(', ') : '*none*'}`,
        `- **Schema:** \`${e.schema}\``,
        `- **Example:** \`${e.example}\``,
        `- **Validation contract:** \`${e.validationContract.package}.${e.validationContract.symbol}()\``,
        `- **Namespaced events:** ${e.namespacedEvents.length > 0 ? e.namespacedEvents.join(', ') : '*none*'}`,
        '',
        "> Per-engine prose lives in the installed package's `SKILL.md`, loaded at runtime — never re-derived.",
        '',
      ].join('\n'),
    ),
    '',
  ].join('\n');
  writeFileSync(join(skillRefDir, 'engine-skills.md'), engineSkillsMd + '\n');

  console.log(`Generated engine skills data -> ${packageSrcDataDir}`);
  console.log(`Generated engine skills reference -> ${skillRefDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateAll();
  console.log('Successfully generated domain guidance artifacts.');
}
