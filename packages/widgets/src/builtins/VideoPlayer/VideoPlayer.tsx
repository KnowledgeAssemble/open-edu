import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';
import { WidgetError } from '../WidgetError';

const chapterSchema = z.object({
  time: z.number(),
  title: z.string(),
});

const videoPlayerSchema = z.object({
  video: z.string().min(1),
  poster: z.string().optional(),
  title: z.string().optional(),
  captions: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).optional(),
  chapters: z.array(chapterSchema).optional(),
  transcript: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  showTranscript: z.boolean().optional().default(false),
  allowFullscreen: z.boolean().optional().default(true),
  interactive: z.boolean().optional().default(false),
});

const VideoPlayerStateSchema = z.object({
  lastPosition: z.number().optional(),
  watchedChapters: z.array(z.number()).optional(),
  bookmarks: z.array(z.number()).optional(),
});

function VideoPlayerComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = useMemo(() => videoPlayerSchema.safeParse(rawConfig), [rawConfig]);
  const parsedState = useMemo(() => {
    const result = VideoPlayerStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [activeCaptionIndex, setActiveCaptionIndex] = useState<number | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number | null>(null);
  const activeChapterIndexRef = useRef(activeChapterIndex);
  useEffect(() => {
    activeChapterIndexRef.current = activeChapterIndex;
  }, [activeChapterIndex]);
  const [bookmarks, setBookmarks] = useState<number[]>(parsedState?.bookmarks ?? []);

  const isObserve = parsed.success && !parsed.data.interactive;
  const { handleAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.video-player',
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (parsed?.data?.captions) {
        const idx = parsed.data.captions.findIndex(
          (c) => video.currentTime >= c.start && video.currentTime <= c.end,
        );
        setActiveCaptionIndex(idx >= 0 ? idx : null);
      }
      if (parsed?.data?.chapters) {
        let chIdx = 0;
        for (let i = parsed.data.chapters.length - 1; i >= 0; i--) {
          if (video.currentTime >= parsed.data.chapters[i]!.time) {
            chIdx = i;
            break;
          }
        }
        if (chIdx !== activeChapterIndexRef.current) setActiveChapterIndex(chIdx);
      }
    };
    const handleLoadedMetadata = () => setTotalDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      emitInteraction({
        type: 'widget.interaction',
        widgetId: 'core.video-player',
        action: 'ended',
        duration: video.currentTime,
      });
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [parsed, emitInteraction]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = time;
  }, []);

  const handleBookmark = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const time = Math.round(video.currentTime * 10) / 10;
    if (!bookmarks.includes(time)) {
      setBookmarks((prev) => [...prev, time].sort((a, b) => a - b));
      emitInteraction({
        type: 'widget.interaction',
        widgetId: 'core.video-player',
        action: 'bookmark',
        time,
      });
    }
  }, [bookmarks, emitInteraction]);

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
    <div role="group" aria-label={config.title ?? 'Video player'} data-testid="video-player">
      <video
        ref={videoRef}
        src={
          resolveAsset && config.video
            ? resolveAsset(config.video)
            : config.video?.replace(/^assets\//, '/assets/')
        }
        poster={
          resolveAsset && config.poster
            ? resolveAsset(config.poster)
            : config.poster?.replace(/^assets\//, '/assets/')
        }
        preload="metadata"
        className="w-full rounded-lg"
      />

      {config.title && <h3 className="text-on-surface mt-sm font-semibold">{config.title}</h3>}

      <div className="gap-sm mt-sm flex items-center">
        <Button variant="default" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </Button>
        <span className="text-on-surface/70 text-sm">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
        <input
          type="range"
          min={0}
          max={totalDuration || 0}
          value={currentTime}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="flex-1"
          aria-label="Seek"
        />
        {config.interactive && (
          <Button variant="outline" onClick={handleBookmark} aria-label="Add bookmark">
            🔖
          </Button>
        )}
      </div>

      {config.chapters && config.chapters.length > 0 && (
        <div className="mt-sm gap-xs flex flex-wrap">
          {config.chapters.map((ch, idx) => (
            <Button
              key={idx}
              variant={idx === activeChapterIndex ? 'default' : 'outline'}
              size="sm"
              onClick={() => seekTo(ch.time)}
              aria-label={`Chapter: ${ch.title}`}
            >
              {ch.title}
            </Button>
          ))}
        </div>
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

const VideoPlayerWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Play video clips with chapters, captions, and transcripts.',
    whatItDoes:
      'The Video Player widget plays a video file with full playback controls. Students can watch educational videos with chapter navigation, timed captions, and a transcript panel. It supports fullscreen mode and keyboard shortcuts.',
    whenToUse: [
      'Showing educational animations and demonstrations',
      'Video-based science experiments',
      'Visual explanations of complex concepts',
      'Documentary-style content for older students',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.video-player"',
      'Provide the path to your video file',
      'Optionally add a poster image for the thumbnail',
      'Add chapters for easy navigation, captions for accessibility',
    ],
    configFields: [
      {
        name: 'video',
        type: 'string',
        required: true,
        description: 'Path to the video file (MP4 recommended).',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Title shown above the video player.',
      },
      {
        name: 'poster',
        type: 'string',
        required: false,
        description: 'Path to a poster image shown before the video plays.',
      },
      {
        name: 'chapters',
        type: 'array of objects',
        required: false,
        description: 'Video chapters. Each has time (number, seconds) and title (string).',
      },
      {
        name: 'captions',
        type: 'array of objects',
        required: false,
        description: 'Timed captions. Each has start (number), end (number), and text (string).',
      },
      {
        name: 'transcript',
        type: 'string',
        required: false,
        description: 'Full text transcript of the video content.',
      },
      {
        name: 'showTranscript',
        type: 'boolean',
        required: false,
        description: 'Show the transcript panel. Defaults to true.',
      },
      {
        name: 'allowFullscreen',
        type: 'boolean',
        required: false,
        description: 'Allow fullscreen mode. Defaults to true.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, plays in observe mode. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Photosynthesis Video",\n  "widget": "core.video-player",\n  "config": {\n    "video": "assets/video/photosynthesis.mp4",\n    "title": "Understanding Photosynthesis",\n    "chapters": [\n      { "time": 0, "title": "Introduction" },\n      { "time": 60, "title": "Light Reactions" },\n      { "time": 180, "title": "Calvin Cycle" }\n    ],\n    "showTranscript": true,\n    "interactive": false\n  }\n}',
    tips: [
      'Use short, focused clips (1-5 minutes)',
      'Always add captions for accessibility',
      'Chapters help students navigate to specific sections',
      'Video files should be placed in your lesson package directory',
    ],
    sidebarPosition: 15,
    relatedWidgets: [
      {
        id: 'core.audio-player',
        name: 'Audio Player',
        domain: 'core',
        slug: 'audio-player',
      },
    ],
  },
  id: 'core.video-player',
  name: 'Video Player',
  description: 'Educational video playback with chapters, captions, and transcript',
  domain: 'core',
  version: '1.0.0',
  schema: videoPlayerSchema,
  render: VideoPlayerComponent,
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
    supportsLocalization: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    tts: true,
    captions: true,
    audioDescription: true,
    reducedMotion: true,
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
    positiveMessage: 'Great watching!',
    achievement: 'first-watch',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 10,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    recommendedAge: [5, 18],
    readingLevel: 'grade-3',
    subjectTags: ['general', 'science', 'history'],
    learningObjectives: [
      'Watch and comprehend educational video content',
      'Navigate between video chapters',
      'Follow along with captions and transcript',
    ],
    commonMisconceptions: [
      'Watching without pausing to reflect on content',
      'Ignoring chapter markers that organize key concepts',
    ],
    generationHints: [
      'Break long videos into chapters with clear titles',
      'Provide captions for accessibility',
      'Include a transcript for reference',
    ],
    authoringPrompt: 'Create a video playback activity for demonstration or explanation content',
    exampleConfigs: [
      {
        video: 'https://example.com/video/photosynthesis.mp4',
        title: 'Photosynthesis Explained',
        chapters: [
          { time: 0, title: 'Introduction' },
          { time: 60, title: 'Light Reactions' },
          { time: 180, title: 'Calvin Cycle' },
        ],
        showTranscript: true,
        interactive: true,
      },
    ],
  },
  icon: 'play-circle',
  keywords: ['video', 'watch', 'play', 'chapters', 'captions', 'demonstration'],
  status: 'stable',
};

export { VideoPlayerWidget as videoPlayer, videoPlayerSchema };
export default VideoPlayerWidget;
