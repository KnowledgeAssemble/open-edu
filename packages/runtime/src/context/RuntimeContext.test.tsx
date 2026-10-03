import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { RuntimeProvider, useRuntime } from './RuntimeContext';
import type { LoadedPackage } from '@open-edu/core';
import type { WorkflowEngine, WorkflowEvent } from '@open-edu/workflow';
import type { ReactNode } from 'react';
import type { ProgressSnapshot } from '@open-edu/schemas';

function makePackage(
  nodes: Array<{ relativePath: string; type: string; content: string }>,
): LoadedPackage {
  return {
    rootDir: '/tmp/test',
    manifest: {
      id: 'test',
      title: 'Test',
      version: '1.0.0',
      author: 'A',
      entry: 'nodes/lesson-01.md',
    },
    workflow: { routing: {} },
    rewards: null,
    cards: null,
    nodes: nodes.map((n) => ({
      path: `/tmp/${n.relativePath}`,
      relativePath: n.relativePath,
      content: n.content,
      node: { type: n.type, skills: undefined } as never,
    })),
    assetPaths: [],
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

function makeEngine(): StubEngine & WorkflowEngine {
  const stub = {
    start: vi.fn(),
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

function emit(engine: StubEngine, event: WorkflowEvent) {
  engine.__listener?.(event);
}

describe('RuntimeProvider', () => {
  let engine: StubEngine & WorkflowEngine;
  let pkg: LoadedPackage;

  beforeEach(() => {
    pkg = makePackage([
      { relativePath: 'nodes/lesson-01.md', type: 'lesson', content: '# Hello' },
      { relativePath: 'nodes/lesson-02.md', type: 'lesson', content: '# World' },
    ]);
    engine = makeEngine();
  });

  it('starts the engine on mount and does not stop on unmount', () => {
    const { unmount } = render(
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        <span>child</span>
      </RuntimeProvider>,
    );
    expect(engine.start).toHaveBeenCalledTimes(1);
    unmount();
    expect(engine.stop).not.toHaveBeenCalled();
  });

  it('subscribes to workflow events and unsubscribes on unmount', () => {
    const { unmount } = render(
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        <span>child</span>
      </RuntimeProvider>,
    );
    expect(engine.subscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(engine.__listener).toBeNull();
  });

  it('updates currentNodeId on node.entered event', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result, rerender } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      emit(engine, { type: 'node.entered', nodeId: 'nodes/lesson-01.md', timestamp: 1 });
    });
    rerender();
    expect(result.current.currentNodeId).toBe('nodes/lesson-01.md');
    expect(result.current.currentNode?.relativePath).toBe('nodes/lesson-01.md');
  });

  it('records scores on node.completed event', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      emit(engine, { type: 'node.entered', nodeId: 'nodes/quiz-01.md', timestamp: 1 });
    });
    act(() => {
      emit(engine, {
        type: 'node.completed',
        nodeId: 'nodes/quiz-01.md',
        score: 100,
        timestamp: 2,
      });
    });
    expect(result.current.scores['nodes/quiz-01.md']).toBe(100);
    expect(result.current.lastScore).toBe(100);
  });

  it('sets isCompleted on workflow.completed event', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      emit(engine, { type: 'workflow.completed', timestamp: 3 });
    });
    expect(result.current.isCompleted).toBe(true);
  });

  it('tracks visited nodes in order without duplicates', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      emit(engine, { type: 'node.entered', nodeId: 'nodes/lesson-01.md', timestamp: 1 });
    });
    act(() => {
      emit(engine, { type: 'node.entered', nodeId: 'nodes/lesson-02.md', timestamp: 2 });
    });
    expect(result.current.visitedNodes).toEqual(['nodes/lesson-01.md', 'nodes/lesson-02.md']);
  });

  it('completeNode delegates to the engine', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      result.current.completeNode(75);
    });
    expect(engine.completeNode).toHaveBeenCalledWith(75);
  });

  it('getNode returns a loaded node by relativePath', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    expect(result.current.getNode('nodes/lesson-02.md')?.content).toBe('# World');
    expect(result.current.getNode('missing.md')).toBeUndefined();
  });

  it('throws when useRuntime is used outside RuntimeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useRuntime())).toThrow(/RuntimeProvider/);
    spy.mockRestore();
  });

  it('initializes state from valid initialProgress', () => {
    const initialProgress: ProgressSnapshot = {
      packageId: 'test',
      packageVersion: '1.0.0',
      currentNodeId: 'nodes/lesson-02.md',
      visitedNodes: ['nodes/lesson-01.md', 'nodes/lesson-02.md'],
      scores: { 'nodes/lesson-01.md': 80 },
      answers: {},
      isCompleted: false,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine} initialProgress={initialProgress}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    expect(result.current.currentNodeId).toBe('nodes/lesson-02.md');
    expect(result.current.visitedNodes).toEqual(['nodes/lesson-01.md', 'nodes/lesson-02.md']);
    expect(result.current.scores).toEqual({ 'nodes/lesson-01.md': 80 });
    expect(result.current.isCompleted).toBe(false);
  });

  it('initializes completed state from valid initialProgress', () => {
    const initialProgress: ProgressSnapshot = {
      packageId: 'test',
      packageVersion: '1.0.0',
      currentNodeId: 'nodes/lesson-02.md',
      visitedNodes: ['nodes/lesson-01.md', 'nodes/lesson-02.md'],
      scores: { 'nodes/lesson-01.md': 80 },
      answers: {},
      isCompleted: true,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine} initialProgress={initialProgress}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    expect(result.current.isCompleted).toBe(true);
  });

  it('ignores invalid initialProgress and starts fresh', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const initialProgress: ProgressSnapshot = {
      packageId: 'test',
      packageVersion: '1.0.0',
      currentNodeId: 'nonexistent-node',
      visitedNodes: ['nonexistent-node'],
      scores: {},
      answers: {},
      isCompleted: false,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine} initialProgress={initialProgress}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    expect(result.current.currentNodeId).toBe('nodes/lesson-01.md');
    expect(result.current.visitedNodes).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('calls onProgressChange when node is entered', () => {
    const onProgressChange = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine} onProgressChange={onProgressChange}>
        {children}
      </RuntimeProvider>
    );
    renderHook(() => useRuntime(), { wrapper });
    act(() => {
      emit(engine, { type: 'node.entered', nodeId: 'nodes/lesson-01.md', timestamp: 1 });
    });
    expect(onProgressChange).toHaveBeenCalledWith(
      expect.objectContaining({ currentNodeId: 'nodes/lesson-01.md' }),
    );
  });

  it('does not call onProgressChange if not provided', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    expect(() => {
      renderHook(() => useRuntime(), { wrapper });
    }).not.toThrow();
  });

  it('does not re-call onProgressChange when only the callback identity changes', () => {
    let tick = 0;
    const toISOStringSpy = vi.spyOn(Date.prototype, 'toISOString').mockImplementation(function (
      this: Date,
    ) {
      tick += 1;
      return `2024-01-01T00:00:00.${String(tick).padStart(3, '0')}Z`;
    });
    try {
      const calls: ProgressSnapshot[] = [];
      let onProgressChange: (snapshot: ProgressSnapshot) => void = () => {};
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={pkg} engine={engine} onProgressChange={onProgressChange}>
          {children}
        </RuntimeProvider>
      );
      const first = vi.fn((s: ProgressSnapshot) => calls.push(s));
      onProgressChange = first;
      const { rerender } = renderHook(() => useRuntime(), { wrapper });
      act(() => {
        emit(engine, { type: 'node.entered', nodeId: 'nodes/lesson-01.md', timestamp: 1 });
      });
      const countAfterEnter = calls.length;
      for (let i = 0; i < 5; i++) {
        const cb = vi.fn((s: ProgressSnapshot) => calls.push(s));
        onProgressChange = cb;
        rerender();
        expect(cb).not.toHaveBeenCalled();
      }
      expect(calls.length).toBe(countAfterEnter);
    } finally {
      toISOStringSpy.mockRestore();
    }
  });

  it('exposes progressSnapshot in context value', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    expect(result.current.progressSnapshot).toBeDefined();
    expect(result.current.progressSnapshot?.packageId).toBe('test');
  });

  it('saveAnswer stores an answer by nodeId', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      result.current.saveAnswer('nodes/quiz-01.md', {
        type: 'quiz',
        selectedOptionId: 'b',
        score: 100,
      });
    });
    expect(result.current.answers['nodes/quiz-01.md']).toEqual({
      type: 'quiz',
      selectedOptionId: 'b',
      score: 100,
    });
  });

  it('saveAnswer overwrites previous answer for same nodeId', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      result.current.saveAnswer('nodes/quiz-01.md', {
        type: 'quiz',
        selectedOptionId: 'b',
        score: 100,
      });
    });
    act(() => {
      result.current.saveAnswer('nodes/quiz-01.md', {
        type: 'quiz',
        selectedOptionId: 'a',
        score: 0,
      });
    });
    expect(result.current.answers['nodes/quiz-01.md']).toEqual({
      type: 'quiz',
      selectedOptionId: 'a',
      score: 0,
    });
  });

  it('saveAnswer stores answers for multiple nodes', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      result.current.saveAnswer('nodes/quiz-01.md', {
        type: 'quiz',
        selectedOptionId: 'b',
        score: 100,
      });
    });
    act(() => {
      result.current.saveAnswer('nodes/quiz-02.md', {
        type: 'quiz',
        selectedOptionId: 'c',
        score: 0,
      });
    });
    expect(Object.keys(result.current.answers).length).toBe(2);
  });

  it('restores answers from initialProgress', () => {
    const initialProgress: ProgressSnapshot = {
      packageId: 'test',
      packageVersion: '1.0.0',
      currentNodeId: 'nodes/lesson-01.md',
      visitedNodes: ['nodes/quiz-01.md', 'nodes/lesson-01.md'],
      scores: { 'nodes/quiz-01.md': 100 },
      answers: {
        'nodes/quiz-01.md': { type: 'quiz', selectedOptionId: 'b', score: 100 },
      },
      isCompleted: false,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine} initialProgress={initialProgress}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    expect(result.current.answers['nodes/quiz-01.md']).toEqual({
      type: 'quiz',
      selectedOptionId: 'b',
      score: 100,
    });
  });

  it('includes answers in progressSnapshot', () => {
    const onProgressChange = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeProvider loadedPackage={pkg} engine={engine} onProgressChange={onProgressChange}>
        {children}
      </RuntimeProvider>
    );
    const { result } = renderHook(() => useRuntime(), { wrapper });
    act(() => {
      result.current.saveAnswer('nodes/quiz-01.md', {
        type: 'quiz',
        selectedOptionId: 'b',
        score: 100,
      });
    });
    expect(result.current.progressSnapshot?.answers).toEqual({
      'nodes/quiz-01.md': { type: 'quiz', selectedOptionId: 'b', score: 100 },
    });
  });

  it('emitTelemetry forwards to onTelemetryEvent with a timestamp', () => {
    const onTelemetryEvent = vi.fn();
    const { result } = renderHook(() => useRuntime(), {
      wrapper: ({ children }) => (
        <RuntimeProvider loadedPackage={pkg} engine={engine} onTelemetryEvent={onTelemetryEvent}>
          {children}
        </RuntimeProvider>
      ),
    });
    result.current.emitTelemetry?.({
      event: 'widget_interaction',
      widgetId: 'core.matching',
      action: 'reveal',
    });
    expect(onTelemetryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'widget_interaction',
        widgetId: 'core.matching',
        action: 'reveal',
        timestamp: expect.any(Number),
      }),
    );
  });

  describe('resolveAsset', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const svgText = '<svg></svg>';

    let createObjectURLSpy: ReturnType<typeof vi.fn<any[], string>>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createObjectURLSpy = vi.fn(() => `blob:mock/${Math.random().toString(36).slice(2)}`);
      revokeObjectURLSpy = vi.fn();
      vi.stubGlobal('URL', {
        ...globalThis.URL,
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function makePackageWithAssets(
      assets: Array<{ path: string; data: ArrayBuffer }>,
    ): LoadedPackage {
      const assetMap = new Map<string, ArrayBuffer>();
      for (const a of assets) {
        assetMap.set(a.path, a.data);
      }
      return {
        rootDir: '/tmp/test',
        manifest: {
          id: 'test-asset',
          title: 'Test Asset',
          version: '1.0.0',
          author: 'A',
          entry: 'nodes/lesson-01.md',
        },
        workflow: { routing: {} },
        rewards: null,
        cards: null,
        nodes: [
          {
            path: '/tmp/nodes/lesson-01.md',
            relativePath: 'nodes/lesson-01.md',
            content: '# Hello',
            node: { type: 'lesson', skills: undefined } as never,
          },
        ],
        assetPaths: assets.map((a) => a.path),
        assetMap,
      };
    }

    it('returns a blob URL for an asset in the map', () => {
      const assetPkg = makePackageWithAssets([
        { path: 'images/photo.png', data: pngBytes.buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      const url = result.current.resolveAsset('images/photo.png');
      expect(url).toMatch(/^blob:/);
    });

    it('uses correct MIME type based on extension', () => {
      const assetPkg = makePackageWithAssets([
        { path: 'images/photo.png', data: pngBytes.buffer as ArrayBuffer },
        { path: 'images/cover.jpg', data: jpgBytes.buffer as ArrayBuffer },
        { path: 'icons/logo.svg', data: new TextEncoder().encode(svgText).buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      result.current.resolveAsset('images/photo.png');
      result.current.resolveAsset('images/cover.jpg');
      result.current.resolveAsset('icons/logo.svg');
      expect(createObjectURLSpy).toHaveBeenCalledTimes(3);
      const types = createObjectURLSpy.mock.calls.map((call: unknown[]) => (call[0] as Blob).type);
      expect(types).toEqual(['image/png', 'image/jpeg', 'image/svg+xml']);
    });

    it('returns the same cached URL on repeated calls for same path', () => {
      const assetPkg = makePackageWithAssets([
        { path: 'images/photo.png', data: pngBytes.buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      const url1 = result.current.resolveAsset('images/photo.png');
      const url2 = result.current.resolveAsset('images/photo.png');
      expect(url1).toBe(url2);
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to /assets/<path> for assets not in the map', () => {
      const assetPkg = makePackageWithAssets([]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      const url = result.current.resolveAsset('missing/file.png');
      expect(url).toBe('/assets/missing/file.png');
      warnSpy.mockRestore();
    });

    it('returns /assets/<path> for non-blob fallback with external-looking paths', () => {
      const assetPkg = makePackageWithAssets([]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      const url = result.current.resolveAsset('images/photo.png');
      expect(url).toBe('/assets/images/photo.png');
      warnSpy.mockRestore();
    });

    it('revokes blob URLs on unmount', () => {
      const assetPkg = makePackageWithAssets([
        { path: 'images/photo.png', data: pngBytes.buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result, unmount } = renderHook(() => useRuntime(), { wrapper });
      const url = result.current.resolveAsset('images/photo.png');
      expect(url).toMatch(/^blob:/);
      unmount();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(url);
    });

    it('revokes old blob URLs when unmounted after asset resolution', () => {
      const assetPkg = makePackageWithAssets([
        { path: 'images/old.png', data: pngBytes.buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result, unmount } = renderHook(() => useRuntime(), { wrapper });
      const url = result.current.resolveAsset('images/old.png');
      expect(url).toMatch(/^blob:/);
      expect(revokeObjectURLSpy).not.toHaveBeenCalledWith(url);

      unmount();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(url);
    });
  });

  describe('resolveEngineAsset', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn<any[], string>>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createObjectURLSpy = vi.fn(() => `blob:mock/${Math.random().toString(36).slice(2)}`);
      revokeObjectURLSpy = vi.fn();
      vi.stubGlobal('URL', {
        ...globalThis.URL,
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function makePackageWithAssets(
      assets: Array<{ path: string; data: ArrayBuffer }>,
    ): LoadedPackage {
      const assetMap = new Map<string, ArrayBuffer>();
      for (const a of assets) {
        assetMap.set(a.path, a.data);
      }
      return {
        rootDir: '/tmp/test',
        manifest: {
          id: 'test-asset',
          title: 'Test Asset',
          version: '1.0.0',
          author: 'A',
          entry: 'nodes/lesson-01.md',
        },
        workflow: { routing: {} },
        rewards: null,
        cards: null,
        nodes: [
          {
            path: '/tmp/nodes/lesson-01.md',
            relativePath: 'nodes/lesson-01.md',
            content: '# Hello',
            node: { type: 'lesson', skills: undefined } as never,
          },
        ],
        assetPaths: assets.map((a) => a.path),
        assetMap,
      };
    }

    it('returns decoded file contents for a .geojson data asset', () => {
      const geojson = '{"type":"FeatureCollection","features":[]}';
      const assetPkg = makePackageWithAssets([
        {
          path: 'data/india/states.geojson',
          data: new TextEncoder().encode(geojson).buffer as ArrayBuffer,
        },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      expect(result.current.resolveEngineAsset('data/india/states.geojson')).toBe(geojson);
    });

    it('resolves both assets/foo.json and foo.json keys to the same data asset', () => {
      const assetPkg = makePackageWithAssets([
        { path: 'foo.json', data: new TextEncoder().encode('{"a":1}').buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      expect(result.current.resolveEngineAsset('assets/foo.json')).toBe('{"a":1}');
      expect(result.current.resolveEngineAsset('foo.json')).toBe('{"a":1}');
    });

    it('resolves an image id to a URL string, never bytes', () => {
      const assetPkg = makePackageWithAssets([
        { path: 'figure.svg', data: new TextEncoder().encode('<svg/>').buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      const url = result.current.resolveEngineAsset('assets/figure.svg');
      expect(typeof url).toBe('string');
      expect(url).toMatch(/^blob:/);
    });

    it('returns an empty string for a missing data asset', () => {
      const assetPkg = makePackageWithAssets([]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      expect(result.current.resolveEngineAsset('data/missing.geojson')).toBe('');
      warnSpy.mockRestore();
    });

    it('never returns bytes for any asset id', () => {
      const assetPkg = makePackageWithAssets([
        {
          path: 'data.json',
          data: new TextEncoder().encode('{"a":1}').buffer as ArrayBuffer,
        },
        { path: 'img.png', data: new Uint8Array([0x89, 0x50]).buffer as ArrayBuffer },
      ]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <RuntimeProvider loadedPackage={assetPkg} engine={engine}>
          {children}
        </RuntimeProvider>
      );
      const { result } = renderHook(() => useRuntime(), { wrapper });
      expect(result.current.resolveEngineAsset('data.json')).toBe('{"a":1}');
      expect(typeof result.current.resolveEngineAsset('img.png')).toBe('string');
    });
  });
});
