import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

const CRORE_COLUMNS = ['Cr', 'TL', 'L', 'TTh', 'Th', 'H', 'T', 'O'] as const;
const LAKH_COLUMNS = ['L', 'TTh', 'Th', 'H', 'T', 'O'] as const;

const LABEL_MAP: Record<string, string> = {
  Cr: 'Crore',
  TL: 'Ten L.',
  L: 'Lakh',
  TTh: 'Ten Th.',
  Th: 'Thousand',
  H: 'Hundred',
  T: 'Tens',
  O: 'Ones',
};

export const placeValueChartSchema = z.object({
  maxPlaces: z.enum(['lakh', 'crore']),
  digits: z.array(z.number().nullable()).optional(),
  targetNumber: z.number().optional(),
  interactive: z.boolean().optional().default(true),
  draggableDigits: z.array(z.number()).optional(),
  showLabels: z.boolean().optional().default(true),
  description: z.string().optional(),
});

function computeNumber(placed: (number | null)[]): number {
  let num = 0;
  let power = 0;
  for (let i = placed.length - 1; i >= 0; i--) {
    const d = placed[i];
    if (d !== null && d !== undefined) {
      num += d * Math.pow(10, power);
    }
    power++;
  }
  return num;
}

function rightAlignDigits(
  digits: (number | null | undefined)[],
  colCount: number,
): (number | null)[] {
  const result: (number | null)[] = new Array(colCount).fill(null);
  const offset = colCount - digits.length;
  for (let i = 0; i < digits.length; i++) {
    const idx = offset + i;
    if (idx >= 0) {
      const d = digits[i];
      result[idx] = d !== undefined ? d : null;
    }
  }
  return result;
}

const PlaceValueChartStateSchema = z.object({
  submitted: z.boolean(),
  placedDigits: z.array(z.number().nullable()),
});

function PlaceValueChartComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = useMemo(() => placeValueChartSchema.safeParse(rawConfig), [rawConfig]);
  const content = parsed.success ? parsed.data : null;

  const parsedState = useMemo(() => {
    const result = PlaceValueChartStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [selectedDigit, setSelectedDigit] = useState<number | null>(null);

  const columns = content?.maxPlaces === 'crore' ? CRORE_COLUMNS : LAKH_COLUMNS;

  const colCount = columns.length;

  const [placedDigits, setPlacedDigits] = useState<(number | null)[]>(() => {
    if (parsedState?.placedDigits) return parsedState.placedDigits;
    if (!content?.digits) return new Array(colCount).fill(null);
    return rightAlignDigits(content.digits, colCount);
  });

  const isObserve = content && !content.interactive;
  const bankDigits = useMemo(() => {
    if (content?.draggableDigits) return content.draggableDigits;
    if (content?.targetNumber !== undefined) {
      const digits = new Set<number>();
      let num = content.targetNumber;
      if (num === 0) return [0];
      while (num > 0) {
        digits.add(num % 10);
        num = Math.floor(num / 10);
      }
      return Array.from(digits).sort((a, b) => a - b);
    }
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }, [content?.draggableDigits, content?.targetNumber]);

  const {
    handleAcknowledge: handleObserveAcknowledge,
    showAcknowledgeButton,
    acknowledged,
  } = useObserveMode({
    isObserve: !!isObserve && !!content,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'math.place-value-chart',
  });

  const handleSlotClick = useCallback(
    (index: number) => {
      if (submitted || isObserve) return;
      setPlacedDigits((prev) => {
        const next = [...prev];
        const current = next[index];
        if (current !== null && selectedDigit !== null) {
          next[index] = selectedDigit;
          setSelectedDigit(null);
          return next;
        }
        if (current !== null && selectedDigit === null) {
          next[index] = null;
          return next;
        }
        if (current === null && selectedDigit !== null) {
          next[index] = selectedDigit;
          setSelectedDigit(null);
          return next;
        }
        return prev;
      });
    },
    [submitted, isObserve, selectedDigit],
  );

  const handleDigitSelect = useCallback(
    (digit: number) => {
      if (submitted || isObserve) return;
      setSelectedDigit((prev) => (prev === digit ? null : digit));
    },
    [submitted, isObserve],
  );

  const handleSubmit = useCallback(() => {
    if (!content || submitted) return;
    const placedNum = computeNumber(placedDigits);
    const expected = content.targetNumber;
    let correct = false;
    if (expected !== undefined) {
      correct = placedNum === expected;
    } else {
      correct = placedDigits.some((d) => d !== null);
    }
    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      placedDigits,
      expected,
      placedNumber: placedNum,
      correct,
      widgetId: 'math.place-value-chart',
    });
    setSubmitted(true);
  }, [content, submitted, placedDigits, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (!content) return;
    const placedNum = computeNumber(placedDigits);
    const expected = content.targetNumber;
    let correct = false;
    if (expected !== undefined) {
      correct = placedNum === expected;
    } else {
      correct = placedDigits.some((d) => d !== null);
    }
    const score = correct ? 100 : 0;
    complete(score, { submitted: true, placedDigits });
  }, [content, placedDigits, complete]);

  if (!parsed.success || !content) {
    return (
      <div
        role="alert"
        data-testid="widget-config-error"
        className="border-outline-variant bg-surface-container-lowest p-md rounded-xl border text-center"
      >
        <p className="text-on-surface font-semibold">
          Invalid widget configuration. Please check your settings.
        </p>
      </div>
    );
  }

  const isAllNull = placedDigits.every((d) => d === null);
  const hasTarget = content.targetNumber !== undefined;

  const displayDigits = isObserve
    ? content.digits
      ? rightAlignDigits(content.digits, colCount)
      : new Array(colCount).fill(null)
    : placedDigits;

  return (
    <div data-testid="place-value-chart" aria-label="Place value chart">
      {content.description && <p>{content.description}</p>}

      <div
        role="group"
        aria-label="Place value columns"
        style={{
          display: 'inline-flex',
          gap: '4px',
          padding: '12px',
          border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
          borderRadius: '8px',
          background: 'var(--oe-color-surface-container, #f9fafb)',
        }}
      >
        {columns.map((col, i) => (
          <div
            key={col}
            data-testid={`column-${col}`}
            role="columnheader"
            aria-label={`${LABEL_MAP[col]} column`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              width: '64px',
            }}
          >
            {content.showLabels && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--oe-color-on-surface-variant, #6b7280)',
                  letterSpacing: '0.5px',
                }}
              >
                {LABEL_MAP[col]}
              </div>
            )}
            <div
              data-testid={`slot-${col}`}
              role={!isObserve ? 'button' : undefined}
              tabIndex={!isObserve ? 0 : undefined}
              aria-label={
                displayDigits[i] !== null
                  ? `${LABEL_MAP[col]}: ${displayDigits[i]}${!isObserve ? '. Click to remove' : ''}`
                  : `${LABEL_MAP[col]} slot empty${!isObserve ? '. Click to place a digit' : ''}`
              }
              aria-live={!isObserve ? 'polite' : undefined}
              onClick={() => handleSlotClick(i)}
              onKeyDown={(e) => {
                if (!isObserve && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleSlotClick(i);
                }
              }}
              style={{
                width: '48px',
                height: '56px',
                border:
                  displayDigits[i] !== null
                    ? '2px solid var(--oe-color-primary, #3b82f6)'
                    : selectedDigit !== null
                      ? '2px dashed var(--oe-color-primary-container, #93c5fd)'
                      : '2px solid var(--oe-color-outline-variant, #d1d5db)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                fontFamily: 'monospace',
                background:
                  displayDigits[i] !== null
                    ? 'var(--oe-color-primary-container, #eff6ff)'
                    : 'var(--oe-color-surface, #ffffff)',
                cursor: isObserve ? 'default' : 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              {displayDigits[i] !== null ? displayDigits[i] : ''}
            </div>
          </div>
        ))}
      </div>

      {showAcknowledgeButton && (
        <div role="status" aria-live="assertive" data-testid="observe-acknowledge-container">
          <Button
            variant="default"
            onClick={handleObserveAcknowledge}
            data-testid="observe-acknowledge"
          >
            Acknowledge
          </Button>
        </div>
      )}

      {!showAcknowledgeButton && acknowledged && (
        <div role="status" aria-live="assertive" data-testid="observe-complete">
          <p>Content acknowledged.</p>
        </div>
      )}

      {!isObserve && (
        <>
          <div
            role="group"
            aria-label="Digit bank"
            data-testid="digit-bank"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '12px',
              padding: '10px',
              border: '1px dashed var(--oe-color-outline-variant, #d1d5db)',
              borderRadius: '8px',
              background: 'var(--oe-color-surface-container, #f9fafb)',
              maxWidth: `${colCount * 60 + (colCount - 1) * 4 + 24}px`,
            }}
          >
            {bankDigits.map((digit) => {
              const isSelected = selectedDigit === digit;
              return (
                <div
                  key={digit}
                  data-testid={`bank-digit-${digit}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Digit ${digit}${isSelected ? ', selected' : ''}`}
                  aria-selected={isSelected}
                  onClick={() => handleDigitSelect(digit)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDigitSelect(digit);
                    }
                  }}
                  style={{
                    width: '40px',
                    height: '44px',
                    border: isSelected
                      ? '2px solid var(--oe-color-primary, #3b82f6)'
                      : '1px solid var(--oe-color-outline-variant, #d1d5db)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    background: isSelected
                      ? 'var(--oe-color-primary-container, #eff6ff)'
                      : 'var(--oe-color-surface, #ffffff)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {digit}
                </div>
              );
            })}
          </div>

          <div role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: '8px' }}>
            {selectedDigit !== null && (
              <p data-testid="selected-digit-status">
                Selected: {selectedDigit} → click a column to place it
              </p>
            )}
            {!isAllNull && selectedDigit === null && (
              <p data-testid="placement-status">Click a placed digit to remove it.</p>
            )}
          </div>

          <div style={{ marginTop: '12px' }}>
            {!submitted ? (
              <Button variant="default" onClick={handleSubmit} disabled={isAllNull}>
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
              {hasTarget ? (
                computeNumber(placedDigits) === content.targetNumber ? (
                  <p>Correct! The number matches.</p>
                ) : (
                  <p>
                    The number formed is {computeNumber(placedDigits)}
                    {content.targetNumber !== undefined
                      ? `, expected ${content.targetNumber}.`
                      : '.'}
                  </p>
                )
              ) : (
                <p>Number formed: {computeNumber(placedDigits)}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const PlaceValueChartWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Build and explore numbers using an interactive place value chart.',
    whatItDoes:
      'The Place Value Chart widget helps students understand how digits represent different values based on their position. Students drag digits into columns (ones, tens, hundreds, etc.) to build numbers. It supports the Indian number system with lakh and crore places.',
    whenToUse: [
      'Teaching place value concepts',
      'Building multi-digit numbers',
      'Understanding expanded form',
      'Comparing numbers using place value',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "math.place-value-chart"',
      'Set the target number students should build',
      'Provide the digits for students to drag',
      'Choose the max place value level',
    ],
    configFields: [
      {
        name: 'targetNumber',
        type: 'number',
        required: true,
        description: 'The number students should build on the chart.',
      },
      {
        name: 'draggableDigits',
        type: 'array of numbers',
        required: true,
        description: 'The digits students can use, e.g. [5, 4, 3] for the number 543.',
      },
      {
        name: 'maxPlaces',
        type: 'string',
        required: false,
        description: 'Highest place value shown, e.g. "hundred", "thousand", "lakh".',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions for the student.',
      },
      {
        name: 'showLabels',
        type: 'boolean',
        required: false,
        description: 'Show place value labels. Defaults to true.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows the completed chart. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Place Value Practice",\n  "widget": "math.place-value-chart",\n  "config": {\n    "description": "Build the number 543 by placing digits in the correct columns.",\n    "maxPlaces": "hundred",\n    "targetNumber": 543,\n    "draggableDigits": [5, 4, 3],\n    "showLabels": true,\n    "interactive": true\n  }\n}',
    tips: [
      'Use numbers up to 999 for early learners',
      'Include visual separators between columns for clarity',
      'Explain that zero acts as a placeholder',
      'Start with 2-digit numbers before introducing larger ones',
    ],
    sidebarPosition: 2,
    relatedWidgets: [
      {
        id: 'math.number-line',
        name: 'Number Line',
        domain: 'math',
        slug: 'number-line',
      },
    ],
  },
  id: 'math.place-value-chart',
  name: 'Place Value Chart',
  description: 'Understand place value with interactive chart manipulation',
  domain: 'math',
  version: '1.0.0',
  schema: placeValueChartSchema,
  render: PlaceValueChartComponent,
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
    achievement: 'first-place-value',
    positiveMessage: 'Place value identified!',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 3,
    bloomsLevel: 'understand',
    cognitiveLoad: 'low',
    subjectTags: ['math', 'place-value'],
    authoringPrompt: 'Create a place value chart exercise for multi-digit numbers',
    recommendedAge: [6, 10],
    readingLevel: 'grade-2',
    learningObjectives: [
      'Identify the position and value of each digit in a multi-digit number',
      'Understand how digit position determines its value',
      'Compose and decompose numbers using place value columns',
    ],
    commonMisconceptions: [
      'Treating each column as having equal value regardless of position',
      'Confusing the Indian lakh/crore system with Western million/billion notation',
      'Placing digits without considering their positional value',
    ],
    generationHints: [
      'Use targetNumber to auto-generate draggable digit bank',
      'Start with lakh mode before introducing crore',
      'Display column labels (Ones, Tens, Hundreds, ...) clearly above each slot',
    ],
    exampleConfigs: [
      { targetNumber: 1234, mode: 'lakh' },
      { targetNumber: 56789, mode: 'lakh' },
      { targetNumber: 1234567, mode: 'crore' },
    ],
  },
  icon: 'table',
  keywords: ['place', 'value', 'chart', 'math', '位值'],
  status: 'stable',
};

export { PlaceValueChartWidget as placeValueChart };
export default PlaceValueChartWidget;
