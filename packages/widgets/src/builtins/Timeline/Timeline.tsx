import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { AnimationConfigSchema } from '@open-edu/schemas';
import { useObserveMode } from '../../use-observe-mode';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const timelineEventSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  date: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
});

const timelineSchema = z.object({
  events: z.array(timelineEventSchema).min(2),
  title: z.string().optional(),
  layout: z.enum(['horizontal', 'vertical', 'compact']).default('vertical'),
  showDates: z.boolean().optional().default(true),
  showImages: z.boolean().optional().default(false),
  interactive: z.boolean().optional().default(false),
  hints: z.array(z.string()).optional(),
  animation: AnimationConfigSchema.optional(),
});

export type TimelineConfig = z.infer<typeof timelineSchema>;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

function SortableTimelineEvent({
  event,
  index,
  submitted,
  correctOrder,
  layout,
  showDates,
  showImages,
  resolveAsset,
}: {
  event: z.infer<typeof timelineEventSchema>;
  index: number;
  submitted: boolean;
  correctOrder: string[];
  layout: string;
  showDates: boolean;
  showImages: boolean;
  resolveAsset?: (path: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
  });

  const isCorrectPosition = submitted && correctOrder[index] === event.id;
  const isIncorrectPosition = submitted && correctOrder[index] !== event.id;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: `${transition || ''}`,
    padding: '0.5rem',
    border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
    borderRadius: '0.25rem',
    backgroundColor: isCorrectPosition
      ? 'var(--oe-color-success-container, #dcfce7)'
      : isIncorrectPosition
        ? 'var(--oe-color-error-container, #fee2e2)'
        : 'var(--oe-color-surface, #ffffff)',
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    minWidth: layout === 'horizontal' ? '180px' : undefined,
    flex: layout === 'compact' ? '0 0 auto' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
      data-testid={`timeline-event-${event.id}`}
      aria-label={`Event ${index + 1}: ${event.title}`}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
        {event.icon && <span>{event.icon}</span>}
        <div style={{ flex: 1 }}>
          <strong>{event.title}</strong>
          {showDates && event.date && (
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.875rem',
                color: 'var(--oe-color-on-surface-variant, #6b7280)',
              }}
            >
              {event.date}
            </span>
          )}
          {event.description && (
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.875rem',
                color: 'var(--oe-color-on-surface-variant, #6b7280)',
              }}
            >
              {event.description}
            </p>
          )}
          {showImages && event.image && (
            <img
              src={resolveAsset?.(event.image) ?? `/assets/${event.image.replace(/^assets\//, '')}`}
              alt={event.title}
              style={{
                maxWidth: '100%',
                height: 'auto',
                marginTop: '0.25rem',
                borderRadius: '0.25rem',
              }}
            />
          )}
        </div>
        {isCorrectPosition && (
          <span style={{ marginLeft: 'auto', color: 'var(--oe-success, #22c55e)' }}>✓</span>
        )}
        {isIncorrectPosition && (
          <span style={{ marginLeft: 'auto', color: 'var(--oe-error, #ef4444)' }}>✗</span>
        )}
      </div>
    </div>
  );
}

function ObserveTimelineEvent({
  event,
  index,
  layout,
  showDates,
  showImages,
  resolveAsset,
}: {
  event: z.infer<typeof timelineEventSchema>;
  index: number;
  layout: string;
  showDates: boolean;
  showImages: boolean;
  resolveAsset?: (path: string) => string;
}) {
  return (
    <div
      data-testid={`observe-event-${event.id}`}
      role="listitem"
      aria-label={`Event ${index + 1}: ${event.title}`}
      style={{
        position: 'relative',
        paddingLeft: layout === 'vertical' ? '1.5rem' : '0',
        marginBottom: layout === 'vertical' ? '0' : undefined,
        flex: layout === 'compact' ? '0 0 auto' : undefined,
        minWidth: layout === 'horizontal' ? '180px' : undefined,
      }}
    >
      {layout === 'vertical' && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-6px',
              top: '4px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'var(--oe-color-primary, #3b82f6)',
              border: '2px solid var(--oe-color-surface, #ffffff)',
              zIndex: 1,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0px',
              top: '16px',
              bottom: '-16px',
              borderLeft: '2px solid var(--oe-color-outline-variant, #d1d5db)',
              width: 0,
            }}
          />
        </>
      )}
      <div
        style={{
          padding: '0.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.375rem',
        }}
      >
        {event.icon && <span>{event.icon}</span>}
        <div style={{ flex: 1 }}>
          <strong>{event.title}</strong>
          {showDates && event.date && (
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.875rem',
                color: 'var(--oe-color-on-surface-variant, #6b7280)',
              }}
            >
              {event.date}
            </span>
          )}
          {event.description && (
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.875rem',
                color: 'var(--oe-color-on-surface-variant, #6b7280)',
              }}
            >
              {event.description}
            </p>
          )}
          {showImages && event.image && (
            <img
              src={resolveAsset?.(event.image) ?? `/assets/${event.image.replace(/^assets\//, '')}`}
              alt={event.title}
              style={{
                maxWidth: '100%',
                height: 'auto',
                marginTop: '0.25rem',
                borderRadius: '0.25rem',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const TimelineStateSchema = z.object({
  eventOrder: z.array(z.string()),
  submitted: z.boolean(),
  hintIndex: z.number(),
});

function TimelineComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = timelineSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;
  const hasValidContent = parsed.success && content && content.events.length >= 2;

  const parsedState = useMemo(() => {
    const result = TimelineStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [hintIndex, setHintIndex] = useState(parsedState?.hintIndex ?? 0);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const isObserve = content?.interactive !== true;
  const events = content?.events ?? [];
  const layout = content?.layout ?? 'vertical';

  const correctOrder = useMemo(() => events.map((e) => e.id), [events]);

  const initOrder = useMemo(() => {
    if (!content) return [];
    const ids = content.events.map((e) => e.id);
    return shuffleArray(ids);
  }, [content]);

  const [eventOrder, setEventOrder] = useState<string[]>(
    () => parsedState?.eventOrder ?? initOrder,
  );

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && hasValidContent,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.timeline',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      setActiveDragId(null);
      if (submitted || isObserve) return;
      if (overId && activeId !== overId) {
        setEventOrder((prev) => {
          const oldIndex = prev.indexOf(activeId);
          const newIndex = prev.indexOf(overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
    },
    [submitted, isObserve],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (submitted || !content) return;

    const correct =
      correctOrder.length === eventOrder.length &&
      correctOrder.every((id, i) => id === eventOrder[i]);
    const accuracy =
      eventOrder.filter((id, i) => id === correctOrder[i]).length / correctOrder.length;

    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      userOrder: eventOrder,
      correct,
      accuracy,
      widgetId: 'core.timeline',
    });
    setSubmitted(true);
  }, [submitted, content, eventOrder, correctOrder, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (!content) return;
    const accuracy =
      eventOrder.filter((id, i) => id === correctOrder[i]).length / correctOrder.length;
    const score = Math.round(accuracy * 100);

    complete(score, { submitted: true, eventOrder, hintIndex });
  }, [content, eventOrder, correctOrder, hintIndex, complete]);

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

  const sortStrategy =
    layout === 'horizontal' || layout === 'compact'
      ? horizontalListSortingStrategy
      : verticalListSortingStrategy;

  const activeDragEvent = activeDragId ? events.find((e) => e.id === activeDragId) : null;

  if (isObserve) {
    return (
      <div data-testid="timeline" aria-label="Timeline">
        <div role="status" aria-live="polite">
          {content.title && (
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--oe-color-on-surface, #111827)' }}>
              {content.title}
            </h3>
          )}
          <div
            role="list"
            aria-label="Timeline events"
            style={
              layout === 'horizontal'
                ? {
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1.5rem',
                    overflowX: 'auto',
                    paddingTop: '1rem',
                  }
                : layout === 'compact'
                  ? {
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '0.25rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }
                  : {
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      paddingTop: '0.5rem',
                    }
            }
          >
            {correctOrder.map((id, idx) => {
              const event = events.find((e) => e.id === id);
              if (!event) return null;
              if (layout === 'compact') {
                return (
                  <div
                    key={event.id}
                    role="listitem"
                    aria-label={`Event ${idx + 1}: ${event.title}`}
                    data-testid={`observe-event-${event.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <span>
                      {event.icon && <span>{event.icon} </span>}
                      {event.title}
                    </span>
                    {idx < correctOrder.length - 1 && (
                      <span
                        aria-hidden="true"
                        style={{ color: 'var(--oe-color-on-surface-variant, #6b7280)' }}
                      >
                        {' '}
                        →{' '}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <ObserveTimelineEvent
                  key={event.id}
                  event={event}
                  index={idx}
                  layout={layout}
                  showDates={content.showDates ?? true}
                  showImages={content.showImages ?? false}
                  resolveAsset={resolveAsset}
                />
              );
            })}
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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div data-testid="timeline" aria-label="Timeline activity">
        {content.title && (
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--oe-color-on-surface, #111827)' }}>
            {content.title}
          </h3>
        )}

        <div
          data-testid="timeline-sortable"
          role="group"
          aria-label="Reorder the timeline events"
          style={
            layout === 'horizontal'
              ? {
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '0.5rem',
                  overflowX: 'auto',
                  padding: '0.75rem',
                  border: '2px solid var(--oe-color-primary, #3b82f6)',
                  borderRadius: '0.375rem',
                  minHeight: '2.5rem',
                  backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
                }
              : layout === 'compact'
                ? {
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '0.25rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '0.75rem',
                    border: '2px solid var(--oe-color-primary, #3b82f6)',
                    borderRadius: '0.375rem',
                    minHeight: '2.5rem',
                    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
                  }
                : {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    border: '2px solid var(--oe-color-primary, #3b82f6)',
                    borderRadius: '0.375rem',
                    minHeight: '2.5rem',
                    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
                  }
          }
        >
          <SortableContext items={eventOrder} strategy={sortStrategy}>
            {eventOrder.map((id, index) => {
              const event = events.find((e) => e.id === id);
              if (!event) return null;
              // Compact layout uses static items (drag disabled for compact display)
              if (layout === 'compact') {
                return (
                  <div
                    key={event.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <div
                      data-testid={`timeline-event-${event.id}`}
                      role="listitem"
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid var(--oe-color-outline-variant, #d1d5db)',
                        borderRadius: '0.25rem',
                        backgroundColor:
                          submitted && correctOrder[index] === event.id
                            ? 'var(--oe-color-success-container, #dcfce7)'
                            : submitted && correctOrder[index] !== event.id
                              ? 'var(--oe-color-error-container, #fee2e2)'
                              : 'var(--oe-color-surface, #ffffff)',
                        cursor: 'grab',
                      }}
                    >
                      {event.icon && <span>{event.icon} </span>}
                      {event.title}
                    </div>
                    {index < eventOrder.length - 1 && (
                      <span
                        aria-hidden="true"
                        style={{ color: 'var(--oe-color-on-surface-variant, #6b7280)' }}
                      >
                        {' '}
                        →{' '}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <SortableTimelineEvent
                  key={event.id}
                  event={event}
                  index={index}
                  submitted={submitted}
                  correctOrder={correctOrder}
                  layout={layout}
                  showDates={content.showDates ?? true}
                  showImages={content.showImages ?? false}
                  resolveAsset={resolveAsset}
                />
              );
            })}
          </SortableContext>
        </div>

        {submitted &&
          correctOrder.map((correctId, slotIndex) => {
            const placedId = eventOrder[slotIndex];
            const isIncorrectPosition = placedId && placedId !== correctId;
            if (!isIncorrectPosition) return null;
            const correctEvent = events.find((e) => e.id === correctId);
            return (
              <div
                key={`correction-${slotIndex}`}
                style={{
                  padding: '0.25rem 0.5rem',
                  marginLeft: '1.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--oe-color-on-surface-variant, #6b7280)',
                  fontStyle: 'italic',
                }}
              >
                Correct: {correctEvent?.icon && <span>{correctEvent.icon} </span>}
                {correctEvent?.title}
              </div>
            );
          })}

        <div role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: '0.5rem' }}>
          {eventOrder.length > 0 && (
            <p data-testid="timeline-status">
              {eventOrder.length} of {events.length} events in sequence
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

        <div style={{ marginTop: '1rem' }}>
          {!submitted ? (
            <Button variant="default" onClick={handleSubmit} disabled={false}>
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
              const correct =
                correctOrder.length === eventOrder.length &&
                correctOrder.every((id, i) => id === eventOrder[i]);
              const correctCount = eventOrder.filter((id, i) => id === correctOrder[i]).length;
              if (correct) {
                return <p>Correct! The timeline is in the right order.</p>;
              }
              return (
                <p>
                  {correctCount} of {correctOrder.length} events in the right position.
                </p>
              );
            })()}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeDragEvent ? (
          <div
            style={{
              padding: '0.5rem',
              border: '2px solid var(--oe-color-primary, #3b82f6)',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
              cursor: 'grabbing',
              userSelect: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            {activeDragEvent.icon && <span>{activeDragEvent.icon}</span>}
            <span>{activeDragEvent.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const TimelineWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Display events in chronological order on an interactive timeline.',
    whatItDoes:
      'The Timeline widget arranges events along a visual timeline. Students can observe events in order or interactively arrange them. It supports horizontal, vertical, and compact layouts with optional dates, images, and descriptions.',
    whenToUse: [
      'Teaching historical sequences and chronology',
      'Showing life cycles and growth stages',
      'Displaying project milestones or steps',
      'Visualizing process timelines in science',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.timeline"',
      'Define your events — each needs an id and title',
      'Optionally add dates, descriptions, icons, and images',
      'Choose a layout: horizontal, vertical, or compact',
    ],
    configFields: [
      {
        name: 'events',
        type: 'array of objects',
        required: true,
        description:
          'Timeline events. Each has id (string), title (string), and optional date (string), icon (string), description (string), image (string).',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'An overall title for the timeline.',
      },
      {
        name: 'layout',
        type: 'string',
        required: false,
        description: '"horizontal", "vertical" (default), or "compact".',
      },
      {
        name: 'showDates',
        type: 'boolean',
        required: false,
        description: 'Show dates on the timeline. Defaults to true.',
      },
      {
        name: 'showImages',
        type: 'boolean',
        required: false,
        description: 'Show images on the timeline. Defaults to false.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows events for observation only. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "The Water Cycle",\n  "widget": "core.timeline",\n  "config": {\n    "title": "The Water Cycle",\n    "events": [\n      { "id": "evap", "title": "Evaporation", "icon": "☀️", "description": "Water heats up and rises as vapor" },\n      { "id": "cond", "title": "Condensation", "icon": "☁️", "description": "Water vapor cools and forms clouds" },\n      { "id": "rain", "title": "Rain", "icon": "🌧️", "description": "Water falls as precipitation" },\n      { "id": "collect", "title": "Collection", "icon": "🌊", "description": "Water collects in oceans and lakes" }\n    ],\n    "layout": "vertical",\n    "showDates": false,\n    "showImages": false,\n    "interactive": false\n  }\n}',
    tips: [
      'Use clear, descriptive event titles',
      'Add emoji icons to make events visually distinct',
      'Keep descriptions short — 1 sentence or less',
      'For interactive mode, make sure the correct order is unambiguous',
    ],
    sidebarPosition: 13,
    relatedWidgets: [
      {
        id: 'core.sequencing',
        name: 'Sequencing',
        domain: 'core',
        slug: 'sequencing',
      },
      {
        id: 'science.process-diagram',
        name: 'Process Diagram',
        domain: 'science',
        slug: 'process-diagram',
      },
    ],
  },
  id: 'core.timeline',
  version: '1.0.0',
  schema: timelineSchema,
  name: 'Timeline',
  description: 'Explore events in chronological order with interactive timeline',
  domain: 'core',
  learningIntents: [LearningIntent.Apply, LearningIntent.Observe],
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
    achievement: 'timeline-master',
    positiveMessage: 'Timeline completed!',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 5,
    bloomsLevel: 'apply',
    cognitiveLoad: 'moderate',
    subjectTags: ['general', 'history'],
    authoringPrompt: 'Create a timeline of events in chronological order with at least 4 events',
    recommendedAge: [8, 16],
    readingLevel: 'grade-3',
    learningObjectives: [
      'Arrange events in chronological order',
      'Understand temporal relationships between events',
      'Identify causes and effects through sequencing',
    ],
    commonMisconceptions: [
      'Confusing earlier events with later events when dates are similar',
      'Assuming order based on event importance rather than chronology',
    ],
    generationHints: [
      'Ensure each event has a unique and identifiable title',
      'Include dates to make chronological order unambiguous',
      'Use 4-8 events for manageable complexity',
    ],
    exampleConfigs: [
      { events: ['Event A (1900)', 'Event B (1950)', 'Event C (2000)'] },
      { events: ['Seed planted', 'Sprout appears', 'Plant flowers', 'Fruit grows'] },
    ],
  },
  icon: 'git-branch',
  keywords: ['timeline', 'events', 'chronological', 'history', '时间线'],
  status: 'stable',
  render: TimelineComponent,
};

export { TimelineWidget as timeline, timelineSchema };
export default TimelineWidget;
