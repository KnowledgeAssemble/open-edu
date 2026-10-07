import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import type { InteractiveNode } from '@open-edu/schemas';
import type * as InteractiveRuntime from '@open-edu/interactive-runtime';
import { I18nProvider } from '@open-edu/i18n';
import runtimeDict from '@open-edu/i18n/locales/en/runtime.json';

/**
 * Regression tests for the host's deferred snapshot re-read.
 *
 * `engine.instantiate()` emits `engine-ready` synchronously, before
 * `InteractiveNode` assigns its instance ref, so the first snapshot read can
 * legitimately come back empty and is retried on the next macrotask.
 *
 * That retry must terminate:
 *  - a composed lesson never hands the host an `InteractiveNodeHandle` (see
 *    `handleLessonReady`), yet its child engines still emit `engine-ready`
 *    through the shared bridge, so it must not be retried at all;
 *  - a single-engine node resolves on the first deferral, and must not defer
 *    again on every subsequent engine event.
 *
 * Both stubs below reproduce the real emission ordering: `engine-ready` first,
 * then `onReady`.
 */
vi.mock('@open-edu/interactive-runtime', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof InteractiveRuntime;
  const engineReady = (bridge: { onEvent: (e: unknown) => void }, instanceId: string) =>
    bridge.onEvent({ seq: 1, name: 'engine-ready', instanceId });

  return {
    ...actual,
    // Composed lesson: child engines emit, but no node handle is ever provided.
    InteractiveLessonView: ({ bridge }: { bridge: { onEvent: (e: unknown) => void } }) => {
      useEffect(() => {
        engineReady(bridge, 'engine-a');
        engineReady(bridge, 'engine-b');
      }, [bridge]);
      return <div data-testid="interactive-lesson-stub" />;
    },
    // Single engine: emits before onReady, and the handle snapshots cleanly.
    InteractiveNodeView: ({
      bridge,
      onReady,
    }: {
      bridge: { onEvent: (e: unknown) => void };
      onReady: (handle: unknown) => void;
    }) => {
      useEffect(() => {
        engineReady(bridge, 'engine-a');
        onReady({ snapshot: () => ({ scene: { nodes: [] } }) });
      }, [bridge, onReady]);
      return <div data-testid="interactive-node-stub" />;
    },
  };
});

const { InteractiveRenderer } = await import('./InteractiveRenderer');

const COMPOSED_NODE = {
  type: 'interactive',
  id: 'composed',
  title: 'Composed lesson',
  engines: [
    { instanceId: 'engine-a', engine: 'timeline', spec: { type: 'timeline' } },
    { instanceId: 'engine-b', engine: 'visual', spec: { type: 'visual' } },
  ],
  bindings: [],
} as unknown as InteractiveNode;

const SINGLE_NODE = {
  type: 'interactive',
  id: 'single',
  title: 'Number line',
  engine: 'visual',
  spec: { type: 'visual', version: '1.0.0', id: 'nl' },
} as unknown as InteractiveNode;

function renderNode(node: InteractiveNode) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider locale="en" dictionaries={{ en: { runtime: runtimeDict } }}>
      {children}
    </I18nProvider>
  );
  return render(<InteractiveRenderer node={node} nodeId="nodes/x.json" />, { wrapper });
}

/** Records the zero-delay `setTimeout` calls the renderer schedules (its retry). */
function trackRetryTimers() {
  const scheduled: number[] = [];
  const cleared: number[] = [];
  const originalSet = window.setTimeout;
  const originalClear = window.clearTimeout;
  vi.spyOn(window, 'setTimeout').mockImplementation(((
    handler: TimerHandler,
    timeout?: number,
    ...rest: unknown[]
  ): number => {
    const id = originalSet(handler, timeout, ...rest);
    if (timeout === 0) scheduled.push(Number(id));
    return Number(id);
  }) as unknown as typeof window.setTimeout);
  vi.spyOn(window, 'clearTimeout').mockImplementation(((id?: number): void => {
    if (id != null) cleared.push(Number(id));
    originalClear(id);
  }) as unknown as typeof window.clearTimeout);
  return { scheduled, cleared };
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('InteractiveRenderer deferred snapshot re-read', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    cleanup();
  });

  describe('composed lesson (never provides a handle)', () => {
    it('schedules no retry at all', () => {
      const { scheduled } = trackRetryTimers();
      const { getByTestId } = renderNode(COMPOSED_NODE);
      expect(getByTestId('interactive-lesson-stub')).toBeInTheDocument();

      // A self-rescheduling retry would fire once per elapsed millisecond.
      advance(10_000);

      expect(scheduled).toEqual([]);
    });
  });

  describe('single engine (handle arrives after engine-ready)', () => {
    it('defers exactly once, then stops', () => {
      const { scheduled } = trackRetryTimers();
      renderNode(SINGLE_NODE);

      advance(10_000);
      expect(scheduled).toHaveLength(1);
    });

    it('does not defer again on later engine events', () => {
      const { scheduled } = trackRetryTimers();
      renderNode(SINGLE_NODE);

      advance(1_000);
      const afterFirst = scheduled.length;
      advance(60_000);

      expect(scheduled.length).toBe(afterFirst);
    });
  });

  it('cancels a pending retry on unmount', () => {
    const { scheduled, cleared } = trackRetryTimers();
    const { unmount } = renderNode(SINGLE_NODE);

    // Unmount before the deferred re-read fires, while the retry is pending.
    expect(scheduled).toHaveLength(1);

    unmount();
    expect(cleared).toContain(scheduled[0]);
  });
});
