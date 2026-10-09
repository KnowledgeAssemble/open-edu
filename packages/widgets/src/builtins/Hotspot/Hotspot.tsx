import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

const hotspotItemSchema = z.object({
  id: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  radius: z.number().optional().default(5),
  label: z.string(),
  correct: z.boolean().optional().default(false),
  description: z.string().optional(),
  hint: z.string().optional(),
});

const hotspotSchema = z.object({
  image: z.string().min(1),
  altText: z.string().min(1),
  hotspots: z.array(hotspotItemSchema).min(1),
  mode: z.enum(['single', 'multiple']).default('single'),
  interactive: z.boolean().optional().default(true),
  hints: z.array(z.string()).optional(),
});

export type HotspotConfig = z.infer<typeof hotspotSchema>;

const HotspotStateSchema = z.object({
  selectedIds: z.array(z.string()),
  submitted: z.boolean(),
  attemptCount: z.number(),
  hintIndex: z.number(),
});

function HotspotComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = hotspotSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;
  const hasValidContent = parsed.success && content && content.hotspots.length > 0;

  const parsedState = useMemo(() => {
    const result = HotspotStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [selectedIds, setSelectedIds] = useState<string[]>(parsedState?.selectedIds ?? []);
  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [attemptCount, setAttemptCount] = useState(parsedState?.attemptCount ?? 0);
  const [hintIndex, setHintIndex] = useState(parsedState?.hintIndex ?? 0);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | null>(null);

  const isObserve = content?.interactive !== true;
  const hotspots = content?.hotspots ?? [];
  const mode = content?.mode ?? 'single';
  const maxAttempts = 3;

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && hasValidContent,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.hotspot',
  });

  const handleHotspotClick = useCallback(
    (hotspotId: string) => {
      if (submitted || isObserve) return;
      setFeedbackMessage(null);
      setFeedbackType(null);

      const hotspot = hotspots.find((h) => h.id === hotspotId);
      if (!hotspot) return;

      if (mode === 'single') {
        setSelectedIds([hotspotId]);
        emitInteraction({
          type: 'widget.interaction',
          action: 'click',
          hotspotId,
          label: hotspot.label,
          widgetId: 'core.hotspot',
        });

        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);

        if (hotspot.correct) {
          setFeedbackMessage('Correct!');
          setFeedbackType('success');
          complete(100, {
            selectedIds: [hotspotId],
            submitted: true,
            attemptCount: newAttemptCount,
            hintIndex,
          });
          setSubmitted(true);
        } else {
          if (newAttemptCount >= maxAttempts) {
            setFeedbackMessage('No more attempts. The correct answer has been revealed.');
            setFeedbackType('error');
            const correctHotspot = hotspots.find((h) => h.correct);
            setSelectedIds(correctHotspot ? [correctHotspot.id] : []);
            complete(0, {
              selectedIds: correctHotspot ? [correctHotspot.id] : [],
              submitted: true,
              attemptCount: newAttemptCount,
              hintIndex,
            });
            setSubmitted(true);
          } else {
            setFeedbackMessage(`Try again. Attempts remaining: ${maxAttempts - newAttemptCount}`);
            setFeedbackType('error');
          }
        }
      } else {
        setSelectedIds((prev) =>
          prev.includes(hotspotId) ? prev.filter((id) => id !== hotspotId) : [...prev, hotspotId],
        );
      }
    },
    [submitted, isObserve, mode, hotspots, attemptCount, hintIndex, emitInteraction, complete],
  );

  const handleSubmit = useCallback(() => {
    if (submitted || !content || mode !== 'multiple') return;

    const correctHotspots = hotspots.filter((h) => h.correct);
    const correctCount = selectedIds.filter((id) => {
      const hotspot = hotspots.find((h) => h.id === id);
      return hotspot?.correct;
    }).length;
    const totalCorrect = correctHotspots.length;
    const score = totalCorrect > 0 ? Math.round((correctCount / totalCorrect) * 100) : 0;

    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      selectedIds,
      correctCount,
      totalCorrect,
      score,
      widgetId: 'core.hotspot',
    });
    complete(score, { selectedIds, submitted: true, attemptCount, hintIndex });
    setSubmitted(true);
    setFeedbackMessage(
      score >= 100 ? 'All correct!' : `${correctCount} of ${totalCorrect} correct.`,
    );
    setFeedbackType(score >= 100 ? 'success' : 'error');
  }, [
    submitted,
    content,
    mode,
    hotspots,
    selectedIds,
    attemptCount,
    hintIndex,
    emitInteraction,
    complete,
  ]);

  const handleHintClick = useCallback(() => {
    if (content?.hints && hintIndex < content.hints.length - 1) {
      setHintIndex((i) => i + 1);
    }
  }, [content?.hints, hintIndex]);

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

  const getHotspotStyle = (hotspot: z.infer<typeof hotspotItemSchema>): React.CSSProperties => {
    const isSelected = selectedIds.includes(hotspot.id);
    const isCorrectHotspot = hotspot.correct;
    const minSize = Math.max(hotspot.radius * 2, 20);

    let backgroundColor = 'rgba(59, 130, 246, 0.15)';
    let borderColor = 'var(--oe-color-primary, #3b82f6)';
    let cursor = 'pointer';

    if (submitted || isObserve) {
      if (isCorrectHotspot) {
        backgroundColor = 'rgba(34, 197, 94, 0.3)';
        borderColor = 'var(--oe-success, #22c55e)';
      } else if (isSelected && !hotspot.correct && submitted) {
        backgroundColor = 'rgba(239, 68, 68, 0.3)';
        borderColor = 'var(--oe-error, #ef4444)';
      } else {
        backgroundColor = 'rgba(59, 130, 246, 0.1)';
        borderColor = 'var(--oe-color-outline-variant, #d1d5db)';
        cursor = 'default';
      }
    } else if (isSelected) {
      backgroundColor =
        mode === 'single'
          ? hotspot.correct
            ? 'rgba(34, 197, 94, 0.3)'
            : 'rgba(239, 68, 68, 0.3)'
          : 'rgba(59, 130, 246, 0.3)';
      borderColor =
        mode === 'single'
          ? hotspot.correct
            ? 'var(--oe-success, #22c55e)'
            : 'var(--oe-error, #ef4444)'
          : 'var(--oe-color-primary, #3b82f6)';
    }

    if (isObserve && isCorrectHotspot) {
      backgroundColor = 'rgba(34, 197, 94, 0.3)';
      borderColor = 'var(--oe-success, #22c55e)';
    }

    return {
      position: 'absolute',
      left: `${hotspot.x}%`,
      top: `${hotspot.y}%`,
      transform: 'translate(-50%, -50%)',
      width: `${minSize}px`,
      height: `${minSize}px`,
      borderRadius: '50%',
      backgroundColor,
      border: `2px solid ${borderColor}`,
      cursor: submitted || isObserve ? 'default' : cursor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
    };
  };

  if (isObserve) {
    return (
      <div data-testid="hotspot" aria-label="Hotspot regions" role="group">
        <div role="status" aria-live="polite">
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
            }}
          >
            <img
              src={
                resolveAsset?.(content.image) ?? `/assets/${content.image.replace(/^assets\//, '')}`
              }
              alt={content.altText}
              data-testid="hotspot-image"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            {hotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                data-testid={`observe-hotspot-${hotspot.id}`}
                style={getHotspotStyle(hotspot)}
                aria-label={hotspot.label}
                aria-hidden="true"
              >
                {hotspot.correct && (
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
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            {hotspots
              .filter((h) => h.correct)
              .map((hotspot) => (
                <div
                  key={hotspot.id}
                  data-testid={`observe-description-${hotspot.id}`}
                  style={{
                    padding: '0.5rem',
                    margin: '0.25rem 0',
                    border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
                    borderRadius: '0.25rem',
                    backgroundColor: 'var(--oe-color-success-container, #dcfce7)',
                  }}
                >
                  <strong>{hotspot.label}</strong>
                  {hotspot.description && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
                      {hotspot.description}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
        {!showAcknowledgeButton && (
          <div role="status" aria-live="assertive" data-testid="observe-complete">
            <p>Content acknowledged.</p>
          </div>
        )}
        {showAcknowledgeButton && !submitted && (
          <div style={{ marginTop: '1rem' }}>
            <Button variant="default" onClick={handleObserveAcknowledge}>
              Acknowledge
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="hotspot" aria-label="Hotspot regions" role="group">
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          maxWidth: '100%',
        }}
      >
        <img
          src={resolveAsset?.(content.image) ?? `/assets/${content.image.replace(/^assets\//, '')}`}
          alt={content.altText}
          data-testid="hotspot-image"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {hotspots.map((hotspot) => {
          const isSelected = selectedIds.includes(hotspot.id);
          return (
            <div
              key={hotspot.id}
              data-testid={`hotspot-${hotspot.id}`}
              style={getHotspotStyle(hotspot)}
              role="button"
              tabIndex={0}
              aria-label={hotspot.label}
              aria-pressed={isSelected}
              onClick={() => handleHotspotClick(hotspot.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleHotspotClick(hotspot.id);
                }
              }}
            >
              {submitted && hotspot.correct && (
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
              {submitted && isSelected && !hotspot.correct && (
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
          );
        })}
      </div>

      <div role="status" aria-live="polite" style={{ marginTop: '0.5rem' }}>
        {selectedIds.length > 0 && (
          <div data-testid="selected-info">
            {selectedIds.map((id) => {
              const hotspot = hotspots.find((h) => h.id === id);
              if (!hotspot) return null;
              return (
                <div key={id} style={{ marginBottom: '0.25rem' }}>
                  <strong>Selected: {hotspot.label}</strong>
                  {hotspot.description && !submitted && (
                    <p
                      style={{
                        margin: '0.25rem 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--oe-color-on-surface-variant, #6b7280)',
                      }}
                    >
                      {hotspot.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
          <p>{feedbackMessage}</p>
        </div>
      )}

      {!submitted && content.hints && content.hints.length > 0 && content.hints[hintIndex] && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: '0.5rem',
            color: 'var(--oe-color-on-surface-variant, #6b7280)',
          }}
        >
          <p>{content.hints[hintIndex]}</p>
          {hintIndex < content.hints.length - 1 && (
            <Button variant="ghost" size="sm" onClick={handleHintClick}>
              More help
            </Button>
          )}
        </div>
      )}

      {mode === 'multiple' && !submitted && (
        <div style={{ marginTop: '1rem' }}>
          <Button variant="default" onClick={handleSubmit} disabled={selectedIds.length === 0}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

const HotspotWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Tap or click specific regions of an image to answer questions.',
    whatItDoes:
      'The Hotspot widget overlays clickable regions on an image. Students tap the correct area to answer a question — like "Find Maharashtra on this map." It supports single-select and multi-select modes with visual feedback for correct and incorrect taps.',
    whenToUse: [
      'Identifying locations on maps',
      'Pointing out parts of a diagram or image',
      'Geography and anatomy exercises',
      'Interactive image exploration',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.hotspot"',
      'Provide an image path and alt text',
      'Define hotspot regions — each needs id, x/y position (0-100), radius, and label',
      'Mark the correct hotspot with correct: true',
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
        name: 'hotspots',
        type: 'array of objects',
        required: true,
        description:
          'Clickable regions. Each has id (string), x (number 0-100), y (number 0-100), radius (number, default 5), label (string), correct (boolean), and optional description (string).',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description:
          '"single" for one correct hotspot (default) or "multiple" for selecting several.',
      },
      {
        name: 'hints',
        type: 'array of strings',
        required: false,
        description: 'Progressive hints to help students find the right region.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, highlights hotspots for observation. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Identify Maharashtra",\n  "widget": "core.hotspot",\n  "config": {\n    "image": "assets/images/india-map.png",\n    "altText": "Map of India with states highlighted",\n    "hotspots": [\n      { "id": "mh", "x": 45, "y": 55, "radius": 8, "label": "Maharashtra", "correct": true, "description": "Capital: Mumbai" },\n      { "id": "ka", "x": 42, "y": 65, "radius": 8, "label": "Karnataka", "correct": false },\n      { "id": "dl", "x": 48, "y": 30, "radius": 8, "label": "Delhi", "correct": false }\n    ],\n    "mode": "single",\n    "interactive": true,\n    "hints": ["Look for the western coastal state"]\n  }\n}',
    tips: [
      'Define clear, non-overlapping hotspot regions',
      'Use x/y values between 0-100 for responsive positioning',
      'Provide descriptive labels and alt text for each region',
      'Add hints for students who struggle to find the right area',
    ],
    sidebarPosition: 12,
    relatedWidgets: [
      {
        id: 'science.image-label',
        name: 'Image Label',
        domain: 'science',
        slug: 'image-label',
      },
      {
        id: 'science.label-diagram',
        name: 'Label Diagram',
        domain: 'science',
        slug: 'label-diagram',
      },
    ],
  },
  id: 'core.hotspot',
  version: '1.0.0',
  schema: hotspotSchema,
  name: 'Hotspot',
  description: 'Click or tap on specific areas of an image to answer questions',
  domain: 'core',
  learningIntents: [LearningIntent.Explore, LearningIntent.Assess],
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
    achievement: 'hotspot-explorer',
    positiveMessage: 'Hotspot activity complete!',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 3,
    bloomsLevel: 'apply',
    cognitiveLoad: 'moderate',
    subjectTags: ['general', 'geography'],
    authoringPrompt:
      'Create a hotspot image activity with clickable regions for learners to identify',
    recommendedAge: [6, 16],
    readingLevel: 'grade-2',
    learningObjectives: [
      'Identify specific regions or elements in an image',
      'Recognize spatial relationships between objects',
      'Apply knowledge to select correct areas on a visual reference',
    ],
    commonMisconceptions: [
      'Clicking on the wrong region that looks visually similar',
      'Confusing adjacent regions with similar labels',
    ],
    generationHints: [
      'Use clear images with distinct regions',
      'Make hotspot targets large enough for touch interaction',
      'Limit hotspots to 3-8 for optimal engagement',
      'Provide descriptive alt text for accessibility',
    ],
    exampleConfigs: [
      {
        image: 'assets/images/map.png',
        hotspots: [
          { id: 'r1', x: 50, y: 50, label: 'Center', correct: true },
          { id: 'r2', x: 25, y: 25, label: 'Corner', correct: false },
        ],
      },
    ],
  },
  icon: 'mouse-pointer-click',
  keywords: ['hotspot', 'click', 'tap', 'image', 'interactive'],
  status: 'stable',
  render: HotspotComponent,
};

export { HotspotWidget as hotspot, hotspotSchema };
export default HotspotWidget;
