import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

const regionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  image: z.string().optional(),
  audio: z.string().optional(),
  video: z.string().optional(),
  tooltip: z.string().optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100).optional().default(10),
  height: z.number().min(0).max(100).optional().default(10),
});

export const imageLabelSchema = z.object({
  image: z.string().min(1),
  altText: z.string().optional(),
  regions: z.array(regionSchema).min(1),
  interactive: z.boolean().optional().default(false),
  hints: z.array(z.string()).optional(),
});

export type ImageLabelConfig = z.infer<typeof imageLabelSchema>;

const ImageLabelStateSchema = z.object({
  acknowledged: z.boolean(),
  attemptCount: z.number(),
  hintIndex: z.number(),
});

function InfoCard({
  region,
  onClose,
  cardRef,
  resolveAsset,
}: {
  region: z.infer<typeof regionSchema>;
  onClose: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
  resolveAsset?: (path: string) => string;
}) {
  const titleId = `image-label-card-title-${region.id}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hasMedia = region.image || region.audio || region.video;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      data-testid={`info-card-${region.id}`}
      style={{
        position: 'absolute',
        zIndex: 50,
        minWidth: '200px',
        maxWidth: '300px',
        padding: '0.75rem',
        border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
        borderRadius: '0.5rem',
        backgroundColor: 'var(--oe-color-surface, #ffffff)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.5rem',
        }}
      >
        <h3
          id={titleId}
          data-testid="info-card-title"
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--oe-color-on-surface, #111827)',
          }}
        >
          {region.title}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          data-testid="info-card-close"
          aria-label="Close"
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: 'var(--oe-color-on-surface-variant, #6b7280)',
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            lineHeight: 1,
          }}
        >
          ✕
        </Button>
      </div>
      {region.description && (
        <p
          data-testid="info-card-description"
          style={{
            margin: '0.25rem 0',
            fontSize: '0.875rem',
            color: 'var(--oe-color-on-surface-variant, #6b7280)',
            lineHeight: 1.5,
          }}
        >
          {region.description}
        </p>
      )}
      {hasMedia && (
        <div style={{ marginTop: '0.5rem' }}>
          {region.image && (
            <img
              src={
                resolveAsset?.(region.image) ?? `/assets/${region.image.replace(/^assets\//, '')}`
              }
              alt={region.title}
              data-testid="info-card-image"
              style={{ width: '100%', height: 'auto', borderRadius: '0.25rem' }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ImageLabelComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = imageLabelSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;
  const hasValidContent = parsed.success && content && content.regions.length > 0;

  const parsedState = useMemo(() => {
    const result = ImageLabelStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [acknowledged, setAcknowledged] = useState(parsedState?.acknowledged ?? false);
  const [attemptCount, setAttemptCount] = useState(parsedState?.attemptCount ?? 0);
  const [hintIndex, setHintIndex] = useState(parsedState?.hintIndex ?? 0);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [quizRegionId, setQuizRegionId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [tooltipRegionId, setTooltipRegionId] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isObserve = content?.interactive !== true;
  const regions = content?.regions ?? [];
  const maxAttempts = 3;

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && hasValidContent && !submitted,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'science.image-label',
  });

  const initializeQuiz = useCallback(() => {
    if (!content || content.regions.length === 0) return;
    const idx = Math.floor(Math.random() * content.regions.length);
    const region = content.regions[idx];
    if (region) {
      setQuizRegionId(region.id);
    }
  }, [content]);

  useEffect(() => {
    if (!isObserve && hasValidContent && !quizRegionId && !submitted) {
      initializeQuiz();
    }
  }, [isObserve, hasValidContent, quizRegionId, submitted, initializeQuiz]);

  const handleRegionClick = useCallback(
    (regionId: string) => {
      if (submitted) return;
      const region = regions.find((r) => r.id === regionId);
      if (!region) return;

      emitInteraction({
        type: 'widget.interaction',
        action: 'click',
        regionId,
        title: region.title,
        widgetId: 'science.image-label',
      });

      if (isObserve) {
        setSelectedRegionId(regionId === selectedRegionId ? null : regionId);
        setAcknowledged(true);
        if (!acknowledged) {
          complete(100, { acknowledged: true, attemptCount: 0, hintIndex });
          setAcknowledged(true);
        }
      } else {
        if (!quizRegionId) return;
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);

        if (regionId === quizRegionId) {
          setFeedbackMessage('Correct!');
          setFeedbackType('success');
          setSubmitted(true);
          const score = 100;
          emitInteraction({
            type: 'widget.interaction',
            action: 'answer',
            correct: true,
            attemptCount: newAttemptCount,
            regionId,
            widgetId: 'science.image-label',
          });
          complete(score, {
            acknowledged: true,
            attemptCount: newAttemptCount,
            hintIndex,
          });
        } else {
          if (newAttemptCount >= maxAttempts) {
            setFeedbackMessage(
              `The correct region was: ${regions.find((r) => r.id === quizRegionId)?.title}`,
            );
            setFeedbackType('error');
            setSelectedRegionId(quizRegionId);
            setSubmitted(true);
            emitInteraction({
              type: 'widget.interaction',
              action: 'answer',
              correct: false,
              attemptCount: newAttemptCount,
              widgetId: 'science.image-label',
            });
            complete(0, {
              acknowledged: true,
              attemptCount: newAttemptCount,
              hintIndex,
            });
          } else {
            setFeedbackMessage(`Try again. Attempts remaining: ${maxAttempts - newAttemptCount}`);
            setFeedbackType('error');
            setSelectedRegionId(null);
          }
        }
      }
    },
    [
      isObserve,
      submitted,
      regions,
      selectedRegionId,
      acknowledged,
      quizRegionId,
      attemptCount,
      hintIndex,
      emitInteraction,
      complete,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, regionId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRegionClick(regionId);
      }
    },
    [handleRegionClick],
  );

  const handleCardClose = useCallback(() => {
    setSelectedRegionId(null);
  }, []);

  const handleTryAgain = useCallback(() => {
    setSubmitted(false);
    setFeedbackMessage(null);
    setFeedbackType(null);
    setSelectedRegionId(null);
    setAttemptCount(0);
    setHintIndex(0);
    setQuizRegionId(null);
  }, []);

  const handleHintClick = useCallback(() => {
    if (content?.hints && hintIndex < content.hints.length) {
      setHintIndex((i) => i + 1);
    }
  }, [content?.hints, hintIndex]);

  useEffect(() => {
    if (!selectedRegionId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-testid^="image-label-region-"]')) {
          setSelectedRegionId(null);
        }
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedRegionId]);

  if (!hasValidContent) {
    return (
      <div
        role="alert"
        data-testid="widget-config-error"
        style={{
          padding: '1rem',
          border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--oe-color-surface-container-lowest, #f9fafb)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontWeight: 600, color: 'var(--oe-color-on-surface, #111827)' }}>
          This activity could not be loaded.
        </p>
      </div>
    );
  }

  const selectedRegion = selectedRegionId ? regions.find((r) => r.id === selectedRegionId) : null;

  return (
    <div
      ref={containerRef}
      data-testid="image-label"
      role="group"
      aria-label="Interactive image regions"
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          maxWidth: '100%',
        }}
      >
        <img
          src={resolveAsset?.(content.image) ?? `/assets/${content.image.replace(/^assets\//, '')}`}
          alt={content.altText || 'Interactive educational image'}
          data-testid="image-label-image"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {regions.map((region) => {
          const isSelected = selectedRegionId === region.id;
          const isQuizTarget = !isObserve && quizRegionId === region.id;
          const isRevealed = submitted && selectedRegionId === region.id;

          let borderColor = 'var(--oe-color-outline-variant, #d1d5db)';
          let backgroundColor = 'transparent';
          const cursor = 'pointer';

          if (isObserve) {
            if (isSelected) {
              borderColor = 'var(--oe-color-primary, #3b82f6)';
              backgroundColor = 'rgba(59, 130, 246, 0.15)';
            }
          } else {
            if (isRevealed || (submitted && region.id === quizRegionId)) {
              borderColor = 'var(--oe-success, #22c55e)';
              backgroundColor = 'rgba(34, 197, 94, 0.2)';
            } else if (isSelected && !submitted) {
              borderColor = 'var(--oe-error, #ef4444)';
              backgroundColor = 'rgba(239, 68, 68, 0.15)';
            } else if (isQuizTarget && !submitted) {
              borderColor = 'var(--oe-color-primary, #3b82f6)';
              backgroundColor = 'rgba(59, 130, 246, 0.1)';
            }
          }

          const baseStyle: React.CSSProperties = {
            position: 'absolute',
            left: `${region.x}%`,
            top: `${region.y}%`,
            width: `${region.width}%`,
            height: `${region.height}%`,
            border: isObserve ? `2px dashed ${borderColor}` : `2px solid ${borderColor}`,
            borderRadius: isObserve ? '0.25rem' : '50%',
            backgroundColor,
            cursor: submitted ? 'default' : cursor,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          };

          return (
            <div key={region.id}>
              <div
                data-testid={`image-label-region-${region.id}`}
                role="button"
                tabIndex={submitted ? -1 : 0}
                aria-label={region.title}
                aria-pressed={isSelected}
                style={baseStyle}
                onClick={() => handleRegionClick(region.id)}
                onKeyDown={(e) => handleKeyDown(e, region.id)}
                onMouseEnter={() => {
                  if (!isObserve) return;
                  setTooltipRegionId(region.id);
                }}
                onMouseLeave={() => setTooltipRegionId(null)}
                onFocus={() => {
                  if (!isObserve) return;
                  setTooltipRegionId(region.id);
                }}
                onBlur={() => setTooltipRegionId(null)}
              >
                {isObserve && isSelected && (
                  <span
                    style={{
                      color: 'var(--oe-color-primary, #3b82f6)',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    }}
                  >
                    ✓
                  </span>
                )}
                {!isObserve && isRevealed && (
                  <span
                    style={{
                      color: 'var(--oe-success, #22c55e)',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    }}
                  >
                    ✓
                  </span>
                )}
                {!isObserve && isSelected && !submitted && (
                  <span
                    style={{
                      color: 'var(--oe-error, #ef4444)',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    }}
                  >
                    ✗
                  </span>
                )}
              </div>
              {isObserve && tooltipRegionId === region.id && region.tooltip && (
                <div
                  data-testid={`region-tooltip-${region.id}`}
                  role="tooltip"
                  style={{
                    position: 'absolute',
                    left: `${region.x + region.width / 2}%`,
                    top: `${region.y - 2}%`,
                    transform: 'translate(-50%, -100%)',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'var(--oe-color-inverse-surface, #374151)',
                    color: 'var(--oe-color-inverse-on-surface, #f9fafb)',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    zIndex: 60,
                    pointerEvents: 'none',
                  }}
                >
                  {region.tooltip}
                </div>
              )}
              {isObserve && selectedRegionId === region.id && selectedRegion && (
                <InfoCard
                  region={selectedRegion}
                  onClose={handleCardClose}
                  cardRef={cardRef}
                  resolveAsset={resolveAsset}
                />
              )}
            </div>
          );
        })}
      </div>

      {!isObserve && quizRegionId && !submitted && (
        <div
          role="status"
          aria-live="polite"
          data-testid="image-label-quiz-prompt"
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
            borderRadius: '0.375rem',
            backgroundColor: 'var(--oe-color-surface-container-lowest, #f9fafb)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500, color: 'var(--oe-color-on-surface, #111827)' }}>
            {regions.find((r) => r.id === quizRegionId)?.description ||
              `Find: ${regions.find((r) => r.id === quizRegionId)?.title}`}
          </p>
        </div>
      )}

      {feedbackMessage && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="feedback"
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            backgroundColor:
              feedbackType === 'success'
                ? 'var(--oe-color-success-container, #dcfce7)'
                : feedbackType === 'error'
                  ? 'var(--oe-color-error-container, #fee2e2)'
                  : 'transparent',
            color:
              feedbackType === 'success'
                ? 'var(--oe-color-on-success-container, #166534)'
                : feedbackType === 'error'
                  ? 'var(--oe-color-on-error-container, #991b1b)'
                  : 'var(--oe-color-on-surface, #111827)',
          }}
        >
          <p style={{ margin: 0 }}>{feedbackMessage}</p>
        </div>
      )}

      {!isObserve && submitted && !feedbackMessage?.includes('Correct') && (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="default" onClick={handleTryAgain} data-testid="try-again-button">
            Try Again
          </Button>
        </div>
      )}

      {!isObserve && !submitted && content?.hints && hintIndex < content.hints.length && (
        <div style={{ marginTop: '0.5rem' }}>
          <Button variant="ghost" size="sm" onClick={handleHintClick} data-testid="hint-button">
            {hintIndex === 0 ? 'Show hint' : 'More help'}
          </Button>
        </div>
      )}

      {!isObserve &&
        hintIndex > 0 &&
        content?.hints &&
        hintIndex <= content.hints.length &&
        !submitted && (
          <div
            role="status"
            aria-live="polite"
            data-testid="hint-text"
            style={{
              marginTop: '0.5rem',
              color: 'var(--oe-color-on-surface-variant, #6b7280)',
              fontStyle: 'italic',
              fontSize: '0.875rem',
            }}
          >
            <p style={{ margin: 0 }}>Hint: {content.hints[hintIndex - 1]}</p>
          </div>
        )}

      {isObserve && showAcknowledgeButton && (
        <div style={{ marginTop: '1rem' }}>
          <Button
            variant="default"
            onClick={() => {
              setAcknowledged(true);
              handleObserveAcknowledge();
            }}
            data-testid="observe-acknowledge"
          >
            Mark as explored ✓
          </Button>
        </div>
      )}

      {isObserve && !showAcknowledgeButton && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="observe-complete"
          style={{ marginTop: '0.5rem' }}
        >
          <p style={{ color: 'var(--oe-color-on-surface-variant, #6b7280)' }}>Content explored.</p>
        </div>
      )}
    </div>
  );
}

const ImageLabelWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Tap regions of an image to identify and learn about them.',
    whatItDoes:
      'The Image Label widget shows an image with tappable regions. When students tap a region, they see its name and description. It works like an interactive exploration tool — great for planetariums, maps, and detailed diagrams.',
    whenToUse: [
      'Interactive exploration of labeled images',
      'Solar system and astronomy activities',
      'Museum-style exhibit exploration',
      'Teaching visual identification skills',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "science.image-label"',
      'Provide an image with alt text',
      'Define clickable regions with x/y positions, titles, and descriptions',
      'Optionally add hints for guided exploration',
    ],
    configFields: [
      {
        name: 'image',
        type: 'string',
        required: true,
        description: 'Path to the image file.',
      },
      {
        name: 'altText',
        type: 'string',
        required: true,
        description: 'Description of the image for screen readers.',
      },
      {
        name: 'regions',
        type: 'array of objects',
        required: true,
        description:
          'Clickable regions. Each has id (string), title (string), description (string), x (number), y (number), and optional tooltip (string).',
      },
      {
        name: 'hints',
        type: 'array of strings',
        required: false,
        description: 'Hints to guide exploration.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, regions can still be tapped for information. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Solar System Explorer",\n  "widget": "science.image-label",\n  "config": {\n    "image": "assets/images/solar-system.png",\n    "altText": "Solar system with clickable planets",\n    "regions": [\n      { "id": "mars", "title": "Mars", "description": "The Red Planet, 4th from the Sun", "x": 45, "y": 30, "tooltip": "Click to learn about Mars" },\n      { "id": "jupiter", "title": "Jupiter", "description": "Largest planet in our solar system", "x": 60, "y": 50, "tooltip": "Click to learn about Jupiter" },\n      { "id": "earth", "title": "Earth", "description": "Our home planet, 3rd from the Sun", "x": 35, "y": 40, "tooltip": "Click to learn about Earth" }\n    ],\n    "interactive": false,\n    "hints": ["Mars is known as the Red Planet", "Jupiter is the largest planet"]\n  }\n}',
    tips: [
      'Use images with clearly defined, non-overlapping regions',
      'Keep region descriptions concise — 1-2 sentences',
      'Position regions carefully to cover the right part of the image',
      'Add tooltips to hint at what students will discover',
    ],
    sidebarPosition: 2,
    relatedWidgets: [
      {
        id: 'science.label-diagram',
        name: 'Label Diagram',
        domain: 'science',
        slug: 'label-diagram',
      },
      {
        id: 'core.hotspot',
        name: 'Hotspot',
        domain: 'core',
        slug: 'hotspot',
      },
    ],
  },
  id: 'science.image-label',
  version: '0.2.0',
  schema: imageLabelSchema,
  name: 'Image Label',
  description: 'Identify and label parts of an image or photograph',
  domain: 'science',
  learningIntents: [LearningIntent.Observe, LearningIntent.Apply],
  capabilities: {
    supportsObserveMode: true,
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
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
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
    achievement: 'image-label-explorer',
    positiveMessage: 'Image regions explored!',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 3,
    bloomsLevel: 'apply',
    cognitiveLoad: 'moderate',
    subjectTags: ['science', 'geography', 'biology'],
    recommendedAge: [6, 16],
    readingLevel: 'grade-2',
    learningObjectives: [
      'Identify specific regions or elements in an image',
      'Recognize spatial relationships between objects',
      'Apply knowledge to locate areas on a visual reference',
    ],
    commonMisconceptions: [
      'Clicking on regions with visually similar appearance',
      'Confusing adjacent regions with similar labels',
    ],
    generationHints: [
      'Use clear images with distinct regions',
      'Make region targets large enough for touch interaction',
      'Limit regions to 3-8 for optimal engagement',
      'Provide descriptive alt text for accessibility',
    ],
    exampleConfigs: [
      {
        image: 'assets/images/solar-system.png',
        regions: [
          { id: 'mars', title: 'Mars', description: 'The Red Planet', x: 45, y: 30 },
          { id: 'jupiter', title: 'Jupiter', description: 'Largest planet', x: 60, y: 50 },
        ],
      },
      {
        image: 'assets/images/plant-anatomy.png',
        regions: [
          { id: 'roots', title: 'Roots', description: 'Below the soil', x: 50, y: 90 },
          { id: 'stem', title: 'Stem', description: 'Supports the plant', x: 50, y: 60 },
        ],
      },
    ],
  },
  icon: 'image',
  keywords: ['image', 'label', 'identify', 'photo', 'region', 'explore'],
  status: 'stable',
  render: ImageLabelComponent,
};

export { ImageLabelWidget as imageLabel };
export default ImageLabelWidget;
