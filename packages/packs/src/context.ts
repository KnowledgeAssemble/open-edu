import { z } from 'zod';
import { LearningIntent } from '@open-edu/widgets/intents';
import { ConceptRefSchema } from './curriculum.js';

export const PackRefSchema = z.object({
  id: z.string(),
  version: z.string(),
  type: z.enum(['knowledge', 'curriculum']),
});
export type PackRef = z.infer<typeof PackRefSchema>;

export const AvailableActivitySchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  domain: z.string().max(200).optional(),
  intents: z.array(z.nativeEnum(LearningIntent)).default([]),
  subjectTags: z.array(z.string()).max(100).default([]),
});
export type AvailableActivity = z.infer<typeof AvailableActivitySchema>;

export const AuthoringContextSchema = z.object({
  packs: z.array(PackRefSchema).max(100).default([]),
  curriculumUnit: z.string().max(300).optional(),
  learner: z.string().max(100).optional(),
  locale: z.string().max(16).optional(),
  availableActivities: z.array(AvailableActivitySchema).max(500).default([]),
  concepts: z
    .array(
      z.object({
        ref: ConceptRefSchema,
        summary: z.string().min(1).max(4000),
      }),
    )
    .max(1000)
    .default([]),
  objectives: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
        bloomLevel: z.string().max(100).optional(),
        concepts: z.array(ConceptRefSchema).max(200).default([]),
        requiresIntents: z.array(z.nativeEnum(LearningIntent)),
      }),
    )
    .max(1000)
    .default([]),
  budget: z.object({
    maxChars: z.number().int().positive().max(1_000_000),
    usedChars: z.number().int().nonnegative(),
    truncated: z.array(z.string()).max(20).default([]),
  }),
  provenance: z
    .array(
      z.object({
        pack: z.string().min(1).max(300),
        version: z.string().min(1).max(100),
        documents: z.array(z.string().max(300)).max(200).default([]),
      }),
    )
    .max(100)
    .default([]),
});

export type AuthoringContext = z.infer<typeof AuthoringContextSchema>;
