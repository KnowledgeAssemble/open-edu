import { z } from 'zod';
import { PackIdSchema } from './manifest.js';

export const ConceptSourceSchema = z.object({
  documentId: z.string().min(1).max(128),
  locator: z.string().min(1).max(256).optional(),
  section: z.string().max(256).optional(),
  page: z.number().int().positive().optional(),
  excerpt: z.string().max(2000).optional(),
});
export type ConceptSource = z.infer<typeof ConceptSourceSchema>;

export const ConceptSchema = z
  .object({
    id: PackIdSchema,
    title: z.string().min(1).max(256),
    summary: z.string().min(1).max(2000),
    domainTags: z.array(z.string().min(1).max(64)).min(1),
    examples: z.array(z.string().max(1000)).max(10).optional(),
    misconceptions: z.array(z.string().max(1000)).max(10).optional(),
    prerequisites: z.array(z.string().min(1).max(128)).max(20).optional(),
    source: ConceptSourceSchema.optional(),
  })
  .strict();

export type Concept = z.infer<typeof ConceptSchema>;
