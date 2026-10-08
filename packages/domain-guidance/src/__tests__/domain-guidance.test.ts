import type { z } from 'zod';
import { describe, it, expect } from 'vitest';
import {
  getArtifactContractData,
  getArtifactContractPromptView,
  getProfilesData,
  getProfile,
  getQualityRubricData,
  getQualityDimension,
} from '../index.js';
import { generateArtifactContractData } from '../generate.js';
import { buildDerivedSchemaFacts } from '../schema-facts.js';
import {
  getProfile as getProfileBrowser,
  getProfilesData as getProfilesDataBrowser,
  listProfiles,
} from '../profiles.js';
import {
  CourseSpecJSONSchema,
  LessonJSONSchema,
  ActivityJSONSchema,
  MCQQuestionSchema,
} from '@open-edu/course-compiler';

function liveShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  return (schema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
}

describe('domain-guidance package', () => {
  it('committed artifact-contract.json is in sync with schema generator', () => {
    const generated = generateArtifactContractData();
    const fromFile = getArtifactContractData();
    expect(fromFile).toEqual(generated);
  });

  it('derived schema facts are introspected live and match the enforcing Zod schema', () => {
    const facts = buildDerivedSchemaFacts();
    const metadataShape = liveShape(CourseSpecJSONSchema.shape.metadata);
    const lessonShape = liveShape(LessonJSONSchema);
    const activityShape = liveShape(ActivityJSONSchema);
    const questionShape = liveShape(MCQQuestionSchema);

    expect(facts.requiredTopLevelKeys).toEqual(Object.keys(CourseSpecJSONSchema.shape));
    expect(facts.metadataFields.map((f) => f.name).sort()).toEqual(
      Object.keys(metadataShape).sort(),
    );
    expect(facts.lessonFields.map((f) => f.name).sort()).toEqual(Object.keys(lessonShape).sort());
    expect(facts.activityFields.map((f) => f.name).sort()).toEqual(
      Object.keys(activityShape).sort(),
    );
    expect(facts.questionFields.map((f) => f.name).sort()).toEqual(
      Object.keys(questionShape).sort(),
    );

    const allFields = [...facts.metadataFields, ...facts.lessonFields];
    for (const field of allFields) {
      const live = metadataShape[field.name] ?? lessonShape[field.name];
      expect(live).toBeDefined();
      expect(field.required, `${field.name} required flag`).toBe(!live!.isOptional());
    }

    expect(facts.activitySteps).toEqual([
      'observe',
      'guided_practice',
      'independent_practice',
      'mastery_check',
      'positive_completion',
    ]);
    expect(facts.activityTypes).toEqual(['reading', 'exercise', 'quiz', 'reflection', 'widget']);
  });

  it('the committed artifact contract records every course-spec metadata field', () => {
    generateArtifactContractData();
    const facts = buildDerivedSchemaFacts();
    const metadataNames = facts.metadataFields.map((f) => f.name);
    expect(metadataNames).toEqual(
      expect.arrayContaining([
        'keywords',
        'targetAudience',
        'audience',
        'accessibility',
        'lastUpdated',
        'language',
        'generated',
      ]),
    );
  });

  it('golden-file test: authored prompt view renders curated prose over derived facts', () => {
    const promptView = getArtifactContractPromptView();
    expect(promptView).toContain('Output ONLY a single JSON object');
    expect(promptView).toContain('"format": "openedu-course-spec"');
    expect(promptView).toContain('RULES:');
    expect(promptView).toContain('1 to 6 lessons only');
    expect(promptView).toContain('Use measurable objectives');
    expect(promptView).toContain('lastUpdated');
    expect(promptView).toContain('enum(beginner | intermediate | advanced)');
    expect(promptView).toContain('metadata.language');
  });

  it('profiles accessors return valid profile definitions', () => {
    const data = getProfilesData();
    expect(data.schemaVersion).toBe(1);
    expect(data.defaultProfile).toBe('neurotypical');
    expect(Object.keys(data.profiles)).toContain('autism');
    expect(Object.keys(data.profiles)).toContain('school');

    const autism = getProfile('autism');
    expect(autism).toBeDefined();
    expect(autism?.kind).toBe('autism');
    expect(autism?.accessibility).toContain('sensory-friendly');
  });

  it('quality rubric accessors return valid dimension definitions', () => {
    const rubric = getQualityRubricData();
    expect(rubric.schemaVersion).toBe(1);
    expect(rubric.dimensions.map((d) => d.id)).toEqual([
      'objectives',
      'assessment',
      'duration',
      'completeness',
    ]);

    const objectives = getQualityDimension('objectives');
    expect(objectives).toBeDefined();
    expect(objectives?.title).toBe('Learning Objectives');
    expect(objectives?.promptGuidance).toContain('measurable objectives');
  });

  it('browser-safe ./profiles subpath stays in parity with the Node entry', () => {
    const nodeProfiles = getProfilesData();
    const browserProfiles = getProfilesDataBrowser();

    expect(browserProfiles).toEqual(nodeProfiles);
    expect(
      listProfiles()
        .map((p) => p.id)
        .sort(),
    ).toEqual(Object.keys(nodeProfiles.profiles).sort());

    for (const [id, profile] of Object.entries(nodeProfiles.profiles)) {
      expect(getProfileBrowser(id)).toEqual(profile);
    }
  });
});
