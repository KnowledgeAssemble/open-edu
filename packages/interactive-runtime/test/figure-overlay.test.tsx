import { describe, it, expect } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import axe from 'axe-core';
import { FigureOverlay, collectFigurePlacements, authoredIdOf } from '../src/figure-overlay';
import type { SceneNodeLike } from '../src/figure-overlay';

describe('authoredIdOf', () => {
  it('reads metadata.nodeId for diagram nodes', () => {
    expect(authoredIdOf({ id: 'n1', metadata: { nodeId: 'a' } })).toBe('a');
  });

  it('reads metadata.entityId for geomap nodes', () => {
    expect(authoredIdOf({ id: 'n1', metadata: { entityId: 'odisha' } })).toBe('odisha');
  });

  it('reads metadata.rowId for chart nodes', () => {
    expect(authoredIdOf({ id: 'n1', metadata: { rowId: 'r1' } })).toBe('r1');
  });

  it('uses node.id for timeline event-markers', () => {
    expect(authoredIdOf({ id: 'event-1947', kind: 'event-marker' })).toBe('event-1947');
  });

  it('returns undefined for timeline event spans', () => {
    expect(authoredIdOf({ id: 'e1-span', kind: 'event-span' })).toBeUndefined();
  });

  it('returns undefined without metadata', () => {
    expect(authoredIdOf({ id: 'n1' })).toBeUndefined();
  });
});

describe('collectFigurePlacements', () => {
  const figures: Record<string, { ref: string; altKey?: string; decorative?: boolean }> = {
    a: { ref: 'a.svg', altKey: 'k' },
    r1: { ref: 'chart.svg', altKey: 'k' },
    orphan: { ref: 'm.svg', altKey: 'k' },
  };

  it('computes percentage positions from scene bounds and canvas', () => {
    const nodes: SceneNodeLike[] = [
      {
        id: 'n1',
        metadata: { nodeId: 'a' },
        bounds: { x: 610, y: 100, width: 50, height: 60 },
      },
    ];
    const placements = collectFigurePlacements(nodes, figures, { width: 760, height: 400 });
    expect(placements).toHaveLength(1);
    expect(placements[0].left).toBeCloseTo(80.26, 2);
    expect(placements[0].top).toBe(25);
    expect(placements[0].width).toBeCloseTo(6.58, 2);
    expect(placements[0].height).toBe(15);
  });

  it('places at most one figure per key across matching nodes', () => {
    const nodes: SceneNodeLike[] = [
      {
        id: 'm1',
        metadata: { rowId: 'r1' },
        bounds: { x: 10, y: 10, width: 20, height: 20 },
      },
      {
        id: 'm2',
        metadata: { rowId: 'r1' },
        bounds: { x: 100, y: 100, width: 20, height: 20 },
      },
    ];
    const placements = collectFigurePlacements(nodes, figures, { width: 760, height: 400 });
    expect(placements).toHaveLength(1);
    expect(placements[0].key).toBe('r1');
    expect(placements[0].left).toBeCloseTo((10 / 760) * 100, 5);
  });

  it('skips nodes without bounds', () => {
    const nodes: SceneNodeLike[] = [{ id: 'n1', metadata: { nodeId: 'a' } }];
    expect(collectFigurePlacements(nodes, figures, { width: 760, height: 400 })).toEqual([]);
  });

  it('skips hidden scene nodes', () => {
    const nodes: SceneNodeLike[] = [
      {
        id: 'n1',
        metadata: { nodeId: 'a' },
        hidden: true,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
      },
    ];
    expect(collectFigurePlacements(nodes, figures, { width: 760, height: 400 })).toEqual([]);
  });

  it('skips figure keys that match no scene node', () => {
    const nodes: SceneNodeLike[] = [
      { id: 'n1', metadata: { nodeId: 'a' }, bounds: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const placements = collectFigurePlacements(nodes, figures, { width: 760, height: 400 });
    expect(placements.map((p) => p.key)).toEqual(['a']);
  });

  it('walks nested children depth-first', () => {
    const nodes: SceneNodeLike[] = [
      {
        id: 'root',
        children: [
          { id: 'n1', metadata: { nodeId: 'a' }, bounds: { x: 0, y: 0, width: 10, height: 10 } },
          {
            id: 'group',
            children: [
              {
                id: 'n2',
                metadata: { nodeId: 'r1' },
                bounds: { x: 0, y: 0, width: 10, height: 10 },
              },
            ],
          },
        ],
      },
    ];
    const placements = collectFigurePlacements(nodes, figures, { width: 760, height: 400 });
    expect(placements.map((p) => p.key)).toEqual(['a', 'r1']);
  });
});

interface HostProps {
  viewBox?: string | null;
  figures: Record<string, { ref: string; altKey?: string; decorative?: boolean }>;
  nodes: SceneNodeLike[];
  children?: ReactNode;
}

function Host({ viewBox, figures, nodes, children }: HostProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <svg viewBox={viewBox ?? undefined} />
      <FigureOverlay
        figures={figures}
        snapshotNodes={nodes}
        surfaceRef={ref}
        resolve={(r) => `resolved:${r}`}
        translate={(k) => `t:${k}`}
      />
      {children}
    </div>
  );
}

const NODE = {
  id: 'n1',
  metadata: { nodeId: 'a' },
  bounds: { x: 0, y: 0, width: 100, height: 100 },
};

describe('FigureOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a figure image with the resolved src and alt text', async () => {
    const { findByTestId } = render(
      <Host
        viewBox="0 0 760 400"
        figures={{ a: { ref: 'water-cycle.svg', altKey: 'interactive.figure.demo.waterCycle' } }}
        nodes={[NODE]}
      />,
    );
    const overlay = await findByTestId('figure-overlay');
    const img = overlay.querySelector('img')!;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('resolved:water-cycle.svg');
    expect(img.getAttribute('alt')).toBe('t:interactive.figure.demo.waterCycle');
  });

  it('marks a decorative figure aria-hidden with an empty alt', async () => {
    const { findByTestId } = render(
      <Host
        viewBox="0 0 760 400"
        figures={{ a: { ref: 'd.svg', decorative: true } }}
        nodes={[NODE]}
      />,
    );
    const overlay = await findByTestId('figure-overlay');
    const img = overlay.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders nothing for an absent or invalid viewBox', () => {
    const { queryByTestId } = render(
      <Host viewBox={null} figures={{ a: { ref: 'a.svg', altKey: 'k' } }} nodes={[NODE]} />,
    );
    expect(queryByTestId('figure-overlay')).not.toBeInTheDocument();
  });

  it('degrades a meaningful figure to the caption span on load error', async () => {
    const { findByTestId, container } = render(
      <Host
        viewBox="0 0 760 400"
        figures={{ a: { ref: 'a.svg', altKey: 'interactive.figure.demo.waterCycle' } }}
        nodes={[NODE]}
      />,
    );
    const overlay = await findByTestId('figure-overlay');
    const img = overlay.querySelector('img')!;
    fireEvent.error(img);
    const caption = await findByTestId('figure-caption');
    expect(caption.textContent).toBe('t:interactive.figure.demo.waterCycle');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('renders nothing for a decorative figure that fails to load', async () => {
    const { findByTestId, container } = render(
      <Host
        viewBox="0 0 760 400"
        figures={{ a: { ref: 'd.svg', decorative: true } }}
        nodes={[NODE]}
      />,
    );
    const overlay = await findByTestId('figure-overlay');
    const img = overlay.querySelector('img')!;
    fireEvent.error(img);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="figure-caption"]')).toBeNull();
  });

  it('passes axe-core accessibility audits', async () => {
    const { container } = render(
      <Host
        viewBox="0 0 760 400"
        figures={{
          a: { ref: 'meaningful.svg', altKey: 'interactive.figure.demo.waterCycle' },
          b: { ref: 'decorative.svg', decorative: true },
        }}
        nodes={[
          { ...NODE, metadata: { nodeId: 'a' } },
          {
            id: 'n2',
            metadata: { nodeId: 'b' },
            bounds: { x: 200, y: 0, width: 100, height: 100 },
          },
        ]}
      />,
    );
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
