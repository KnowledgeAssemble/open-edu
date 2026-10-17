import { z } from 'zod';

export const ReproductionNodeSchema = z.object({
  path: z.string(),
  objectives: z.array(z.string()).default([]),
  concepts: z.array(z.object({ pack: z.string(), concept: z.string() })).default([]),
  widgets: z.array(z.string()).default([]),
  capabilityGaps: z.array(z.string()).default([]),
});

export const AuthoringScopeSchema = z.object({
  curriculum: z.string().min(1).max(300),
  unit: z.string().max(300).optional(),
  learner: z.string().max(100).optional(),
  locale: z.string().max(16).optional(),
});

export type AuthoringScope = z.infer<typeof AuthoringScopeSchema>;

export const ReproductionRecordSchema = z.object({
  schemaVersion: z.literal(1),
  packs: z.array(
    z.object({ id: z.string(), version: z.string(), type: z.enum(['knowledge', 'curriculum']) }),
  ),
  generatedAt: z.string(),
  contextFingerprint: z.string(),
  authoringScope: AuthoringScopeSchema.optional(),
  nodes: z.array(ReproductionNodeSchema),
});

export type ReproductionRecord = z.infer<typeof ReproductionRecordSchema>;
