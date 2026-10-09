import { useState, useMemo, useRef } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';
import { WidgetError } from '../WidgetError';

const markerSchema = z.object({
  value: z.number(),
  label: z.string().optional(),
  color: z.string().optional(),
});

const numberLineSchema = z.object({
  min: z.number().optional().default(0),
  max: z.number().optional().default(10),
  step: z.number().optional().default(1),
  target: z.number().optional(),
  markers: z.array(markerSchema).optional(),
  showLabels: z.boolean().optional().default(true),
  showGrid: z.boolean().optional().default(false),
  mode: z
    .enum(['integers', 'decimals', 'fractions', 'negative', 'measurement'])
    .optional()
    .default('integers'),
  interactive: z.boolean().optional().default(false),
  tolerance: z.number().optional().default(0.5),
});

const NumberLineStateSchema = z.object({
  placedMarkers: z.array(z.number()),
  answeredCorrectly: z.boolean().optional(),
});

const PADDING = 40;
const LINE_HEIGHT = 120;

function NumberLineComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = numberLineSchema.safeParse(rawConfig);
  const parsedState = useMemo(() => {
    const result = NumberLineStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [placedMarkers, setPlacedMarkers] = useState<number[]>(parsedState?.placedMarkers ?? []);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(
    parsedState?.answeredCorrectly ?? false,
  );

  const isObserve = parsed.success && !parsed.data.interactive;
  const { handleAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'math.number-line',
  });

  if (!parsed.success) {
    return <WidgetError />;
  }

  const { min, max, step, markers, showLabels, showGrid, mode, target, tolerance } = parsed.data;

  const svgWidth = 600;
  const lineStart = PADDING;
  const lineEnd = svgWidth - PADDING;
  const lineLength = lineEnd - lineStart;

  const valueToX = (val: number) => lineStart + ((val - min) / (max - min)) * lineLength;

  const xToValue = (x: number) => {
    const raw = min + ((x - lineStart) / lineLength) * (max - min);
    return Math.round(raw / step) * step;
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!parsed.data.interactive) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const value = xToValue(x);
    setPlacedMarkers((prev) => [...prev, value]);

    const isCorrect = target !== undefined && Math.abs(value - target) <= (tolerance ?? 0.5);
    emitInteraction({
      type: 'widget.interaction',
      widgetId: 'math.number-line',
      action: 'place',
      value,
      correct: isCorrect,
    });

    if (isCorrect && !answeredCorrectly) {
      setAnsweredCorrectly(true);
      complete(100, { placedMarkers: [...placedMarkers, value], answeredCorrectly: true });
    }
  };

  const tickValues: number[] = [];
  for (let v = min; v <= max; v = Math.round((v + step) * 1000) / 1000) {
    tickValues.push(v);
  }

  const formatLabel = (v: number) => {
    if (mode === 'fractions') {
      const whole = Math.floor(Math.abs(v));
      const frac = Math.abs(v) - whole;
      if (frac === 0) return v < 0 ? `-${whole}` : `${whole}`;
      return `${v < 0 ? '-' : ''}${whole || ''}${Math.round(frac * 100)}/100`;
    }
    if (mode === 'decimals') return v.toFixed(1);
    return v.toString();
  };

  return (
    <div role="group" aria-label="Number line" data-testid="number-line">
      {target !== undefined && parsed.data.interactive && (
        <p className="text-on-surface mb-sm font-semibold">
          Find {formatLabel(target)} on the number line
        </p>
      )}

      <svg
        ref={svgRef}
        width={svgWidth}
        height={LINE_HEIGHT + (showLabels ? 30 : 0)}
        viewBox={`0 0 ${svgWidth} ${LINE_HEIGHT + (showLabels ? 30 : 0)}`}
        className="w-full cursor-pointer"
        onClick={handleSvgClick}
        role={parsed.data.interactive ? 'application' : 'img'}
        aria-label={`Number line from ${min} to ${max}`}
      >
        {showGrid &&
          tickValues.map((v) => (
            <line
              key={`grid-${v}`}
              x1={valueToX(v)}
              y1={10}
              x2={valueToX(v)}
              y2={LINE_HEIGHT - 10}
              stroke="var(--oe-color-outline-variant, #e0e0e0)"
              strokeWidth={1}
            />
          ))}

        <line
          x1={lineStart}
          y1={LINE_HEIGHT / 2}
          x2={lineEnd}
          y2={LINE_HEIGHT / 2}
          stroke="var(--oe-color-on-surface, #1c1b1f)"
          strokeWidth={2}
        />
        <polygon
          points={`${lineEnd},${LINE_HEIGHT / 2 - 5} ${lineEnd + 10},${LINE_HEIGHT / 2} ${lineEnd},${LINE_HEIGHT / 2 + 5}`}
          fill="var(--oe-color-on-surface, #1c1b1f)"
        />

        {tickValues.map((v) => {
          const x = valueToX(v);
          return (
            <g key={v}>
              <line
                x1={x}
                y1={LINE_HEIGHT / 2 - 8}
                x2={x}
                y2={LINE_HEIGHT / 2 + 8}
                stroke="var(--oe-color-on-surface, #1c1b1f)"
                strokeWidth={2}
              />
              {showLabels && (
                <text
                  x={x}
                  y={LINE_HEIGHT / 2 + 25}
                  textAnchor="middle"
                  fill="var(--oe-color-on-surface, #1c1b1f)"
                  fontSize={12}
                >
                  {formatLabel(v)}
                </text>
              )}
            </g>
          );
        })}

        {markers?.map((m, i) => (
          <circle
            key={`marker-${i}`}
            cx={valueToX(m.value)}
            cy={LINE_HEIGHT / 2}
            r={6}
            fill={m.color ?? 'var(--oe-color-primary, #6750a4)'}
            aria-label={m.label ?? formatLabel(m.value)}
          />
        ))}

        {target !== undefined && isObserve && (
          <circle
            cx={valueToX(target)}
            cy={LINE_HEIGHT / 2}
            r={8}
            fill="var(--oe-color-primary, #6750a4)"
            stroke="var(--oe-color-on-primary, #fff)"
            strokeWidth={2}
            aria-label={`Target: ${formatLabel(target)}`}
          />
        )}

        {placedMarkers.map((v, i) => (
          <circle
            key={`placed-${i}`}
            cx={valueToX(v)}
            cy={LINE_HEIGHT / 2}
            r={6}
            fill={
              answeredCorrectly && v === target
                ? 'var(--oe-color-success, #16a34a)'
                : 'var(--oe-color-error, #dc2626)'
            }
            aria-label={`Placed at ${formatLabel(v)}`}
          />
        ))}
      </svg>

      {isObserve && showAcknowledgeButton && (
        <div className="p-md border-outline-variant mt-md flex items-center justify-center border-t">
          <Button variant="default" onClick={handleAcknowledge} data-testid="observe-acknowledge">
            Mark as seen ✓
          </Button>
        </div>
      )}
    </div>
  );
}

const NumberLineWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Explore numbers, fractions, and operations on an interactive number line.',
    whatItDoes:
      'The Number Line widget displays an interactive number line where students can place values, compare positions, and explore number relationships. It supports integers, decimals, and fractions with customizable ranges and markers.',
    whenToUse: [
      'Teaching number sense and counting',
      'Visualizing addition and subtraction',
      'Comparing numbers and fractions',
      'Understanding negative numbers',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "math.number-line"',
      'Set the min and max values for the line',
      'Set the step size between marks',
      'Optionally add a target value or markers',
    ],
    configFields: [
      {
        name: 'min',
        type: 'number',
        required: true,
        description: 'The lowest number on the line.',
      },
      {
        name: 'max',
        type: 'number',
        required: true,
        description: 'The highest number on the line.',
      },
      {
        name: 'step',
        type: 'number',
        required: true,
        description: 'The spacing between marks. Use 1 for integers.',
      },
      {
        name: 'target',
        type: 'number',
        required: false,
        description: 'A specific value students should locate on the line.',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description: '"integers" (default) or "decimals" for fractional values.',
      },
      {
        name: 'markers',
        type: 'array of objects',
        required: false,
        description:
          'Highlighted markers. Each has value (number), label (string), and optional color (CSS variable).',
      },
      {
        name: 'showLabels',
        type: 'boolean',
        required: false,
        description: 'Show number labels on the line. Defaults to true.',
      },
      {
        name: 'showGrid',
        type: 'boolean',
        required: false,
        description: 'Show vertical grid lines at marks. Defaults to false.',
      },
      {
        name: 'tolerance',
        type: 'number',
        required: false,
        description: 'How close the student needs to be to the target. Defaults to 0.5.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows a static number line. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Number Line Explorer",\n  "widget": "math.number-line",\n  "config": {\n    "min": -10,\n    "max": 10,\n    "step": 1,\n    "target": 3.5,\n    "markers": [\n      { "value": -5, "label": "-5" },\n      { "value": 0, "label": "0" },\n      { "value": 7, "label": "7" }\n    ],\n    "showLabels": true,\n    "showGrid": true,\n    "mode": "decimals",\n    "tolerance": 0.5,\n    "interactive": false\n  }\n}',
    tips: [
      'Start with positive integers only for early learners',
      'Add markers to highlight important reference points',
      'Use decimals mode only after students master integers',
      'Clear tick marks help students count between labeled numbers',
    ],
    sidebarPosition: 6,
    relatedWidgets: [
      {
        id: 'math.fraction-visual',
        name: 'Fraction Visual',
        domain: 'math',
        slug: 'fraction-visual',
      },
      {
        id: 'math.place-value-chart',
        name: 'Place Value Chart',
        domain: 'math',
        slug: 'place-value-chart',
      },
    ],
  },
  id: 'math.number-line',
  name: 'Number Line',
  description: 'Visual number reasoning with interactive number line',
  domain: 'math',
  version: '1.0.0',
  schema: numberLineSchema,
  render: NumberLineComponent,
  learningIntents: [LearningIntent.Observe, LearningIntent.Practice, LearningIntent.Compare],
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
    supportsLocalization: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    ariaSupport: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackHints: true,
    trackSuccessRate: true,
    trackInteractions: true,
    trackMistakes: true,
  },
  reward: {
    completionXP: 15,
    confetti: true,
    positiveMessage: 'Number sense strengthened!',
    achievement: 'first-numberline',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 3,
    bloomsLevel: 'understand',
    cognitiveLoad: 'moderate',
    recommendedAge: [6, 14],
    readingLevel: 'grade-2',
    subjectTags: ['math', 'number-sense'],
    learningObjectives: [
      'Locate numbers on a number line',
      'Compare relative positions of numbers',
      'Estimate values between marked points',
    ],
    commonMisconceptions: [
      'Confusing the direction of negative numbers',
      'Assuming equal spacing between non-uniform intervals',
    ],
    generationHints: [
      'Use a reasonable range (0-10 for early learners, -10 to 10 for negatives)',
      'Include at least 5 tick marks for reference',
      'Place target values at non-obvious positions for challenge',
    ],
    authoringPrompt: 'Create a number line activity for locating or comparing numbers',
    exampleConfigs: [
      {
        min: 0,
        max: 10,
        step: 1,
        target: 7,
        showLabels: true,
        interactive: true,
        mode: 'integers',
      },
      {
        min: -5,
        max: 5,
        step: 1,
        target: -3,
        showLabels: true,
        interactive: true,
        mode: 'negative',
      },
    ],
  },
  icon: 'ruler',
  keywords: ['number-line', 'math', 'integers', 'decimals', 'fractions', 'estimate'],
  status: 'stable',
};

export { NumberLineWidget as numberLine, numberLineSchema };
export default NumberLineWidget;
