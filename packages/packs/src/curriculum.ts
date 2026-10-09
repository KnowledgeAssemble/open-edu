import { z } from 'zod';
import { LearningIntent } from '@open-edu/widgets/intents';
import { PackIdSchema } from './manifest.js';

export const ConceptRefSchema = z.object({
  pack: PackIdSchema,
  concept: PackIdSchema,
});
export type ConceptRef = z.infer<typeof ConceptRefSchema>;

export const ObjectiveSchema = z
  .object({
    id: PackIdSchema,
    description: z.string().min(1).max(500),
    bloomLevel: z
      .enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
      .optional(),
    concepts: z.array(ConceptRefSchema).default([]),
    requiresIntents: z.array(z.nativeEnum(LearningIntent)).min(1),
  })
  .strict();

export const CurriculumUnitSchema = z
  .object({
    id: PackIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(2000).optional(),
    concepts: z.array(ConceptRefSchema).default([]),
    objectives: z.array(ObjectiveSchema).min(1),
    estimatedMinutes: z.number().int().positive().optional(),
    prerequisites: z.array(z.string()).default([]),
  })
  .strict();

export const CurriculumSchema = z
  .object({
    id: PackIdSchema,
    title: z.string().min(1).max(256),
    subject: z.string().min(1).max(128),
    level: z.string().max(64).optional(),
    units: z.array(CurriculumUnitSchema).min(1),
  })
  .strict();

export type Curriculum = z.infer<typeof CurriculumSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
