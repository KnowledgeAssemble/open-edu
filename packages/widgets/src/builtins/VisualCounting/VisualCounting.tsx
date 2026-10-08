import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

export const visualCountingSchema = z.object({
  description: z.string().optional(),
  items: z.array(z.string()).optional(),
  count: z.number().optional(),
  text: z.string().optional(),
  hint: z.string().optional(),
  hints: z.array(z.string()).optional(),
  left: z.union([z.array(z.string()), z.number()]).optional(),
  right: z.union([z.array(z.string()), z.number()]).optional(),
  sum: z.number().optional(),
  emoji: z.string().optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  interactive: z.boolean().optional().default(false),
});

export type VisualCountingConfig = z.infer<typeof visualCountingSchema>;

const SIZE_MAP = { sm: '2rem', md: '3rem', lg: '4rem' } as const;

function isAdditionMode(c: VisualCountingConfig): boolean {
  return c.left !== undefined || c.right !== undefined;
}

function getEmojiLabel(emoji: string, position: number, total: number): string {
  return `${emoji} ${position} of ${total}`;
}

const VisualCountingStateSchema = z.object({
  submitted: z.boolean(),
  selectedCount: z.number().nullable(),
});

function VisualCountingComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = visualCountingSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : ({} as VisualCountingConfig);
  const isAddition = parsed.success && isAdditionMode(content);
  const hasValidContent =
    parsed.success &&
    (isAddition
      ? content.left !== undefined || content.right !== undefined
      : content.items !== undefined || content.count !== undefined);

  const parsedState = useMemo(() => {
    const result = VisualCountingStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [hintIndex, setHintIndex] = useState(0);
  const [selectedCount, setSelectedCount] = useState<number | null>(
    parsedState?.selectedCount ?? null,
  );

  const displayItems = useMemo(() => {
    if (content.items && content.items.length > 0) return content.items;
    if (content.count && content.emoji) {
      return Array.from({ length: content.count }, () => content.emoji!);
    }
    return [];
  }, [content.items, content.count, content.emoji]);

  const leftItems = Array.isArray(content.left) ? content.left : [];
  const rightItems = Array.isArray(content.right) ? content.right : [];
  const leftCount = typeof content.left === 'number' ? content.left : leftItems.length;
  const rightCount = typeof content.right === 'number' ? content.right : rightItems.length;
  const expected = isAddition ? (content.sum ?? leftCount + rightCount) : (content.count ?? 0);
  const emojiSize = SIZE_MAP[content.size ?? 'md'];
  const labelName = content.text ?? 'item';
  const isObserve = !content.interactive;

  const numberButtons = useMemo(() => {
    const nums: number[] = [];
    for (let i = Math.max(1, expected - 3); i <= expected + 3; i++) {
      nums.push(i);
    }
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = nums[i]!;
      nums[i] = nums[j]!;
      nums[j] = tmp;
    }
    return nums;
  }, [expected]);

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.visual-counting',
  });

  const handleNumberClick = useCallback(
    (num: number) => {
      if (submitted) return;
      setSelectedCount(num);
    },
    [submitted],
  );

  const handleSubmit = useCallback(() => {
    if (selectedCount === null || submitted) return;
    const correct = selectedCount === expected;
    const accuracy =
      expected > 0 ? Math.max(0, 1 - Math.abs(selectedCount - expected) / expected) : 0;
    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      count: selectedCount,
      correct,
      accuracy,
      widgetId: 'core.visual-counting',
    });
    setSubmitted(true);
  }, [selectedCount, submitted, expected, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (selectedCount === null) return;
    const accuracy =
      expected > 0 ? Math.max(0, 1 - Math.abs(selectedCount - expected) / expected) : 0;
    complete(accuracy * 100, { submitted: true, selectedCount });
  }, [selectedCount, expected, complete]);

  const handleHintClick = useCallback(() => {
    if (content.hints && hintIndex < content.hints.length - 1) {
      setHintIndex((i) => i + 1);
    }
  }, [content.hints, hintIndex]);

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

  const renderItems = (items: string[], displayCount?: number) => {
    const emoji = content.emoji ?? items[0] ?? '';
    const count = displayCount ?? items.length;
    return (
      <ul
        style={{
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(3rem, 1fr))',
          gap: '0.5rem',
          padding: 0,
          margin: 0,
        }}
        role="list"
        aria-label={labelName}
      >
        {Array.from({ length: count }, (_, idx) => (
          <li key={idx} role="listitem" aria-label={getEmojiLabel(emoji, idx + 1, count)}>
            <span role="img" aria-hidden="true" style={{ fontSize: emojiSize }}>
              {emoji}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const renderAddition = (showTotal: boolean) => (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
      role="group"
      aria-label="Addition counting"
    >
      {leftItems.length > 0 && renderItems(leftItems)}
      {leftCount > 0 && leftItems.length === 0 && (
        <span style={{ fontSize: emojiSize }}>{leftCount} items</span>
      )}
      <span style={{ fontSize: emojiSize }}>+</span>
      {rightItems.length > 0 && renderItems(rightItems)}
      {rightCount > 0 && rightItems.length === 0 && (
        <span style={{ fontSize: emojiSize }}>{rightCount} items</span>
      )}
      {showTotal && (
        <>
          <span style={{ fontSize: emojiSize }}>=</span>
          <span style={{ fontSize: emojiSize, fontWeight: 'bold' }}>{expected}</span>
        </>
      )}
    </div>
  );

  if (isObserve) {
    return (
      <div data-testid="visual-counting" aria-label="Visual counting activity">
        <div role="status" aria-live="polite">
          {content.description && <p>{content.description}</p>}
          {isAddition ? (
            renderAddition(true)
          ) : (
            <>
              {displayItems.length > 0 && renderItems(displayItems, content.count)}
              {content.text && (
                <p>
                  There are {content.count} {content.text}.
                </p>
              )}
            </>
          )}
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
    <div data-testid="visual-counting" aria-label="Visual counting activity">
      {content.description && <p>{content.description}</p>}
      {isAddition
        ? renderAddition(false)
        : displayItems.length > 0 && renderItems(displayItems, content.count)}
      {displayItems.length === 0 && !isAddition && <p role="status">No items to count.</p>}

      {!submitted && (
        <div role="group" aria-label="Count selection" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {numberButtons.map((num) => (
              <Button
                key={num}
                variant={selectedCount === num ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleNumberClick(num)}
                aria-pressed={selectedCount === num}
                aria-label={`Count ${num}`}
              >
                {num}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!submitted && content.hints && content.hints.length > 0 && content.hints[hintIndex] && (
        <div
          role="status"
          aria-live="polite"
          style={{ marginTop: '0.5rem', color: 'var(--oe-color-on-surface-variant, #6b7280)' }}
        >
          <p>{content.hints[hintIndex]}</p>
          {hintIndex < content.hints.length - 1 && (
            <Button variant="ghost" size="sm" onClick={handleHintClick}>
              More help
            </Button>
          )}
        </div>
      )}

      {!submitted && content.hint && !content.hints && (
        <div
          role="status"
          aria-live="polite"
          style={{ marginTop: '0.5rem', color: 'var(--oe-color-on-surface-variant, #6b7280)' }}
        >
          <p>{content.hint}</p>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        {!submitted ? (
          <Button variant="default" onClick={handleSubmit} disabled={selectedCount === null}>
            Submit
          </Button>
        ) : (
          <Button variant="default" onClick={handleContinue} data-testid="continue-button">
            Continue
          </Button>
        )}
      </div>

      {selectedCount !== null && !submitted && (
        <div role="status" aria-live="polite" aria-atomic="true">
          <p>Selected: {selectedCount}</p>
        </div>
      )}

      {submitted && (
        <div role="status" aria-live="assertive" data-testid="feedback" className="mt-sm">
          {selectedCount === expected ? (
            <p className="text-success font-semibold">Correct! The answer is {expected}.</p>
          ) : (
            <p className="text-error font-semibold">
              Not quite. The correct answer is {expected}. You selected {selectedCount}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const VisualCountingWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Display visual objects for students to count and identify quantities.',
    whatItDoes:
      'The Visual Counting widget shows a grid of visual objects (like emoji) and asks students to count them. Students type or select the correct number. It helps early learners build number sense through visual grouping.',
    whenToUse: [
      'Teaching counting and quantities to early learners',
      'Building number recognition skills',
      'Visual math practice for pre-readers',
      'Reinforcing one-to-one correspondence',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.visual-counting"',
      'Choose an emoji or character for the items',
      'Set the count — how many items to show',
      'Add a description like "Count the stars!"',
    ],
    configFields: [
      {
        name: 'items',
        type: 'array of strings',
        required: true,
        description:
          'Emoji or characters to display as countable items. Usually a single item repeated.',
      },
      {
        name: 'count',
        type: 'number',
        required: true,
        description: 'How many items to show (1-12 recommended).',
      },
      {
        name: 'text',
        type: 'string',
        required: false,
        description: 'Text shown after the count, e.g. "stars" displays as "5 stars".',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions shown above the counting grid.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows the correct count. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Count the Stars",\n  "widget": "core.visual-counting",\n  "config": {\n    "description": "How many stars do you see?",\n    "items": ["⭐"],\n    "count": 5,\n    "text": "stars",\n    "interactive": true\n  }\n}',
    tips: [
      'Use visually distinct emoji that are easy to count',
      'Limit counts to 1-12 for young learners',
      'Space items clearly in the grid — avoid crowding',
      'Start with small counts and gradually increase',
    ],
    sidebarPosition: 3,
    relatedWidgets: [
      {
        id: 'math.number-line',
        name: 'Number Line',
        domain: 'math',
        slug: 'number-line',
      },
      {
        id: 'math.grid-area',
        name: 'Grid Area',
        domain: 'math',
        slug: 'grid-area',
      },
    ],
  },
  id: 'core.visual-counting',
  name: 'Visual Counting',
  description: 'Count visual objects and identify quantities',
  domain: 'core',
  version: '0.1.0',
  schema: visualCountingSchema,
  render: VisualCountingComponent,
  learningIntents: [LearningIntent.Observe, LearningIntent.Practice],
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
    achievement: 'first-count',
    positiveMessage: 'Counting correct!',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 2,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    subjectTags: ['math', 'counting'],
    authoringPrompt: 'Create a visual counting exercise with clear images',
    recommendedAge: [3, 7],
    readingLevel: 'pre-reader',
    learningObjectives: [
      'Count objects accurately up to 12',
      'Recognize quantities visually without counting',
      'Add two groups of objects together',
    ],
    commonMisconceptions: [
      'Double-counting an object at the boundary of groups',
      'Confusing 6 and 9 when items are rotated',
      'Losing track when items are scattered irregularly',
    ],
    generationHints: [
      'Use visually distinct emoji items',
      'Limit count to 1-12 for clarity',
      'Space items clearly in the grid layout',
    ],
    exampleConfigs: [
      { items: ['🍎', '🍎', '🍎'], answer: 3 },
      { items: ['🌟', '🌟', '🌟', '🌟', '🌟'], answer: 5 },
      { left: ['🐱', '🐱'], right: ['🐱', '🐱', '🐱'], answer: 5 },
    ],
  },
  icon: 'hash',
  keywords: ['count', 'visual', 'number', 'quantity'],
  status: 'stable',
};

export { VisualCountingWidget as visualCounting };
export default VisualCountingWidget;
