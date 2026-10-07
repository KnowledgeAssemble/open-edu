import { z } from 'zod';

export const QuizAnswerSchema = z.object({
  type: z.literal('quiz'),
  selectedOptionId: z.string(),
  score: z.number(),
});

export const ReflectionAnswerSchema = z.object({
  type: z.literal('reflection'),
  text: z.string(),
});

// `widgetVersion` (and the provenance fields below) are optional for backward
// compatibility with answers saved before this phase. Analytics that group or
// filter by widgetVersion must handle null/undefined for pre-provenance records.
export const WidgetAnswerSchema = z.object({
  type: z.literal('widget'),
  widgetId: z.string(),
  widgetVersion: z.string().optional(),
  data: z.unknown(),
  score: z.number().optional(),
  intendedWidgetId: z.string().min(1).max(256).optional(),
  intendedWidgetVersion: z.string().min(1).max(64).optional(),
  renderedWidgetId: z.string().min(1).max(256).optional(),
  renderedWidgetVersion: z.string().min(1).max(64).optional(),
  renderedViaFallback: z.boolean().optional(),
});

export const InteractiveAnswerSchema = z.object({
  type: z.literal('interactive'),
  engaged: z.boolean().default(true),
  interactions: z.number().nonnegative().default(0),
  score: z.number().min(0).max(100).optional(),
});

export const NodeAnswerSchema = z.discriminatedUnion('type', [
  QuizAnswerSchema,
  ReflectionAnswerSchema,
  WidgetAnswerSchema,
  InteractiveAnswerSchema,
]);

export type QuizAnswer = z.infer<typeof QuizAnswerSchema>;
export type ReflectionAnswer = z.infer<typeof ReflectionAnswerSchema>;
export type WidgetAnswer = z.infer<typeof WidgetAnswerSchema>;
export type InteractiveAnswer = z.infer<typeof InteractiveAnswerSchema>;
export type NodeAnswer = z.infer<typeof NodeAnswerSchema>;

export const ProgressSnapshotSchema = z.object({
  packageId: z.string().min(1).max(128),
  packageVersion: z.string().min(1).max(64),
  currentNodeId: z.string().min(1).max(512),
  visitedNodes: z.array(z.string().min(1).max(512)),
  scores: z.record(z.number()).default({}),
  answers: z.record(NodeAnswerSchema).default({}),
  isCompleted: z.boolean().default(false),
  updatedAt: z.string().min(1).max(64).datetime(),
});

export type ProgressSnapshot = z.infer<typeof ProgressSnapshotSchema>;

export const ModuleProgressSnapshotSchema = z.object({
  moduleId: z.string().min(1).max(128),
  packageVersion: z.string().min(1).max(64),
  currentNodeId: z.string().min(1).max(512),
  visitedNodes: z.array(z.string().min(1).max(512)),
  scores: z.record(z.number()).default({}),
  answers: z.record(NodeAnswerSchema).default({}),
  isCompleted: z.boolean().default(false),
  completedAt: z.string().optional(),
});

export const BundleProgressSnapshotSchema = z.object({
  bundleId: z.string(),
  bundleVersion: z.string().min(1).max(64),
  currentModuleId: z.string().optional(),
  moduleStatuses: z.record(z.enum(['locked', 'unlocked', 'in_progress', 'completed'])).default({}),
  moduleProgress: z.record(ModuleProgressSnapshotSchema).default({}),
  updatedAt: z.string().datetime(),
});

export type ModuleProgressSnapshot = z.infer<typeof ModuleProgressSnapshotSchema>;
export type BundleProgressSnapshot = z.infer<typeof BundleProgressSnapshotSchema>;
