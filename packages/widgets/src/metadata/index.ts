export type { WidgetCapabilities } from './capabilities';
export type { AccessibilityMetadata } from './accessibility';
export type { AnalyticsMetadata } from './analytics';
export type { RewardMetadata } from './reward';
export type { AIMetadata, BloomsLevel, CognitiveLoad, DifficultyLevel } from './ai';
export { LearningIntent } from './learning-intents';
export {
  WIDGET_LEARNING_INTENTS,
  getLearningIntentsForWidget,
  getWidgetsByLearningIntent,
} from '../builtin-roster';
