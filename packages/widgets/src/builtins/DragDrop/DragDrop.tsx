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

const itemSchema = z.object({
  id: z.string(),
  label: z.string(),
  emoji: z.string().optional(),
});

const targetSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const dragDropSchema = z.object({
  description: z.string().optional(),
  items: z.array(itemSchema).min(1),
  targets: z.array(targetSchema).min(1),
  expectedPositions: z.record(z.string(), z.string()),
  hints: z.array(z.string()).optional(),
  hint: z.string().optional(),
  interactive: z.boolean().optional().default(false),
});

export type DragDropConfig = z.infer<typeof dragDropSchema>;

function DraggableItem({
  item,
  isSelected,
  onItemClick,
}: {
  item: { id: string; label: string; emoji?: string };
  isSelected: boolean;
  onItemClick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'item' },
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
      data-testid={`unplaced-item-${item.id}`}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`Item ${item.label}${item.emoji ? ` ${item.emoji}` : ''}`}
      aria-selected={isSelected}
      onClick={() => onItemClick(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onItemClick(item.id);
        }
      }}
    >
      {item.emoji && <span>{item.emoji} </span>}
      {item.label}
    </div>
  );
}

function DroppableTarget({
  target,
  items,
  placedItems,
  selectedItemId,
  hasItem,
  shouldHighlight,
  onTargetClick,
  onRemoveItem,
  submitted,
  expectedPositions,
}: {
  target: { id: string; label: string };
  items: Array<{ id: string; label: string; emoji?: string }>;
  placedItems: Record<string, string>;
  selectedItemId: string | null;
  hasItem: boolean;
  shouldHighlight: boolean;
  onTargetClick: (id: string) => void;
  onRemoveItem: (id: string) => void;
  submitted: boolean;
  expectedPositions?: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: target.id,
    data: { type: 'target' },
  });

  const itemsInTarget = items.filter((item) => placedItems[item.id] === target.id);

  const style: React.CSSProperties = {
    padding: '0.75rem',
    border: isOver
      ? '2px solid var(--oe-color-primary, #3b82f6)'
      : shouldHighlight
        ? '2px dashed var(--oe-color-primary, #3b82f6)'
        : hasItem
          ? '1px solid var(--oe-color-outline-variant, #d1d5db)'
          : '1px solid var(--oe-color-outline-variant, #d1d5db)',
    borderRadius: '0.375rem',
    minHeight: '2.5rem',
    backgroundColor: isOver
      ? 'var(--oe-color-primary-container, #eff6ff)'
      : shouldHighlight
        ? 'var(--oe-color-primary-container, #eff6ff)'
        : 'var(--oe-color-surface-container-lowest, #f9fafb)',
    cursor: selectedItemId !== null && !hasItem ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
  };

  return (
    <div
      ref={setNodeRef}
      key={target.id}
      data-testid={`target-${target.id}`}
      role="button"
      tabIndex={selectedItemId !== null ? 0 : -1}
      aria-label={`Drop zone: ${target.label}`}
      onClick={() => onTargetClick(target.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTargetClick(target.id);
        }
      }}
      style={style}
    >
      <strong>{target.label}</strong>
      {itemsInTarget.map((item) => {
        const placedTarget = placedItems[item.id];
        const expectedTarget = expectedPositions?.[item.id];
        const isCorrectPlacement =
          submitted && placedTarget && expectedTarget && placedTarget === expectedTarget;
        const isWrongPlacement =
          submitted && placedTarget && expectedTarget && placedTarget !== expectedTarget;
        return (
          <div
            key={item.id}
            data-testid={`placed-item-${item.id}`}
            data-correct={isCorrectPlacement ? 'true' : isWrongPlacement ? 'false' : undefined}
            style={{
              marginTop: '0.25rem',
              padding: '0.25rem 0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              border: isCorrectPlacement
                ? '2px solid var(--oe-success, #22c55e)'
                : isWrongPlacement
                  ? '2px solid var(--oe-error, #ef4444)'
                  : '1px solid var(--oe-color-outline-variant, #d1d5db)',
              borderRadius: '0.25rem',
              backgroundColor: isCorrectPlacement
                ? 'var(--oe-color-success-container, #f0fdf4)'
                : isWrongPlacement
                  ? 'var(--oe-color-error-container, #fee2e2)'
                  : 'var(--oe-color-surface, #ffffff)',
              transition: 'all 0.2s ease',
            }}
          >
            {item.emoji && <span>{item.emoji}</span>}
            <span>{item.label}</span>
            {!submitted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveItem(item.id);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'var(--oe-color-on-surface-variant, #6b7280)',
                  padding: '0 0.25rem',
                  borderRadius: '0.25rem',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor =
                    'var(--oe-color-surface-variant, #f3f4f6)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }}
                aria-label={`Remove ${item.label} from ${target.label}`}
              >
                ✕
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DragDropStateSchema = z.object({
  submitted: z.boolean(),
  placedItems: z.record(z.string(), z.string()),
  hintIndex: z.number(),
});

function DragDropComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = dragDropSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;
  const hasValidContent =
    parsed.success && content && content.items.length > 0 && content.targets.length > 0;

  const parsedState = useMemo(() => {
    const result = DragDropStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [placedItems, setPlacedItems] = useState<Record<string, string>>(
    parsedState?.placedItems ?? {},
  );
  const [hintIndex, setHintIndex] = useState(parsedState?.hintIndex ?? 0);
  const [activeDragItem, setActiveDragItem] = useState<{ id: string } | null>(null);

  const isObserve = content?.interactive !== true;
  const items = content?.items ?? [];
  const targets = content?.targets ?? [];

  const unplacedItemIds = items.map((item) => item.id).filter((id) => !(id in placedItems));

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && hasValidContent,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.drag-drop',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleItemClick = useCallback(
    (itemId: string) => {
      if (submitted || isObserve) return;
      setSelectedItemId((prev) => (prev === itemId ? null : itemId));
    },
    [submitted, isObserve],
  );

  const handleTargetClick = useCallback(
    (targetId: string) => {
      if (submitted || isObserve || selectedItemId === null) return;
      setPlacedItems((prev) => ({
        ...prev,
        [selectedItemId]: targetId,
      }));
      setSelectedItemId(null);
    },
    [submitted, isObserve, selectedItemId],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      if (submitted || isObserve) return;
      setPlacedItems((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    },
    [submitted, isObserve],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragItem({ id: String(event.active.id) });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      setActiveDragItem(null);
      if (submitted || isObserve) return;
      if (overId && activeId !== overId && unplacedItemIds.includes(activeId)) {
        setPlacedItems((prev) => ({
          ...prev,
          [activeId]: overId,
        }));
        setSelectedItemId(null);
      }
    },
    [submitted, isObserve, unplacedItemIds],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (submitted || !content) return;
    const totalItems = content.items.length;
    let correctCount = 0;

    for (const item of content.items) {
      const placed = placedItems[item.id];
      const expected = content.expectedPositions[item.id];
      if (placed && placed === expected) {
        correctCount++;
      }
    }

    const allCorrect = correctCount === totalItems;
    const accuracy = totalItems > 0 ? correctCount / totalItems : 0;

    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      droppedPositions: placedItems,
      correct: allCorrect,
      accuracy,
      widgetId: 'core.drag-drop',
    });
    setSubmitted(true);
  }, [submitted, content, placedItems, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (!content) return;
    const totalItems = content.items.length;
    let correctCount = 0;

    for (const item of content.items) {
      const placed = placedItems[item.id];
      const expected = content.expectedPositions[item.id];
      if (placed && placed === expected) {
        correctCount++;
      }
    }

    const accuracy = totalItems > 0 ? correctCount / totalItems : 0;
    const score = Math.round(accuracy * 100);

    complete(score, { submitted: true, placedItems, hintIndex });
  }, [content, placedItems, hintIndex, complete]);

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
        className="border-outline-variant bg-surface-container-lowest p-md rounded-xl border text-center"
      >
        <p className="text-on-surface font-semibold">This activity could not be loaded.</p>
      </div>
    );
  }

  const allItemsPlaced = items.every((item) => item.id in placedItems);

  if (isObserve) {
    const observePositions: Record<string, string> = {};
    if (content) {
      for (const item of content.items) {
        const targetId = content.expectedPositions[item.id];
        if (targetId) {
          observePositions[item.id] = targetId;
        }
      }
    }

    return (
      <div data-testid="drag-drop" aria-label="Drag and drop activity">
        <div role="status" aria-live="polite">
          {content.description && <p>{content.description}</p>}
          <div
            role="group"
            aria-label="Drop zones with items"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            {targets.map((target) => {
              const itemsInTarget = items.filter((item) => observePositions[item.id] === target.id);
              return (
                <div
                  key={target.id}
                  data-testid={`observe-target-${target.id}`}
                  style={{
                    padding: '0.75rem',
                    border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
                    borderRadius: '0.375rem',
                    backgroundColor: 'var(--oe-color-surface-container-lowest, #f9fafb)',
                    minHeight: '2.5rem',
                  }}
                  aria-label={`Target: ${target.label}`}
                >
                  <strong>{target.label}</strong>
                  {itemsInTarget.map((item) => (
                    <div
                      key={item.id}
                      data-testid={`observe-item-${item.id}`}
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.25rem 0.5rem',
                      }}
                      aria-label={`Item: ${item.label}`}
                    >
                      {item.emoji && <span>{item.emoji} </span>}
                      {item.label}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        {showAcknowledgeButton && (
          <div className="p-md border-outline-variant mt-md flex items-center justify-center border-t">
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
          <div role="status" aria-live="assertive" data-testid="observe-complete">
            <p>Content acknowledged.</p>
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
      <div data-testid="drag-drop" aria-label="Drag and drop activity">
        {content.description && <p>{content.description}</p>}

        <div
          data-testid="unplaced-items"
          role="group"
          aria-label="Unplaced items"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginTop: '0.75rem',
            marginBottom: '0.75rem',
            padding: '0.75rem',
            border: '1px dashed var(--oe-color-outline-variant, #d1d5db)',
            borderRadius: '0.375rem',
            minHeight: '2.5rem',
            backgroundColor: 'var(--oe-color-surface-container-lowest, #f9fafb)',
          }}
        >
          {unplacedItemIds.length === 0 && (
            <span
              style={{
                color: 'var(--oe-color-on-surface-variant, #9ca3af)',
                fontStyle: 'italic',
              }}
            >
              All items placed
            </span>
          )}
          {unplacedItemIds.map((itemId) => {
            const item = items.find((i) => i.id === itemId);
            if (!item) return null;
            const isSelected = selectedItemId === itemId;
            return (
              <DraggableItem
                key={itemId}
                item={item}
                isSelected={isSelected}
                onItemClick={handleItemClick}
              />
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Drop zones"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {targets.map((target) => {
            const itemsInTarget = items.filter((item) => placedItems[item.id] === target.id);
            const hasItem = itemsInTarget.length > 0;
            const shouldHighlight = selectedItemId !== null && !hasItem;
            return (
              <DroppableTarget
                key={target.id}
                target={target}
                items={items}
                placedItems={placedItems}
                selectedItemId={selectedItemId}
                hasItem={hasItem}
                shouldHighlight={shouldHighlight}
                onTargetClick={handleTargetClick}
                onRemoveItem={handleRemoveItem}
                submitted={submitted}
                expectedPositions={content.expectedPositions}
              />
            );
          })}
        </div>

        <div role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: '0.5rem' }}>
          {Object.keys(placedItems).length > 0 && (
            <p data-testid="placement-status">
              {Object.keys(placedItems).length} of {items.length} items placed
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
            <p>{content.hints[hintIndex]}</p>
            {hintIndex < content.hints.length - 1 && (
              <Button variant="ghost" size="sm" onClick={handleHintClick}>
                More help
              </Button>
            )}
          </div>
        )}

        {!submitted && content.hint && !content.hints && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: '0.5rem',
              color: 'var(--oe-color-on-surface-variant, #6b7280)',
            }}
          >
            <p>{content.hint}</p>
          </div>
        )}

        <div style={{ marginTop: '1rem' }}>
          {!submitted ? (
            <Button variant="default" onClick={handleSubmit} disabled={!allItemsPlaced}>
              Submit
            </Button>
          ) : (
            <Button variant="default" onClick={handleContinue} data-testid="continue-button">
              Continue
            </Button>
          )}
        </div>

        {submitted && (
          <div role="status" aria-live="assertive" data-testid="feedback">
            {(() => {
              const totalItems = items.length;
              let correctCount = 0;
              for (const item of items) {
                const placed = placedItems[item.id];
                const expected = content!.expectedPositions[item.id];
                if (placed && placed === expected) {
                  correctCount++;
                }
              }
              return correctCount === totalItems ? (
                <p>Correct! All items placed correctly.</p>
              ) : (
                <p>
                  {correctCount} of {totalItems} items placed correctly.
                </p>
              );
            })()}
            <div data-testid="correct-answer-panel" style={{ marginTop: '0.5rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Correct placements:</p>
              {items.map((item) => {
                const expectedTargetId = content!.expectedPositions[item.id];
                const expectedTarget = targets.find((t) => t.id === expectedTargetId);
                return (
                  <p key={item.id} style={{ margin: '0.125rem 0' }}>
                    {item.emoji ? `${item.emoji} ` : ''}
                    {item.label} → {expectedTarget?.label ?? expectedTargetId}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeDragItem
          ? (() => {
              const item = items.find((i) => i.id === activeDragItem.id);
              if (!item) return null;
              return (
                <div
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: '2px solid var(--oe-color-primary, #3b82f6)',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
                    cursor: 'grabbing',
                    userSelect: 'none',
                    boxShadow:
                      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(-2px)',
                  }}
                >
                  {item.emoji && <span>{item.emoji} </span>}
                  {item.label}
                </div>
              );
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}

const DragDropWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Drag and drop items into the correct categories or zones.',
    whatItDoes:
      'The Drag & Drop widget lets students sort items into target zones by dragging them with mouse, touch, or keyboard. Each item belongs in one target zone based on the expected positions you define. It works on touch screens, with a mouse, or via keyboard shortcuts.',
    whenToUse: [
      'Sorting items into categories',
      'Classifying animals, objects, or concepts',
      'Grouping by shared attributes',
      'Hands-on sorting activities',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.drag-drop"',
      'Define your items — each needs an id, label, and optional emoji',
      'Define your target zones — each needs an id and label',
      'Set expectedPositions to map each item id to its correct target id',
    ],
    configFields: [
      {
        name: 'items',
        type: 'array of objects',
        required: true,
        description:
          'The draggable items. Each has id (string), label (string), and optional emoji (string).',
      },
      {
        name: 'targets',
        type: 'array of objects',
        required: true,
        description: 'The drop zones. Each has id (string) and label (string).',
      },
      {
        name: 'expectedPositions',
        type: 'object',
        required: true,
        description: 'Maps item ids to target ids. e.g. `{"fish": "ocean", "bird": "sky"}`.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions shown above the activity.',
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
        description: 'When false, shows items pre-placed in correct zones. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Habitat Sort",\n  "widget": "core.drag-drop",\n  "config": {\n    "description": "Sort each animal into the correct habitat.",\n    "items": [\n      { "id": "fish", "label": "Fish", "emoji": "🐟" },\n      { "id": "bird", "label": "Bird", "emoji": "🐦" },\n      { "id": "whale", "label": "Whale", "emoji": "🐋" },\n      { "id": "eagle", "label": "Eagle", "emoji": "🦅" }\n    ],\n    "targets": [\n      { "id": "sky", "label": "Sky" },\n      { "id": "ocean", "label": "Ocean" }\n    ],\n    "expectedPositions": {\n      "fish": "ocean",\n      "bird": "sky",\n      "whale": "ocean",\n      "eagle": "sky"\n    },\n    "interactive": true\n  }\n}',
    tips: [
      'Use 3-6 items with 2-4 target zones for manageable complexity',
      'Make item labels unambiguous so placement is clear',
      'Ensure target zone labels have distinct meanings',
      'Add emoji to items for visual learners and non-readers',
    ],
    sidebarPosition: 4,
    relatedWidgets: [
      {
        id: 'core.matching',
        name: 'Matching',
        domain: 'core',
        slug: 'matching',
      },
      {
        id: 'core.sequencing',
        name: 'Sequencing',
        domain: 'core',
        slug: 'sequencing',
      },
    ],
  },
  id: 'core.drag-drop',
  name: 'Drag & Drop',
  description: 'Drag items to correct locations or categories',
  domain: 'core',
  version: '0.1.0',
  schema: dragDropSchema,
  render: DragDropComponent,
  learningIntents: [LearningIntent.Practice, LearningIntent.Compare],
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
    achievement: 'first-sort',
    positiveMessage: 'Items sorted correctly!',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 5,
    bloomsLevel: 'apply',
    cognitiveLoad: 'moderate',
    subjectTags: ['general'],
    authoringPrompt: 'Create a drag-and-drop categorization exercise',
    recommendedAge: [5, 14],
    readingLevel: 'grade-2',
    learningObjectives: [
      'Classify items into the correct categories',
      'Categorize items based on shared attributes',
      'Compare categories to determine correct placement',
    ],
    commonMisconceptions: [
      'Placing items in the first available target without reading labels',
      'Ignoring category boundaries and grouping by personal preference',
    ],
    generationHints: [
      'Make item labels unambiguous',
      'Ensure target zone labels have distinct meanings',
      'Use 3-6 draggable items for manageable complexity',
    ],
    exampleConfigs: [
      {
        items: [
          { id: '1', label: 'Apple', target: 'Fruit' },
          { id: '2', label: 'Carrot', target: 'Vegetable' },
        ],
      },
      {
        items: [
          { id: '1', label: 'Mercury', target: 'Inner Planet' },
          { id: '2', label: 'Jupiter', target: 'Outer Planet' },
        ],
      },
    ],
  },
  icon: 'move',
  keywords: ['drag', 'drop', 'sort', 'categorize'],
  status: 'stable',
};

export { DragDropWidget as dragDrop };
export default DragDropWidget;
