import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

const blankItemSchema = z.object({
  id: z.string(),
  position: z.number().int().min(0),
  correctAnswer: z.union([z.string(), z.number()]),
  options: z.array(z.union([z.string(), z.number()])).optional(),
});

const fillBlankSchema = z.object({
  description: z.string().optional(),
  template: z.string().optional(),
  blanks: z.array(blankItemSchema).optional(),
  mode: z.enum(['select', 'type']).optional().default('select'),
  hints: z.array(z.string()).optional(),
  hint: z.string().optional(),
  interactive: z.boolean().optional().default(false),
  prompt: z.string().optional(),
  statement: z.string().optional(),
  answers: z.array(z.union([z.string(), z.number()])).optional(),
});

export type FillBlankConfig = z.infer<typeof fillBlankSchema>;
type BlankItem = z.infer<typeof blankItemSchema>;
type ResolvedFillBlankConfig = FillBlankConfig &
  Required<Pick<FillBlankConfig, 'template' | 'blanks'>>;

function convertPipeline(
  statement: string,
  answers: (string | number)[],
): { template: string; blanks: BlankItem[] } {
  const blanks = answers.map((answer, idx) => ({
    id: `blank-${idx}`,
    position: idx,
    correctAnswer: answer,
  }));
  return { template: statement, blanks };
}

const FillBlankStateSchema = z.object({
  submitted: z.boolean(),
  userAnswers: z.record(z.string(), z.union([z.string(), z.number()])),
  hintIndex: z.number(),
});

function FillBlankComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = fillBlankSchema.safeParse(rawConfig);

  const parsedState = useMemo(() => {
    const result = FillBlankStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | number>>(
    parsedState?.userAnswers ?? {},
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(parsedState?.hintIndex ?? 0);

  let config: ResolvedFillBlankConfig | null = null;
  if (parsed.success) {
    const data = parsed.data;
    if (data.template && data.blanks && data.blanks.length > 0) {
      config = data as unknown as ResolvedFillBlankConfig;
    } else if (data.statement && data.answers && data.answers.length > 0) {
      const converted = convertPipeline(data.statement, data.answers);
      config = { ...data, ...converted } as unknown as ResolvedFillBlankConfig;
    }
  }

  const hasValidContent = config !== null;
  const isObserve = config?.interactive !== true;
  const sortedBlanks = config ? [...config.blanks].sort((a, b) => a.position - b.position) : [];
  const segments = config ? config.template.split('___') : [];

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && hasValidContent,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.fill-blank',
  });

  const handleSelect = useCallback(
    (blankId: string, value: string | number) => {
      if (submitted) return;
      setUserAnswers((prev) => ({ ...prev, [blankId]: value }));
      setOpenDropdownId(null);
    },
    [submitted],
  );

  const handleTypeChange = useCallback(
    (blankId: string, value: string) => {
      if (submitted) return;
      setUserAnswers((prev) => ({ ...prev, [blankId]: value }));
    },
    [submitted],
  );

  const handleSubmit = useCallback(() => {
    if (submitted || !config) return;

    const correct = sortedBlanks.every(
      (b) => String(userAnswers[b.id]) === String(b.correctAnswer),
    );
    const correctCount = sortedBlanks.filter(
      (b) => String(userAnswers[b.id]) === String(b.correctAnswer),
    ).length;
    const accuracy = correctCount / sortedBlanks.length;

    emitInteraction({
      type: 'widget.interaction',
      widgetId: 'core.fill-blank',
      action: 'submit',
      answers: userAnswers,
      correct,
      accuracy,
      correctCount,
      totalBlanks: sortedBlanks.length,
    });
    setSubmitted(true);
  }, [submitted, config, sortedBlanks, userAnswers, emitInteraction]);

  const handleContinue = useCallback(() => {
    const correctCount = sortedBlanks.filter(
      (b) => String(userAnswers[b.id]) === String(b.correctAnswer),
    ).length;
    const accuracy = correctCount / sortedBlanks.length;
    const score = Math.round(accuracy * 100);
    complete(score, { submitted: true, userAnswers, hintIndex });
  }, [sortedBlanks, userAnswers, hintIndex, complete]);

  const handleHintClick = useCallback(() => {
    if (config?.hints && hintIndex < config.hints.length - 1) {
      setHintIndex((i) => i + 1);
    }
  }, [config?.hints, hintIndex]);

  if (!hasValidContent) {
    return (
      <div
        role="alert"
        data-testid="widget-config-error"
        className="border-outline-variant bg-surface-container-lowest p-md rounded-xl border text-center"
      >
        <p className="text-on-surface font-semibold">This activity could not be loaded.</p>
      </div>
    );
  }

  const c = config!;
  const displayDescription = c.description || c.prompt;
  const allBlanksAnswered = sortedBlanks.every(
    (b) => userAnswers[b.id] !== undefined && userAnswers[b.id] !== '',
  );

  function renderBlankControl(blank: BlankItem, idx: number) {
    const userAnswer = userAnswers[blank.id];
    const isAnswerCorrect = submitted && String(userAnswer) === String(blank.correctAnswer);
    const borderColor = submitted
      ? isAnswerCorrect
        ? 'var(--oe-color-success, #16a34a)'
        : 'var(--oe-color-error, #dc2626)'
      : 'var(--oe-color-outline-variant, #d1d5db)';

    if (c.mode === 'type') {
      return (
        <input
          key={blank.id}
          type="text"
          data-testid={`blank-input-${blank.id}`}
          value={String(userAnswer ?? '')}
          onChange={(e) => handleTypeChange(blank.id, e.target.value)}
          disabled={submitted}
          aria-label={`Blank ${idx + 1}`}
          style={{
            display: 'inline-block',
            width: '6rem',
            padding: '0.125rem 0.25rem',
            border: `2px solid ${borderColor}`,
            borderRadius: '0.25rem',
            margin: '0 0.125rem',
            fontSize: 'inherit',
          }}
        />
      );
    }

    return (
      <span key={blank.id} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          data-testid={`blank-select-${blank.id}`}
          onClick={() => {
            if (submitted) return;
            setOpenDropdownId(openDropdownId === blank.id ? null : blank.id);
          }}
          disabled={submitted}
          aria-label={`Blank ${idx + 1}`}
          aria-expanded={openDropdownId === blank.id}
          role="combobox"
          style={{
            border: `2px solid ${borderColor}`,
            borderRadius: '0.25rem',
            padding: '0.125rem 0.5rem',
            margin: '0 0.125rem',
            fontSize: 'inherit',
            cursor: submitted ? 'default' : 'pointer',
            backgroundColor: 'var(--oe-color-surface, #ffffff)',
            minWidth: '4rem',
          }}
        >
          {userAnswer !== undefined ? String(userAnswer) : '?'}
        </button>
        {openDropdownId === blank.id && blank.options && blank.options.length > 0 && (
          <span
            data-testid={`dropdown-${blank.id}`}
            role="listbox"
            aria-label={`Options for blank ${idx + 1}`}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              backgroundColor: 'var(--oe-color-surface, #ffffff)',
              border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
              borderRadius: '0.25rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {blank.options.map((opt, optIdx) => (
              <button
                key={optIdx}
                data-testid={`option-${blank.id}-${optIdx}`}
                role="option"
                aria-selected={String(userAnswers[blank.id]) === String(opt)}
                onClick={() => handleSelect(blank.id, opt)}
                style={{
                  padding: '0.25rem 0.75rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 'inherit',
                  fontWeight: String(userAnswers[blank.id]) === String(opt) ? 'bold' : 'normal',
                }}
              >
                {String(opt)}
              </button>
            ))}
          </span>
        )}
      </span>
    );
  }

  if (isObserve) {
    return (
      <div data-testid="fill-blank" aria-label="Fill in the blank activity">
        <div role="status" aria-live="polite">
          {displayDescription && <p>{displayDescription}</p>}
          <p>
            {segments.map((segment, idx) => (
              <span key={idx}>
                {segment}
                {idx < sortedBlanks.length && (
                  <span
                    data-testid={`observe-blank-${sortedBlanks[idx]!.id}`}
                    style={{
                      display: 'inline-block',
                      padding: '0 0.25rem',
                      fontWeight: 'bold',
                      color: 'var(--oe-color-success, #16a34a)',
                      borderBottom: '2px solid var(--oe-color-success, #16a34a)',
                      margin: '0 0.125rem',
                    }}
                  >
                    {String(sortedBlanks[idx]!.correctAnswer)}
                  </span>
                )}
              </span>
            ))}
          </p>
        </div>
        {showAcknowledgeButton && (
          <div className="p-md border-outline-variant mt-md flex items-center justify-center border-t">
            <Button
              variant="default"
              onClick={handleObserveAcknowledge}
              data-testid="observe-acknowledge"
            >
              Mark as seen ✓
            </Button>
          </div>
        )}
        {!showAcknowledgeButton && (
          <div role="status" aria-live="assertive" data-testid="observe-complete">
            <p>Content acknowledged.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="fill-blank" aria-label="Fill in the blank activity">
      {displayDescription && <p>{displayDescription}</p>}

      <div role="group" aria-label="Fill in the blanks text">
        <p>
          {segments.map((segment, idx) => (
            <span key={idx}>
              {segment}
              {idx < sortedBlanks.length && renderBlankControl(sortedBlanks[idx]!, idx)}
            </span>
          ))}
        </p>
      </div>

      {!submitted && c.hints && c.hints.length > 0 && c.hints[hintIndex] && (
        <div
          role="status"
          aria-live="polite"
          style={{ marginTop: '0.5rem', color: 'var(--oe-color-on-surface-variant, #6b7280)' }}
        >
          <p>{c.hints[hintIndex]}</p>
          {hintIndex < c.hints.length - 1 && (
            <Button variant="ghost" size="sm" onClick={handleHintClick}>
              More help
            </Button>
          )}
        </div>
      )}

      {!submitted && c.hint && !c.hints && (
        <div
          role="status"
          aria-live="polite"
          style={{ marginTop: '0.5rem', color: 'var(--oe-color-on-surface-variant, #6b7280)' }}
        >
          <p>{c.hint}</p>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        {!submitted ? (
          <Button variant="default" onClick={handleSubmit} disabled={!allBlanksAnswered}>
            Submit
          </Button>
        ) : (
          <Button variant="default" onClick={handleContinue} data-testid="continue-button">
            Continue
          </Button>
        )}
      </div>

      {submitted && (
        <div role="status" aria-live="assertive" data-testid="feedback">
          {(() => {
            const correct = sortedBlanks.every(
              (b) => String(userAnswers[b.id]) === String(b.correctAnswer),
            );
            const correctCount = sortedBlanks.filter(
              (b) => String(userAnswers[b.id]) === String(b.correctAnswer),
            ).length;
            if (correct) {
              return <p>Correct! All blanks filled correctly.</p>;
            }
            return (
              <p>
                {correctCount} of {sortedBlanks.length} blanks correct.
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const FillBlankWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Complete sentences by filling in missing words or numbers.',
    whatItDoes:
      'The Fill in the Blank widget shows a sentence or paragraph with gaps. Students fill in the blanks by selecting from a dropdown of options or typing their answer. It supports both select mode (choose from options) and type mode (write the answer).',
    whenToUse: [
      'Vocabulary practice and word recall',
      'Cloze reading comprehension exercises',
      'Math equation completion',
      'Grammar exercises (verb tenses, prepositions)',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.fill-blank"',
      'Write your template text with ___ where blanks go',
      'Define each blank with an id, position, and correct answer',
      'Choose select mode (dropdown) or type mode (free text)',
    ],
    configFields: [
      {
        name: 'template',
        type: 'string',
        required: true,
        description: 'The text with ___ placeholders for blanks. e.g. "Water ___ from the ground."',
      },
      {
        name: 'blanks',
        type: 'array of objects',
        required: true,
        description:
          'Each blank definition. Has id (string), position (number), correctAnswer (string or number), and optional options array for select mode.',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description: '"select" for dropdown choices (default) or "type" for free text input.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions shown above the activity.',
      },
      {
        name: 'hints',
        type: 'array of strings',
        required: false,
        description: 'Progressive hints for students who need help.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows filled blanks. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Water Cycle Sentences",\n  "widget": "core.fill-blank",\n  "config": {\n    "description": "Complete the sentences about the water cycle.",\n    "template": "Water ___ from the ground into the air. It forms ___ in the sky. Then it falls back down as ___.",\n    "blanks": [\n      { "id": "b1", "position": 0, "correctAnswer": "evaporates", "options": ["evaporates", "freezes", "sinks"] },\n      { "id": "b2", "position": 1, "correctAnswer": "clouds", "options": ["rocks", "clouds", "waves"] },\n      { "id": "b3", "position": 2, "correctAnswer": "rain", "options": ["rain", "sand", "wind"] }\n    ],\n    "mode": "select",\n    "interactive": true\n  }\n}',
    tips: [
      'Place blanks on key vocabulary or concepts, not filler words',
      'Provide 3-5 options per blank in select mode',
      'Make sure the sentence reads correctly when the right answer is filled in',
      'Use type mode only for older students or simple single-word answers',
    ],
    sidebarPosition: 6,
    relatedWidgets: [
      {
        id: 'core.multiple-choice',
        name: 'Multiple Choice',
        domain: 'core',
        slug: 'multiple-choice',
      },
      {
        id: 'core.story-question',
        name: 'Story Question',
        domain: 'core',
        slug: 'story-question',
      },
    ],
  },
  id: 'core.fill-blank',
  name: 'Fill in the Blank',
  description: 'Complete sentences or equations by filling in missing parts',
  domain: 'core',
  version: '0.1.0',
  schema: fillBlankSchema,
  render: FillBlankComponent,
  learningIntents: [LearningIntent.Assess, LearningIntent.Practice],
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
    trackMistakes: true,
    trackHints: true,
    trackRetries: true,
  },
  reward: {
    completionXP: 10,
    confetti: true,
    positiveMessage: 'All blanks filled correctly!',
    achievement: 'first-blank',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 3,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    subjectTags: ['general', 'language', 'math'],
    authoringPrompt: 'Create a fill-in-the-blank exercise with 3-5 blanks',
    recommendedAge: [5, 16],
    readingLevel: 'grade-3',
    learningObjectives: [
      'Complete sentences with the correct word or phrase',
      'Apply knowledge of vocabulary or mathematical terms',
      'Demonstrate recall of key concepts through cloze tasks',
    ],
    commonMisconceptions: [
      'Choosing syntactically correct but semantically wrong answers',
      'Ignoring sentence context when selecting from options',
      'Entering the correct meaning in an incorrect grammatical form',
    ],
    generationHints: [
      'Place blanks on key concepts, not filler words',
      'Provide 3-5 options per blank in select mode',
      'Ensure the sentence is grammatically complete with the answer filled in',
    ],
    exampleConfigs: [
      { template: 'The capital of France is ___.', answers: ['Paris'] },
      { template: 'Water boils at ___ degrees Celsius.', answers: ['100'] },
    ],
  },
  icon: 'text-cursor-input',
  keywords: ['fill', 'blank', 'complete', 'gap'],
  status: 'stable',
};

export { FillBlankWidget as fillBlank, fillBlankSchema };
export default FillBlankWidget;
