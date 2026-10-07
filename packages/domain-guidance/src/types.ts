import { z } from 'zod';

export const LearnerProfileKindSchema = z.enum([
  'school',
  'college',
  'adult',
  'family',
  'neurotypical',
  'autism',
]);
export type LearnerProfileKind = z.infer<typeof LearnerProfileKindSchema>;

export const LearnerProfileSchema = z.object({
  id: z.string(),
  kind: LearnerProfileKindSchema,
  name: z.string(),
  audience: z.string(),
  description: z.string(),
  accessibility: z.array(z.string()),
  difficultyBias: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
  pacingRangeMinutes: z.tuple([z.number(), z.number()]),
  gradeBands: z
    .record(
      z.object({
        pacingRangeMinutes: z.tuple([z.number(), z.number()]),
      }),
    )
    .optional(),
  guidanceDeltas: z.array(z.string()).optional(),
  outputDeltas: z.array(z.string()).optional(),
  promptInstructions: z.string().optional(),
});
export type LearnerProfileDefinition = z.infer<typeof LearnerProfileSchema>;

export const ProfilesFileSchema = z.object({
  schemaVersion: z.literal(1),
  defaultProfile: z.string(),
  profiles: z.record(LearnerProfileSchema),
});
export type ProfilesFile = z.infer<typeof ProfilesFileSchema>;

export const QualityDimensionIdSchema = z.enum([
  'objectives',
  'assessment',
  'duration',
  'completeness',
]);
export type QualityDimensionId = z.infer<typeof QualityDimensionIdSchema>;

export const QualityDimensionSchema = z.object({
  id: QualityDimensionIdSchema,
  title: z.string(),
  description: z.string(),
  failingMessage: z.string(),
  promptGuidance: z.string(),
  thresholds: z.record(z.unknown()).optional(),
});
export type QualityDimension = z.infer<typeof QualityDimensionSchema>;

export const QualityRubricFileSchema = z.object({
  schemaVersion: z.literal(1),
  dimensions: z.array(QualityDimensionSchema),
});
export type QualityRubricFile = z.infer<typeof QualityRubricFileSchema>;

export const ArtifactContractSchema = z.object({
  schemaVersion: z.literal(1),
  format: z.literal('openedu-course-spec'),
  version: z.literal(1),
  requiredTopLevelKeys: z.array(z.string()),
  derivedSchemaFacts: z.record(z.unknown()),
  authoredPromptRules: z.array(z.string()),
});
export type ArtifactContractData = z.infer<typeof ArtifactContractSchema>;

export const ValidationContractSchema = z.object({
  package: z.string(),
  symbol: z.string(),
  method: z.string(),
});
export type ValidationContractData = z.infer<typeof ValidationContractSchema>;

export const EngineSkillEntrySchema = z.object({
  type: z.string(),
  skill: z.string(),
  kinds: z.array(z.string()),
  skillDoc: z.string(),
  schema: z.string(),
  example: z.string(),
  validationContract: ValidationContractSchema,
  namespacedEvents: z.array(z.string()),
});
export type EngineSkillEntryData = z.infer<typeof EngineSkillEntrySchema>;

export const EngineSkillsDataSchema = z.object({
  package: z.literal('engine-skills'),
  version: z.string(),
  schemaVersion: z.literal(1),
  engines: z.array(EngineSkillEntrySchema),
});
export type EngineSkillsData = z.infer<typeof EngineSkillsDataSchema>;
