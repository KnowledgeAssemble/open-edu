import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

const imageCompareSchema = z.object({
  leftImage: z.string().min(1),
  rightImage: z.string().min(1),
  leftLabel: z.string().optional(),
  rightLabel: z.string().optional(),
  mode: z.enum(['slider', 'side-by-side', 'overlay', 'before-after']).default('slider'),
  caption: z.string().optional(),
  altText: z.object({
    left: z.string().min(1),
    right: z.string().min(1),
  }),
  showLabels: z.boolean().optional().default(true),
  sliderPosition: z.number().min(0).max(100).optional().default(50),
  interactive: z.boolean().optional().default(false),
});

const ImageCompareStateSchema = z.object({
  sliderPosition: z.number(),
});

function ImageCompareComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = imageCompareSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;
  const hasValidContent = parsed.success && content;

  const parsedState = useMemo(() => {
    const result = ImageCompareStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const initialPos = parsedState?.sliderPosition ?? content?.sliderPosition ?? 50;
  const [sliderPos, setSliderPos] = useState(initialPos);
  const sliderPosRef = useRef(initialPos);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [localAcknowledged, setLocalAcknowledged] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isObserve = !!(content?.interactive !== true && hasValidContent);

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.image-compare',
  });

  const handleGotIt = useCallback(() => {
    emitInteraction({
      type: 'widget.interaction',
      action: 'acknowledge',
      widgetId: 'core.image-compare',
    });
    complete(100, { sliderPosition: sliderPos });
    setLocalAcknowledged(true);
  }, [complete, emitInteraction, sliderPos]);

  const updateSliderPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = Math.round((x / rect.width) * 100);
    const newPos = Math.max(0, Math.min(100, pct));
    setSliderPos(newPos);
    sliderPosRef.current = newPos;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      updateSliderPosition(e.clientX);
    },
    [updateSliderPosition],
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      updateSliderPosition(e.clientX);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      emitInteraction({
        type: 'widget.interaction',
        action: 'slider-drag',
        position: sliderPosRef.current,
        widgetId: 'core.image-compare',
      });
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updateSliderPosition, emitInteraction]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      updateSliderPosition(e.touches[0]!.clientX);
    },
    [updateSliderPosition],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    emitInteraction({
      type: 'widget.interaction',
      action: 'slider-drag',
      position: sliderPosRef.current,
      widgetId: 'core.image-compare',
    });
  }, [emitInteraction]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newPos = Math.min(100, sliderPosRef.current + 5);
        setSliderPos(newPos);
        sliderPosRef.current = newPos;
        emitInteraction({
          type: 'widget.interaction',
          action: 'slider-keyboard',
          position: newPos,
          widgetId: 'core.image-compare',
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newPos = Math.max(0, sliderPosRef.current - 5);
        setSliderPos(newPos);
        sliderPosRef.current = newPos;
        emitInteraction({
          type: 'widget.interaction',
          action: 'slider-keyboard',
          position: newPos,
          widgetId: 'core.image-compare',
        });
      }
    },
    [emitInteraction],
  );

  const handleOverlayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isObserve) return;
      const val = Number(e.target.value);
      setOverlayOpacity(val);
      emitInteraction({
        type: 'widget.interaction',
        action: 'overlay-adjust',
        opacity: val,
        widgetId: 'core.image-compare',
      });
    },
    [isObserve, emitInteraction],
  );

  if (!hasValidContent) {
    return (
      <div role="alert" data-testid="widget-config-error">
        <p>This activity could not be loaded.</p>
      </div>
    );
  }

  const mode = content.mode;
  const leftSrc =
    resolveAsset?.(content.leftImage) ?? `/assets/${content.leftImage.replace(/^assets\//, '')}`;
  const rightSrc =
    resolveAsset?.(content.rightImage) ?? `/assets/${content.rightImage.replace(/^assets\//, '')}`;
  const compositeAriaLabel = [
    content.caption,
    content.leftLabel && `Left: ${content.leftLabel}`,
    content.rightLabel && `Right: ${content.rightLabel}`,
    content.altText.left,
    content.altText.right,
  ]
    .filter(Boolean)
    .join('. ');

  const finalAcknowledged = parsedState ? true : localAcknowledged;

  const renderAcknowledge = () => {
    if (isObserve) {
      if (showAcknowledgeButton && !finalAcknowledged) {
        return (
          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="default"
              onClick={handleObserveAcknowledge}
              data-testid="observe-acknowledge"
            >
              Mark as seen ✓
            </Button>
          </div>
        );
      }
      return (
        <div
          role="status"
          aria-live="assertive"
          data-testid="observe-complete"
          style={{ marginTop: '0.75rem' }}
        >
          <p>Content acknowledged.</p>
        </div>
      );
    }
    if (!finalAcknowledged) {
      return (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="default" onClick={handleGotIt} data-testid="image-compare-got-it">
            Got it ✓
          </Button>
        </div>
      );
    }
    return (
      <div
        role="status"
        aria-live="assertive"
        data-testid="image-compare-acknowledged"
        style={{ marginTop: '0.75rem' }}
      >
        <p>Acknowledged.</p>
      </div>
    );
  };

  if (mode === 'side-by-side') {
    return (
      <div data-testid="image-compare" role="img" aria-label={compositeAriaLabel}>
        {content.caption && (
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{content.caption}</p>
        )}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '200px' }}>
            <img
              src={leftSrc}
              alt={content.altText.left}
              data-testid="image-compare-left"
              style={{ maxHeight: '400px', objectFit: 'contain', width: '100%' }}
            />
            {content.showLabels && content.leftLabel && (
              <p style={{ textAlign: 'center', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {content.leftLabel}
              </p>
            )}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <img
              src={rightSrc}
              alt={content.altText.right}
              data-testid="image-compare-right"
              style={{ maxHeight: '400px', objectFit: 'contain', width: '100%' }}
            />
            {content.showLabels && content.rightLabel && (
              <p style={{ textAlign: 'center', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {content.rightLabel}
              </p>
            )}
          </div>
        </div>
        {renderAcknowledge()}
      </div>
    );
  }

  if (mode === 'overlay') {
    const displayOpacity = isObserve ? 50 : overlayOpacity;
    return (
      <div data-testid="image-compare" role="img" aria-label={compositeAriaLabel}>
        {content.caption && (
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{content.caption}</p>
        )}
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '200px',
          }}
        >
          <img
            src={rightSrc}
            alt={content.altText.right}
            style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '400px' }}
          />
          <img
            src={leftSrc}
            alt={content.altText.left}
            data-testid="image-compare-overlay-top"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: displayOpacity / 100,
            }}
          />
        </div>
        {!isObserve && (
          <div style={{ marginTop: '0.5rem' }}>
            <label
              htmlFor={`overlay-slider-${props.nodeId}`}
              style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Adjust overlay: {displayOpacity}%
            </label>
            <input
              id={`overlay-slider-${props.nodeId}`}
              type="range"
              min={0}
              max={100}
              value={displayOpacity}
              onChange={handleOverlayChange}
              data-testid="image-compare-overlay-slider"
              aria-label={`Overlay opacity ${displayOpacity} percent`}
              style={{ width: '100%' }}
            />
          </div>
        )}
        {renderAcknowledge()}
      </div>
    );
  }

  const displaySliderPos = sliderPos;

  if (mode === 'before-after') {
    return (
      <div data-testid="image-compare" role="img" aria-label={compositeAriaLabel}>
        {content.caption && (
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{content.caption}</p>
        )}
        <div
          ref={containerRef}
          data-testid="image-compare-slider"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displaySliderPos}
          aria-label="Image comparison slider"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          onTouchStart={(e) => {
            setIsDragging(true);
            updateSliderPosition(e.touches[0]!.clientX);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '200px',
            overflow: 'hidden',
            cursor: 'ew-resize',
            userSelect: 'none',
          }}
        >
          <img
            src={leftSrc}
            alt={content.altText.left}
            style={{
              width: '100%',
              display: 'block',
              objectFit: 'contain',
              maxHeight: '400px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              clipPath: `inset(0 ${100 - displaySliderPos}% 0 0)`,
            }}
          >
            <img
              src={rightSrc}
              alt={content.altText.right}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'contain',
                maxHeight: '400px',
              }}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${displaySliderPos}%`,
              width: '3px',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              transform: 'translateX(-50%)',
              zIndex: 2,
            }}
          />
          {content.showLabels && (
            <>
              <span
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  left: '0.5rem',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: '#ffffff',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  zIndex: 3,
                }}
              >
                {content.leftLabel ?? 'Before'}
              </span>
              <span
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: '#ffffff',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  zIndex: 3,
                }}
              >
                {content.rightLabel ?? 'After'}
              </span>
            </>
          )}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${displaySliderPos}%`,
              transform: 'translate(-50%, -50%)',
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'ew-resize',
            }}
          >
            <span style={{ color: '#333', fontSize: '0.75rem', lineHeight: 1 }}>{'\u2194'}</span>
          </div>
        </div>
        <div role="status" aria-live="polite" data-testid="slider-position">
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Position: {displaySliderPos}%</p>
        </div>
        {renderAcknowledge()}
      </div>
    );
  }

  // slider mode (default)
  return (
    <div data-testid="image-compare" role="img" aria-label={compositeAriaLabel}>
      {content.caption && (
        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{content.caption}</p>
      )}
      <div
        ref={containerRef}
        data-testid="image-compare-slider"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displaySliderPos}
        aria-label="Image comparison slider"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          setIsDragging(true);
          updateSliderPosition(e.touches[0]!.clientX);
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '200px',
          overflow: 'hidden',
          cursor: 'ew-resize',
          userSelect: 'none',
        }}
      >
        <img
          src={leftSrc}
          alt={content.altText.left}
          data-testid="image-compare-left"
          style={{
            width: '100%',
            display: 'block',
            objectFit: 'contain',
            maxHeight: '400px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            clipPath: `inset(0 ${100 - displaySliderPos}% 0 0)`,
          }}
        >
          <img
            src={rightSrc}
            alt={content.altText.right}
            data-testid="image-compare-right"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
              maxHeight: '400px',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${displaySliderPos}%`,
            width: '3px',
            backgroundColor: '#ffffff',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            transform: 'translateX(-50%)',
            zIndex: 2,
          }}
        />
        {content.showLabels && (
          <>
            <span
              style={{
                position: 'absolute',
                top: '0.5rem',
                left: '0.5rem',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: '#ffffff',
                padding: '0.125rem 0.5rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                zIndex: 3,
              }}
            >
              {content.leftLabel ?? 'Left'}
            </span>
            <span
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: '#ffffff',
                padding: '0.125rem 0.5rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                zIndex: 3,
              }}
            >
              {content.rightLabel ?? 'Right'}
            </span>
          </>
        )}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${displaySliderPos}%`,
            transform: 'translate(-50%, -50%)',
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'ew-resize',
          }}
        >
          <span style={{ color: '#333', fontSize: '0.75rem', lineHeight: 1 }}>{'\u2194'}</span>
        </div>
      </div>
      <div role="status" aria-live="polite" data-testid="slider-position">
        <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Position: {displaySliderPos}%</p>
      </div>
      {renderAcknowledge()}
    </div>
  );
}

const ImageCompareWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Compare two images side by side with an interactive slider.',
    whatItDoes:
      'The Image Compare widget places two images side by side (or overlapped with a draggable slider) so students can compare differences and similarities. It supports a slider mode for before/after comparisons and a side-by-side mode.',
    whenToUse: [
      'Comparing healthy vs diseased plants or organisms',
      'Before and after science experiments',
      'Visual differences and similarities activities',
      'Art comparison and analysis',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.image-compare"',
      'Provide paths to your left and right images',
      'Add labels and alt text for each image',
      'Choose slider or side-by-side mode',
    ],
    configFields: [
      {
        name: 'leftImage',
        type: 'string',
        required: true,
        description: 'Path to the left (or top) image file.',
      },
      {
        name: 'rightImage',
        type: 'string',
        required: true,
        description: 'Path to the right (or bottom) image file.',
      },
      {
        name: 'leftLabel',
        type: 'string',
        required: false,
        description: 'Label shown under the left image.',
      },
      {
        name: 'rightLabel',
        type: 'string',
        required: false,
        description: 'Label shown under the right image.',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description: '"slider" for draggable overlay or "side-by-side". Defaults to "slider".',
      },
      {
        name: 'altText',
        type: 'object',
        required: false,
        description: 'Accessibility descriptions: `{ left: string, right: string }`.',
      },
      {
        name: 'caption',
        type: 'string',
        required: false,
        description: 'Caption text shown below both images.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Leaf Comparison",\n  "widget": "core.image-compare",\n  "config": {\n    "leftImage": "assets/images/healthy-leaf.png",\n    "rightImage": "assets/images/diseased-leaf.png",\n    "leftLabel": "Healthy Leaf",\n    "rightLabel": "Diseased Leaf",\n    "mode": "slider",\n    "altText": {\n      "left": "A healthy green leaf",\n      "right": "A diseased leaf with brown spots"\n    },\n    "caption": "Compare a healthy leaf with a diseased one"\n  }\n}',
    tips: [
      'Use clear, high-contrast images for best comparison results',
      'Always provide alt text for accessibility',
      'The slider mode works best for before/after comparisons',
      'Image files should be placed in your lesson package directory',
    ],
    sidebarPosition: 11,
    relatedWidgets: [
      {
        id: 'core.hotspot',
        name: 'Hotspot',
        domain: 'core',
        slug: 'hotspot',
      },
    ],
  },
  id: 'core.image-compare',
  version: '1.0.0',
  schema: imageCompareSchema,
  name: 'Image Compare',
  description: 'Compare two images side by side to identify differences or similarities',
  domain: 'core',
  render: ImageCompareComponent,
  learningIntents: [LearningIntent.Compare, LearningIntent.Observe],
  capabilities: {
    supportsObserveMode: true,
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsOffline: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
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
  },
  reward: {
    completionXP: 10,
    confetti: true,
    achievement: 'first-image-compare',
    positiveMessage: 'Images compared!',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 2,
    bloomsLevel: 'analyze',
    cognitiveLoad: 'low',
    recommendedAge: [5, 18],
    readingLevel: 'grade-2',
    subjectTags: ['general', 'visual'],
    learningObjectives: [
      'Identify differences between two similar images',
      'Observe and compare visual details systematically',
    ],
    commonMisconceptions: ['Focusing only on obvious differences while missing subtle ones'],
    generationHints: [
      'Provide images with clear, meaningful differences for comparison',
      'Use alt text that describes the key differences between images',
      'Keep images in the same orientation and scale for fair comparison',
    ],
    authoringPrompt: 'Create an image comparison activity',
    exampleConfigs: [
      {
        leftImage: 'assets/images/healthy-leaf.png',
        rightImage: 'assets/images/diseased-leaf.png',
        leftLabel: 'Healthy Leaf',
        rightLabel: 'Diseased Leaf',
        mode: 'slider',
        altText: { left: 'A healthy green leaf', right: 'A diseased leaf with brown spots' },
        caption: 'Compare a healthy leaf with a diseased one',
      },
    ],
  },
  icon: 'columns-2',
  keywords: ['image', 'compare', 'difference', 'side-by-side', 'slider', 'overlay'],
  status: 'stable',
};

export { ImageCompareWidget as imageCompare, imageCompareSchema };
export default ImageCompareWidget;
