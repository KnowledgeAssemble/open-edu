import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import { WidgetError } from '../WidgetError';

export const configSchema = z.object({
  duration: z.number().int().min(5).max(3600).default(120),
  mode: z.enum(['countdown', 'countup']).default('countdown'),
  label: z.string().max(256).optional(),
  completeMessage: z.string().max(256).optional(),
  visual: z.enum(['ring', 'bar', 'blocks']).default('ring'),
  showDigital: z.boolean().default(true),
  autoStart: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowSkip: z.boolean().default(true),
  warnings: z
    .array(
      z.object({
        atSeconds: z.number().int().min(0),
        message: z.string().max(256).optional(),
      }),
    )
    .default([]),
  colorZones: z.boolean().default(true),
  interactive: z.boolean().default(false),
});

export type TimerConfig = z.infer<typeof configSchema>;

const TimerStateSchema = z
  .object({
    phase: z.enum(['idle', 'running', 'paused', 'completed']),
    remaining: z.number().int().min(0).optional(),
    elapsed: z.number().int().min(0).optional(),
    startedAt: z.number().nullable().optional(),
  })
  .optional();

type TimerPhase = 'idle' | 'running' | 'paused' | 'completed';

const WIDGET_ID = 'core.timer';
const TICK_MS = 250;
const MAX_BLOCKS = 10;

const STROKE_ZONE_CLASSES: Record<string, string> = {
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  error: 'stroke-error',
};

const FILL_ZONE_CLASSES: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function zoneName(ratio: number, colorZones: boolean): string {
  if (!colorZones) return 'primary';
  if (ratio > 0.5) return 'success';
  if (ratio > 0.25) return 'warning';
  return 'error';
}

function TimerComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const { t } = useTranslation();

  const parsed = useMemo(() => configSchema.safeParse(rawConfig), [rawConfig]);
  const config = parsed.success ? parsed.data : null;

  const parsedState = useMemo(() => {
    const result = TimerStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const duration = config?.duration ?? 120;
  const mode = config?.mode ?? 'countdown';
  const autoStart = config?.autoStart ?? true;
  const allowPause = config?.allowPause ?? true;
  const allowSkip = config?.allowSkip ?? true;
  const interactive = config?.interactive ?? false;

  const initialSeconds = useMemo(() => {
    if (mode === 'countup') {
      if (parsedState && typeof parsedState.elapsed === 'number') return parsedState.elapsed;
      return 0;
    }
    if (parsedState && typeof parsedState.remaining === 'number') {
      return Math.min(Math.max(parsedState.remaining, 0), duration);
    }
    return duration;
  }, [mode, parsedState, duration]);

  const initialPhase = useMemo<TimerPhase>(() => {
    if (parsedState?.phase) return parsedState.phase;
    return autoStart ? 'running' : 'idle';
  }, [parsedState, autoStart]);

  const [phase, setPhase] = useState<TimerPhase>(initialPhase);
  const [displaySeconds, setDisplaySeconds] = useState(initialSeconds);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const completedRef = useRef(false);
  const startedEmittedRef = useRef(false);
  const firedWarningsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (initialPhase === 'running' && startedAtRef.current === null) {
      offsetRef.current = mode === 'countdown' ? duration - initialSeconds : initialSeconds;
      startedAtRef.current = Date.now();
    }
    if (autoStart && initialPhase === 'running' && !startedEmittedRef.current) {
      startedEmittedRef.current = true;
      emit({ action: 'start', mode, duration, autoStart });
      announce(t('widgets.timer.started'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getElapsedSeconds = useCallback(() => {
    const base =
      offsetRef.current + (startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0);
    return mode === 'countdown' ? Math.min(duration, base) : base;
  }, [mode, duration]);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  const emit = useCallback(
    (data: Record<string, unknown>) => {
      emitInteraction({ type: 'widget.interaction', widgetId: WIDGET_ID, ...data });
    },
    [emitInteraction],
  );

  const completeTimer = useCallback(
    (method: 'natural' | 'skipped' | 'done') => {
      if (completedRef.current) return;
      completedRef.current = true;
      const elapsed = Math.floor(getElapsedSeconds());
      if (phase !== 'completed') setPhase('completed');
      const state =
        mode === 'countdown'
          ? { phase: 'completed' as const, remaining: 0, elapsed, startedAt: null }
          : { phase: 'completed' as const, elapsed, startedAt: null };
      emit({ action: 'complete', method, elapsed });
      announce(config?.completeMessage ?? t('widgets.timer.all_done'));
      complete(undefined, state);
    },
    [complete, config, emit, getElapsedSeconds, mode, phase, announce, t],
  );

  const handleStart = useCallback(() => {
    offsetRef.current = 0;
    startedAtRef.current = Date.now();
    firedWarningsRef.current.clear();
    setDisplaySeconds(mode === 'countdown' ? duration : 0);
    setPhase('running');
    emit({ action: 'start', mode, duration, autoStart });
    announce(t('widgets.timer.started'));
  }, [mode, duration, autoStart, emit, announce, t]);

  const handlePause = useCallback(() => {
    if (phase !== 'running') return;
    offsetRef.current = Math.floor(getElapsedSeconds());
    startedAtRef.current = null;
    setPhase('paused');
    emit({ action: 'pause', elapsed: offsetRef.current });
    announce(t('widgets.timer.paused'));
  }, [phase, getElapsedSeconds, emit, announce, t]);

  const handleResume = useCallback(() => {
    if (phase !== 'paused') return;
    startedAtRef.current = Date.now();
    setPhase('running');
    emit({ action: 'resume', elapsed: Math.floor(getElapsedSeconds()) });
    announce(t('widgets.timer.resumed'));
  }, [phase, getElapsedSeconds, emit, announce, t]);

  const handleRestart = useCallback(() => {
    if (completedRef.current) return;
    offsetRef.current = 0;
    startedAtRef.current = Date.now();
    firedWarningsRef.current.clear();
    setDisplaySeconds(mode === 'countdown' ? duration : 0);
    setPhase('running');
    emit({ action: 'restart' });
    announce(t('widgets.timer.restarted'));
  }, [mode, duration, emit, announce, t]);

  const handleSkip = useCallback(() => {
    if (!allowSkip || completedRef.current || phase === 'completed') return;
    const elapsed = Math.floor(getElapsedSeconds());
    const warningsSeen = firedWarningsRef.current.size;
    const warningsSkipped = (config?.warnings ?? [])
      .filter((w) => !firedWarningsRef.current.has(w.atSeconds))
      .map((w) => w.atSeconds);
    emit({ action: 'skip', elapsed, warningsSeen, warningsSkipped });
    completeTimer('skipped');
  }, [allowSkip, getElapsedSeconds, config, emit, completeTimer]);

  const handleDone = useCallback(() => {
    if (completedRef.current || phase === 'completed') return;
    completeTimer('done');
  }, [completeTimer, phase]);

  useEffect(() => {
    if (phase !== 'running') return;
    const interval = window.setInterval(() => {
      const base =
        offsetRef.current + (startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0);
      const next =
        mode === 'countdown'
          ? Math.max(0, Math.ceil(duration - base))
          : Math.floor(Math.max(0, base));
      setDisplaySeconds((prev) => (prev === next ? prev : next));
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [phase, mode, duration]);

  const warnings = useMemo(
    () => [...(config?.warnings ?? [])].sort((a, b) => b.atSeconds - a.atSeconds),
    [config],
  );

  useEffect(() => {
    if (mode !== 'countdown' || phase !== 'running') return;
    for (const warning of warnings) {
      if (warning.atSeconds <= 0) continue;
      if (firedWarningsRef.current.has(warning.atSeconds)) continue;
      if (displaySeconds <= warning.atSeconds) {
        firedWarningsRef.current.add(warning.atSeconds);
        const message = warning.message ?? t('widgets.timer.warning_default');
        announce(message);
        emit({ action: 'warning', atSeconds: warning.atSeconds, remaining: displaySeconds });
        break;
      }
    }
  }, [displaySeconds, phase, mode, warnings, emit, announce, t]);

  useEffect(() => {
    if (mode !== 'countdown' || phase !== 'running') return;
    if (completedRef.current || displaySeconds > 0) return;
    completeTimer('natural');
  }, [displaySeconds, phase, mode, completeTimer]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        if (allowPause && !completedRef.current) {
          if (phase === 'running') handlePause();
          else if (phase === 'paused') handleResume();
        }
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        if (phase === 'running' || phase === 'paused') handleRestart();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleSkip();
      }
    },
    [allowPause, phase, handlePause, handleResume, handleRestart, handleSkip],
  );

  if (!parsed.success) {
    return <WidgetError />;
  }

  const completed = completedRef.current || phase === 'completed';
  const ratio =
    mode === 'countdown' ? displaySeconds / duration : displaySeconds / Math.max(duration, 1);
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const zone = zoneName(clampedRatio, config?.colorZones !== false);
  const strokeClass = STROKE_ZONE_CLASSES[zone];
  const fillClass = FILL_ZONE_CLASSES[zone];

  const ringSize = 180;
  const ringRadius = 80;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - clampedRatio);

  const filledBlocks = Math.round(clampedRatio * MAX_BLOCKS);

  return (
    <div
      role="timer"
      tabIndex={0}
      aria-label={config?.label ?? t('widgets.timer.label_default')}
      onKeyDown={handleKeyDown}
      data-testid="timer"
      className="gap-sm p-md flex flex-col items-center"
    >
      {config?.label && (
        <p className="text-on-surface text-center font-semibold" data-testid="timer-label">
          {config.label}
        </p>
      )}

      <div data-testid="timer-visual" className="flex items-center justify-center">
        {config?.visual === 'bar' && (
          <div
            role="presentation"
            aria-hidden="true"
            className="border-outline-variant bg-surface-container-lowest h-sm w-full overflow-hidden rounded-full border"
          >
            <div
              className={`h-full rounded-full ${fillClass}`}
              data-testid="timer-bar"
              style={{ width: `${clampedRatio * 100}%` }}
            />
          </div>
        )}

        {config?.visual === 'blocks' && (
          <div
            role="presentation"
            aria-hidden="true"
            className="gap-xs flex items-center"
            data-testid="timer-blocks"
          >
            {Array.from({ length: MAX_BLOCKS }, (_, index) => (
              <span
                key={index}
                className={`h-icon-sm w-icon-sm rounded-sm ${
                  index < filledBlocks ? fillClass : 'bg-surface-container-high'
                }`}
              />
            ))}
          </div>
        )}

        {(!config?.visual || config.visual === 'ring') && (
          <svg
            width={ringSize}
            height={ringSize}
            viewBox="0 0 180 180"
            role="presentation"
            aria-hidden="true"
            data-testid="timer-ring"
          >
            <circle
              cx="90"
              cy="90"
              r={ringRadius}
              fill="none"
              strokeWidth="14"
              className="stroke-surface-container-high"
            />
            <circle
              cx="90"
              cy="90"
              r={ringRadius}
              fill="none"
              strokeWidth="14"
              strokeLinecap="round"
              className={`${strokeClass} motion-safe:duration-normal motion-safe:transition-[stroke-dashoffset] motion-safe:ease-out`}
              strokeDasharray={`${ringCircumference} ${ringCircumference}`}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 90 90)"
              data-testid="timer-ring-progress"
            />
          </svg>
        )}
      </div>

      <div className="relative flex items-center justify-center">
        {config?.showDigital && (
          <p
            className="text-on-surface text-5xl font-bold tabular-nums"
            data-testid="timer-digital"
            aria-label={
              mode === 'countdown'
                ? t('widgets.timer.remaining_aria', { time: formatTime(displaySeconds) })
                : t('widgets.timer.elapsed_aria', { time: formatTime(displaySeconds) })
            }
          >
            {formatTime(displaySeconds)}
          </p>
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        data-testid="timer-announcement"
        className="bg-surface-container-low text-on-surface px-md py-xs min-h-8 rounded-full text-center text-sm font-medium"
      >
        {announcement ?? '\u00a0'}
      </div>

      {!completed && interactive && phase === 'idle' && (
        <Button variant="default" onClick={handleStart} data-testid="timer-start">
          {t('widgets.timer.start')}
        </Button>
      )}

      {!completed && interactive && phase === 'running' && allowPause && (
        <Button variant="secondary" onClick={handlePause} data-testid="timer-pause">
          {t('widgets.timer.pause')}
        </Button>
      )}

      {!completed && interactive && phase === 'paused' && allowPause && (
        <Button variant="secondary" onClick={handleResume} data-testid="timer-resume">
          {t('widgets.timer.resume')}
        </Button>
      )}

      {!completed && interactive && (phase === 'running' || phase === 'paused') && (
        <Button variant="outline" onClick={handleRestart} data-testid="timer-restart">
          {t('widgets.timer.restart')}
        </Button>
      )}

      {!completed && mode === 'countup' && (
        <Button variant="default" onClick={handleDone} data-testid="timer-done">
          {t('widgets.timer.done')}
        </Button>
      )}

      {!completed && allowSkip && (
        <Button variant="ghost" onClick={handleSkip} data-testid="timer-skip">
          {t('widgets.timer.skip')}
        </Button>
      )}

      {completed && (
        <div className="text-on-surface/70 gap-xs flex items-center text-center text-sm">
          <span aria-hidden="true">{'\u2705'}</span>
          <span data-testid="timer-complete">
            {config?.completeMessage ?? t('widgets.timer.all_done')}
          </span>
        </div>
      )}
    </div>
  );
}

const TimerWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'A visual countdown or count-up timer for breaks and transitions.',
    whatItDoes:
      'The Timer widget shows time as a shrinking ring, bar, or row of blocks so elapsed and remaining time feel concrete rather than abstract. It supports clear start signals, pre-warned near-end announcements, and a calm completion state — designed with autism-spectrum learners in mind, with no startling audio or flashing.',
    whenToUse: [
      'Placing a timed stretch break between lessons',
      'Predictable transitions between activities',
      'Quiet focus or reading blocks with a count-up timer',
      'Teaching the concept of elapsed versus remaining time',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.timer"',
      'Choose a duration in seconds (5–3600)',
      'Pick a visual: ring (default), bar, or blocks',
      'Optionally add warnings with atSeconds and a message for predictable transitions',
      'Leave interactive off for an auto-running break, or turn it on for pause/resume/restart controls',
    ],
    configFields: [
      {
        name: 'duration',
        type: 'number',
        required: false,
        description: 'Length of the timer in seconds (5–3600). Defaults to 120.',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description: '"countdown" (default) or "countup".',
      },
      {
        name: 'label',
        type: 'string',
        required: false,
        description: 'Short heading such as "Time for a stretch break".',
      },
      {
        name: 'completeMessage',
        type: 'string',
        required: false,
        description: 'Calm message shown when the timer finishes, e.g. "Ready to continue?".',
      },
      {
        name: 'visual',
        type: 'string',
        required: false,
        description: '"ring" (default), "bar", or "blocks" time representation.',
      },
      {
        name: 'warnings',
        type: 'array of objects',
        required: false,
        description:
          'Pre-warned transitions. Each has atSeconds (number) and an optional message (string).',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description:
          'When true, shows pause/resume/restart controls. When false (default) the timer auto-runs and completes on its own.',
      },
      {
        name: 'allowSkip',
        type: 'boolean',
        required: false,
        description: 'Whether to show an "End break now" button. Defaults to true.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Take a Break",\n  "widget": "core.timer",\n  "config": {\n    "duration": 120,\n    "mode": "countdown",\n    "label": "Time for a stretch break",\n    "completeMessage": "Ready to continue?",\n    "visual": "ring",\n    "warnings": [\n      { "atSeconds": 60, "message": "One minute left — finish up" },\n      { "atSeconds": 10, "message": "Almost done" }\n    ],\n    "interactive": false\n  }\n}',
    tips: [
      'Use short, concrete break lengths (1–5 minutes) for young or spectrum learners',
      'Add a warning 30–60 seconds before the end to support predictable transitions',
      'Provide a clear label and a calm completeMessage',
      'Visual time is primary — keep the digital readout on for accessibility',
    ],
    sidebarPosition: 10,
    relatedWidgets: [
      {
        id: 'core.callout',
        name: 'Callout',
        domain: 'core',
        slug: 'callout',
      },
      {
        id: 'core.audio-player',
        name: 'Audio Player',
        domain: 'core',
        slug: 'audio-player',
      },
      {
        id: 'math.clock-time',
        name: 'Clock Time',
        domain: 'math',
        slug: 'clock-time',
      },
    ],
  },
  id: WIDGET_ID,
  version: '1.0.0',
  name: 'Timer',
  description: 'Visual countdown/count-up timer for breaks and transitions',
  domain: 'core',
  schema: configSchema,
  render: TimerComponent,
  learningIntents: [LearningIntent.Observe, LearningIntent.Reflect],
  capabilities: {
    supportsObserveMode: true,
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsAccessibility: true,
    supportsOffline: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    tts: true,
    reducedMotion: true,
    focusManagement: true,
    ariaSupport: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackInteractions: true,
  },
  reward: {
    achievement: 'first-timer',
    positiveMessage: 'Break complete — great job!',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 2,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    readingLevel: 'pre-reader',
    recommendedAge: [3, 18],
    subjectTags: ['wellness', 'self-regulation', 'transitions'],
    learningObjectives: [
      'Use a visual timer to understand elapsed and remaining time',
      'Transition calmly between activities',
    ],
    commonMisconceptions: [
      'Understanding that the shrinking visual does not mean time is running out of control',
      'Confusing remaining time with elapsed time on a count-up timer',
    ],
    generationHints: [
      'Keep break length short and concrete (1-5 minutes) for young or spectrum learners',
      'Add a warning ~30-60s before the end to support predictable transitions',
      'Provide a clear label and a calm completeMessage',
    ],
    authoringPrompt: 'Create a timed break or transition with a visual countdown',
    exampleConfigs: [
      {
        duration: 120,
        mode: 'countdown',
        label: 'Time for a stretch break',
        visual: 'ring',
      },
      {
        duration: 300,
        mode: 'countdown',
        warnings: [{ atSeconds: 60, message: 'One minute left' }],
      },
      {
        mode: 'countup',
        label: 'Quiet reading time',
        interactive: true,
      },
    ],
  },
  icon: 'timer',
  keywords: ['timer', 'break', 'countdown', 'transition', 'pause', 'self-regulation'],
  status: 'stable',
};

export { TimerWidget as timer, configSchema as timerConfigSchema };
export default TimerWidget;
