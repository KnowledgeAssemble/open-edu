import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

export const configSchema = z.object({
  type: z.enum(['ruler', 'thermometer', 'cylinder']),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  unit: z.string().min(1),
  interactive: z.boolean().optional().default(true),
  targetValue: z.number().optional(),
  showReading: z.boolean().optional().default(true),
  showLabels: z.boolean().optional().default(true),
  value: z.number().optional(),
  description: z.string().optional(),
});

export type MeasurementScaleConfig = z.infer<typeof configSchema>;

const WIDTH = 320;
const HEIGHT = 360;
const PADDING = 40;

const MeasurementScaleStateSchema = z.object({
  submitted: z.boolean(),
  value: z.number(),
});

function MeasurementScaleComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = configSchema.safeParse(rawConfig);
  const config = parsed.success ? parsed.data : (null as unknown as MeasurementScaleConfig);

  const parsedState = useMemo(() => {
    const result = MeasurementScaleStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [value, setValue] = useState(parsedState?.value ?? config?.value ?? config?.min ?? 0);

  const isInteractive = config?.interactive ?? false;
  const isObserve = parsed.success && !isInteractive;

  const {
    handleAcknowledge: handleObserveAcknowledge,
    showAcknowledgeButton,
    acknowledged,
  } = useObserveMode({
    isObserve: isObserve && !!config,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'math.measurement-scale',
  });

  const clamp = useCallback(
    (v: number) => {
      if (!config) return v;
      const stepped = Math.round((v - config.min) / config.step) * config.step + config.min;
      return Math.min(config.max, Math.max(config.min, stepped));
    },
    [config],
  );

  const indicatorColor = submitted
    ? 'var(--oe-color-success, #10b981)'
    : 'var(--oe-color-primary, #3b82f6)';

  const mapCoordinatesToValue = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      if (!config) return value;
      const isVertical = config.type === 'thermometer' || config.type === 'cylinder';
      let pos: number;
      if (isVertical) {
        pos = 1 - (clientY - rect.top) / rect.height;
      } else {
        pos = (clientX - rect.left) / rect.width;
      }
      pos = Math.min(1, Math.max(0, pos));
      const range = config.max - config.min;
      return clamp(config.min + pos * range);
    },
    [config, clamp, value],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!config || !isInteractive || submitted) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const newValue = mapCoordinatesToValue(e.clientX, e.clientY, rect);
      setValue(newValue);
    },
    [config, isInteractive, submitted, mapCoordinatesToValue],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (!config || !isInteractive || submitted) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const touch = e.touches[0];
      if (!touch) return;
      const newValue = mapCoordinatesToValue(touch.clientX, touch.clientY, rect);
      setValue(newValue);
    },
    [config, isInteractive, submitted, mapCoordinatesToValue],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (!config || !isInteractive || submitted) return;
      e.preventDefault();
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const touch = e.touches[0];
      if (!touch) return;
      const newValue = mapCoordinatesToValue(touch.clientX, touch.clientY, rect);
      setValue(newValue);
    },
    [config, isInteractive, submitted, mapCoordinatesToValue],
  );

  const handleSubmit = useCallback(() => {
    if (!config || submitted) return;
    const target = config.targetValue;
    let correct = false;
    if (target != null) {
      const diff = Math.abs(value - target);
      correct = diff <= config.step;
    }
    emitInteraction({
      type: 'widget.interaction',
      widgetId: 'math.measurement-scale',
      action: 'submit',
      value,
      targetValue: target,
      correct,
    });
    setSubmitted(true);
  }, [config, submitted, value, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (!config) return;
    const target = config.targetValue;
    let correct = false;
    if (target != null) {
      const diff = Math.abs(value - target);
      correct = diff <= config.step;
    }
    const score = correct ? 100 : 0;
    complete(score, { submitted: true, value });
  }, [config, value, complete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!config || !isInteractive || submitted) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        setValue((v) => clamp(v + config.step));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setValue((v) => clamp(v - config.step));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [config, isInteractive, submitted, clamp, handleSubmit],
  );

  const currentReading = config ? `${value}${config.unit}` : '';

  if (!parsed.success || !config) {
    return (
      <div
        role="alert"
        data-testid="widget-config-error"
        className="border-outline-variant bg-surface-container-lowest p-md rounded-xl border text-center"
      >
        <p className="text-on-surface font-semibold">Unable to load measurement scale</p>
        <p className="text-on-surface-variant mt-1 text-sm">
          Please check the widget configuration and try again.
        </p>
      </div>
    );
  }

  const cfg: MeasurementScaleConfig = config;

  function getTickInterval(): number {
    const range = cfg.max - cfg.min;
    if (range <= 0) return 1;
    const ideal = range / 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(ideal)));
    const residual = ideal / magnitude;
    let nice: number;
    if (residual <= 1.5) nice = 1;
    else if (residual <= 3.5) nice = 2;
    else if (residual <= 7.5) nice = 5;
    else nice = 10;
    return nice * magnitude;
  }

  function renderRuler() {
    const svgW = WIDTH;
    const svgH = 120;
    const rulerY = 60;
    const rulerH = 40;
    const tickInterval = getTickInterval();
    const range = cfg.max - cfg.min;
    const usable = svgW - PADDING * 2;

    const ticks: React.ReactNode[] = [];
    for (let v = cfg.min; v <= cfg.max + 0.0001; v += tickInterval) {
      const frac = (v - cfg.min) / range;
      const x = PADDING + frac * usable;
      const isMajor = Math.abs(v - Math.round(v / tickInterval) * tickInterval) < 0.0001;
      const tickH = isMajor ? 16 : 8;
      ticks.push(
        <line
          key={`tick-${v}`}
          x1={x}
          y1={rulerY}
          x2={x}
          y2={rulerY + tickH}
          stroke="var(--oe-color-on-surface, #374151)"
          strokeWidth={isMajor ? 2 : 1}
          aria-hidden="true"
        />,
      );
      if (isMajor && cfg.showLabels) {
        ticks.push(
          <text
            key={`label-${v}`}
            x={x}
            y={rulerY + 32}
            textAnchor="middle"
            fontSize={11}
            fill="var(--oe-color-on-surface, #374151)"
            aria-hidden="true"
          >
            {v}
          </text>,
        );
      }
    }

    const markerFrac = (value - cfg.min) / range;
    const markerX = PADDING + markerFrac * usable;

    return (
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        data-testid="ruler-svg"
        role="img"
        aria-label={`Ruler scale from ${cfg.min} to ${cfg.max} ${cfg.unit}`}
        style={{ cursor: isInteractive && !submitted ? 'pointer' : 'default' }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onKeyDown={handleKeyDown}
        tabIndex={isInteractive && !submitted ? 0 : undefined}
      >
        <rect
          x={PADDING}
          y={rulerY}
          width={usable}
          height={rulerH}
          fill="var(--oe-color-surface-container, #f9fafb)"
          stroke="var(--oe-color-outline, #9ca3af)"
          strokeWidth={1}
          rx={4}
        />
        {ticks}
        <line
          x1={markerX}
          y1={rulerY - 8}
          x2={markerX}
          y2={rulerY + rulerH + 4}
          stroke={indicatorColor}
          strokeWidth={3}
          strokeLinecap="round"
          aria-hidden="true"
        />
        <polygon
          points={`${markerX - 6},${rulerY - 8} ${markerX + 6},${rulerY - 8} ${markerX},${rulerY - 16}`}
          fill={indicatorColor}
          aria-hidden="true"
        />
        {cfg.showReading && isInteractive && (
          <text
            x={markerX}
            y={rulerY - 22}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill="var(--oe-color-on-surface, #1f2937)"
            aria-hidden="true"
          >
            {currentReading}
          </text>
        )}
      </svg>
    );
  }

  function renderThermometer() {
    const svgW = 160;
    const svgH = HEIGHT;
    const bulbCY = svgH - 50;
    const bulbR = 20;
    const tubeX = svgW / 2;
    const tubeTopY = 60;
    const tubeBotY = bulbCY - bulbR;
    const tubeLen = tubeBotY - tubeTopY;
    const tickInterval = getTickInterval();
    const range = cfg.max - cfg.min;

    const ticks: React.ReactNode[] = [];
    for (let v = cfg.min; v <= cfg.max + 0.0001; v += tickInterval) {
      const frac = (v - cfg.min) / range;
      const y = tubeBotY - frac * tubeLen;
      const isMajor = Math.abs(v - Math.round(v / tickInterval) * tickInterval) < 0.0001;
      const tickW = isMajor ? 12 : 6;
      ticks.push(
        <line
          key={`tick-${v}`}
          x1={tubeX - tickW}
          y1={y}
          x2={tubeX}
          y2={y}
          stroke="var(--oe-color-on-surface, #374151)"
          strokeWidth={isMajor ? 2 : 1}
          aria-hidden="true"
        />,
      );
      if (isMajor && cfg.showLabels) {
        ticks.push(
          <text
            key={`label-${v}`}
            x={tubeX - tickW - 4}
            y={y + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--oe-color-on-surface, #374151)"
            aria-hidden="true"
          >
            {v}
          </text>,
        );
      }
    }

    const markerFrac = (value - cfg.min) / range;
    const fillHeight = markerFrac * tubeLen;

    return (
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        data-testid="thermometer-svg"
        role="img"
        aria-label={`Thermometer scale from ${cfg.min} to ${cfg.max} ${cfg.unit}`}
        style={{ cursor: isInteractive && !submitted ? 'pointer' : 'default' }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onKeyDown={handleKeyDown}
        tabIndex={isInteractive && !submitted ? 0 : undefined}
      >
        <rect
          x={tubeX - 8}
          y={tubeTopY}
          width={16}
          height={tubeLen}
          fill="var(--oe-color-surface-container-high, #f3f4f6)"
          stroke="var(--oe-color-outline, #9ca3af)"
          strokeWidth={1}
          rx={8}
        />
        <rect
          x={tubeX - 6}
          y={tubeBotY - fillHeight}
          width={12}
          height={fillHeight}
          fill={indicatorColor}
          rx={6}
          aria-hidden="true"
        />
        <circle
          cx={tubeX}
          cy={bulbCY}
          r={bulbR}
          fill={indicatorColor}
          stroke="var(--oe-color-outline, #9ca3af)"
          strokeWidth={1}
          aria-hidden="true"
        />
        ,{ticks}
        {cfg.showReading && isInteractive && (
          <text
            x={tubeX + bulbR + 12}
            y={bulbCY + 5}
            textAnchor="start"
            fontSize={13}
            fontWeight={600}
            fill="var(--oe-color-on-surface, #1f2937)"
            aria-hidden="true"
          >
            {currentReading}
          </text>
        )}
      </svg>
    );
  }

  function renderCylinder() {
    const svgW = 180;
    const svgH = HEIGHT;
    const cx = svgW / 2;
    const cylTop = 60;
    const cylBot = svgH - 60;
    const cylH = cylBot - cylTop;
    const cylW = 80;
    const tickInterval = getTickInterval();
    const range = cfg.max - cfg.min;

    const ticks: React.ReactNode[] = [];
    for (let v = cfg.min; v <= cfg.max + 0.0001; v += tickInterval) {
      const frac = (v - cfg.min) / range;
      const y = cylBot - frac * cylH;
      const isMajor = Math.abs(v - Math.round(v / tickInterval) * tickInterval) < 0.0001;
      const tickW = isMajor ? 12 : 6;
      ticks.push(
        <line
          key={`tick-${v}`}
          x1={cx + cylW / 2}
          y1={y}
          x2={cx + cylW / 2 + tickW}
          y2={y}
          stroke="var(--oe-color-on-surface, #374151)"
          strokeWidth={isMajor ? 2 : 1}
          aria-hidden="true"
        />,
      );
      if (isMajor && cfg.showLabels) {
        ticks.push(
          <text
            key={`label-${v}`}
            x={cx + cylW / 2 + tickW + 4}
            y={y + 4}
            textAnchor="start"
            fontSize={11}
            fill="var(--oe-color-on-surface, #374151)"
            aria-hidden="true"
          >
            {v}
          </text>,
        );
      }
    }

    const markerFrac = (value - cfg.min) / range;
    const fillHeight = markerFrac * cylH;
    const liquidY = cylBot - fillHeight;

    return (
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        data-testid="cylinder-svg"
        role="img"
        aria-label={`Graduated cylinder scale from ${cfg.min} to ${cfg.max} ${cfg.unit}`}
        style={{ cursor: isInteractive && !submitted ? 'pointer' : 'default' }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onKeyDown={handleKeyDown}
        tabIndex={isInteractive && !submitted ? 0 : undefined}
      >
        <ellipse
          cx={cx}
          cy={cylTop}
          rx={cylW / 2}
          ry={10}
          fill="var(--oe-color-surface-variant, #e5e7eb)"
          stroke="var(--oe-color-outline, #9ca3af)"
          strokeWidth={1}
        />
        <rect
          x={cx - cylW / 2}
          y={cylTop}
          width={cylW}
          height={cylH}
          fill="none"
          stroke="var(--oe-color-outline, #9ca3af)"
          strokeWidth={1}
        />
        <rect
          x={cx - cylW / 2 + 2}
          y={liquidY}
          width={cylW - 4}
          height={fillHeight}
          fill={indicatorColor}
          opacity={0.6}
          aria-hidden="true"
        />
        <ellipse
          cx={cx}
          cy={cylBot}
          rx={cylW / 2}
          ry={10}
          fill={indicatorColor}
          opacity={0.6}
          aria-hidden="true"
        />
        <ellipse
          cx={cx}
          cy={cylTop}
          rx={cylW / 2}
          ry={10}
          fill="none"
          stroke="var(--oe-color-outline, #9ca3af)"
          strokeWidth={1}
        />
        {ticks}
        {cfg.showReading && isInteractive && (
          <text
            x={cx + cylW / 2 + 20}
            y={liquidY + 5}
            textAnchor="start"
            fontSize={13}
            fontWeight={600}
            fill="var(--oe-color-on-surface, #1f2937)"
            aria-hidden="true"
          >
            {currentReading}
          </text>
        )}
      </svg>
    );
  }

  return (
    <div
      data-testid="measurement-scale"
      aria-label={`Measurement scale: ${cfg.type}`}
      style={{ textAlign: 'center' }}
    >
      {cfg.description && <p>{cfg.description}</p>}

      <div role="status" aria-live="polite" data-testid="reading-live-region" aria-atomic="true">
        {cfg.showReading ? currentReading : ''}
      </div>

      {cfg.type === 'ruler' && renderRuler()}
      {cfg.type === 'thermometer' && renderThermometer()}
      {cfg.type === 'cylinder' && renderCylinder()}

      {isInteractive && !submitted && (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="default" onClick={handleSubmit} data-testid="submit-btn">
            Submit
          </Button>
        </div>
      )}

      {isInteractive && submitted && (
        <div data-testid="feedback" role="status" aria-live="assertive">
          {value != null && cfg.targetValue != null
            ? Math.abs(value - cfg.targetValue) <= cfg.step
              ? 'Correct!'
              : `Not quite. Expected ${cfg.targetValue}${cfg.unit}.`
            : 'Complete.'}
        </div>
      )}

      {isInteractive && submitted && (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="default" onClick={handleContinue} data-testid="continue-button">
            Continue
          </Button>
        </div>
      )}

      {showAcknowledgeButton && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="observe-acknowledge-container"
          className="mt-4 text-center"
        >
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
        <div
          role="status"
          aria-live="assertive"
          data-testid="observe-complete"
          className="mt-4 text-center"
        >
          <p className="text-oe-text-secondary mb-2">Content acknowledged.</p>
        </div>
      )}
    </div>
  );
}

const MeasurementScaleWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Read and set measurements on interactive rulers, thermometers, and scales.',
    whatItDoes:
      'The Measurement Scale widget shows a labeled scale — like a ruler, thermometer, or measuring jug. Students read the current measurement or set it to a target value. It supports various units and scale types.',
    whenToUse: [
      'Teaching how to read a ruler or thermometer',
      'Measuring length, temperature, or volume',
      'Comparing measurements',
      'Practicing estimation before precise measurement',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "math.measurement-scale"',
      'Choose the scale type: ruler, thermometer, or measuring jug',
      'Set the min, max, and step values',
      'Set a target value for students to match',
    ],
    configFields: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description: 'Scale type: "ruler", "thermometer", or "jug".',
      },
      {
        name: 'min',
        type: 'number',
        required: true,
        description: 'Minimum value on the scale.',
      },
      {
        name: 'max',
        type: 'number',
        required: true,
        description: 'Maximum value on the scale.',
      },
      {
        name: 'step',
        type: 'number',
        required: true,
        description: 'The increment between markings. Use 1 for whole numbers.',
      },
      {
        name: 'unit',
        type: 'string',
        required: false,
        description: 'Unit label, e.g. "cm", "°C", "ml".',
      },
      {
        name: 'targetValue',
        type: 'number',
        required: false,
        description: 'The target measurement students should set.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions for the student.',
      },
      {
        name: 'showReading',
        type: 'boolean',
        required: false,
        description: 'Show the numeric reading. Defaults to true.',
      },
      {
        name: 'showLabels',
        type: 'boolean',
        required: false,
        description: 'Show scale labels. Defaults to true.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows a static measurement. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Thermometer Reading",\n  "widget": "math.measurement-scale",\n  "config": {\n    "description": "Set the thermometer to 25 degrees Celsius.",\n    "type": "thermometer",\n    "min": -10,\n    "max": 50,\n    "step": 1,\n    "unit": "°C",\n    "targetValue": 25,\n    "showReading": true,\n    "showLabels": true,\n    "interactive": true\n  }\n}',
    tips: [
      'Use whole-number measurements for early learners',
      'Include both metric and imperial options when relevant',
      'Explain where to start measuring from (e.g. the 0 mark, not the 1 mark)',
      'Show labeled markings clearly for readability',
    ],
    sidebarPosition: 5,
    relatedWidgets: [
      {
        id: 'math.clock-time',
        name: 'Clock Time',
        domain: 'math',
        slug: 'clock-time',
      },
    ],
  },
  id: 'math.measurement-scale',
  name: 'Measurement Scale',
  description: 'Measure lengths, weights, and volumes using interactive scales',
  domain: 'math',
  version: '1.0.0',
  schema: configSchema,
  render: MeasurementScaleComponent,
  learningIntents: [LearningIntent.Practice, LearningIntent.Apply],
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
    achievement: 'first-measure',
    positiveMessage: 'Measurement accurate!',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 4,
    bloomsLevel: 'apply',
    cognitiveLoad: 'moderate',
    subjectTags: ['math', 'measurement'],
    authoringPrompt: 'Create a measurement exercise using scales and rulers',
    recommendedAge: [6, 12],
    readingLevel: 'grade-2',
    learningObjectives: [
      'Read measurements accurately on a ruler or scale',
      'Understand the relationship between tick marks and values',
      'Estimate a measurement and verify against a target',
    ],
    commonMisconceptions: [
      'Starting measurement count at 1 instead of 0',
      'Ignoring unit labels when reading values',
      'Misreading thermometer as showing area instead of temperature',
    ],
    generationHints: [
      'Use simple step values (1, 2, 5, or 10)',
      'Keep the measurement range under 100 for young learners',
      'Always include the unit label in all markings',
    ],
    exampleConfigs: [
      { type: 'ruler', max: 20, unit: 'cm', target: 12 },
      { type: 'thermometer', max: 50, unit: '°C', target: 37 },
      { type: 'cylinder', max: 100, unit: 'ml', target: 60 },
    ],
  },
  icon: 'ruler',
  keywords: ['measurement', 'scale', 'math', 'ruler', '测量'],
  status: 'stable',
};

export { MeasurementScaleWidget as measurementScale };
export default MeasurementScaleWidget;
