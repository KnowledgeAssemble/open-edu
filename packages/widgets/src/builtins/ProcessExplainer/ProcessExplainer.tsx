import { useState, useCallback } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { AnimationConfigSchema } from '@open-edu/schemas';
import { useTranslation } from '@open-edu/i18n';
import { useObserveMode } from '../../use-observe-mode';
import { WidgetError } from '../WidgetError';

const explainerStepSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  media: z.string().optional(),
  icon: z.string().optional(),
});

const processExplainerSchema = z.object({
  title: z.string().optional(),
  steps: z.array(explainerStepSchema).min(2),
  stepByStep: z.boolean().optional().default(true),
  interactive: z.boolean().optional().default(false),
  animation: AnimationConfigSchema.optional(),
});

const ProcessExplainerStateSchema = z.object({
  revealedCount: z.number(),
  finished: z.boolean().optional(),
});

function ProcessExplainerComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  /** Controlled reveal count from the runtime step-sync machine. */
  syncedRevealedCount?: number;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, syncedRevealedCount } = props;
  const { t } = useTranslation();
  const parsed = processExplainerSchema.safeParse(rawConfig);
  const isSynced = syncedRevealedCount !== undefined;

  const [localRevealedCount, setLocalRevealedCount] = useState(() => {
    if (!parsed.success) return 0;
    const restored = ProcessExplainerStateSchema.safeParse(storedState);
    if (restored.success) return restored.data.revealedCount;
    return parsed.data.stepByStep ? 0 : parsed.data.steps.length;
  });
  const revealedCount = isSynced ? syncedRevealedCount : localRevealedCount;
  const [finished, setFinished] = useState(() => {
    const restored = ProcessExplainerStateSchema.safeParse(storedState);
    return restored.success ? (restored.data.finished ?? false) : false;
  });

  const isObserve = parsed.success && !parsed.data.interactive;
  const { handleAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.process-explainer',
  });

  const handleRevealNext = useCallback(() => {
    if (!parsed.success) return;
    const next = revealedCount + 1;
    if (!isSynced) {
      setLocalRevealedCount(next);
    }
    emitInteraction({
      type: 'widget.interaction',
      widgetId: 'core.process-explainer',
      action: 'reveal',
      step: next,
    });
  }, [parsed, revealedCount, emitInteraction, isSynced]);

  const handleFinish = useCallback(() => {
    if (!parsed.success || finished) return;
    setFinished(true);
    complete(100, { revealedCount, finished: true });
  }, [parsed, finished, revealedCount, complete]);

  if (!parsed.success) {
    return <WidgetError />;
  }

  const config = parsed.data;

  return (
    <div
      role="group"
      aria-label={config.title ?? t('widgets.process_explainer.title_default')}
      data-testid="process-explainer"
    >
      {config.title && <h3 className="text-on-surface mb-sm font-semibold">{config.title}</h3>}

      <ol
        role="list"
        className="space-y-md"
        aria-label={t('widgets.process_explainer.steps_label')}
      >
        {config.steps.map((step, index) => {
          const revealed = index < revealedCount;
          return (
            <li
              key={step.id}
              role="listitem"
              aria-label={t('widgets.process_explainer.step_label', {
                step: String(index + 1),
                title: step.title,
              })}
              className="border-outline-variant bg-surface-container-lowest gap-sm p-md flex items-start rounded-xl border"
            >
              <span
                className="text-on-primary bg-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div>
                <p className="text-on-surface font-semibold">{step.title}</p>
                {revealed && step.description && (
                  <p className="text-on-surface-variant mt-xs text-sm">{step.description}</p>
                )}
                {revealed && step.media && (
                  <img
                    src={step.media}
                    alt={step.title}
                    className="mt-sm max-h-40 rounded-lg"
                    loading="lazy"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {config.stepByStep && revealedCount < config.steps.length && (
        <div className="mt-md text-center">
          <Button variant="default" onClick={handleRevealNext} data-testid="reveal-next">
            {t('widgets.process_explainer.reveal_next')}
          </Button>
          <p className="text-on-surface/70 mt-xs text-sm">
            {t('widgets.process_explainer.step_of', {
              step: String(revealedCount + 1),
              total: String(config.steps.length),
            })}
          </p>
        </div>
      )}

      {config.stepByStep && revealedCount >= config.steps.length && !finished && (
        <div className="mt-md text-center">
          <p className="text-on-surface font-semibold" data-testid="explainer-complete">
            {t('widgets.process_explainer.all_steps')}
          </p>
          <Button
            variant="default"
            onClick={handleFinish}
            data-testid="finish-button"
            className="mt-sm"
          >
            {t('widgets.process_explainer.finish')}
          </Button>
        </div>
      )}

      {config.stepByStep && finished && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="explainer-finished"
          className="mt-md text-center"
        >
          <p className="text-on-surface font-semibold">
            {t('widgets.process_explainer.all_steps_viewed')}
          </p>
        </div>
      )}

      {isObserve && showAcknowledgeButton && (
        <div className="border-outline-variant p-md mt-md flex items-center justify-center border-t">
          <Button variant="default" onClick={handleAcknowledge} data-testid="observe-acknowledge">
            {t('widgets.process_explainer.mark_as_seen')}
          </Button>
        </div>
      )}
    </div>
  );
}

const ProcessExplainerWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Walk through a process one step at a time with clear explanations.',
    whatItDoes:
      'The Process Explainer widget presents a process as a numbered list of steps. In step-by-step mode, each step is revealed progressively, keeping focus on one idea at a time. Optional dotLottie or SVG animations can be attached via config.animation.',
    whenToUse: [
      'Teaching multi-stage processes step by step',
      'Explaining how a system works',
      'Guiding learners through a procedure',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.process-explainer"',
      'Define your steps — each needs an id and title',
      'Optionally add descriptions, icons, and media per step',
      'Optionally attach an animation config for dotLottie/SVG effects',
    ],
    configFields: [
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'An overall title for the explainer.',
      },
      {
        name: 'steps',
        type: 'array of objects',
        required: true,
        description:
          'Explainer steps. Each has id (string) and title (string), with optional description (string), icon (string), and media (string).',
      },
      {
        name: 'stepByStep',
        type: 'boolean',
        required: false,
        description: 'Reveal steps one at a time. Defaults to true.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows steps for observation only. Defaults to false.',
      },
      {
        name: 'animation',
        type: 'object',
        required: false,
        description:
          'Optional OAS animation config (backend lottie/svg, src, trigger, reducedMotion, effects).',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Water Cycle",\n  "widget": "core.process-explainer",\n  "config": {\n    "title": "The Water Cycle",\n    "stepByStep": true,\n    "interactive": true,\n    "steps": [\n      { "id": "evap", "title": "Evaporation", "description": "Sun heats water into vapor" },\n      { "id": "cond", "title": "Condensation", "description": "Vapor cools into clouds" },\n      { "id": "rain", "title": "Precipitation", "description": "Water falls as rain or snow" },\n      { "id": "collect", "title": "Collection", "description": "Water gathers in oceans and lakes" }\n    ]\n  }\n}',
    tips: [
      'Use 3-8 steps for clarity',
      'Keep step descriptions to 1-2 sentences',
      'Use stepByStep mode to reduce cognitive load',
    ],
    sidebarPosition: 14,
    relatedWidgets: [
      {
        id: 'science.process-diagram',
        name: 'Process Diagram',
        domain: 'science',
        slug: 'process-diagram',
      },
      {
        id: 'core.timeline',
        name: 'Timeline',
        domain: 'core',
        slug: 'timeline',
      },
    ],
  },
  id: 'core.process-explainer',
  name: 'Process Explainer',
  description: 'Step-by-step explanation of a process with progressive reveal',
  domain: 'core',
  version: '1.0.0',
  schema: processExplainerSchema,
  render: ProcessExplainerComponent,
  learningIntents: [LearningIntent.Observe, LearningIntent.Understand],
  capabilities: {
    supportsObserveMode: true,
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsHints: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
    supportsOffline: true,
    supportsAnimation: true,
    supportsLocalization: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    reducedMotion: true,
    ariaSupport: true,
    focusManagement: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackHints: true,
    trackInteractions: true,
  },
  reward: {
    completionXP: 15,
    confetti: true,
    positiveMessage: 'Process understood!',
    achievement: 'first-process-explainer',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 5,
    bloomsLevel: 'understand',
    cognitiveLoad: 'moderate',
    recommendedAge: [8, 18],
    readingLevel: 'grade-4',
    learningObjectives: [
      'Understand the sequence of steps in a process',
      'Identify relationships between process stages',
      'Explain each stage of a process in their own words',
    ],
    commonMisconceptions: [
      'Skipping intermediate steps in a process',
      'Confusing the order of stages',
    ],
    generationHints: [
      'Use 3-8 steps for clarity',
      'Keep each step description to 1-2 sentences',
      'Provide an icon or simple media asset per step when possible',
    ],
    authoringPrompt: 'Create a step-by-step explainer for a natural or computational process',
    exampleConfigs: [
      {
        title: 'Water Cycle',
        steps: [
          { id: 'evaporation', title: 'Evaporation', description: 'Sun heats water into vapor' },
          { id: 'condensation', title: 'Condensation', description: 'Vapor cools into clouds' },
          {
            id: 'precipitation',
            title: 'Precipitation',
            description: 'Water falls as rain or snow',
          },
          {
            id: 'collection',
            title: 'Collection',
            description: 'Water gathers in oceans and lakes',
          },
        ],
        stepByStep: true,
        interactive: true,
      },
    ],
  },
  icon: 'list-video',
  keywords: ['process', 'explainer', 'steps', 'step-by-step', 'sequence', 'how-it-works'],
  status: 'stable',
};

export { ProcessExplainerWidget as processExplainer, processExplainerSchema };
export default ProcessExplainerWidget;
