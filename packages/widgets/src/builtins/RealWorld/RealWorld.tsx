import { useState, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

type SelfAssessment = 'well' | 'learning' | 'practice' | null;

const realWorldSchema = z.object({
  scenario: z.string().min(1),
  taskDescription: z.string().optional(),
  prompt: z.string().optional(),
  expectedAnswer: z.string().optional(),
  visualExample: z.string().optional(),
  hint: z.string().optional(),
  interactive: z.boolean().optional().default(false),
});

const RealWorldStateSchema = z.object({
  submitted: z.boolean(),
  response: z.string(),
  selfAssessment: z.enum(['well', 'learning', 'practice']).nullable(),
});

function RealWorldComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;

  const parsed = realWorldSchema.safeParse(rawConfig);

  const parsedState = useMemo(() => {
    const result = RealWorldStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [response, setResponse] = useState(parsedState?.response ?? '');
  const [showSelfAssess, setShowSelfAssess] = useState(parsedState?.submitted ?? false);
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment>(
    parsedState?.selfAssessment ?? null,
  );

  const content = parsed.success ? parsed.data : null;
  const isInteractive = content?.interactive ?? false;

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: parsed.success && !isInteractive,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.real-world',
  });

  const handleComplete = () => {
    if (!content) return;
    setShowSelfAssess(true);
  };

  const handleSelfAssess = (assessment: SelfAssessment) => {
    if (!content) return;
    setSelfAssessment(assessment);
    const scoreMap: Record<string, number> = { well: 100, learning: 50, practice: 0 };
    const score = scoreMap[assessment ?? 'learning'] ?? 50;

    const interactionData: Record<string, unknown> = {
      type: 'widget.interaction',
      widgetId: 'core.real-world',
      action: 'submit',
      response,
      selfAssessment: assessment,
      score,
    };

    if (content.expectedAnswer && response) {
      interactionData.expectedAnswer = content.expectedAnswer;
      interactionData.responseExactMatch =
        response.trim().toLowerCase() === content.expectedAnswer.trim().toLowerCase();
      interactionData.responsePartialMatch =
        content.expectedAnswer.trim().toLowerCase().includes(response.trim().toLowerCase()) ||
        response.trim().toLowerCase().includes(content.expectedAnswer.trim().toLowerCase());
    }

    emitInteraction(interactionData);
    complete(score, { submitted: true, response, selfAssessment: assessment });
    setSubmitted(true);
  };

  if (!parsed.success) {
    return (
      <div
        role="alert"
        data-testid="widget-config-error"
        className="border-error bg-error/10 p-md text-on-surface rounded-lg border"
      >
        <p className="text-error font-semibold">Configuration Error</p>
        <p className="mt-xs text-on-surface/70 text-sm">
          Invalid real world configuration. Please check the scenario data.
        </p>
      </div>
    );
  }

  const { scenario, taskDescription, prompt, visualExample, hint } = parsed.data;

  if (!isInteractive) {
    return (
      <div data-testid="real-world-observe">
        <article aria-label="Real World Scenario">
          {visualExample && <span aria-hidden="true">{visualExample} </span>}
          <p>{scenario}</p>
        </article>
        {taskDescription && <p data-testid="task-description">{taskDescription}</p>}
        {prompt && (
          <p data-testid="prompt" aria-label="Prompt">
            {prompt}
          </p>
        )}
        {showAcknowledgeButton && (
          <Button
            variant="default"
            onClick={handleObserveAcknowledge}
            data-testid="acknowledge-button"
          >
            Acknowledge
          </Button>
        )}
        {!showAcknowledgeButton && (
          <div role="status" aria-live="assertive" data-testid="observe-complete">
            <p>Content acknowledged.</p>
          </div>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div data-testid="real-world">
        <article aria-label="Real World Scenario">
          {visualExample && <span aria-hidden="true">{visualExample} </span>}
          <p>{scenario}</p>
        </article>
        {taskDescription && <p>{taskDescription}</p>}
        {prompt && <p>{prompt}</p>}
        <div role="status" aria-live="assertive" data-testid="real-world-result">
          <div className="bg-surface-container-lowest border-outline-variant p-md mt-md rounded-xl border">
            <h3 className="mb-sm font-semibold">Your response:</h3>
            <p className="text-on-surface whitespace-pre-wrap">{response}</p>
          </div>
          {selfAssessment && (
            <p className="mt-sm text-on-surface/70">
              Self-assessment:{' '}
              {selfAssessment === 'well'
                ? 'I understand this well'
                : selfAssessment === 'learning'
                  ? "I'm still learning"
                  : 'I need more practice'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="real-world">
      <article aria-label="Real World Scenario">
        {visualExample && <span aria-hidden="true">{visualExample} </span>}
        <p>{scenario}</p>
      </article>
      {taskDescription && <p data-testid="task-description">{taskDescription}</p>}
      {prompt && (
        <p data-testid="prompt" aria-label="Prompt">
          {prompt}
        </p>
      )}
      {hint && (
        <p id="real-world-hint" data-testid="hint" aria-label="Hint">
          {hint}
        </p>
      )}
      <div>
        <textarea
          id="real-world-response"
          data-testid="response-textarea"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={4}
          aria-label={prompt ?? 'Your response'}
          aria-describedby={hint ? 'real-world-hint' : undefined}
        />
      </div>
      {!showSelfAssess && (
        <Button variant="default" onClick={handleComplete} data-testid="complete-task-button">
          I Completed This Task
        </Button>
      )}
      {showSelfAssess && (
        <div
          role="group"
          aria-label="Self-assessment"
          data-testid="self-assessment-container"
          className="mt-md"
        >
          <p className="mb-sm font-semibold">Reflect on your work:</p>
          <div className="gap-sm flex flex-col">
            <Button
              variant="default"
              onClick={() => handleSelfAssess('well')}
              data-testid="self-assess-well"
            >
              I understand this well
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSelfAssess('learning')}
              data-testid="self-assess-learning"
            >
              I'm still learning
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSelfAssess('practice')}
              data-testid="self-assess-practice"
            >
              I need more practice
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const RealWorldWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Apply learning to real-world scenarios with open-ended reflection.',
    whatItDoes:
      'The Real World widget presents a practical scenario and asks students to apply what they learned. Students write their answer and explanation in a text area. It is designed for open-ended thinking rather than right/wrong answers.',
    whenToUse: [
      'Applying math concepts to everyday situations',
      'Connecting science to real-world examples',
      'Reflective writing after a lesson',
      'Problem-solving with real-life context',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.real-world"',
      'Write a relatable, age-appropriate scenario',
      'Add a task description — what should the student do?',
      'Optionally provide an expected answer for comparison',
    ],
    configFields: [
      {
        name: 'scenario',
        type: 'string',
        required: true,
        description: 'A real-world situation the student should think about.',
      },
      {
        name: 'taskDescription',
        type: 'string',
        required: false,
        description: 'Specific instructions for what the student should do or answer.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Additional context or instructions.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows the scenario in read-only mode. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Baking Cookies",\n  "widget": "core.real-world",\n  "config": {\n    "scenario": "You are helping to bake cookies for a school event. The recipe calls for 2 cups of flour, 1 cup of sugar, and 1 teaspoon of vanilla. You need to triple the recipe to make enough for everyone.",\n    "taskDescription": "How many cups of flour will you need in total? Write your answer and explain your thinking.",\n    "interactive": true\n  }\n}',
    tips: [
      'Use relatable, age-appropriate everyday scenarios',
      'Keep the scenario brief and concrete',
      'Encourage students to explain their reasoning, not just give an answer',
      'This widget works well at the end of a lesson for application',
    ],
    sidebarPosition: 8,
    relatedWidgets: [
      {
        id: 'core.story-question',
        name: 'Story Question',
        domain: 'core',
        slug: 'story-question',
      },
    ],
  },
  id: 'core.real-world',
  name: 'Real World',
  description: 'Apply learning to real-world scenarios and contexts',
  domain: 'core',
  version: '0.1.0',
  schema: realWorldSchema,
  render: RealWorldComponent,
  learningIntents: [LearningIntent.Apply, LearningIntent.Explore],
  capabilities: {
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsHints: true,
    supportsRetry: true,
    supportsScoring: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
    supportsOffline: true,
    supportsObserveMode: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    tts: true,
    focusManagement: true,
    ariaSupport: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackSuccessRate: true,
    trackHints: true,
    trackRetries: true,
  },
  reward: {
    completionXP: 10,
    confetti: true,
    achievement: 'first-scenario',
    positiveMessage: 'Scenario completed!',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 5,
    bloomsLevel: 'apply',
    cognitiveLoad: 'moderate',
    subjectTags: ['general'],
    authoringPrompt: 'Create a real-world application scenario',
    recommendedAge: [8, 18],
    readingLevel: 'grade-4',
    learningObjectives: [
      'Apply learned concepts to a real-world scenario',
      'Explain reasoning using everyday context',
      'Self-assess understanding through open-ended reflection',
    ],
    commonMisconceptions: [
      'Treating it as a right/wrong quiz instead of a reflection exercise',
      'Providing generic answers instead of scenario-specific responses',
    ],
    generationHints: [
      'Use relatable, age-appropriate everyday scenarios',
      'Include an optional expectedAnswer for comparison',
      'Keep the scenario brief and concrete',
    ],
    exampleConfigs: [
      {
        scenario: 'You have ₹50 and buy 3 notebooks at ₹12 each.',
        prompt: 'How much change do you get?',
      },
      { scenario: 'A plant grows 2 cm every week.', prompt: 'How tall will it be after 5 weeks?' },
    ],
  },
  icon: 'globe',
  keywords: ['real', 'world', 'application', 'scenario'],
  status: 'stable',
};

export { RealWorldWidget as realWorld, realWorldSchema };
export default RealWorldWidget;
