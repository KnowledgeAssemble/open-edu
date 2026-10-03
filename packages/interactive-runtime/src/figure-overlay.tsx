import { useEffect, useState, type RefObject } from 'react';

export interface SceneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneNodeLike {
  id: string;
  kind?: string;
  bounds?: SceneBounds;
  metadata?: Record<string, unknown>;
  children?: SceneNodeLike[];
  hidden?: boolean;
}

export interface FigureSpecView {
  ref: string;
  altKey?: string;
  decorative?: boolean;
}

export interface FigurePlacement {
  key: string;
  spec: FigureSpecView;
  left: number;
  top: number;
  width: number;
  height: number;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The authored id, per engine (L10). */
export function authoredIdOf(node: SceneNodeLike): string | undefined {
  const meta = node.metadata ?? {};
  const metaId = asString(meta.nodeId) ?? asString(meta.entityId) ?? asString(meta.rowId);
  if (metaId) return metaId;
  if (node.kind === 'event-marker') return asString(node.id);
  return undefined;
}

/** Depth-first over the scene tree; one figure per figures key, first match wins. */
export function collectFigurePlacements(
  nodes: SceneNodeLike[] | undefined,
  figures: Record<string, FigureSpecView>,
  canvas: { width: number; height: number },
): FigurePlacement[] {
  const placements: FigurePlacement[] = [];
  const used = new Set<string>();
  const walk = (list: SceneNodeLike[] | undefined): void => {
    for (const node of list ?? []) {
      const id = authoredIdOf(node);
      if (id && !used.has(id) && figures[id] && node.bounds && !node.hidden) {
        used.add(id);
        const b = node.bounds;
        placements.push({
          key: id,
          spec: figures[id],
          left: (b.x / canvas.width) * 100,
          top: (b.y / canvas.height) * 100,
          width: (b.width / canvas.width) * 100,
          height: (b.height / canvas.height) * 100,
        });
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return placements;
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export interface FigureOverlayProps {
  figures: Record<string, FigureSpecView>;
  snapshotNodes: SceneNodeLike[] | undefined;
  /** Ref to the wrapper element that contains the engine's live <svg>. */
  surfaceRef: RefObject<HTMLElement | null>;
  resolve: (ref: string) => string;
  translate: (altKey: string) => string;
}

export function FigureOverlay({
  figures,
  snapshotNodes,
  surfaceRef,
  resolve,
  translate,
}: FigureOverlayProps): JSX.Element | null {
  const [canvas, setCanvas] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    setFailed(new Set());
    const viewBox = surfaceRef.current?.querySelector('svg')?.getAttribute('viewBox');
    const parts = (viewBox ?? '').split(/[\s,]+/).map(Number);
    const width = parts[2];
    const height = parts[3];
    setCanvas(
      parts.length === 4 && isPositiveFinite(width) && isPositiveFinite(height)
        ? { width, height }
        : null,
    );
  }, [surfaceRef, snapshotNodes]);

  if (!canvas) return null;
  const placements = collectFigurePlacements(snapshotNodes, figures, canvas);

  return (
    <div
      data-testid="figure-overlay"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
    >
      {placements.map(({ key, spec, left, top, width, height }) => {
        const style = {
          position: 'absolute' as const,
          left: `${left}%`,
          top: `${top}%`,
          margin: 0,
        };
        if (failed.has(key)) {
          if (spec.decorative === true || !spec.altKey) return null;
          return (
            <span
              key={key}
              style={style}
              data-testid="figure-caption"
              className="text-body-ui text-muted-foreground"
            >
              {translate(spec.altKey)}
            </span>
          );
        }
        return (
          <figure key={key} style={{ ...style, width: `${width}%`, height: `${height}%` }}>
            <img
              src={resolve(spec.ref)}
              alt={spec.decorative === true ? '' : spec.altKey ? translate(spec.altKey) : ''}
              aria-hidden={spec.decorative === true || undefined}
              className="h-full w-full object-contain"
              onError={() => setFailed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))}
            />
          </figure>
        );
      })}
    </div>
  );
}
