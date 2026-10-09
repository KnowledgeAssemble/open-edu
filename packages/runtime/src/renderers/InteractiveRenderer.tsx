import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InteractiveNode } from '@open-edu/schemas';
import {
  InteractiveNodeView,
  InteractiveLessonView,
  buildOpenEduBridge,
  buildSemanticTokens,
  AlternativeList,
  extractAlternativeRows,
  FigureOverlay,
} from '@open-edu/interactive-runtime';
import type {
  OpenEduBridge,
  InteractiveNodeHandle,
  AlternativeRowLike,
  SceneNodeLike,
} from '@open-edu/interactive-runtime';
import { Button } from '@open-edu/design-system';
import { useRuntimeOptional } from '../context/RuntimeContext';
import { useTranslation } from '@open-edu/i18n';
import { useLiveRegion } from '@open-edu/accessibility';
import { WidgetErrorBoundary } from '../widgets/NativeWidgetAdapter';

export interface InteractiveRendererProps {
  node: InteractiveNode;
  nodeId: string;
  onComplete?: (score?: number) => void;
}

type EngineEvent = {
  seq: number;
  name: string;
  instanceId: string;
  action?: unknown;
};

interface EngineSceneNode {
  id: string;
  kind?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  metadata?: Record<string, unknown>;
  children?: EngineSceneNode[];
  hidden?: boolean;
}

interface EngineSnapshot {
  scene?: { nodes?: EngineSceneNode[] };
  svgResult?: { alternative?: unknown[] };
}

/** Lifecycle events after which the host re-reads the engine snapshot (L3). */
export function shouldRefreshSnapshot(eventName: string): boolean {
  return eventName === 'engine-ready' || eventName.endsWith('state-changed');
}

function isComposedLesson(node: InteractiveNode): boolean {
  return Array.isArray(node.engines);
}

function resolveEngineLabel(node: InteractiveNode, event: EngineEvent): string {
  if (node.engine) return node.engine;
  const entry = node.engines?.find((engine) => engine.instanceId === event.instanceId);
  if (entry) return entry.engine;
  const prefix = event.name.split('.')[0];
  if (prefix && !prefix.includes('-')) return prefix;
  return 'interactive';
}

/**
 * Renders a single `{ type: 'interactive' }` node via the OpenEdu host bridge.
 * Single-engine nodes mount {@link InteractiveNodeView}; composed lessons mount
 * {@link InteractiveLessonView}. Engine events are bridged to OpenEdu telemetry;
 * completion is user-initiated via an explicit "Mark complete" button.
 */
export function InteractiveRenderer({
  node,
  nodeId,
  onComplete,
}: InteractiveRendererProps): JSX.Element {
  const runtime = useRuntimeOptional();
  const { t, locale } = useTranslation();
  const { announce } = useLiveRegion();
  const [interactions, setInteractions] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const tRef = useRef(t);
  tRef.current = t;
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  const engineHandleRef = useRef<InteractiveNodeHandle | null>(null);
  const [engineSnapshot, setEngineSnapshot] = useState<EngineSnapshot | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pendingRetryRef = useRef<number | null>(null);

  const refreshSnapshot = useCallback(() => {
    const snapshot = engineHandleRef.current?.snapshot() as EngineSnapshot | undefined;
    if (snapshot) {
      setEngineSnapshot(snapshot);
      return;
    }
    // `engine.instantiate()` emits engine-ready synchronously, before
    // InteractiveNode assigns its instance ref, so the first read can come back
    // empty. Defer one re-read to the next macrotask, by which time the handle
    // is populated.
    //
    // Both guards matter. A composed lesson never populates engineHandleRef
    // (see handleLessonReady), so re-reading it is pointless and would reschedule
    // forever. And the pending check keeps this to a single deferral in flight
    // rather than one per engine event.
    if (isComposedLesson(nodeRef.current)) return;
    if (pendingRetryRef.current !== null) return;
    pendingRetryRef.current = window.setTimeout(() => {
      pendingRetryRef.current = null;
      refreshSnapshot();
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (pendingRetryRef.current !== null) {
        window.clearTimeout(pendingRetryRef.current);
        pendingRetryRef.current = null;
      }
    };
  }, []);

  const handleNodeReady = useCallback((handle: InteractiveNodeHandle) => {
    engineHandleRef.current = handle; // single-engine only (L5)
    setIsReady(true);
  }, []);

  const handleLessonReady = useCallback(() => {
    setIsReady(true); // composed: no handle, no layers (L5)
  }, []);

  const handleEngineEvent = useCallback(
    (event: EngineEvent) => {
      if (shouldRefreshSnapshot(event.name)) refreshSnapshot();
      const isUserInteraction = event.action != null;
      if (isUserInteraction) setInteractions((n) => n + 1);
      const rawAction = event.action as { type?: string } | undefined;
      runtimeRef.current?.emitTelemetry?.({
        event: 'interactive_interaction',
        nodeId,
        instanceId: event.instanceId,
        engine: resolveEngineLabel(nodeRef.current, event),
        action: rawAction?.type,
        seq: event.seq,
        data: { event: event.name },
      });
    },
    [nodeId, refreshSnapshot],
  );

  const bridge: OpenEduBridge = useMemo(
    () =>
      buildOpenEduBridge({
        locale,
        tokens: buildSemanticTokens(),
        reducedMotion:
          typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
            : false,
        t: (key, vars) => {
          const safe: Record<string, string> = {};
          if (vars) for (const k of Object.keys(vars)) safe[k] = String(vars[k]);
          return tRef.current(key, safe);
        },
        announce: (message) => announceRef.current(message),
        onEvent: handleEngineEvent,
        resolveAsset: (id) => runtimeRef.current?.resolveEngineAsset(id) ?? `/assets/${id}`,
      }),
    [locale, handleEngineEvent],
  );

  const handleComplete = (): void => {
    runtime?.saveAnswer(nodeId, {
      type: 'interactive',
      engaged: interactions > 0,
      interactions,
    });
    runtime?.emitTelemetry?.({
      event: 'interactive_complete',
      nodeId,
      interactions,
    });
    announce(t('runtime.interactive.completed'));
    if (onComplete) onComplete(undefined);
    else runtime?.completeNode(undefined);
  };

  const engineLabel = node.engine ?? node.id ?? 'lesson';
  const interactiveId = node.id ?? node.engine ?? nodeId;

  return (
    <div
      className="open-edu-interactive"
      data-testid="interactive-renderer"
      role="region"
      aria-label={t('runtime.interactive.iframe_title', { engine: engineLabel })}
    >
      {!isReady && (
        <p className="text-body-ui text-muted-foreground" role="status">
          {t('runtime.interactive.loading')}
        </p>
      )}
      {(node.title ?? node.prompt) && (
        <div className="mb-4">
          {node.title && <h2 className="text-body-ui font-semibold text-foreground">{node.title}</h2>}
          {node.prompt && <p className="text-body-ui text-muted-foreground mt-1">{node.prompt}</p>}
        </div>
      )}
      <div className="relative" ref={surfaceRef}>
        <WidgetErrorBoundary widgetId={interactiveId} message={t('runtime.interactive.load_error')}>
          {isComposedLesson(node) ? (
            <InteractiveLessonView
              lesson={{
                id: node.id ?? 'interactive-lesson',
                title: node.title,
                engines: node.engines ?? [],
                bindings: node.bindings ?? [],
              }}
              bridge={bridge}
              onReady={handleLessonReady}
            />
          ) : (
            <InteractiveNodeView
              spec={node.spec}
              engineType={node.engine ?? 'visual'}
              bridge={bridge}
              onReady={handleNodeReady}
            />
          )}
        </WidgetErrorBoundary>
        {!isComposedLesson(node) && engineSnapshot && node.figures && (
          <FigureOverlay
            figures={node.figures}
            snapshotNodes={engineSnapshot.scene?.nodes as SceneNodeLike[] | undefined}
            surfaceRef={surfaceRef}
            resolve={(ref) => runtimeRef.current?.resolveEngineAsset(ref) ?? `/assets/${ref}`}
          />
        )}
      </div>
      {!isComposedLesson(node) && (
        <AlternativeList
          title={t('runtime.interactive.alternative.title')}
          cycleLabel={t('runtime.interactive.alternative.cycleLabel')}
          rows={extractAlternativeRows(
            engineSnapshot?.svgResult?.alternative as AlternativeRowLike[],
          )}
        />
      )}
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={handleComplete} disabled={!isReady}>
          {t('runtime.interactive.mark_complete')}
        </Button>
      </div>
    </div>
  );
}
