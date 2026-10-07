import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { InteractiveNode, InteractiveLesson } from '@knowledgeassemble/interactive-react';
import type {
  InteractiveNodeHandle,
  InteractiveLessonHandle,
} from '@knowledgeassemble/interactive-react';
import type { OpenEduBridge } from './bridge.js';

export interface InteractiveNodeViewProps {
  spec: unknown;
  engineType: string;
  bridge: OpenEduBridge;
  id?: string;
  /** Called for every semantic engine event (telemetry / diagnostics). */
  onEvent?: (event: { seq: number; name: string; instanceId: string; action?: unknown }) => void;
  /** Called when the underlying handle becomes available. */
  onReady?: (handle: InteractiveNodeHandle) => void;
}

/**
 * Mount a single interactive engine node, forwarding the KA ref handle so the
 * host can `dispatch` semantic actions and read snapshots/events.
 */
export const InteractiveNodeView = forwardRef<InteractiveNodeHandle, InteractiveNodeViewProps>(
  function InteractiveNodeView({ spec, engineType, bridge, id, onReady }, ref) {
    const innerRef = useRef<InteractiveNodeHandle | null>(null);

    const handleRef = useCallback(
      (node: InteractiveNodeHandle | null) => {
        innerRef.current = node;
        if (node) onReady?.(node);
      },
      [onReady],
    );

    useImperativeHandle(ref, () => ({
      dispatch: (action) => innerRef.current?.dispatch(action),
      snapshot: () => innerRef.current?.snapshot(),
      events: () => innerRef.current?.events() ?? [],
    }));

    return (
      <InteractiveNode ref={handleRef} spec={spec} engineType={engineType} host={bridge} id={id} />
    );
  },
);

export interface InteractiveLessonViewProps {
  lesson: unknown;
  bridge: OpenEduBridge;
  /** Called for every semantic engine event (telemetry / diagnostics). */
  onEvent?: (event: { seq: number; name: string; instanceId: string; action?: unknown }) => void;
  /** Called when the underlying handle becomes available. */
  onReady?: (handle: InteractiveLessonHandle) => void;
}

/**
 * Mount a composed interactive lesson (multiple engines + bindings), forwarding
 * the KA ref handle so the host can `dispatch(instanceId, action)` and read
 * snapshots/events.
 */
export const InteractiveLessonView = forwardRef<
  InteractiveLessonHandle,
  InteractiveLessonViewProps
>(function InteractiveLessonView({ lesson, bridge, onReady }, ref) {
  const innerRef = useRef<InteractiveLessonHandle | null>(null);

  const handleRef = useCallback(
    (node: InteractiveLessonHandle | null) => {
      innerRef.current = node;
      if (node) onReady?.(node);
    },
    [onReady],
  );

  useImperativeHandle(ref, () => ({
    dispatch: (instanceId, action) => innerRef.current?.dispatch(instanceId, action),
    snapshot: (instanceId) => innerRef.current?.snapshot(instanceId),
    events: () => innerRef.current?.events() ?? [],
    instances: () => innerRef.current?.instances() ?? [],
  }));

  return <InteractiveLesson ref={handleRef} lesson={lesson} host={bridge} />;
});

export type {
  InteractiveNodeHandle,
  InteractiveLessonHandle,
} from '@knowledgeassemble/interactive-react';
