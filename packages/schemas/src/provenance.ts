import { z } from 'zod';

export const ReproductionNodeSchema = z.object({
  path: z.string(),
  objectives: z.array(z.string()).default([]),
  concepts: z.array(z.object({ pack: z.string(), concept: z.string() })).default([]),
  widgets: z.array(z.string()).default([]),
  capabilityGaps: z.array(z.string()).default([]),
});

export const ReproductionRecordSchema = z.object({
  schemaVersion: z.literal(1),
  packs: z.array(
    z.object({ id: z.string(), version: z.string(), type: z.enum(['knowledge', 'curriculum']) }),
  ),
  generatedAt: z.string(),
  contextFingerprint: z.string(),
  nodes: z.array(ReproductionNodeSchema),
});

export type ReproductionRecord = z.infer<typeof ReproductionRecordSchema>;
