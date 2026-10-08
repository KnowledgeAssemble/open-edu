import type { WidgetDefinitionV2 } from './types';
import type { LearningIntent } from './metadata/learning-intents';
import {
  visualCounting,
  multipleChoice,
  matching,
  dragDrop,
  sequencing,
  fillBlank,
  storyQuestion,
  realWorld,
  fractionVisual,
  placeValueChart,
  gridArea,
  chartReader,
  clockTime,
  measurementScale,
  callout,
  imageCompare,
  hotspot,
  timeline,
  labelDiagram,
  imageLabel,
  audioPlayer,
  videoPlayer,
  flashcard,
  processDiagram,
  numberLine,
  socialMap,
  processExplainer,
  timer,
} from './builtins';

/** The single source of truth for the built-in widget roster (28 entries; the deprecated practice widget is retired). */
export const BUILTIN_WIDGETS: WidgetDefinitionV2[] = [
  visualCounting,
  multipleChoice,
  matching,
  dragDrop,
  sequencing,
  fillBlank,
  storyQuestion,
  realWorld,
  fractionVisual,
  placeValueChart,
  gridArea,
  chartReader,
  clockTime,
  measurementScale,
  callout,
  imageCompare,
  hotspot,
  timeline,
  labelDiagram,
  imageLabel,
  audioPlayer,
  videoPlayer,
  flashcard,
  processDiagram,
  numberLine,
  socialMap,
  processExplainer,
  timer,
];

export const WIDGET_LEARNING_INTENTS: Record<string, LearningIntent[]> = Object.fromEntries(
  BUILTIN_WIDGETS.map((w) => [w.id, w.learningIntents]),
);

export function getLearningIntentsForWidget(widgetId: string): LearningIntent[] {
  return WIDGET_LEARNING_INTENTS[widgetId] ?? [];
}

export function getWidgetsByLearningIntent(intent: LearningIntent): string[] {
  return Object.entries(WIDGET_LEARNING_INTENTS)
    .filter(([, intents]) => intents.includes(intent))
    .map(([id]) => id);
}
