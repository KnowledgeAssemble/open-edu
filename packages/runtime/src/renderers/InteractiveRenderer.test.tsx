import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import axe from 'axe-core';
import type { InteractiveNode } from '@open-edu/schemas';
import { InteractiveRenderer, shouldRefreshSnapshot } from './InteractiveRenderer';
import { RuntimeProvider } from '../context/RuntimeContext';
import type { LoadedPackage, LoadedNode } from '@open-edu/core';
import type { WorkflowEngine, WorkflowEvent } from '@open-edu/workflow';
import { I18nProvider } from '@open-edu/i18n';
import runtimeDict from '@open-edu/i18n/locales/en/runtime.json';

const NUMBER_LINE_SPEC = {
  type: 'visual',
  version: '1.0.0',
  id: 'number-line-test',
  purpose: {
    learningObjective: 'Identify the value 7 on a number line from 0 to 10',
    interactionGoal: 'Select the highlighted marker at position 7',
    reasoningMode: 'identify',
  },
  content: {
    kind: 'number-line',
    components: [
      {
        id: 'nl',
        type: 'number-line',
        props: { min: 0, max: 10, step: 1, highlight: [7] },
      },
    ],
  },
  accessibility: {
    label: 'Number line from zero to ten',
    description: 'A number line with 7 highlighted. Select the highlighted value.',
  },
  interaction: {
    mode: 'identify',
    actions: ['select', 'focus', 'reset'],
  },
};

function interactiveNode(): InteractiveNode {
  return {
    id: 'nl-node',
    title: 'Number line',
    type: 'interactive',
    engine: 'visual',
    spec: NUMBER_LINE_SPEC,
  };
}

const DIAGRAM_CYCLE_SPEC = {
  type: 'diagram',
  version: '1.0.0',
  id: 'simple-cycle-figure',
  metadata: { title: 'Two-stage water cycle' },
  purpose: { learningObjective: 'Understand a cyclical process' },
  content: {
    kind: 'cycle',
    nodes: [
      { id: 'a', label: 'Stage A', description: 'Water enters the cycle.' },
      { id: 'b', label: 'Stage B', description: 'Water leaves the cycle.' },
    ],
    edges: [
      { from: 'a', to: 'b', relationship: 'leads-to' },
      { from: 'b', to: 'a', relationship: 'leads-to' },
    ],
  },
  interaction: { mode: 'explore', actions: ['select', 'deselect', 'focus', 'reset'] },
  questions: [],
  sources: [{ class: 'illustrative' }],
  accessibility: { label: 'Simple cycle between Stage A and Stage B' },
} as const;

function diagramNode(): InteractiveNode {
  return {
    id: 'diagram-cycle',
    title: 'Two-stage water cycle',
    type: 'interactive',
    engine: 'diagram',
    spec: DIAGRAM_CYCLE_SPEC,
  };
}

function diagramFigureNode(): InteractiveNode {
  return {
    ...diagramNode(),
    figures: {
      a: { ref: 'assets/water-cycle.svg', altKey: 'interactive.figure.demo.waterCycle' },
    },
  };
}

const GEOMAP_SPEC = {
  type: 'geomap',
  version: '1.0.0',
  id: 'geomap-data-asset',
  metadata: { title: 'Data asset geomap' },
  purpose: { learningObjective: 'Locate a feature', reasoningMode: 'identify' },
  content: {
    viewport: { fit: 'content', padding: 0.08 },
    projection: { type: 'equirectangular' },
    geography: {
      sources: [
        { id: 'states', type: 'geojson', class: 'authoritative', uri: 'assets/data.geojson' },
      ],
    },
    entities: [
      {
        id: 'odisha',
        type: 'state',
        name: 'Odisha',
        location: { source: 'states', featureId: 'IN-OD' },
      },
    ],
    layers: [
      {
        id: 'states-layer',
        type: 'region',
        items: [{ entity: 'odisha', interactive: true, label: true }],
      },
    ],
  },
  interaction: { mode: 'identify', actions: ['select', 'focus', 'deselect', 'reset'] },
  questions: [],
  sources: [{ class: 'authoritative' }],
  accessibility: { label: 'Map with one state', description: 'Select the state.' },
} as const;

function geomapNode(): InteractiveNode {
  return {
    id: 'geomap-node',
    title: 'Locate Odisha',
    type: 'interactive',
    engine: 'geomap',
    spec: GEOMAP_SPEC,
  };
}

function makeLoadedNode(relativePath: string, node: LoadedNode['node'], content = ''): LoadedNode {
  return {
    path: `/tmp/${relativePath}`,
    relativePath,
    content,
    node,
  };
}

function makePackage(
  nodes: Array<{ relativePath: string; node: LoadedNode['node'] }>,
  assetMap?: Map<string, ArrayBuffer>,
): LoadedPackage {
  return {
    rootDir: '/tmp/test',
    manifest: {
      id: 'test',
      title: 'Test',
      version: '1.0.0',
      author: 'A',
      entry: 'nodes/nl-01.md',
    },
    workflow: { routing: {} },
    rewards: null,
    cards: null,
    nodes: nodes.map((n) => makeLoadedNode(n.relativePath, n.node)),
    assetPaths: assetMap ? Array.from(assetMap.keys()) : [],
    assetMap,
  };
}

interface StubEngine {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  completeNode: ReturnType<typeof vi.fn>;
  navigateTo: ReturnType<typeof vi.fn>;
  __listener: ((e: WorkflowEvent) => void) | null;
}

function makeEngine(initialNodeId: string): StubEngine & WorkflowEngine {
  const stub = {
    start: vi.fn(() => {
      queueMicrotask(() =>
        stub.__listener?.({ type: 'node.entered', nodeId: initialNodeId, timestamp: 1 }),
      );
    }),
    stop: vi.fn(),
    subscribe: vi.fn((listener: (e: WorkflowEvent) => void) => {
      stub.__listener = listener;
      return () => {
        stub.__listener = null;
      };
    }),
    completeNode: vi.fn(),
    navigateTo: vi.fn(),
    __listener: null as ((e: WorkflowEvent) => void) | null,
  };
  return stub as unknown as StubEngine & WorkflowEngine;
}

function renderWithProvider(
  ui: ReactNode,
  initialNodeId: string,
  engine = makeEngine(initialNodeId),
) {
  const pkg = makePackage([{ relativePath: initialNodeId, node: interactiveNode() }]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider locale="en" dictionaries={{ en: { runtime: runtimeDict } }}>
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    </I18nProvider>
  );
  const utils = render(ui, { wrapper });
  return { ...utils, engine };
}

function renderInteractiveNode(
  node: InteractiveNode,
  relativePath: string,
  opts: {
    assetMap?: Map<string, ArrayBuffer>;
    onTelemetryEvent?: (event: unknown) => void;
  } = {},
) {
  const pkg = makePackage([{ relativePath, node }], opts.assetMap);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider locale="en" dictionaries={{ en: { runtime: runtimeDict } }}>
      <RuntimeProvider
        loadedPackage={pkg}
        engine={makeEngine(relativePath)}
        onTelemetryEvent={opts.onTelemetryEvent}
      >
        {children}
      </RuntimeProvider>
    </I18nProvider>
  );
  return render(<InteractiveRenderer node={node} nodeId={relativePath} />, { wrapper });
}

function stubBlobUrl() {
  vi.stubGlobal('URL', {
    ...globalThis.URL,
    createObjectURL: vi.fn(() => `blob:mock/${Math.random().toString(36).slice(2)}`),
    revokeObjectURL: vi.fn(),
  });
}

async function runAxe(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
  return results.violations;
}

describe('InteractiveRenderer', () => {
  it('renders node title as the activity prompt heading', async () => {
    const { getByRole } = renderWithProvider(
      <InteractiveRenderer node={interactiveNode()} nodeId="nodes/nl-01.md" />,
      'nodes/nl-01.md',
    );
    expect(getByRole('heading', { name: 'Number line' })).toBeInTheDocument();
  });

  it('mounts a single-engine interactive node', async () => {
    const { getByTestId } = renderWithProvider(
      <InteractiveRenderer node={interactiveNode()} nodeId="nodes/nl-01.md" />,
      'nodes/nl-01.md',
    );
    expect(getByTestId('interactive-renderer')).toBeInTheDocument();
  });

  it('renders prompt when node has a prompt field', async () => {
    const nodeWithPrompt: InteractiveNode = {
      ...interactiveNode(),
      prompt: 'Click the highlighted marker on the line.',
    };
    const { findByText } = renderWithProvider(
      <InteractiveRenderer node={nodeWithPrompt} nodeId="nodes/nl-01.md" />,
      'nodes/nl-01.md',
    );
    expect(await findByText('Click the highlighted marker on the line.')).toBeInTheDocument();
  });

  it('increments internal interaction count on SVG click and passes it on Mark complete', async () => {
    const { container, findByRole, getByRole, engine } = renderWithProvider(
      <InteractiveRenderer node={interactiveNode()} nodeId="nodes/nl-01.md" />,
      'nodes/nl-01.md',
    );
    await findByRole('heading', { name: 'Number line' });
    await waitFor(() => expect(getByRole('button', { name: 'Mark complete' })).not.toBeDisabled());
    const target = container.querySelector('#nl-label-7');
    expect(target).toBeTruthy();
    fireEvent.click(target!);
    fireEvent.click(getByRole('button', { name: 'Mark complete' }));
    expect(engine.completeNode).toHaveBeenCalledWith(undefined);
  });

  it('calls onComplete when reaching the mark complete button', async () => {
    const onComplete = vi.fn();
    const { getByRole } = renderWithProvider(
      <InteractiveRenderer
        node={interactiveNode()}
        nodeId="nodes/nl-01.md"
        onComplete={onComplete}
      />,
      'nodes/nl-01.md',
    );
    fireEvent.click(getByRole('button', { name: 'Mark complete' }));
    expect(onComplete).toHaveBeenCalledWith(undefined);
  });

  it('falls back to the runtime completeNode when no callback is supplied', async () => {
    const { getByRole, engine } = renderWithProvider(
      <InteractiveRenderer node={interactiveNode()} nodeId="nodes/nl-01.md" />,
      'nodes/nl-01.md',
    );
    fireEvent.click(getByRole('button', { name: 'Mark complete' }));
    expect(engine.completeNode).toHaveBeenCalledWith(undefined);
  });

  it('passes axe-core accessibility audits', async () => {
    const { container } = renderWithProvider(
      <InteractiveRenderer node={interactiveNode()} nodeId="nodes/nl-01.md" />,
      'nodes/nl-01.md',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('mounts a composed interactive lesson', async () => {
    const composedNode: InteractiveNode = {
      type: 'interactive',
      id: 'independence-narrative-demo',
      title: 'Timeline drives visual focus',
      engines: [
        {
          instanceId: 'timeline-independence',
          engine: 'timeline',
          spec: {
            type: 'timeline',
            version: '1.0.0',
            id: 'timeline-independence',
            metadata: { title: 'Timeline' },
            purpose: { learningObjective: 'Explore events', reasoningMode: 'sequence' },
            content: {
              kind: 'events',
              events: [{ id: 'event-1947', label: 'Independence', date: '1947-08-15' }],
            },
            interaction: { mode: 'explore', actions: ['select'] },
            accessibility: { label: 'Timeline' },
          },
        },
        {
          instanceId: 'visual-independence',
          engine: 'visual',
          spec: {
            type: 'visual',
            version: '1.0.0',
            id: 'visual-independence',
            content: {
              kind: 'illustration',
              entities: [{ id: 'figure-independence', label: 'Independence' }],
            },
            interaction: { mode: 'explore', actions: ['focus', 'reset'] },
            accessibility: { label: 'Illustration' },
          },
        },
      ],
      bindings: [
        {
          on: 'timeline.event-selected',
          from: 'timeline-independence',
          dispatch: {
            to: 'visual-independence',
            action: 'focus',
            targetIdFrom: 'links.visualEntityId',
          },
        },
      ],
    };
    const pkg = makePackage([{ relativePath: 'nodes/composed.json', node: composedNode }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nProvider locale="en" dictionaries={{ en: { runtime: runtimeDict } }}>
        <RuntimeProvider loadedPackage={pkg} engine={makeEngine('nodes/composed.json')}>
          {children}
        </RuntimeProvider>
      </I18nProvider>
    );
    const { getByTestId, queryByTestId } = render(
      <InteractiveRenderer node={composedNode} nodeId="nodes/composed.json" />,
      { wrapper },
    );
    expect(getByTestId('interactive-renderer')).toBeInTheDocument();
    expect(queryByTestId('interactive-alternative')).not.toBeInTheDocument();
  });

  describe('shouldRefreshSnapshot', () => {
    it('refreshes on engine-ready', () => {
      expect(shouldRefreshSnapshot('engine-ready')).toBe(true);
    });

    it('refreshes on any name ending in state-changed', () => {
      expect(shouldRefreshSnapshot('state-changed')).toBe(true);
      expect(shouldRefreshSnapshot('timeline.state-changed')).toBe(true);
    });

    it('does not refresh on interaction or mount events', () => {
      expect(shouldRefreshSnapshot('interaction-started')).toBe(false);
      expect(shouldRefreshSnapshot('interaction-completed')).toBe(false);
      expect(shouldRefreshSnapshot('engine-mounted')).toBe(false);
      expect(shouldRefreshSnapshot('')).toBe(false);
    });
  });

  it('renders the alternative list with cycles and descriptions for a diagram node', async () => {
    const pkg = makePackage([{ relativePath: 'nodes/diagram.json', node: diagramNode() }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nProvider locale="en" dictionaries={{ en: { runtime: runtimeDict } }}>
        <RuntimeProvider loadedPackage={pkg} engine={makeEngine('nodes/diagram.json')}>
          {children}
        </RuntimeProvider>
      </I18nProvider>
    );
    const { findByTestId } = render(
      <InteractiveRenderer node={diagramNode()} nodeId="nodes/diagram.json" />,
      { wrapper },
    );
    const region = await findByTestId('interactive-alternative');
    expect(within(region).getByText(/Cycle: /)).toBeInTheDocument();
    expect(within(region).getByText('Water enters the cycle.')).toBeInTheDocument();
    expect(within(region).getByText('Water leaves the cycle.')).toBeInTheDocument();
  });

  it('does not duplicate the engine node label inside the alternative region', async () => {
    const pkg = makePackage([{ relativePath: 'nodes/diagram.json', node: diagramNode() }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nProvider locale="en" dictionaries={{ en: { runtime: runtimeDict } }}>
        <RuntimeProvider loadedPackage={pkg} engine={makeEngine('nodes/diagram.json')}>
          {children}
        </RuntimeProvider>
      </I18nProvider>
    );
    const { container, findByTestId } = render(
      <InteractiveRenderer node={diagramNode()} nodeId="nodes/diagram.json" />,
      { wrapper },
    );
    const region = await findByTestId('interactive-alternative');
    expect(within(region).queryByText('Stage A')).not.toBeInTheDocument();
    expect(container.textContent).toContain('Stage A');
  });

  it('renders no alternative list for a visual engine node', async () => {
    const { queryByTestId, getByRole } = renderWithProvider(
      <InteractiveRenderer node={interactiveNode()} nodeId="nodes/nl-01.md" />,
      'nodes/nl-01.md',
    );
    await waitFor(() => expect(getByRole('button', { name: 'Mark complete' })).not.toBeDisabled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryByTestId('interactive-alternative')).not.toBeInTheDocument();
  });

  it('mounts a geomap node whose source uri points at a package-relative geojson', async () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'IN-OD',
          properties: { name: 'Odisha' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [83, 18],
                [87, 18],
                [87, 22],
                [83, 22],
                [83, 18],
              ],
            ],
          },
        },
      ],
    });
    const assetMap = new Map<string, ArrayBuffer>([
      ['data.geojson', new TextEncoder().encode(geojson).buffer],
    ]);
    const pkg = makePackage([{ relativePath: 'nodes/geomap.json', node: geomapNode() }], assetMap);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nProvider locale="en" dictionaries={{ en: { runtime: runtimeDict } }}>
        <RuntimeProvider loadedPackage={pkg} engine={makeEngine('nodes/geomap.json')}>
          {children}
        </RuntimeProvider>
      </I18nProvider>
    );
    const { container, queryByRole, getByRole } = render(
      <InteractiveRenderer node={geomapNode()} nodeId="nodes/geomap.json" />,
      { wrapper },
    );
    await waitFor(() => expect(getByRole('button', { name: 'Mark complete' })).not.toBeDisabled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryByRole('alert')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the figure overlay beside a diagram node with a resolvable asset', async () => {
    stubBlobUrl();
    const assetMap = new Map<string, ArrayBuffer>([
      ['water-cycle.svg', new TextEncoder().encode('<svg/>').buffer],
    ]);
    const { container, findByTestId } = renderInteractiveNode(
      diagramFigureNode(),
      'nodes/diagram.json',
      { assetMap },
    );
    const overlay = await findByTestId('figure-overlay');
    const img = overlay.querySelector('img')!;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('alt')).toBe('runtime.interactive.figure.demo.waterCycle');
    expect(container.querySelector('[data-testid="interactive-alternative"]')).toBeInTheDocument();
  });

  it('emits zero engine events when a figure is clicked', async () => {
    stubBlobUrl();
    const onTelemetryEvent = vi.fn();
    const assetMap = new Map<string, ArrayBuffer>([
      ['water-cycle.svg', new TextEncoder().encode('<svg/>').buffer],
    ]);
    const { findByTestId } = renderInteractiveNode(diagramFigureNode(), 'nodes/diagram.json', {
      assetMap,
      onTelemetryEvent,
    });
    const overlay = await findByTestId('figure-overlay');
    const img = overlay.querySelector('img')!;
    const before = onTelemetryEvent.mock.calls.length;
    fireEvent.click(img);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onTelemetryEvent.mock.calls.length).toBe(before);
  });

  it('degrades an unresolvable figure ref to the caption with no img', async () => {
    const { findByTestId, container } = renderInteractiveNode(
      diagramFigureNode(),
      'nodes/diagram.json',
    );
    const overlay = await findByTestId('figure-overlay');
    const img = overlay.querySelector('img')!;
    fireEvent.error(img);
    const caption = await findByTestId('figure-caption');
    expect(caption.textContent).toBe('runtime.interactive.figure.demo.waterCycle');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders no figure overlay for a composed lesson', async () => {
    const composedNode: InteractiveNode = {
      type: 'interactive',
      id: 'independence-narrative-demo',
      title: 'Timeline drives visual focus',
      engines: [
        {
          instanceId: 'timeline-independence',
          engine: 'timeline',
          spec: {
            type: 'timeline',
            version: '1.0.0',
            id: 'timeline-independence',
            metadata: { title: 'Timeline' },
            purpose: { learningObjective: 'Explore events', reasoningMode: 'sequence' },
            content: {
              kind: 'events',
              events: [{ id: 'event-1947', label: 'Independence', date: '1947-08-15' }],
            },
            interaction: { mode: 'explore', actions: ['select'] },
            accessibility: { label: 'Timeline' },
          },
        },
        {
          instanceId: 'visual-independence',
          engine: 'visual',
          spec: {
            type: 'visual',
            version: '1.0.0',
            id: 'visual-independence',
            content: {
              kind: 'illustration',
              entities: [{ id: 'figure-independence', label: 'Independence' }],
            },
            interaction: { mode: 'explore', actions: ['focus', 'reset'] },
            accessibility: { label: 'Illustration' },
          },
        },
      ],
      bindings: [],
      figures: {
        'event-1947': { ref: 'assets/timeline.svg', altKey: 'interactive.figure.demo.waterCycle' },
      },
    };
    const { queryByTestId } = renderInteractiveNode(composedNode, 'nodes/composed.json');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryByTestId('figure-overlay')).not.toBeInTheDocument();
  });

  afterEach(() => {
    cleanup();
  });
});
