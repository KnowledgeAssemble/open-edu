import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { AnimationConfigSchema } from '@open-edu/schemas';
import { useObserveMode } from '../../use-observe-mode';
import { WidgetError } from '../WidgetError';

const nodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  image: z.string().optional(),
  icon: z.string().optional(),
});

const connectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(['arrow', 'dashed', 'double', 'loop']).optional().default('arrow'),
  label: z.string().optional(),
});

const processDiagramSchema = z.object({
  nodes: z.array(nodeSchema).min(2),
  connections: z.array(connectionSchema).min(1),
  layout: z.enum(['horizontal', 'vertical', 'cycle', 'radial']).optional().default('horizontal'),
  title: z.string().optional(),
  interactive: z.boolean().optional().default(false),
  animate: z.boolean().optional().default(false),
  stepByStep: z.boolean().optional().default(false),
  animation: AnimationConfigSchema.optional(),
});

const ProcessDiagramStateSchema = z.object({
  revealedNodes: z.array(z.number()),
  currentStep: z.number(),
  finished: z.boolean().optional(),
});

const NODE_WIDTH = 140;
const NODE_HEIGHT = 60;
const GAP = 80;

function computePositions(
  nodes: { id: string }[],
  layout: string,
  containerWidth: number,
  containerHeight: number,
) {
  const positions = new Map<string, { x: number; y: number }>();
  const cx = containerWidth / 2;
  const cy = containerHeight / 2;

  if (layout === 'horizontal') {
    const totalWidth = nodes.length * NODE_WIDTH + (nodes.length - 1) * GAP;
    const startX = (containerWidth - totalWidth) / 2;
    nodes.forEach((n, i) => {
      positions.set(n.id, { x: startX + i * (NODE_WIDTH + GAP), y: cy - NODE_HEIGHT / 2 });
    });
  } else if (layout === 'vertical') {
    const totalHeight = nodes.length * NODE_HEIGHT + (nodes.length - 1) * GAP;
    const startY = (containerHeight - totalHeight) / 2;
    nodes.forEach((n, i) => {
      positions.set(n.id, { x: cx - NODE_WIDTH / 2, y: startY + i * (NODE_HEIGHT + GAP) });
    });
  } else if (layout === 'cycle') {
    const radius = Math.min(cx, cy) - NODE_WIDTH;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      positions.set(n.id, {
        x: cx + radius * Math.cos(angle) - NODE_WIDTH / 2,
        y: cy + radius * Math.sin(angle) - NODE_HEIGHT / 2,
      });
    });
  } else if (layout === 'radial') {
    const radius = Math.min(cx, cy) * 0.6;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      positions.set(n.id, {
        x: cx + radius * Math.cos(angle) - NODE_WIDTH / 2,
        y: cy + radius * Math.sin(angle) - NODE_HEIGHT / 2,
      });
    });
  }

  return positions;
}

function ProcessDiagramComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = processDiagramSchema.safeParse(rawConfig);
  const parsedState = useMemo(() => {
    const result = ProcessDiagramStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [revealedNodes, setRevealedNodes] = useState<number[]>(
    parsedState?.revealedNodes ??
      (parsed?.success && (!parsed.data.stepByStep || !parsed.data.interactive)
        ? parsed.data.nodes.map((_, i) => i)
        : []),
  );
  const [currentStep, setCurrentStep] = useState(parsedState?.currentStep ?? 0);
  const [finished, setFinished] = useState(parsedState?.finished ?? false);

  const isObserve = parsed.success && !parsed.data.interactive;
  const { handleAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'science.process-diagram',
  });

  const containerWidth = 600;
  const nodeCount = parsed?.data?.nodes.length ?? 2;
  const layoutType = parsed?.data?.layout ?? 'horizontal';
  const containerHeight =
    layoutType === 'cycle' || layoutType === 'radial'
      ? Math.max(300, nodeCount * 60)
      : Math.max(300, nodeCount * 80);

  const positions = useMemo(() => {
    if (!parsed.success) return new Map();
    return computePositions(parsed.data.nodes, parsed.data.layout, containerWidth, containerHeight);
  }, [parsed]);

  const handleRevealNext = useCallback(() => {
    if (!parsed.success) return;
    const nextIndex = revealedNodes.length;
    if (nextIndex < parsed.data.nodes.length) {
      setRevealedNodes([...revealedNodes, nextIndex]);
      setCurrentStep(nextIndex);
      emitInteraction({
        type: 'widget.interaction',
        widgetId: 'science.process-diagram',
        action: 'reveal',
        nodeIndex: nextIndex,
        nodeId: parsed.data.nodes[nextIndex]?.id,
      });
    }
  }, [parsed, revealedNodes, emitInteraction]);

  const handleFinish = useCallback(() => {
    if (!parsed.success || finished) return;
    setFinished(true);
    complete(100, { revealedNodes, currentStep, finished: true });
  }, [parsed, finished, revealedNodes, currentStep, complete]);

  if (!parsed.success) {
    return <WidgetError />;
  }

  const config = parsed.data;

  if (isObserve) {
    return (
      <div
        role="group"
        aria-label={config.title ?? 'Process diagram'}
        data-testid="process-diagram-observe"
      >
        {config.title && <h3 className="text-on-surface mb-sm font-semibold">{config.title}</h3>}
        <svg
          width={containerWidth}
          height={containerHeight}
          viewBox={`0 0 ${containerWidth} ${containerHeight}`}
          className="w-full"
        >
          <defs>
            <marker
              id={`arrow-${props.nodeId}`}
              viewBox="0 0 10 7"
              refX="10"
              refY="3.5"
              markerWidth="10"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--oe-color-on-surface, #1c1b1f)" />
            </marker>
          </defs>
          {config.connections.map((conn, i) => {
            const from = positions.get(conn.from);
            const to = positions.get(conn.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_WIDTH / 2;
            const y1 = from.y + NODE_HEIGHT / 2;
            const x2 = to.x + NODE_WIDTH / 2;
            const y2 = to.y + NODE_HEIGHT / 2;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--oe-color-on-surface, #1c1b1f)"
                strokeWidth={2}
                strokeDasharray={conn.type === 'dashed' ? '8 4' : undefined}
                markerEnd={`url(#arrow-${props.nodeId})`}
              />
            );
          })}
          {config.nodes.map((node, idx) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            return (
              <g key={node.id} role="listitem" aria-label={`Step ${idx + 1}: ${node.title}`}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill="var(--oe-color-primary-container, #e8def8)"
                  stroke="var(--oe-color-primary, #6750a4)"
                  strokeWidth={2}
                />
                <text
                  x={pos.x + NODE_WIDTH / 2}
                  y={pos.y + NODE_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--oe-color-on-primary-container, #1d192b)"
                  fontSize={13}
                  fontWeight={500}
                >
                  {node.title}
                </text>
              </g>
            );
          })}
        </svg>
        {showAcknowledgeButton && (
          <div className="p-md border-outline-variant mt-md flex items-center justify-center border-t">
            <Button variant="default" onClick={handleAcknowledge} data-testid="observe-acknowledge">
              Mark as seen ✓
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div role="group" aria-label={config.title ?? 'Process diagram'} data-testid="process-diagram">
      {config.title && <h3 className="text-on-surface mb-sm font-semibold">{config.title}</h3>}

      <div role="list" aria-label="Process steps" className="overflow-auto">
        <svg
          width={containerWidth}
          height={containerHeight}
          viewBox={`0 0 ${containerWidth} ${containerHeight}`}
          className="w-full"
        >
          <defs>
            <marker
              id={`arrow-interactive-${props.nodeId}`}
              viewBox="0 0 10 7"
              refX="10"
              refY="3.5"
              markerWidth="10"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--oe-color-on-surface, #1c1b1f)" />
            </marker>
          </defs>
          {config.connections.map((conn, i) => {
            const from = positions.get(conn.from);
            const to = positions.get(conn.to);
            if (!from || !to) return null;
            const fromIdx = config.nodes.findIndex((n) => n.id === conn.from);
            const toIdx = config.nodes.findIndex((n) => n.id === conn.to);
            if (!revealedNodes.includes(fromIdx) || !revealedNodes.includes(toIdx)) return null;
            const x1 = from.x + NODE_WIDTH / 2;
            const y1 = from.y + NODE_HEIGHT / 2;
            const x2 = to.x + NODE_WIDTH / 2;
            const y2 = to.y + NODE_HEIGHT / 2;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--oe-color-on-surface, #1c1b1f)"
                strokeWidth={2}
                strokeDasharray={conn.type === 'dashed' ? '8 4' : undefined}
                markerEnd={`url(#arrow-interactive-${props.nodeId})`}
              />
            );
          })}
          {config.nodes.map((node, idx) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const isRevealed = revealedNodes.includes(idx);
            return (
              <g key={node.id} role="listitem" aria-label={`Step ${idx + 1}: ${node.title}`}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={
                    isRevealed
                      ? idx === currentStep
                        ? 'var(--oe-color-primary, #6750a4)'
                        : 'var(--oe-color-primary-container, #e8def8)'
                      : 'var(--oe-color-surface-container-highest, #e6e1e5)'
                  }
                  stroke={
                    isRevealed
                      ? 'var(--oe-color-primary, #6750a4)'
                      : 'var(--oe-color-outline-variant, #cac4d0)'
                  }
                  strokeWidth={2}
                  opacity={isRevealed ? 1 : 0.4}
                />
                <text
                  x={pos.x + NODE_WIDTH / 2}
                  y={pos.y + NODE_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={
                    isRevealed
                      ? idx === currentStep
                        ? 'var(--oe-color-on-primary, #fff)'
                        : 'var(--oe-color-on-primary-container, #1d192b)'
                      : 'var(--oe-color-on-surface, #1c1b1f)'
                  }
                  fontSize={13}
                  fontWeight={500}
                  opacity={isRevealed ? 1 : 0.4}
                >
                  {node.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {config.stepByStep && revealedNodes.length < config.nodes.length && (
        <div className="mt-md text-center">
          <Button variant="default" onClick={handleRevealNext} data-testid="reveal-next">
            Reveal Next Step
          </Button>
          <p className="text-on-surface/70 mt-xs text-sm">
            Step {revealedNodes.length + 1} of {config.nodes.length}
          </p>
        </div>
      )}

      {config.stepByStep && revealedNodes.length >= config.nodes.length && !finished && (
        <div className="mt-md text-center">
          <p className="text-on-surface font-semibold" data-testid="diagram-complete">
            All steps revealed!
          </p>
          <Button
            variant="default"
            onClick={handleFinish}
            data-testid="finish-button"
            className="mt-sm"
          >
            Finish
          </Button>
        </div>
      )}

      {config.stepByStep && finished && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="diagram-finished"
          className="mt-md text-center"
        >
          <p className="text-on-surface font-semibold">All steps viewed.</p>
        </div>
      )}
    </div>
  );
}

const ProcessDiagramWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Explore step-by-step scientific processes with connected diagrams.',
    whatItDoes:
      'The Process Diagram widget shows a connected diagram of a scientific process — like the water cycle, food chain, or rock cycle. Nodes represent steps, and connections show the flow. It supports cycle, linear, and custom layouts with step-by-step reveal.',
    whenToUse: [
      'Teaching the water cycle or rock cycle',
      'Explaining food chains and food webs',
      'Showing cause-and-effect processes',
      'Visualizing life cycles with stages',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "science.process-diagram"',
      'Define process nodes — each has an id and title',
      'Define connections between nodes with optional labels',
      'Choose a layout: cycle, linear, or tree',
    ],
    configFields: [
      {
        name: 'nodes',
        type: 'array of objects',
        required: true,
        description:
          'Process steps. Each has id (string), title (string), and optional description (string) and icon (string).',
      },
      {
        name: 'connections',
        type: 'array of objects',
        required: true,
        description:
          'Connections between nodes. Each has from (node id), to (node id), and optional label (string) and type ("arrow", "loop", "dashed").',
      },
      {
        name: 'layout',
        type: 'string',
        required: false,
        description: 'Layout style: "cycle", "linear", "tree", or "flow". Defaults to "cycle".',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'An overall title for the diagram.',
      },
      {
        name: 'stepByStep',
        type: 'boolean',
        required: false,
        description: 'Reveal nodes one at a time. Defaults to false.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows the complete diagram. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "The Water Cycle",\n  "widget": "science.process-diagram",\n  "config": {\n    "nodes": [\n      { "id": "evaporation", "title": "Evaporation", "description": "Sun heats water, turning it into vapor", "icon": "☀️" },\n      { "id": "condensation", "title": "Condensation", "description": "Water vapor cools and forms clouds", "icon": "☁️" },\n      { "id": "precipitation", "title": "Precipitation", "description": "Water falls as rain, snow, or hail", "icon": "🌧️" },\n      { "id": "collection", "title": "Collection", "description": "Water gathers in oceans and lakes", "icon": "🌊" }\n    ],\n    "connections": [\n      { "from": "evaporation", "to": "condensation", "label": "vapor rises" },\n      { "from": "condensation", "to": "precipitation", "label": "clouds form" },\n      { "from": "precipitation", "to": "collection", "label": "water falls" },\n      { "from": "collection", "to": "evaporation", "type": "loop", "label": "cycle repeats" }\n    ],\n    "layout": "cycle",\n    "title": "The Water Cycle",\n    "stepByStep": true,\n    "interactive": false\n  }\n}',
    tips: [
      'Use clear step labels that students can read easily',
      'Show arrows to indicate the direction of the process',
      'Add brief descriptions for each step',
      'Cycle layout works best for repeating processes',
    ],
    sidebarPosition: 3,
    relatedWidgets: [
      {
        id: 'core.sequencing',
        name: 'Sequencing',
        domain: 'core',
        slug: 'sequencing',
      },
      {
        id: 'core.timeline',
        name: 'Timeline',
        domain: 'core',
        slug: 'timeline',
      },
    ],
  },
  id: 'science.process-diagram',
  name: 'Process Diagram',
  description: 'Visual explanation of systems and processes with nodes and connections',
  domain: 'science',
  version: '1.0.0',
  schema: processDiagramSchema,
  render: ProcessDiagramComponent,
  learningIntents: [LearningIntent.Observe, LearningIntent.Understand],
  capabilities: {
    supportsObserveMode: true,
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsHints: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
    supportsOffline: true,
    supportsAnimation: true,
    supportsLocalization: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    reducedMotion: true,
    ariaSupport: true,
    focusManagement: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackHints: true,
    trackInteractions: true,
  },
  reward: {
    completionXP: 15,
    confetti: true,
    positiveMessage: 'Process understood!',
    achievement: 'first-process',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 5,
    bloomsLevel: 'understand',
    cognitiveLoad: 'moderate',
    recommendedAge: [8, 18],
    readingLevel: 'grade-4',
    subjectTags: ['science', 'computer-science'],
    learningObjectives: [
      'Understand the sequence of steps in a process',
      'Identify relationships between process stages',
      'Predict the next step in a known process',
    ],
    commonMisconceptions: [
      'Assuming processes always follow a linear path',
      'Missing feedback loops in cyclical processes',
    ],
    generationHints: [
      'Use 3-8 nodes for clarity',
      'Label connections with transition descriptions',
      'Choose layout based on process shape (linear=horizontal, cyclical=cycle)',
    ],
    authoringPrompt:
      'Create a process diagram showing the stages of a natural or computational process',
    exampleConfigs: [
      {
        title: 'Water Cycle',
        nodes: [
          { id: 'evap', title: 'Evaporation' },
          { id: 'cond', title: 'Condensation' },
          { id: 'precip', title: 'Precipitation' },
          { id: 'collect', title: 'Collection' },
        ],
        connections: [
          { from: 'evap', to: 'cond', type: 'arrow' },
          { from: 'cond', to: 'precip', type: 'arrow' },
          { from: 'precip', to: 'collect', type: 'arrow' },
          { from: 'collect', to: 'evap', type: 'loop' },
        ],
        layout: 'cycle',
        interactive: true,
        stepByStep: true,
      },
    ],
  },
  icon: 'git-branch',
  keywords: ['process', 'diagram', 'flow', 'cycle', 'system', 'steps', 'science'],
  status: 'stable',
};

export { ProcessDiagramWidget as processDiagram, processDiagramSchema };
export default ProcessDiagramWidget;
