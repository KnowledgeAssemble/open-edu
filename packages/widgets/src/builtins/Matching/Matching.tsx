import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

export const matchingSchema = z.object({
  description: z.string().optional(),
  pairs: z.array(
    z.object({
      id: z.string().optional(),
      itemA: z.string(),
      itemB: z.string(),
    }),
  ),
  hints: z.array(z.string()).optional(),
  hint: z.string().optional(),
  interactive: z.boolean().optional().default(false),
});

export type MatchingConfig = z.infer<typeof matchingSchema>;

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

function getPairId(pair: { id?: string }, index: number): string {
  return pair.id ?? `pair-${index}`;
}

const MatchingStateSchema = z.object({
  submitted: z.boolean(),
  connections: z.record(z.string(), z.string()),
  hintIndex: z.number(),
});

function MatchingComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const content = useMemo(() => {
    const parsed = matchingSchema.safeParse(rawConfig);
    return parsed.success ? parsed.data : null;
  }, [rawConfig]);
  const hasValidContent = content && content.pairs.length > 0;

  const parsedState = useMemo(() => {
    const result = MatchingStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Map<string, string>>(() =>
    parsedState?.connections ? new Map(Object.entries(parsedState.connections)) : new Map(),
  );
  const [hintIndex, setHintIndex] = useState(parsedState?.hintIndex ?? 0);
  const [connectorPositions, setConnectorPositions] = useState<
    Array<{ x1: number; y1: number; x2: number; y2: number; leftId: string; rightId: string }>
  >([]);

  const [drawingLine, setDrawingLine] = useState<{
    leftId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const isObserve = content?.interactive !== true;
  const pairs = content?.pairs ?? [];

  const shuffledRightPairs = useMemo(() => {
    if (!content) return [];
    return shuffleArray(content.pairs);
  }, [content]);

  const containerRef = useRef<HTMLDivElement>(null);

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve: isObserve && hasValidContent,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.matching',
  });

  const updateConnectorPositions = useCallback(() => {
    if (!containerRef.current) return;
    const positions: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      leftId: string;
      rightId: string;
    }> = [];
    const containerRect = containerRef.current.getBoundingClientRect();

    for (const [leftId, rightId] of connections.entries()) {
      const leftEl = containerRef.current.querySelector(`[data-connector-left="${leftId}"]`);
      const rightEl = containerRef.current.querySelector(`[data-connector-right="${rightId}"]`);
      if (leftEl && rightEl) {
        const leftRect = leftEl.getBoundingClientRect();
        const rightRect = rightEl.getBoundingClientRect();
        positions.push({
          x1: leftRect.right - containerRect.left,
          y1: leftRect.top + leftRect.height / 2 - containerRect.top,
          x2: rightRect.left - containerRect.left,
          y2: rightRect.top + rightRect.height / 2 - containerRect.top,
          leftId,
          rightId,
        });
      }
    }
    setConnectorPositions(positions);
  }, [connections]);

  useEffect(() => {
    updateConnectorPositions();
  }, [connections, updateConnectorPositions]);

  useEffect(() => {
    const handleResize = () => updateConnectorPositions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateConnectorPositions]);

  const getContainerCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const containerRect = containerRef.current.getBoundingClientRect();
      return {
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
      };
    },
    [],
  );

  const findRightItemAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
      const rightId = (el as HTMLElement).getAttribute?.('data-connector-right');
      if (rightId) return rightId;
    }
    return null;
  }, []);

  const handleLeftItemClick = useCallback(
    (pairId: string) => {
      if (submitted) return;
      if (connections.has(pairId)) {
        setConnections((prev) => {
          const next = new Map(prev);
          next.delete(pairId);
          return next;
        });
        setSelectedLeftId(pairId);
        return;
      }
      setSelectedLeftId((prev) => (prev === pairId ? null : pairId));
    },
    [submitted, connections],
  );

  const handleRightItemClick = useCallback(
    (rightPairId: string) => {
      if (submitted || selectedLeftId === null) return;
      setConnections((prev) => {
        const next = new Map(prev);
        next.set(selectedLeftId, rightPairId);
        return next;
      });
      setSelectedLeftId(null);
    },
    [submitted, selectedLeftId],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, leftPairId: string) => {
      if (submitted || isObserve) return;
      if (!containerRef.current) return;
      e.preventDefault();
      const coords = getContainerCoords(e.clientX, e.clientY);
      const leftEl = containerRef.current.querySelector(`[data-connector-left="${leftPairId}"]`);
      if (!leftEl) return;
      const leftRect = leftEl.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setDrawingLine({
        leftId: leftPairId,
        x1: leftRect.right - containerRect.left,
        y1: leftRect.top + leftRect.height / 2 - containerRect.top,
        x2: coords.x,
        y2: coords.y,
      });
      setSelectedLeftId(null);
    },
    [submitted, isObserve, getContainerCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingLine) return;
      const coords = getContainerCoords(e.clientX, e.clientY);
      setDrawingLine((prev) => (prev ? { ...prev, x2: coords.x, y2: coords.y } : null));
    },
    [drawingLine, getContainerCoords],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingLine) return;
      const rightId = findRightItemAtPoint(e.clientX, e.clientY);
      if (rightId) {
        setConnections((prev) => {
          const next = new Map(prev);
          next.set(drawingLine.leftId, rightId);
          return next;
        });
      }
      setDrawingLine(null);
    },
    [drawingLine, findRightItemAtPoint],
  );

  const handleRemoveConnection = useCallback(
    (leftPairId: string) => {
      if (submitted) return;
      setConnections((prev) => {
        const next = new Map(prev);
        next.delete(leftPairId);
        return next;
      });
    },
    [submitted],
  );

  const pairCorrectness = useMemo(() => {
    if (!content) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    for (const pair of content.pairs) {
      const pairId = getPairId(pair, content.pairs.indexOf(pair));
      const connectedRight = connections.get(pairId);
      map.set(pairId, connectedRight === pairId);
    }
    return map;
  }, [content, connections]);

  const computeScore = useCallback(() => {
    if (!content) return 0;
    const totalPairs = content.pairs.length;
    const correctCount = Array.from(pairCorrectness.values()).filter(Boolean).length;
    return totalPairs > 0 ? Math.round((correctCount / totalPairs) * 100) : 0;
  }, [content, pairCorrectness]);

  const handleSubmit = useCallback(() => {
    if (submitted || !content) return;
    const totalPairs = content.pairs.length;
    const results: Array<{ id: string; correct: boolean }> = [];

    for (const pair of content.pairs) {
      const pairId = getPairId(pair, content.pairs.indexOf(pair));
      results.push({ id: pairId, correct: pairCorrectness.get(pairId) ?? false });
    }

    const correctCount = results.filter((r) => r.correct).length;
    const allCorrect = correctCount === totalPairs;
    const accuracy = totalPairs > 0 ? correctCount / totalPairs : 0;

    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      pairs: results,
      correct: allCorrect,
      accuracy,
      widgetId: 'core.matching',
    });
    setSubmitted(true);
  }, [submitted, content, pairCorrectness, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (!content) return;
    const connObj: Record<string, string> = {};
    for (const [k, v] of connections.entries()) {
      connObj[k] = v;
    }
    complete(computeScore(), { submitted: true, connections: connObj, hintIndex });
  }, [content, connections, hintIndex, computeScore, complete]);

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
        className="border-outline-variant bg-surface-container-lowest p-md rounded-lg border text-center"
      >
        <p className="text-on-surface font-semibold">This activity could not be loaded.</p>
      </div>
    );
  }

  const allLeftConnected = pairs.every((pair, idx) => {
    const pairId = getPairId(pair, idx);
    return connections.has(pairId);
  });

  const allDrawingLines = (() => {
    const lines = [...connectorPositions];
    if (drawingLine) {
      lines.push({
        x1: drawingLine.x1,
        y1: drawingLine.y1,
        x2: drawingLine.x2,
        y2: drawingLine.y2,
        leftId: drawingLine.leftId,
        rightId: 'drawing',
      });
    }
    return lines;
  })();

  if (isObserve) {
    return (
      <div data-testid="matching" aria-label="Matching activity">
        <div role="status" aria-live="polite">
          {content.description && <p>{content.description}</p>}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '1rem',
              alignItems: 'start',
            }}
          >
            <div>
              {pairs.map((pair, idx) => {
                const pairId = getPairId(pair, idx);
                return (
                  <div
                    key={pairId}
                    data-testid={`observe-left-${pairId}`}
                    data-observe-left={pairId}
                    style={{ padding: '0.5rem', margin: '0.25rem 0' }}
                    aria-label={pair.itemA}
                  >
                    {pair.itemA}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              >
                {pairs.map((pair, idx) => {
                  const pairId = getPairId(pair, idx);
                  return (
                    <line
                      key={pairId}
                      x1="0%"
                      y1={`${(idx / Math.max(pairs.length - 1, 1)) * 100}%`}
                      x2="100%"
                      y2={`${(idx / Math.max(pairs.length - 1, 1)) * 100}%`}
                      stroke="var(--oe-color-primary, #3b82f6)"
                      strokeWidth={2}
                    />
                  );
                })}
              </svg>
              {pairs.map((pair, idx) => {
                const pairId = getPairId(pair, idx);
                return (
                  <div
                    key={pairId}
                    style={{
                      width: '2rem',
                      height: '2rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0.25rem 0',
                    }}
                  />
                );
              })}
            </div>
            <div>
              {pairs.map((pair, idx) => {
                const pairId = getPairId(pair, idx);
                return (
                  <div
                    key={pairId}
                    data-testid={`observe-right-${pairId}`}
                    data-observe-right={pairId}
                    style={{ padding: '0.5rem', margin: '0.25rem 0' }}
                    aria-label={pair.itemB}
                  >
                    {pair.itemB}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {!showAcknowledgeButton && (
          <div role="status" aria-live="assertive" data-testid="observe-complete">
            <p>Content acknowledged.</p>
          </div>
        )}
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
      </div>
    );
  }

  return (
    <div
      data-testid="matching"
      aria-label="Matching activity"
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none', position: 'relative' }}
    >
      {content.description && <p>{content.description}</p>}

      <div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '1rem',
            alignItems: 'start',
          }}
          role="group"
          aria-label="Matching columns"
        >
          <div role="list" aria-label="Items to match">
            {pairs.map((pair, idx) => {
              const pairId = getPairId(pair, idx);
              const isSelected = selectedLeftId === pairId;
              const isConnected = connections.has(pairId);
              return (
                <div
                  key={pairId}
                  role="listitem"
                  data-testid={`left-item-${pairId}`}
                  data-connector-left={pairId}
                  tabIndex={0}
                  aria-label={`Match ${pair.itemA}`}
                  aria-selected={isSelected}
                  onClick={() => handleLeftItemClick(pairId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLeftItemClick(pairId);
                    }
                  }}
                  onPointerDown={(e) => handlePointerDown(e, pairId)}
                  style={{
                    padding: '0.5rem',
                    margin: '0.25rem 0',
                    border: isSelected
                      ? '2px solid var(--oe-color-primary, #3b82f6)'
                      : isConnected
                        ? '2px solid var(--oe-success, #22c55e)'
                        : '1px solid var(--oe-color-outline-variant, #d1d5db)',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--oe-color-primary-container, #eff6ff)'
                      : isConnected
                        ? 'var(--oe-color-success-container, #f0fdf4)'
                        : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  <span>{pair.itemA}</span>
                  {isConnected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveConnection(pairId);
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
                      aria-label={`Remove match for ${pair.itemA}`}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            aria-hidden="true"
          >
            {pairs.map((pair, idx) => {
              const pairId = getPairId(pair, idx);
              return (
                <div
                  key={pairId}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0.25rem 0',
                  }}
                />
              );
            })}
          </div>

          <div role="list" aria-label="Target items">
            {shuffledRightPairs.map((pair) => {
              const pairId = getPairId(pair, pairs.indexOf(pair));
              const isMatched = Array.from(connections.values()).includes(pairId);
              return (
                <div
                  key={pairId}
                  role="listitem"
                  data-testid={`right-item-${pairId}`}
                  data-connector-right={pairId}
                  tabIndex={selectedLeftId !== null ? 0 : -1}
                  aria-label={`Match with ${pair.itemB}`}
                  onClick={() => handleRightItemClick(pairId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRightItemClick(pairId);
                    }
                  }}
                  style={{
                    padding: '0.5rem',
                    margin: '0.25rem 0',
                    border: isMatched
                      ? '2px solid var(--oe-success, #22c55e)'
                      : '1px solid var(--oe-color-outline-variant, #d1d5db)',
                    borderRadius: '0.25rem',
                    cursor: selectedLeftId !== null ? 'pointer' : 'default',
                    backgroundColor: isMatched
                      ? 'var(--oe-color-success-container, #f0fdf4)'
                      : 'transparent',
                    opacity: isMatched ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{pair.itemB}</span>
                  {isMatched && <span style={{ color: 'var(--oe-success, #22c55e)' }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10,
          }}
          aria-hidden="true"
        >
          {allDrawingLines.map((conn, i) => {
            const isLearnerLine = conn.rightId !== 'drawing';
            const isCorrect =
              isLearnerLine && submitted ? (pairCorrectness.get(conn.leftId) ?? false) : false;
            const stroke =
              submitted && isLearnerLine
                ? isCorrect
                  ? 'var(--oe-success, #22c55e)'
                  : 'var(--oe-error, #ef4444)'
                : 'var(--oe-color-primary, #3b82f6)';
            return (
              <line
                key={`${conn.leftId}-${conn.rightId}-${i}`}
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray={conn.rightId === 'drawing' ? '4 3' : 'none'}
                opacity={conn.rightId === 'drawing' ? 0.7 : 1}
              />
            );
          })}
          {submitted &&
            pairs.map((pair, idx) => {
              const pairId = getPairId(pair, idx);
              if (connections.has(pairId)) return null;
              const leftEl = containerRef.current?.querySelector(
                `[data-connector-left="${pairId}"]`,
              );
              const rightEl = containerRef.current?.querySelector(
                `[data-connector-right="${pairId}"]`,
              );
              if (!leftEl || !rightEl || !containerRef.current) return null;
              const containerRect = containerRef.current.getBoundingClientRect();
              const leftRect = leftEl.getBoundingClientRect();
              const rightRect = rightEl.getBoundingClientRect();
              return (
                <line
                  key={`correct-${pairId}`}
                  x1={leftRect.right - containerRect.left}
                  y1={leftRect.top + leftRect.height / 2 - containerRect.top}
                  x2={rightRect.left - containerRect.left}
                  y2={rightRect.top + rightRect.height / 2 - containerRect.top}
                  stroke="var(--oe-success, #22c55e)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.8}
                />
              );
            })}
        </svg>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: '0.5rem' }}>
        {connections.size > 0 && (
          <p data-testid="connections-status">
            {connections.size} of {pairs.length} pairs connected
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
          <Button variant="default" onClick={handleSubmit} disabled={!allLeftConnected}>
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
          {Array.from(pairCorrectness.values()).every(Boolean) ? (
            <p>Correct! All pairs matched.</p>
          ) : (
            <p>Some pairs are not matched correctly.</p>
          )}
          <div data-testid="correct-answer-panel" style={{ marginTop: '0.5rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Correct pairs:</p>
            {pairs.map((pair, idx) => {
              const pairId = getPairId(pair, idx);
              return (
                <p key={pairId} style={{ margin: '0.125rem 0' }}>
                  {pair.itemA} → {pair.itemB}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const MatchingWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Match pairs of items by dragging or selecting.',
    whatItDoes:
      'The Matching widget shows two columns of items. Students connect each item from the left column to its corresponding match in the right column. It supports keyboard navigation, touch, and screen readers.',
    whenToUse: [
      'Teaching vocabulary and definitions',
      'Matching causes to effects',
      'Pairing items with their categories',
      'Connecting concepts to examples',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.matching"',
      'Define your pairs in the config — each pair has an itemA and itemB',
      'Add an optional description to guide students',
      'Optionally add hints to help students who get stuck',
    ],
    configFields: [
      {
        name: 'pairs',
        type: 'array of objects',
        required: true,
        description: 'The matching pairs. Each object has an itemA (string) and itemB (string).',
      },
      {
        name: 'pairs[].itemA',
        type: 'string',
        required: true,
        description: 'The left-side item text.',
      },
      {
        name: 'pairs[].itemB',
        type: 'string',
        required: true,
        description: 'The right-side item text.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions shown above the matching activity.',
      },
      {
        name: 'hints',
        type: 'array of strings',
        required: false,
        description: 'Progressive hints shown when students need help.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description:
          'When false, shows the activity in observe mode with correct matches pre-connected. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Fruit Color Matching",\n  "widget": "core.matching",\n  "config": {\n    "description": "Match each fruit to its color.",\n    "pairs": [\n      { "itemA": "Apple", "itemB": "Red" },\n      { "itemA": "Banana", "itemB": "Yellow" },\n      { "itemA": "Orange", "itemB": "Orange" },\n      { "itemA": "Grape", "itemB": "Purple" }\n    ],\n    "interactive": true\n  }\n}',
    tips: [
      'Keep itemA and itemB labels short (2-4 words)',
      'Use 3-6 pairs for younger students, up to 10 for older ones',
      'Make sure each pair has a clear, unambiguous connection',
      'Add emoji to item labels for visual reinforcement',
    ],
    sidebarPosition: 2,
    relatedWidgets: [
      {
        id: 'core.drag-drop',
        name: 'Drag & Drop',
        domain: 'core',
        slug: 'drag-drop',
      },
      {
        id: 'language.flashcard',
        name: 'Flashcard',
        domain: 'language',
        slug: 'flashcard',
      },
    ],
  },
  id: 'core.matching',
  name: 'Matching',
  description: 'Match pairs of items by dragging or selecting',
  domain: 'core',
  version: '0.1.0',
  schema: matchingSchema,
  render: MatchingComponent,
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
    trackMistakes: true,
    trackHints: true,
    trackRetries: true,
  },
  reward: {
    completionXP: 10,
    confetti: true,
    positiveMessage: 'All pairs matched!',
    achievement: 'first-match',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 3,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    subjectTags: ['general'],
    authoringPrompt: 'Create a matching exercise with 4-6 pairs',
    recommendedAge: [5, 12],
    readingLevel: 'pre-reader',
    learningObjectives: [
      'Identify correct pairs of related items',
      'Match items based on shared attributes',
      'Compare and contrast items to find relationships',
    ],
    commonMisconceptions: [
      'Selecting both items from the same column',
      'Assuming alphabetical order determines matches',
    ],
    generationHints: [
      'Use items with clear, unambiguous associations',
      'Mix obvious and challenging pairs',
      'Keep text labels short (2-4 words)',
    ],
    exampleConfigs: [
      {
        pairs: [
          { left: 'Dog', right: 'Puppy' },
          { left: 'Cat', right: 'Kitten' },
        ],
      },
      {
        pairs: [
          { left: 'Hot', right: 'Cold' },
          { left: 'Big', right: 'Small' },
          { left: 'Fast', right: 'Slow' },
        ],
      },
    ],
  },
  icon: 'puzzle',
  keywords: ['match', 'pairs', 'connect', 'drag'],
  status: 'stable',
};

export { MatchingWidget as matching };
export default MatchingWidget;
