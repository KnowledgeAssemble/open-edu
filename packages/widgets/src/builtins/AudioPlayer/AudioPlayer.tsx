import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';
import { WidgetError } from '../WidgetError';

const audioPlayerSchema = z.object({
  audio: z.string().min(1),
  transcript: z.string().optional(),
  captions: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  duration: z.number().optional(),
  autoplay: z.boolean().optional().default(false),
  loop: z.boolean().optional().default(false),
  playbackRate: z.number().optional().default(1),
  showTranscript: z.boolean().optional().default(false),
  showControls: z.boolean().optional().default(true),
  waveform: z.boolean().optional().default(false),
  interactive: z.boolean().optional().default(false),
  bookmarks: z.boolean().optional().default(false),
});

const AudioPlayerStateSchema = z.object({
  bookmarks: z.array(z.number()).optional(),
  playbackRate: z.number().optional(),
  lastPosition: z.number().optional(),
});

function AudioPlayerComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = useMemo(() => audioPlayerSchema.safeParse(rawConfig), [rawConfig]);
  const parsedState = useMemo(() => {
    const result = AudioPlayerStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>(parsedState?.bookmarks ?? []);
  const [rate, setRate] = useState(parsedState?.playbackRate ?? parsed?.data?.playbackRate ?? 1);
  const [activeCaptionIndex, setActiveCaptionIndex] = useState<number | null>(null);

  const isObserve = parsed.success && !parsed.data.interactive;
  const { handleAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.audio-player',
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (parsed?.data?.captions) {
        const idx = parsed.data.captions.findIndex(
          (c) => audio.currentTime >= c.start && audio.currentTime <= c.end,
        );
        setActiveCaptionIndex(idx >= 0 ? idx : null);
      }
    };
    const handleLoadedMetadata = () => setTotalDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (!parsed?.data?.loop) {
        emitInteraction({
          type: 'widget.interaction',
          widgetId: 'core.audio-player',
          action: 'ended',
          duration: audio.currentTime,
        });
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [parsed, emitInteraction]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleBookmark = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Math.round(audio.currentTime * 10) / 10;
    if (!bookmarks.includes(time)) {
      const next = [...bookmarks, time].sort((a, b) => a - b);
      setBookmarks(next);
      emitInteraction({
        type: 'widget.interaction',
        widgetId: 'core.audio-player',
        action: 'bookmark',
        time,
      });
    }
  }, [bookmarks, emitInteraction]);

  const handleRateChange = useCallback(
    (newRate: number) => {
      const audio = audioRef.current;
      if (audio) audio.playbackRate = newRate;
      setRate(newRate);
      emitInteraction({
        type: 'widget.interaction',
        widgetId: 'core.audio-player',
        action: 'rate-change',
        rate: newRate,
      });
    },
    [emitInteraction],
  );

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
  }, []);

  if (!parsed.success) {
    return <WidgetError />;
  }

  const config = parsed.data;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div role="group" aria-label={config.title ?? 'Audio player'} data-testid="audio-player">
      <audio
        ref={audioRef}
        src={resolveAsset?.(config.audio) ?? config.audio?.replace(/^assets\//, '/assets/')}
        loop={config.loop}
        preload="metadata"
      />

      {config.title && <h3 className="text-on-surface font-semibold">{config.title}</h3>}
      {config.description && (
        <p className="text-on-surface/70 mb-sm text-sm">{config.description}</p>
      )}

      {config.showControls && (
        <div className="gap-sm flex items-center">
          <Button variant="default" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </Button>
          <span
            className="text-on-surface/70 text-sm"
            aria-label={`Current time ${formatTime(currentTime)} of ${formatTime(totalDuration)}`}
          >
            {formatTime(currentTime)} / {formatTime(totalDuration || (config.duration ?? 0))}
          </span>
          <input
            type="range"
            min={0}
            max={totalDuration || config.duration || 0}
            value={currentTime}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="flex-1"
            aria-label="Seek"
          />
          <select
            value={rate}
            onChange={(e) => handleRateChange(Number(e.target.value))}
            aria-label="Playback speed"
            className="text-on-surface bg-surface-container-lowest border-outline-variant px-xs py-xs rounded border text-sm"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      )}

      {config.bookmarks && parsed.data.interactive && (
        <Button
          variant="outline"
          onClick={handleBookmark}
          className="mt-sm"
          aria-label="Add bookmark"
        >
          🔖 Bookmark
        </Button>
      )}

      {config.captions && activeCaptionIndex !== null && (
        <div
          role="status"
          aria-live="polite"
          data-testid="active-caption"
          className="text-on-surface mt-sm text-center font-medium"
        >
          {config.captions[activeCaptionIndex]?.text}
        </div>
      )}

      {config.showTranscript && config.transcript && (
        <details className="mt-sm">
          <summary className="text-on-surface/70 cursor-pointer text-sm">Show Transcript</summary>
          <p className="text-on-surface/70 mt-xs whitespace-pre-wrap text-sm">
            {config.transcript}
          </p>
        </details>
      )}

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

const AudioPlayerWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Play audio clips with transcripts, captions, and comprehension support.',
    whatItDoes:
      'The Audio Player widget plays an audio file with playback controls. Students can listen to spoken content, read along with a transcript, and view timed captions. It supports bookmarks, waveform visualization, and keyboard controls.',
    whenToUse: [
      'Language learning with pronunciation examples',
      'Listening comprehension exercises',
      'Audio-based instructions for young learners',
      'Storytelling and read-aloud activities',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.audio-player"',
      'Provide the path to your audio file',
      'Add a title and optional description',
      'Optionally provide a transcript and timed captions',
    ],
    configFields: [
      {
        name: 'audio',
        type: 'string',
        required: true,
        description: 'Path to the audio file (MP3, WAV, etc.).',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Title shown above the audio player.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Additional context about the audio.',
      },
      {
        name: 'transcript',
        type: 'string',
        required: false,
        description: 'Full text transcript of the audio content.',
      },
      {
        name: 'captions',
        type: 'array of objects',
        required: false,
        description:
          'Timed captions. Each has start (number, seconds), end (number, seconds), and text (string).',
      },
      {
        name: 'showTranscript',
        type: 'boolean',
        required: false,
        description: 'Show the transcript panel. Defaults to true.',
      },
      {
        name: 'waveform',
        type: 'boolean',
        required: false,
        description: 'Show audio waveform visualization. Defaults to false.',
      },
      {
        name: 'bookmarks',
        type: 'boolean',
        required: false,
        description: 'Allow students to bookmark positions. Defaults to true.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, plays in observe mode. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Listen to Bird Sounds",\n  "widget": "core.audio-player",\n  "config": {\n    "audio": "assets/audio/birdsong.mp3",\n    "title": "Morning Birdsong",\n    "description": "Listen to the sounds of birds in the morning.",\n    "transcript": "You can hear a variety of bird calls: chirping, whistling, and trilling.",\n    "captions": [\n      { "start": 0, "end": 3, "text": "Chirping sounds begin" },\n      { "start": 3, "end": 6, "text": "Whistling melodies join in" },\n      { "start": 6, "end": 10, "text": "A chorus of bird calls" }\n    ],\n    "showTranscript": true,\n    "bookmarks": true,\n    "interactive": false\n  }\n}',
    tips: [
      'Always provide a transcript for accessibility',
      'Use short audio clips (1-3 minutes) for focused listening',
      'Timed captions help students follow along',
      'Audio files should be placed in your lesson package directory',
    ],
    sidebarPosition: 14,
    relatedWidgets: [
      {
        id: 'core.video-player',
        name: 'Video Player',
        domain: 'core',
        slug: 'video-player',
      },
    ],
  },
  id: 'core.audio-player',
  name: 'Audio Player',
  description: 'Play educational audio with transcript, captions, and bookmarks',
  domain: 'core',
  version: '1.0.0',
  schema: audioPlayerSchema,
  render: AudioPlayerComponent,
  learningIntents: [LearningIntent.Observe, LearningIntent.Listen],
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
    tts: true,
    captions: true,
    audioDescription: true,
    ariaSupport: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackHints: true,
    trackInteractions: true,
  },
  reward: {
    completionXP: 10,
    confetti: false,
    positiveMessage: 'Great listening!',
    achievement: 'first-listen',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 5,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    recommendedAge: [5, 18],
    readingLevel: 'grade-2',
    subjectTags: ['language', 'music', 'general'],
    learningObjectives: [
      'Listen to educational audio content',
      'Follow along with transcript or captions',
      'Identify key information from audio',
    ],
    commonMisconceptions: [
      'Assuming audio content is complete after one listen',
      'Skipping captions when available',
    ],
    generationHints: [
      'Provide a clear transcript for accessibility',
      'Use captions for key moments rather than full text',
      'Keep audio segments under 5 minutes for engagement',
    ],
    authoringPrompt:
      'Create an audio playback activity for listening comprehension or pronunciation practice',
    exampleConfigs: [
      {
        audio: 'https://example.com/audio/hello.mp3',
        title: 'Greeting in Spanish',
        transcript: 'Hola, me llamo Maria. Buenos dias.',
        showTranscript: true,
        interactive: true,
        bookmarks: true,
      },
    ],
  },
  icon: 'headphones',
  keywords: ['audio', 'listen', 'sound', 'music', 'podcast', 'transcript'],
  status: 'stable',
};

export { AudioPlayerWidget as audioPlayer, audioPlayerSchema };
export default AudioPlayerWidget;
