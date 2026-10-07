import type { CompanionSkill } from '@open-edu/companion';
import {
  getEngineSkillsData,
  loadEngineSkillDoc,
  loadEngineSchema,
} from '@open-edu/domain-guidance';

function extractSchemaSummary(schema: unknown): string {
  if (typeof schema !== 'object' || schema === null) return '';
  const obj = schema as Record<string, unknown>;
  const topKeys: string[] = [];
  if (obj.properties && typeof obj.properties === 'object') {
    for (const key of Object.keys(obj.properties)) {
      if (['type', 'version', 'id'].includes(key)) {
        topKeys.push(key);
      }
    }
  }
  const content = obj.content as Record<string, unknown> | undefined;
  if (content?.properties && typeof content.properties === 'object') {
    const kindProp = content.properties as Record<string, unknown>;
    if ('kind' in kindProp) {
      topKeys.push('content.kind');
    }
  }
  return topKeys.join(', ');
}

function buildInstruction(entry: {
  type: string;
  skill: string;
  kinds: string[];
  skillDoc: string;
  schema: string;
  example: string;
}): string {
  const skillDocContent = loadEngineSkillDoc(entry.type);
  const schemaContent = loadEngineSchema(entry.type);
  const schemaSummary = extractSchemaSummary(schemaContent);

  const preamble = [
    `You are authoring OpenEdu interactive lesson-node specs. Server-side validation uses the manifest validationContract; do not run local ajv.`,
    `Kinds: ${entry.kinds.length > 0 ? entry.kinds.join(', ') : '*none*'}.`,
    `Reference example: ${entry.example}.`,
    `Schema summary (top-level keys): ${schemaSummary}`,
  ].join('\n');

  return `${preamble}\n\n${skillDocContent}`;
}

export function createInteractiveAuthoringSkills(): CompanionSkill[] {
  const data = getEngineSkillsData();
  return data.engines.map((entry) => ({
    id: `interactive-${entry.type}`,
    description: `Author {type:"interactive", engine:"${entry.type}"} lesson nodes (skill: ${entry.skill}).`,
    instructions: buildInstruction(entry),
    tools: ['generate_item', 'edit_item'],
    permissions: ['item.generate', 'item.edit'],
  }));
}

export const interactiveAuthoringRouterSkill: CompanionSkill = {
  id: 'interactive-authoring',
  description:
    'Route interactive lesson node authoring to the correct engine skill when the engine type is known.',
  instructions: [
    "Identify the interactive engine type from the user's request or content context.",
    'The available engines are: visual (number lines, graphs), chart (bar, line, pie charts), geomap (geographic maps), timeline (temporal sequences), diagram (structural diagrams), composition (multi-engine compositions).',
    "Once identified, follow that engine's `interactive-<type>` skill for authoring rules.",
    'If the engine is unclear, ask the user for clarification.',
    'Refer to references/engine-skills.md for the engine-to-kind matrix.',
  ].join('\n'),
  tools: ['generate_item', 'edit_item'],
  permissions: ['item.generate', 'item.edit'],
};

export function detectEngineType(content: string, engineTypes: string[]): string | null {
  const regex = /["']engine["']\s*:\s*["'](\w+)["']/;
  const match = content.match(regex);
  if (match && match[1] && engineTypes.includes(match[1])) {
    return match[1];
  }
  return null;
}
