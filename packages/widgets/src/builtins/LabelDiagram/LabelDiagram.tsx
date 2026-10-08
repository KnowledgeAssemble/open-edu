import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

const labelSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  target: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  hint: z.string().optional(),
  description: z.string().optional(),
});

export const labelDiagramSchema = z.object({
  image: z.string().min(1),
  altText: z.string().optional(),
  labels: z.array(labelSchema).min(1),
  interactive: z.boolean().optional().default(true),
  hints: z.array(z.string()).optional(),
});

export type LabelDiagramConfig = z.infer<typeof labelDiagramSchema>;

const LabelDiagramStateSchema = z.object({
  placedLabels: z.record(z.string(), z.string()),
  submitted: z.boolean(),
  hintIndex: z.number(),
});

function DraggableLabel({
  label,
  isSelected,
  onLabelClick,
}: {
  label: z.infer<typeof labelSchema>;
  isSelected: boolean;
  onLabelClick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: label.id,
    data: { type: 'label', ...label },
  });

  const style: React.CSSProperties = {
    padding: '0.375rem 0.75rem',
    border: isSelected
      ? '2px solid var(--oe-color-primary, #3b82f6)'
      : '1px solid var(--oe-color-outline-variant, #d1d5db)',
    borderRadius: '1rem',
    cursor: isDragging ? 'grabbing' : isSelected ? 'grabbing' : 'pointer',
    backgroundColor: isSelected
      ? 'var(--oe-color-primary-container, #eff6ff)'
      : 'var(--oe-color-surface, #ffffff)',
    userSelect: 'none',
    fontSize: '0.875rem',
    boxShadow: isSelected
      ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      : isDragging
        ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
        : 'none',
    transform: isDragging ? undefined : isSelected ? 'translateY(-2px)' : 'none',
    opacity: isDragging ? 0.4 : 1,
    transition: 'all 0.2s ease',
  };

  return (
    <div
      ref={setNodeRef}
      data-testid={`unplaced-label-${label.id}`}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`Drag label: ${label.text}`}
      aria-selected={isSelected}
      onClick={() => onLabelClick(label.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onLabelClick(label.id);
        }
      }}
    >
      {label.text}
    </div>
  );
}

function DroppableTarget({
  index,
  label,
  placedText,
  isSelectedTarget,
  onTargetClick,
  onRemove,
  submitted,
}: {
  index: number;
  label?: z.infer<typeof labelSchema>;
  placedText: string | null;
  isSelectedTarget: boolean;
  onTargetClick: () => void;
  onRemove: () => void;
  submitted: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `target-${index}`,
    data: { type: 'target', index },
  });

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: label ? `${label.target.x}%` : '50%',
    top: label ? `${label.target.y}%` : '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    cursor: submitted ? 'default' : 'pointer',
  };

  const circleBackground = isOver
    ? 'var(--oe-color-primary-container, #eff6ff)'
    : isSelectedTarget
      ? 'var(--oe-color-primary-container, #eff6ff)'
      : 'var(--oe-color-surface, #ffffff)';

  const circleBorder = isOver
    ? '2px solid var(--oe-color-primary, #3b82f6)'
    : isSelectedTarget
      ? '2px dashed var(--oe-color-primary, #3b82f6)'
      : '2px solid var(--oe-color-primary, #3b82f6)';

  return (
    <div
      ref={setNodeRef}
      style={containerStyle}
      data-testid={`label-target-${index}`}
      onClick={(e) => {
        e.stopPropagation();
        onTargetClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTargetClick();
        }
      }}
      role="button"
      tabIndex={isSelectedTarget ? 0 : -1}
      aria-label={`Target ${index + 1}: drop label here`}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: circleBackground,
          border: circleBorder,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--oe-color-on-primary-container, #1e3a5f)',
          transition: 'all 0.2s ease',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {index + 1}
      </div>
      {placedText && (
        <div
          data-testid={`placed-label-${index}`}
          aria-label={`${placedText} placed at target ${index + 1}`}
          style={{
            whiteSpace: 'nowrap',
            padding: '0.25rem 0.5rem',
            marginLeft: '0.375rem',
            border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
            borderRadius: '0.25rem',
            backgroundColor: 'var(--oe-color-surface-container-lowest, #f9fafb)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <span>{placedText}</span>
          {!submitted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={`Remove ${placedText} from target ${index + 1}`}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--oe-color-on-surface-variant, #6b7280)',
                padding: '0 0.125rem',
                borderRadius: '0.125rem',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LabelDiagramComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = labelDiagramSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;
  const hasValidContent = parsed.success && content && content.labels.length > 0;

  const parsedState = useMemo(() => {
    const result = LabelDiagramStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [placedLabels, setPlacedLabels] = useState<Record<string, string>>(
    parsedState?.placedLabels ?? {},
  );
  const [hintIndex, setHintIndex] = useState(parsedState?.hintIndex ?? 0);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<{ id: string } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const isObserve = content?.interactive !== true;
  const labels = content?.labels ?? [];

  const unplacedLabelIds = labels.map((l) => l.id).filter((id) => !(id in placedLabels));
  const allLabelsPlaced = labels.length > 0 && unplacedLabelIds.length === 0;

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && hasValidContent && !submitted,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'science.label-diagram',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleLabelClick = useCallback(
    (labelId: string) => {
      if (submitted || isObserve) return;
      setSelectedLabelId((prev) => (prev === labelId ? null : labelId));
    },
    [submitted, isObserve],
  );

  const handleTargetClick = useCallback(
    (targetIndex: number) => {
      if (submitted || isObserve || selectedLabelId === null) return;
      const existingLabelForTarget = Object.entries(placedLabels).find(
        ([, t]) => t === String(targetIndex),
      );
      if (existingLabelForTarget) {
        const [existingLabelId] = existingLabelForTarget;
        setPlacedLabels((prev) => {
          const next = { ...prev };
          delete next[existingLabelId];
          next[selectedLabelId] = String(targetIndex);
          return next;
        });
      } else {
        setPlacedLabels((prev) => ({
          ...prev,
          [selectedLabelId]: String(targetIndex),
        }));
      }
      setSelectedLabelId(null);
    },
    [submitted, isObserve, selectedLabelId, placedLabels],
  );

  const handleRemove = useCallback(
    (labelId: string) => {
      if (submitted || isObserve) return;
      setPlacedLabels((prev) => {
        const next = { ...prev };
        delete next[labelId];
        return next;
      });
    },
    [submitted, isObserve],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveDragLabel({ id });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      setActiveDragLabel(null);

      if (submitted || isObserve) return;

      if (overId && overId.startsWith('target-')) {
        const targetIndex = parseInt(overId.replace('target-', ''), 10);
        if (!isNaN(targetIndex)) {
          const existingLabelForTarget = Object.entries(placedLabels).find(
            ([, t]) => t === String(targetIndex),
          );
          if (existingLabelForTarget) {
            const [existingLabelId] = existingLabelForTarget;
            setPlacedLabels((prev) => {
              const next = { ...prev };
              delete next[existingLabelId];
              next[activeId] = String(targetIndex);
              return next;
            });
          } else if (unplacedLabelIds.includes(activeId)) {
            setPlacedLabels((prev) => ({
              ...prev,
              [activeId]: String(targetIndex),
            }));
          }
          setSelectedLabelId(null);
        }
      }
    },
    [submitted, isObserve, placedLabels, unplacedLabelIds],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragLabel(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (submitted || !content) return;
    const totalLabels = content.labels.length;
    let correctCount = 0;

    for (const label of content.labels) {
      const placedAt = placedLabels[label.id];
      if (placedAt !== undefined) {
        const expectedIndex = content.labels.indexOf(label);
        if (parseInt(placedAt, 10) === expectedIndex) {
          correctCount++;
        }
      }
    }

    const accuracy = totalLabels > 0 ? correctCount / totalLabels : 0;
    const score = Math.round(accuracy * 100);

    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      placedLabels,
      correctCount,
      totalLabels,
      score,
      widgetId: 'science.label-diagram',
    });

    setFeedbackMessage(
      correctCount === totalLabels
        ? 'All labels placed correctly!'
        : `${correctCount} of ${totalLabels} labels placed correctly.`,
    );
    setSubmitted(true);
  }, [submitted, content, placedLabels, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (!content) return;
    const totalLabels = content.labels.length;
    let correctCount = 0;
    for (const label of content.labels) {
      const placedAt = placedLabels[label.id];
      if (placedAt !== undefined) {
        const expectedIndex = content.labels.indexOf(label);
        if (parseInt(placedAt, 10) === expectedIndex) {
          correctCount++;
        }
      }
    }
    const accuracy = totalLabels > 0 ? correctCount / totalLabels : 0;
    const score = Math.round(accuracy * 100);
    complete(score, { placedLabels, submitted: true, hintIndex });
  }, [content, placedLabels, hintIndex, complete]);

  const handleHintClick = useCallback(() => {
    if (content?.hints && hintIndex < content.hints.length - 1) {
      setHintIndex((i) => i + 1);
    }
  }, [content?.hints, hintIndex]);

  const handleRetry = useCallback(() => {
    setSubmitted(false);
    setPlacedLabels({});
    setHintIndex(0);
    setSelectedLabelId(null);
    setFeedbackMessage(null);
  }, []);

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

  if (isObserve) {
    return (
      <div data-testid="label-diagram" aria-label="Label diagram activity">
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
            alt={content.altText || 'Scientific diagram'}
            data-testid="label-diagram-image"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          {labels.map((label, index) => (
            <div key={label.id}>
              <div
                data-testid={`observe-target-${index}`}
                style={{
                  position: 'absolute',
                  left: `${label.target.x}%`,
                  top: `${label.target.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
                    border: '2px solid var(--oe-color-primary, #3b82f6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--oe-color-on-primary-container, #1e3a5f)',
                  }}
                >
                  {index + 1}
                </div>
              </div>
              <div
                data-testid={`observe-label-${index}`}
                style={{
                  position: 'absolute',
                  left: `calc(${label.target.x}% + 20px)`,
                  top: `${label.target.y}%`,
                  transform: 'translateY(-50%)',
                  padding: '0.375rem 0.625rem',
                  border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
                  borderRadius: '0.25rem',
                  backgroundColor: 'var(--oe-color-surface, #ffffff)',
                  fontSize: '0.8rem',
                  zIndex: 10,
                  whiteSpace: 'nowrap',
                }}
                aria-label={`Label: ${label.text}`}
              >
                <strong>{label.text}</strong>
                {label.description && (
                  <p
                    style={{
                      margin: '0.125rem 0 0',
                      fontSize: '0.75rem',
                      color: 'var(--oe-color-on-surface-variant, #6b7280)',
                    }}
                  >
                    {label.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        {showAcknowledgeButton && (
          <div style={{ marginTop: '1rem' }}>
            <Button
              variant="default"
              onClick={handleObserveAcknowledge}
              data-testid="observe-acknowledge"
            >
              Mark as seen ✓
            </Button>
          </div>
        )}
        {!showAcknowledgeButton && (
          <div
            role="status"
            aria-live="assertive"
            data-testid="observe-complete"
            style={{ marginTop: '0.5rem' }}
          >
            <p style={{ color: 'var(--oe-color-on-surface-variant, #6b7280)' }}>
              Content acknowledged.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={undefined}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div data-testid="label-diagram" aria-label="Label diagram activity">
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
            alt={content.altText || 'Scientific diagram'}
            data-testid="label-diagram-image"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          {labels.map((label, index) => {
            const placedLabelId = Object.entries(placedLabels).find(
              ([, t]) => t === String(index),
            )?.[0];
            const placedLabel = placedLabelId ? labels.find((l) => l.id === placedLabelId) : null;
            const isSelectedTarget = selectedLabelId !== null;
            return (
              <DroppableTarget
                key={index}
                index={index}
                label={label}
                placedText={placedLabel?.text || null}
                isSelectedTarget={isSelectedTarget}
                onTargetClick={() => handleTargetClick(index)}
                onRemove={() => {
                  if (placedLabelId) handleRemove(placedLabelId);
                }}
                submitted={submitted}
              />
            );
          })}
        </div>

        <div
          data-testid="label-bank"
          role="group"
          aria-label="Label bank"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginTop: '0.75rem',
            padding: '0.75rem',
            border: '1px dashed var(--oe-color-outline-variant, #d1d5db)',
            borderRadius: '0.375rem',
            minHeight: '2.5rem',
            backgroundColor: 'var(--oe-color-surface-container-lowest, #f9fafb)',
          }}
        >
          {unplacedLabelIds.length === 0 && allLabelsPlaced && (
            <span
              style={{
                color: 'var(--oe-color-on-surface-variant, #9ca3af)',
                fontStyle: 'italic',
              }}
            >
              All labels placed
            </span>
          )}
          {unplacedLabelIds.map((labelId) => {
            const label = labels.find((l) => l.id === labelId);
            if (!label) return null;
            return (
              <DraggableLabel
                key={labelId}
                label={label}
                isSelected={selectedLabelId === labelId}
                onLabelClick={handleLabelClick}
              />
            );
          })}
        </div>

        <div role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: '0.5rem' }}>
          {Object.keys(placedLabels).length > 0 && (
            <p data-testid="placement-status">
              {Object.keys(placedLabels).length} of {labels.length} labels placed
            </p>
          )}
        </div>

        {!submitted && content.hints && content.hints.length > 0 && content.hints[hintIndex] && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: '0.5rem',
              color: 'var(--oe-color-on-surface-variant, #6b7280)',
            }}
          >
            <p data-testid="hint-text">{content.hints[hintIndex]}</p>
            {hintIndex < content.hints.length - 1 && (
              <Button variant="ghost" size="sm" onClick={handleHintClick}>
                More help
              </Button>
            )}
          </div>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          {!submitted ? (
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={!allLabelsPlaced}
              data-testid="submit-button"
            >
              Submit
            </Button>
          ) : (
            <>
              <Button variant="default" onClick={handleRetry} data-testid="retry-button">
                Try Again
              </Button>
              <Button variant="default" onClick={handleContinue} data-testid="continue-button">
                Continue
              </Button>
            </>
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
              backgroundColor: submitted
                ? 'var(--oe-color-success-container, #dcfce7)'
                : 'var(--oe-color-error-container, #fee2e2)',
              color: submitted
                ? 'var(--oe-color-on-success-container, #166534)'
                : 'var(--oe-color-on-error-container, #991b1b)',
            }}
          >
            <p style={{ margin: 0 }}>{feedbackMessage}</p>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeDragLabel
          ? (() => {
              const label = labels.find((l) => l.id === activeDragLabel.id);
              if (!label) return null;
              return (
                <div
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: '2px solid var(--oe-color-primary, #3b82f6)',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
                    cursor: 'grabbing',
                    userSelect: 'none',
                    fontSize: '0.875rem',
                    boxShadow:
                      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(-2px)',
                  }}
                >
                  {label.text}
                </div>
              );
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}

const LabelDiagramWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Label parts of a scientific diagram by dragging labels to the correct spots.',
    whatItDoes:
      'The Label Diagram widget shows a scientific diagram with draggable labels. Students drag each label from a word bank to the correct position on the diagram. Common uses include labeling plant parts, human anatomy, or machine components.',
    whenToUse: [
      'Teaching anatomy and biology diagrams',
      'Labeling parts of a machine or system',
      'Science vocabulary reinforcement',
      'Geography and map labeling',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "science.label-diagram"',
      'Provide a clear diagram image with alt text',
      'Define each label with id, text, x/y target position, and optional hint',
      'Set interactive to true for drag-and-label mode',
    ],
    configFields: [
      {
        name: 'image',
        type: 'string',
        required: true,
        description: 'Path to the diagram image file.',
      },
      {
        name: 'altText',
        type: 'string',
        required: true,
        description: 'Description of the diagram for screen readers.',
      },
      {
        name: 'labels',
        type: 'array of objects',
        required: true,
        description:
          'Labels to drag. Each has id (string), text (string), target with x/y (percent), and optional hint (string).',
      },
      {
        name: 'hints',
        type: 'array of strings',
        required: false,
        description: 'Progressive hints for students who need help.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows labels in position. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Plant Anatomy Labeling",\n  "widget": "science.label-diagram",\n  "config": {\n    "image": "assets/images/plant-anatomy.png",\n    "altText": "Diagram of a plant with parts to label",\n    "labels": [\n      { "id": "roots", "text": "Roots", "target": { "x": 50, "y": 90 }, "hint": "Below the soil" },\n      { "id": "stem", "text": "Stem", "target": { "x": 50, "y": 60 }, "hint": "Supports the plant" },\n      { "id": "leaves", "text": "Leaves", "target": { "x": 30, "y": 40 }, "hint": "Green and flat" },\n      { "id": "flower", "text": "Flower", "target": { "x": 50, "y": 20 }, "hint": "Colorful top" }\n    ],\n    "interactive": true,\n    "hints": ["Roots are found underground", "The stem connects roots to leaves"]\n  }\n}',
    tips: [
      'Use clear, high-contrast diagrams with obvious label areas',
      'Provide 4-8 labels for manageable complexity',
      'Add hints to each label for students who get stuck',
      'Target x/y positions should use percentage values (0-100)',
    ],
    sidebarPosition: 1,
    relatedWidgets: [
      {
        id: 'science.image-label',
        name: 'Image Label',
        domain: 'science',
        slug: 'image-label',
      },
      {
        id: 'core.hotspot',
        name: 'Hotspot',
        domain: 'core',
        slug: 'hotspot',
      },
    ],
  },
  id: 'science.label-diagram',
  version: '1.0.0',
  schema: labelDiagramSchema,
  name: 'Label Diagram',
  description: 'Label parts of a scientific diagram or illustration',
  domain: 'science',
  learningIntents: [LearningIntent.Apply, LearningIntent.Assess],
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
    achievement: 'label-diagram-master',
    positiveMessage: 'Diagram labeled correctly!',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 4,
    bloomsLevel: 'apply',
    cognitiveLoad: 'moderate',
    subjectTags: ['science', 'biology', 'anatomy'],
    recommendedAge: [7, 16],
    readingLevel: 'grade-2',
    learningObjectives: [
      'Identify and label parts of a scientific diagram',
      'Match terms to their correct positions on an illustration',
      'Demonstrate understanding of spatial relationships in diagrams',
    ],
    commonMisconceptions: [
      'Placing labels in the nearest empty target without reading the description',
      'Confusing similar-looking parts that are adjacent on the diagram',
    ],
    generationHints: [
      'Use clear diagrams with distinct labeled parts',
      'Make target positions precise to avoid ambiguity',
      'Limit labels to 4-8 for optimal engagement',
      'Provide hints for each label to scaffold learning',
    ],
    exampleConfigs: [
      {
        image: 'assets/images/plant-anatomy.png',
        labels: [
          { id: 'roots', text: 'Roots', target: { x: 50, y: 90 } },
          { id: 'stem', text: 'Stem', target: { x: 50, y: 60 } },
          { id: 'leaves', text: 'Leaves', target: { x: 30, y: 40 } },
          { id: 'flower', text: 'Flower', target: { x: 50, y: 20 } },
        ],
      },
      {
        image: 'assets/images/human-heart.png',
        labels: [
          { id: 'aorta', text: 'Aorta', target: { x: 50, y: 20 } },
          { id: 'ventricle', text: 'Ventricle', target: { x: 50, y: 60 } },
        ],
      },
    ],
  },
  icon: 'tag',
  keywords: ['label', 'diagram', 'science', 'parts', 'drag', 'drop'],
  status: 'stable',
  render: LabelDiagramComponent,
};

export { LabelDiagramWidget as labelDiagram };
export default LabelDiagramWidget;
