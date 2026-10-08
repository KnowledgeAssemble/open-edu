import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

export const configSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  mode: z.enum(['read', 'set']).optional().default('read'),
  showDigital: z.boolean().optional().default(false),
  targetTime: z
    .object({
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
    })
    .optional(),
  showTargetTime: z.boolean().optional().default(true),
  interactive: z.boolean().optional().default(true),
  size: z.number().positive().optional().default(250),
});

export type ClockTimeConfig = z.infer<typeof configSchema>;

function to12(hour: number): number {
  const h = hour % 12;
  return h === 0 ? 12 : h;
}

function handAngle(hour: number, minute: number): { hourAngle: number; minuteAngle: number } {
  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const minuteAngle = minute * 6;
  return { hourAngle, minuteAngle };
}

const HOUR_VALUES = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function polarX(cx: number, r: number, angleDeg: number): number {
  return cx + r * Math.sin((angleDeg * Math.PI) / 180);
}

function polarY(cx: number, r: number, angleDeg: number): number {
  return cx - r * Math.cos((angleDeg * Math.PI) / 180);
}

const ClockTimeStateSchema = z.object({
  submitted: z.boolean(),
  currentHour: z.number(),
  currentMinute: z.number(),
  selectedHour: z.number().nullable(),
});

function ClockTimeComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = configSchema.safeParse(rawConfig);
  const config = parsed.success ? parsed.data : null;

  const parsedState = useMemo(() => {
    const result = ClockTimeStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [currentHour, setCurrentHour] = useState(parsedState?.currentHour ?? config?.hour ?? 12);
  const [currentMinute, setCurrentMinute] = useState(
    parsedState?.currentMinute ?? config?.minute ?? 0,
  );
  const [selectedHour, setSelectedHour] = useState<number | null>(
    parsedState?.selectedHour ?? null,
  );
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const isInteractive = config?.interactive ?? false;
  const isObserve = config != null && !isInteractive;
  const isReadMode = config?.mode === 'read';
  const isSetMode = config?.mode === 'set';

  const size = config?.size ?? 250;
  const cx = size / 2;
  const cy = size / 2;
  const faceR = size * 0.42;
  const markerR = size * 0.36;
  const digitR = size * 0.29;

  const { hourAngle, minuteAngle } = handAngle(
    isSetMode ? currentHour : (config?.hour ?? 12),
    isSetMode ? currentMinute : (config?.minute ?? 0),
  );

  const displayHour = config != null ? to12(config.hour) : 12;
  const displayHour24 = config?.hour ?? 12;
  const displayMinute = config?.minute ?? 0;

  const displayHour12 = to12(isSetMode ? currentHour : displayHour24);
  const displayMinuteStr = String(isSetMode ? currentMinute : displayMinute).padStart(2, '0');
  const timeAnnouncement = isSetMode
    ? `${displayHour12}:${displayMinuteStr}`
    : `${to12(config?.hour ?? 12)}:${String(config?.minute ?? 0).padStart(2, '0')}`;

  const showDigitalReadout =
    (isInteractive && (isSetMode || config?.showDigital !== false)) ||
    (!isInteractive && config?.showDigital === true);

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && !!config,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'math.clock-time',
  });

  const handleReadSelect = useCallback(
    (hourValue: number) => {
      if (!config || !isInteractive || !isReadMode || submitted) return;
      setSelectedHour(hourValue);
      setAwaitingConfirm(true);
    },
    [config, isInteractive, isReadMode, submitted],
  );

  const handleReadConfirm = useCallback(() => {
    if (!config || !isInteractive || !isReadMode || submitted || selectedHour === null) return;
    const correct = selectedHour === displayHour;
    setSubmitted(true);
    setAwaitingConfirm(false);
    emitInteraction({
      type: 'widget.interaction',
      widgetId: 'math.clock-time',
      action: 'submit',
      mode: 'read',
      selectedHour,
      displayedHour: displayHour,
      correct,
    });
  }, [config, isInteractive, isReadMode, submitted, selectedHour, displayHour, emitInteraction]);

  const handleReadContinue = useCallback(() => {
    const correct = selectedHour === displayHour;
    const score = correct ? 100 : 0;
    complete(score, { submitted: true, currentHour, currentMinute, selectedHour });
  }, [selectedHour, displayHour, complete, currentHour, currentMinute]);

  const computeSetScore = useCallback(() => {
    if (!config) return 0;
    const target = config.targetTime;
    if (!target) return 100;
    const hourCorrect = currentHour % 12 === target.hour % 12;
    const minuteDiff = Math.abs(currentMinute - target.minute);
    if (!hourCorrect) return 0;
    if (minuteDiff <= 1) return 100;
    if (minuteDiff <= 2) return 50;
    if (minuteDiff <= 5) return 25;
    return 0;
  }, [config, currentHour, currentMinute]);

  const handleSetSubmit = useCallback(() => {
    if (!config || !isInteractive || !isSetMode || submitted) return;
    const target = config.targetTime;
    const score = computeSetScore();
    const hourCorrect = currentHour % 12 === (target?.hour ?? currentHour) % 12;
    const minuteDiff = target ? Math.abs(currentMinute - target.minute) : 0;
    const minuteCorrect = !target || minuteDiff <= 5;
    setSubmitted(true);
    emitInteraction({
      type: 'widget.interaction',
      widgetId: 'math.clock-time',
      action: 'submit',
      mode: 'set',
      currentHour,
      currentMinute,
      targetHour: target?.hour,
      targetMinute: target?.minute,
      hourCorrect,
      minuteCorrect,
      score,
    });
  }, [
    config,
    isInteractive,
    isSetMode,
    submitted,
    currentHour,
    currentMinute,
    computeSetScore,
    emitInteraction,
  ]);

  const handleSetContinue = useCallback(() => {
    const score = computeSetScore();
    complete(score, { submitted: true, currentHour, currentMinute, selectedHour });
  }, [computeSetScore, complete, currentHour, currentMinute, selectedHour]);

  const cycleHour = useCallback((dir: 1 | -1) => {
    setCurrentHour((h) => (h + dir + 24) % 24);
  }, []);

  const cycleMinute = useCallback((dir: 1 | -1) => {
    setCurrentMinute((m) => (m + dir + 60) % 60);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!config || !isInteractive || submitted) return;
      if (isSetMode) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (mode === 'hour') cycleHour(1);
          else cycleMinute(1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (mode === 'hour') cycleHour(-1);
          else cycleMinute(-1);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSetSubmit();
        }
      }
    },
    [config, isInteractive, submitted, isSetMode, mode, cycleHour, cycleMinute, handleSetSubmit],
  );

  if (!parsed.success || !config) {
    return (
      <div
        role="alert"
        data-testid="widget-config-error"
        className="p-lg bg-error-container text-on-error-container rounded-lg text-center"
      >
        <p className="text-sm font-medium">Clock configuration is missing or invalid.</p>
        <p className="mt-xs text-xs opacity-75">Please check the widget settings.</p>
      </div>
    );
  }

  function renderClockFace() {
    const markers = HOUR_VALUES.map((hv, i) => {
      const angle = i * 30;
      const mx = polarX(cx, markerR, angle);
      const my = polarY(cx, markerR, angle);
      const dx = polarX(cx, digitR, angle);
      const dy = polarY(cx, digitR, angle);

      const isMarked = isReadMode && isInteractive && !submitted && selectedHour === hv;

      const isTargetRead = isReadMode && isInteractive && submitted && hv === displayHour;

      const isWrongRead =
        isReadMode && isInteractive && submitted && selectedHour === hv && hv !== displayHour;

      return (
        <g key={hv}>
          <circle
            cx={mx}
            cy={my}
            r={4}
            fill={
              isMarked
                ? 'var(--oe-color-primary, #3b82f6)'
                : isTargetRead
                  ? 'var(--oe-success, #10b981)'
                  : isWrongRead
                    ? 'var(--oe-error, #ef4444)'
                    : 'var(--oe-color-on-surface-variant, #374151)'
            }
            aria-hidden="true"
          />
          {interactiveClockPart() && (
            <text
              x={dx}
              y={dy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.055}
              fontWeight={submitted && hv === displayHour ? 'bold' : 'normal'}
              fill={
                isTargetRead
                  ? 'var(--oe-success, #10b981)'
                  : isWrongRead
                    ? 'var(--oe-error, #ef4444)'
                    : 'var(--oe-color-on-surface, #1f2937)'
              }
              cursor={isReadMode && isInteractive && !submitted ? 'pointer' : 'default'}
              onClick={() => handleReadSelect(hv)}
              aria-label={`${hv} o'clock`}
              data-testid={`hour-marker-${hv}`}
            >
              {hv}
            </text>
          )}
          {!interactiveClockPart() && (
            <text
              x={dx}
              y={dy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.055}
              fill="var(--oe-color-on-surface, #1f2937)"
              aria-hidden="true"
            >
              {hv}
            </text>
          )}
        </g>
      );
    });

    const hLen = faceR * 0.5;
    const mLen = faceR * 0.7;
    const hx = polarX(cx, hLen, hourAngle);
    const hy = polarY(cx, hLen, hourAngle);
    const mx = polarX(cx, mLen, minuteAngle);
    const my = polarY(cx, mLen, minuteAngle);

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        data-testid="clock-svg"
        role="img"
        aria-label={`Analog clock showing ${timeAnnouncement}`}
        tabIndex={isInteractive && !submitted ? 0 : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
      >
        <circle
          cx={cx}
          cy={cy}
          r={faceR}
          fill="var(--oe-color-surface, #f9fafb)"
          stroke="var(--oe-color-outline-variant, #9ca3af)"
          strokeWidth={2}
        />
        {markers}
        <line
          x1={cx}
          y1={cy}
          x2={hx}
          y2={hy}
          stroke="var(--oe-color-on-surface, #1f2937)"
          strokeWidth={4}
          strokeLinecap="round"
          aria-hidden="true"
        />
        <line
          x1={cx}
          y1={cy}
          x2={mx}
          y2={my}
          stroke="var(--oe-color-on-surface, #1f2937)"
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
        />
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="var(--oe-color-on-surface, #1f2937)"
          aria-hidden="true"
        />
      </svg>
    );
  }

  function interactiveClockPart() {
    return isReadMode || isSetMode;
  }

  return (
    <div
      data-testid="clock-time"
      aria-label={`Clock time widget showing ${timeAnnouncement}`}
      style={{ textAlign: 'center' }}
    >
      {isSetMode && isInteractive && !submitted && (
        <div className="text-on-surface-variant bg-surface-container-high p-xs mb-sm rounded text-sm">
          Use arrow keys to adjust, Enter to submit
        </div>
      )}

      {isSetMode && isInteractive && config.targetTime && config.showTargetTime && !submitted && (
        <p
          data-testid="target-time-prompt"
          role="status"
          aria-live="polite"
          className="text-on-surface mb-sm font-medium"
        >
          Set the clock to {to12(config.targetTime.hour)}:
          {String(config.targetTime.minute).padStart(2, '0')}
        </p>
      )}

      <div role="status" aria-live="polite" data-testid="time-live-region" aria-atomic="true">
        {showDigitalReadout ? timeAnnouncement : ''}
      </div>

      {showDigitalReadout && isSetMode && (
        <div
          data-testid="digital-readout"
          className="my-sm font-mono text-xl"
          aria-label={`Digital time: ${timeAnnouncement}`}
        >
          {timeAnnouncement}
        </div>
      )}

      {isSetMode && isInteractive && !submitted && (
        <div
          className="gap-sm mb-sm flex justify-center"
          role="group"
          aria-label="Time adjustment mode"
        >
          <Button
            variant={mode === 'hour' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('hour')}
            aria-pressed={mode === 'hour'}
            data-testid="mode-hour"
          >
            Hour
          </Button>
          <Button
            variant={mode === 'minute' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('minute')}
            aria-pressed={mode === 'minute'}
            data-testid="mode-minute"
          >
            Minute
          </Button>
        </div>
      )}

      {renderClockFace()}

      {isSetMode && isInteractive && !submitted && (
        <div
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: mode === 'hour' ? 'bold' : 'normal' }}>
              Hour
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cycleHour(1)}
              data-testid="hour-up"
              aria-label="Increase hour"
            >
              ▲
            </Button>
            <div data-testid="set-hour-display" style={{ fontSize: '1.2rem' }}>
              {displayHour12}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cycleHour(-1)}
              data-testid="hour-down"
              aria-label="Decrease hour"
            >
              ▼
            </Button>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: mode === 'minute' ? 'bold' : 'normal' }}>
              Minute
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cycleMinute(1)}
              data-testid="minute-up"
              aria-label="Increase minute"
            >
              ▲
            </Button>
            <div data-testid="set-minute-display" style={{ fontSize: '1.2rem' }}>
              {String(currentMinute).padStart(2, '0')}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cycleMinute(-1)}
              data-testid="minute-down"
              aria-label="Decrease minute"
            >
              ▼
            </Button>
          </div>
        </div>
      )}

      {isSetMode && isInteractive && !submitted && (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="default" onClick={handleSetSubmit} data-testid="submit-btn">
            Submit
          </Button>
        </div>
      )}

      {isSetMode && isInteractive && submitted && (
        <div data-testid="feedback" role="status" aria-live="assertive">
          {config.targetTime
            ? (() => {
                const score = computeSetScore();
                if (score === 100) return 'Correct!';
                if (score === 50) return 'Close! Within 2 minutes — 50% credit.';
                if (score === 25) return 'Within 5 minutes — 25% credit.';
                return `Not quite. Expected ${to12(config.targetTime.hour)}:${String(config.targetTime.minute).padStart(2, '0')}.`;
              })()
            : 'Complete.'}
        </div>
      )}

      {isSetMode && isInteractive && submitted && (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="default" onClick={handleSetContinue} data-testid="continue-button">
            Continue
          </Button>
        </div>
      )}

      {isReadMode && isInteractive && !submitted && awaitingConfirm && selectedHour !== null && (
        <div style={{ marginTop: '0.75rem' }} role="status" aria-live="polite">
          <p className="mb-xs">You selected {selectedHour} o&apos;clock</p>
          <Button variant="default" onClick={handleReadConfirm} data-testid="confirm-btn">
            Confirm
          </Button>
        </div>
      )}

      {isReadMode && isInteractive && submitted && (
        <div data-testid="feedback" role="status" aria-live="assertive">
          {selectedHour === displayHour
            ? 'Correct!'
            : `Not quite. The hour shown was ${displayHour}.`}
        </div>
      )}

      {isReadMode && isInteractive && submitted && (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="default" onClick={handleReadContinue} data-testid="continue-button">
            Continue
          </Button>
        </div>
      )}

      {isObserve && (
        <div role="status" aria-live="assertive" data-testid="observe-complete">
          {showAcknowledgeButton ? (
            <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              <Button
                variant="default"
                onClick={handleObserveAcknowledge}
                data-testid="observe-acknowledge-btn"
              >
                Acknowledge
              </Button>
            </div>
          ) : (
            <p>Content acknowledged.</p>
          )}
        </div>
      )}
    </div>
  );
}

const ClockTimeWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Read and set time on an interactive analog clock with digital display.',
    whatItDoes:
      'The Clock Time widget shows an analog clock face. Students can read the current time, set the hands to a specific time, or see both analog and digital time together. It supports hour, half-hour, and minute-level precision.',
    whenToUse: [
      'Teaching how to read an analog clock',
      'Practicing time to the hour and half-hour',
      'Converting between analog and digital time',
      'Understanding AM and PM',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "math.clock-time"',
      'Set the starting time (hour and minute)',
      'Choose set mode for interactive practice or display mode',
      'Optionally set a target time for students to match',
    ],
    configFields: [
      {
        name: 'hour',
        type: 'number',
        required: true,
        description: 'The starting hour (1-12).',
      },
      {
        name: 'minute',
        type: 'number',
        required: true,
        description: 'The starting minute (0-59).',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description: '"set" for interactive time-setting, "display" for reading only.',
      },
      {
        name: 'showDigital',
        type: 'boolean',
        required: false,
        description: 'Show the digital time alongside the analog clock. Defaults to true.',
      },
      {
        name: 'targetTime',
        type: 'object',
        required: false,
        description: 'Target time for students to match. Has hour (number) and minute (number).',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions for the student.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows the clock in display mode. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Set the Clock",\n  "widget": "math.clock-time",\n  "config": {\n    "description": "Set the clock to show 7:30.",\n    "hour": 3,\n    "minute": 0,\n    "mode": "set",\n    "showDigital": true,\n    "targetTime": { "hour": 7, "minute": 30 },\n    "interactive": true\n  }\n}',
    tips: [
      'Start with hour-only times (e.g. 3:00) before adding minutes',
      'Use clear, large clock faces for young learners',
      'Show both analog and digital representations together',
      'Explain the difference between the hour and minute hands',
    ],
    sidebarPosition: 4,
    relatedWidgets: [
      {
        id: 'math.measurement-scale',
        name: 'Measurement Scale',
        domain: 'math',
        slug: 'measurement-scale',
      },
    ],
  },
  id: 'math.clock-time',
  name: 'Clock Time',
  description: 'Read and set time on analog and digital clocks',
  domain: 'math',
  version: '1.0.0',
  schema: configSchema,
  render: ClockTimeComponent,
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
    supportsAnimation: true,
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
    achievement: 'first-clock',
    positiveMessage: 'Time telling correct!',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 3,
    bloomsLevel: 'understand',
    cognitiveLoad: 'low',
    subjectTags: ['math', 'time'],
    authoringPrompt: 'Create a clock-reading exercise with analog and digital times',
    recommendedAge: [4, 10],
    readingLevel: 'pre-reader',
    learningObjectives: [
      'Read the hour from an analog clock face',
      'Set clock hands to match a given digital time',
      'Understand the relationship between hour and minute hands',
    ],
    commonMisconceptions: [
      'Reading the minute hand position as the hour',
      'Not accounting for the minute hand affecting the hour hand position',
      "Confusing o'clock times with half-past times",
    ],
    generationHints: [
      "Use round times (o'clock, half past) for easy mode",
      'Use targetTime for precise grading in set mode',
      'Prefer 12-hour display for young learners',
    ],
    exampleConfigs: [
      { hour: 3, minute: 0, mode: 'read' },
      { hour: 7, minute: 30, mode: 'set', targetTime: '7:30' },
      { hour: 11, minute: 45, mode: 'set', targetTime: '11:45' },
    ],
  },
  icon: 'clock',
  keywords: ['clock', 'time', 'math', '时钟', '时间'],
  status: 'stable',
};

export { ClockTimeWidget as clockTime };
export default ClockTimeWidget;
