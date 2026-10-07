import { z } from 'zod';
import { SkillsSchema } from './manifest.js';
import { WidgetReferenceSchema } from './widget-reference.js';
import { RemoteWidgetManifestSchema } from './widget-manifest.js';

const OptionSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(1024),
  correct: z.boolean(),
});

const QuizConfigSchema = z.object({
  question: z.string().min(1).max(2048),
  options: z.array(OptionSchema).min(2).max(26),
});

const ReflectionConfigSchema = z.object({
  prompt: z.string().min(1).max(4096),
});

const WidgetConfigSchema = z.object({
  widget: z.string().min(1).max(256),
  version: z.string().min(1).max(64).optional(),
  config: z.record(z.unknown()).optional(),
});

const ExerciseConfigSchema = z.object({
  widget: z.string().min(1).max(256).optional(),
  config: z.record(z.unknown()).optional(),
});

export const INTERACTIVE_ENGINE_TYPES = [
  'visual',
  'chart',
  'geomap',
  'timeline',
  'diagram',
] as const;

export const InteractiveEngineTypeSchema = z.enum(INTERACTIVE_ENGINE_TYPES);

const InteractiveIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/);

const InteractiveActionTypeSchema = z.enum([
  'select',
  'deselect',
  'focus',
  'unfocus',
  'filter',
  'clear-filter',
  'open-annotation',
  'close-annotation',
  'answer',
  'compare',
  'toggle',
  'expand',
  'collapse',
  'zoom',
  'pan',
  'scrub',
  'jump-to',
  'play-pause',
  'step',
  'drag',
  'drop',
  'place',
  'move',
  'connect',
  'disconnect',
  'follow',
  'reset',
]);

const InteractiveEngineEntrySchema = z
  .object({
    instanceId: InteractiveIdSchema,
    engine: InteractiveEngineTypeSchema,
    spec: z.record(z.unknown()),
  })
  .strict();

const InteractiveBindingSchema = z
  .object({
    on: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/),
    from: z.string().min(1),
    dispatch: z
      .object({
        to: z.string().min(1),
        action: InteractiveActionTypeSchema,
        targetIdFrom: z.string().optional(),
        targetId: z.string().optional(),
      })
      .strict()
      .refine((d) => d.targetIdFrom !== undefined || d.targetId !== undefined, {
        message: 'dispatch must define exactly one of targetIdFrom or targetId',
      })
      .refine((d) => !(d.targetIdFrom !== undefined && d.targetId !== undefined), {
        message: 'dispatch must define exactly one of targetIdFrom or targetId',
      }),
  })
  .strict();

const FigureSpecSchema = z.discriminatedUnion('decorative', [
  z.object({ ref: z.string().min(1), decorative: z.literal(true) }).strict(),
  z
    .object({
      ref: z.string().min(1),
      alt: z.string().min(1),
      decorative: z.literal(false).optional(),
    })
    .strict(),
]);

export type FigureSpec = z.infer<typeof FigureSpecSchema>;

const interactiveConfigShape = {
  engine: InteractiveEngineTypeSchema.optional(),
  spec: z.record(z.unknown()).optional(),
  id: InteractiveIdSchema.optional(),
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).max(1024).optional(),
  engines: z.array(InteractiveEngineEntrySchema).min(1).optional(),
  bindings: z.array(InteractiveBindingSchema).optional(),
  figures: z.record(z.string(), FigureSpecSchema).optional(),
} as const;

type InteractiveConfigValue = {
  engine?: z.infer<typeof InteractiveEngineTypeSchema>;
  spec?: Record<string, unknown>;
  id?: string;
  title?: string;
  prompt?: string;
  engines?: Array<z.infer<typeof InteractiveEngineEntrySchema>>;
  bindings?: Array<z.infer<typeof InteractiveBindingSchema>>;
  figures?: Record<string, FigureSpec>;
};

function refineInteractiveNodeConfig(value: InteractiveConfigValue, ctx: z.RefinementCtx): void {
  const isSingle = value.engine !== undefined || value.spec !== undefined;
  const isComposed =
    value.id !== undefined || value.engines !== undefined || value.bindings !== undefined;

  if (isSingle && isComposed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cannot mix single-engine (engine/spec) with composed (id/engines/bindings) form',
    });
    return;
  }
  if (!isSingle && !isComposed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must provide either engine/spec (single) or engines/bindings (composed)',
    });
    return;
  }
  if (isSingle) {
    if (value.engine === undefined || value.spec === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'single-engine form requires both engine and spec',
      });
    }
  }
  if (isComposed) {
    if (value.engines === undefined || value.bindings === undefined || value.id === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'composed form requires id, engines, and bindings',
      });
    }
  }
}

export const InteractiveNodeConfigSchema = z
  .object(interactiveConfigShape)
  .strict()
  .superRefine(refineInteractiveNodeConfig);

export type InteractiveNodeConfig = z.infer<typeof InteractiveNodeConfigSchema>;

const NodeFields = {
  title: z.string().max(256).optional(),
  skills: SkillsSchema.optional(),
} as const;

export const LessonNodeSchema = z.object({
  type: z.literal('lesson'),
  ...NodeFields,
});

export const QuizNodeSchema = z.object({
  type: z.literal('quiz'),
  ...NodeFields,
  ...QuizConfigSchema.shape,
});

export const ReflectionNodeSchema = z.object({
  type: z.literal('reflection'),
  ...NodeFields,
  ...ReflectionConfigSchema.shape,
});

export const ExerciseNodeSchema = z.object({
  type: z.literal('exercise'),
  ...NodeFields,
  ...ExerciseConfigSchema.shape,
});

export const WidgetNodeSchema = z.object({
  type: z.literal('custom'),
  ...NodeFields,
  ...WidgetConfigSchema.shape,
  remoteWidget: RemoteWidgetManifestSchema.optional(),
  widgetRef: WidgetReferenceSchema.optional(),
});

export const InteractiveNodeSchema = z
  .object({
    type: z.literal('interactive'),
    ...NodeFields,
    ...interactiveConfigShape,
  })
  .strict();

const InteractiveNodeValidatedSchema = InteractiveNodeSchema.superRefine(
  refineInteractiveNodeConfig,
);

export const ContentNodeSchema = z
  .discriminatedUnion('type', [
    LessonNodeSchema,
    QuizNodeSchema,
    ReflectionNodeSchema,
    ExerciseNodeSchema,
    WidgetNodeSchema,
    InteractiveNodeSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.type === 'interactive') {
      refineInteractiveNodeConfig(data, ctx);
    }
  });

export type ContentNode = z.infer<typeof ContentNodeSchema>;
export type LessonNode = z.infer<typeof LessonNodeSchema>;
export type QuizNode = z.infer<typeof QuizNodeSchema>;
export type ReflectionNode = z.infer<typeof ReflectionNodeSchema>;
export type ExerciseNode = z.infer<typeof ExerciseNodeSchema>;
export type WidgetNode = z.infer<typeof WidgetNodeSchema>;
export type InteractiveNode = z.infer<typeof InteractiveNodeSchema>;
export type InteractiveEngineType = z.infer<typeof InteractiveEngineTypeSchema>;
export type InteractiveActionType = z.infer<typeof InteractiveActionTypeSchema>;

export function validateInteractiveNode(
  value: unknown,
): { valid: true; data: InteractiveNode } | { valid: false; issues: string[] } {
  const result = InteractiveNodeValidatedSchema.safeParse(value);
  if (!result.success) {
    return { valid: false, issues: result.error.issues.map((i) => i.message) };
  }
  return { valid: true, data: result.data };
}

export type NodeType = ContentNode['type'];

export const NodeTypeSchema = z.enum([
  'lesson',
  'quiz',
  'reflection',
  'exercise',
  'custom',
  'interactive',
]);
