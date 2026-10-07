import { z } from 'zod';

const TimestampSchema = z.number().positive();

const BaseTelemetrySchema = z.object({
  timestamp: TimestampSchema,
  sessionId: z.string().min(1).max(128).optional(),
  bundleId: z.string().min(1).max(128).optional(),
  moduleId: z.string().min(1).max(128).optional(),
});

export const NodeOpenEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('node_open'),
  nodeId: z.string().min(1).max(256),
  type: z.string().min(1).max(64).optional(),
});

export const NodeCompleteEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('node_complete'),
  nodeId: z.string().min(1).max(256),
  score: z.number().min(0).max(100).optional(),
  renderedViaFallback: z.boolean().optional(),
});

export const QuizAnsweredEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('quiz_answered'),
  nodeId: z.string().min(1).max(256),
  optionId: z.string().min(1).max(64),
  correct: z.boolean(),
});

export const HintTriggeredEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('hint_triggered'),
  nodeId: z.string().min(1).max(256),
});

export const WidgetInteractionEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('widget_interaction'),
  widgetId: z.string().min(1).max(256),
  action: z.string().min(1).max(128).optional(),
  data: z.record(z.unknown()).optional(),
});

export const InteractiveInteractionEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('interactive_interaction'),
  nodeId: z.string().min(1).max(256),
  instanceId: z.string().min(1).max(256),
  engine: z.string().min(1).max(64),
  action: z.string().min(1).max(128).optional(),
  seq: z.number().nonnegative().optional(),
  data: z.record(z.unknown()).optional(),
});

export const InteractiveCompleteEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('interactive_complete'),
  nodeId: z.string().min(1).max(256),
  interactions: z.number().nonnegative().optional(),
});

export const RouteTriggeredEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('route_triggered'),
  from: z.string().min(1).max(256),
  to: z.string().min(1).max(256),
  reason: z.string().min(1).max(512).optional(),
});

export const WorkflowCompleteEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('workflow_complete'),
});

export const ModuleCompleteEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('module_complete'),
  moduleId: z.string().min(1).max(128),
});

export const BundleCompleteEventSchema = BaseTelemetrySchema.extend({
  event: z.literal('bundle_complete'),
  bundleId: z.string().min(1).max(128),
});

export const TelemetryEventSchema = z.discriminatedUnion('event', [
  NodeOpenEventSchema,
  NodeCompleteEventSchema,
  QuizAnsweredEventSchema,
  HintTriggeredEventSchema,
  WidgetInteractionEventSchema,
  InteractiveInteractionEventSchema,
  InteractiveCompleteEventSchema,
  RouteTriggeredEventSchema,
  WorkflowCompleteEventSchema,
  ModuleCompleteEventSchema,
  BundleCompleteEventSchema,
]);

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type NodeOpenEvent = z.infer<typeof NodeOpenEventSchema>;
export type NodeCompleteEvent = z.infer<typeof NodeCompleteEventSchema>;
export type QuizAnsweredEvent = z.infer<typeof QuizAnsweredEventSchema>;
export type HintTriggeredEvent = z.infer<typeof HintTriggeredEventSchema>;
export type WidgetInteractionEvent = z.infer<typeof WidgetInteractionEventSchema>;
export type InteractiveInteractionEvent = z.infer<typeof InteractiveInteractionEventSchema>;
export type InteractiveCompleteEvent = z.infer<typeof InteractiveCompleteEventSchema>;
export type RouteTriggeredEvent = z.infer<typeof RouteTriggeredEventSchema>;
export type WorkflowCompleteEvent = z.infer<typeof WorkflowCompleteEventSchema>;
export type ModuleCompleteEvent = z.infer<typeof ModuleCompleteEventSchema>;
export type BundleCompleteEvent = z.infer<typeof BundleCompleteEventSchema>;

export const TelemetryEventEnum = z.enum([
  'node_open',
  'node_complete',
  'quiz_answered',
  'hint_triggered',
  'widget_interaction',
  'interactive_interaction',
  'interactive_complete',
  'route_triggered',
  'workflow_complete',
  'module_complete',
  'bundle_complete',
]);
