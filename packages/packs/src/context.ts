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
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  intents: z.array(z.nativeEnum(LearningIntent)).default([]),
  subjectTags: z.array(z.string()).default([]),
});
export type AvailableActivity = z.infer<typeof AvailableActivitySchema>;

export const AuthoringContextSchema = z.object({
  packs: z.array(PackRefSchema).default([]),
  curriculumUnit: z.string().optional(),
  learner: z.string().optional(),
  locale: z.string().optional(),
  availableActivities: z.array(AvailableActivitySchema).default([]),
  concepts: z.array(z.object({ ref: ConceptRefSchema, summary: z.string() })).default([]),
  objectives: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        bloomLevel: z.string().optional(),
        concepts: z.array(ConceptRefSchema).default([]),
        requiresIntents: z.array(z.nativeEnum(LearningIntent)),
      }),
    )
    .default([]),
  budget: z.object({
    maxChars: z.number().int().positive(),
    usedChars: z.number().int().nonnegative(),
    truncated: z.array(z.string()).default([]),
  }),
  provenance: z
    .array(
      z.object({
        pack: z.string(),
        version: z.string(),
        documents: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export type AuthoringContext = z.infer<typeof AuthoringContextSchema>;
