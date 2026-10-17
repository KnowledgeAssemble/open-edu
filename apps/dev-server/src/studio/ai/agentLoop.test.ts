import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type {
  AgentRuntime,
  AgentRuntimeEvent,
  AgentRuntimeRequest,
  CompanionEvent,
  CompanionPermissions,
  CompanionTool,
  StudioContextSnapshot,
  Task,
  TaskStore,
} from '@open-edu/companion';
import { runAgentLoop } from './agentLoop.js';
import { InMemoryToolRegistry } from './toolRegistry.js';
import { defaultPermissionPolicy } from './permissionPolicy.js';
import { createSkillResolver } from './skills/resolveSkills.js';
import { InMemorySkillRegistry } from './skillRegistry.js';
import { authoringFixture } from '../test/authoringFixture.js';

const mockDraftActivity = vi.fn();
const mockGenerateCourseDraftTool = vi.fn();

vi.mock('./chat/tools.js', () => ({
  draftActivity: (...args: unknown[]) => mockDraftActivity(...args),
  generateCourseDraftTool: (...args: unknown[]) => mockGenerateCourseDraftTool(...args),
}));

class FakeRuntime implements AgentRuntime {
  runs: AgentRuntimeEvent[][];
  calls = 0;
  requests: AgentRuntimeRequest[] = [];

  constructor(runs: AgentRuntimeEvent[][]) {
    this.runs = runs;
  }

  run(request: AgentRuntimeRequest): AsyncIterable<AgentRuntimeEvent> {
    this.requests.push(request);
    const events = this.runs[Math.min(this.calls, this.runs.length - 1)] ?? [];
    this.calls += 1;
    return {
      async *[Symbol.asyncIterator]() {
        for (const event of events) {
          yield event;
        }
      },
    };
  }
}

function recordingTool(
  id: string,
  permissionId: string,
  options: { schema?: z.ZodType; kind?: CompanionPermissions['allowed'][number]['kind'] } = {},
): { tool: CompanionTool; calls: unknown[] } {
  const calls: unknown[] = [];
  const tool: CompanionTool = {
    id,
    description: `Tool ${id}`,
    inputSchema: options.schema ?? z.object({}).passthrough(),
    permission: { id: permissionId, kind: options.kind ?? 'propose' },
    async execute(input) {
      calls.push(input);
      return { ok: true, value: [{ kind: 'quiz', title: 'Quiz', content: '{}' }] };
    },
  };
  return { tool, calls };
}

const context: StudioContextSnapshot = {
  view: 'outline',
  locale: 'en',
  aiAvailable: true,
  course: {
    id: 'c1',
    title: 'Fractions',
    activityCount: 1,
    outline: [{ title: 'A', kind: 'lesson', path: 'nodes/a.md' }],
  },
};

const learnerContext: StudioContextSnapshot = {
  ...context,
  learner: { id: 'level-b', label: 'Level B', kind: 'school' },
};

const proposePermissions: CompanionPermissions = {
  allowed: [
    { id: 'course.generate', kind: 'propose' },
    { id: 'item.generate', kind: 'propose' },
    { id: 'item.edit', kind: 'propose' },
  ],
  requireApprovalFor: ['commit', 'destructive'],
};

async function collect(generator: AsyncGenerator<CompanionEvent>): Promise<CompanionEvent[]> {
  const events: CompanionEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

function requestFor(message: string, perms: CompanionPermissions = proposePermissions) {
  return {
    message,
    context,
    conversationId: 'conv-1',
    permissions: perms,
  };
}

describe('runAgentLoop — deterministic single-step (Phase 6.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits tool.started before tool.completed for the intent-routed tool', async () => {
    mockDraftActivity.mockResolvedValue({
      ok: true,
      items: [{ kind: 'quiz', title: 'Q', content: '{}' }],
    });
    const { tool } = recordingTool('generate_item', 'item.generate');
    const runtime = new FakeRuntime([[]]);

    const events = await collect(
      runAgentLoop(requestFor('create a quiz about photosynthesis'), {
        runtime,
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        packageDir: '/pkg',
      }),
    );

    const types = events.map((event) => event.type);
    expect(types.indexOf('tool.started')).toBeGreaterThan(-1);
    expect(types.indexOf('tool.started')).toBeLessThan(types.indexOf('tool.completed'));
    expect(events.some((event) => event.type === 'draft.created')).toBe(true);
    expect(mockDraftActivity).toHaveBeenCalledTimes(1);
    expect(runtime.calls).toBe(0);
  });

  it('applies the need-package guard without running the tool', async () => {
    const { tool, calls } = recordingTool('generate_item', 'item.generate');

    const events = await collect(
      runAgentLoop(requestFor('create a quiz about photosynthesis'), {
        runtime: new FakeRuntime([]),
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
      }),
    );

    expect(calls).toHaveLength(0);
    expect(events.some((event) => event.type === 'message.delta')).toBe(true);
    expect(events.some((event) => event.type === 'message.complete')).toBe(true);
  });
});

describe('runAgentLoop — model-driven loop (Phase 6.5)', () => {
  it('executes a model-requested tool once and streams the final text', async () => {
    const { tool, calls } = recordingTool('generate_item', 'item.generate');
    const runtime = new FakeRuntime([
      [
        {
          type: 'tool.call',
          toolCallId: 'c1',
          tool: 'generate_item',
          input: { packageDir: '/pkg' },
        },
        { type: 'text.complete' },
      ],
      [{ type: 'text.delta', text: 'ready' }, { type: 'text.complete' }],
    ]);

    const events = await collect(
      runAgentLoop(requestFor('explain syllabus design'), {
        runtime,
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        packageDir: '/pkg',
      }),
    );

    expect(runtime.calls).toBe(2);
    expect(calls).toHaveLength(1);
    const completed = events.filter((event) => event.type === 'tool.completed');
    expect(completed).toHaveLength(1);
    expect(events.some((event) => event.type === 'message.delta')).toBe(true);
  });

  it('runs two steps when the model requests a tool twice (multi-step)', async () => {
    const { tool } = recordingTool('generate_item', 'item.generate');
    const runtime = new FakeRuntime([
      [
        {
          type: 'tool.call',
          toolCallId: 'c1',
          tool: 'generate_item',
          input: { packageDir: '/pkg' },
        },
        { type: 'text.complete' },
      ],
      [
        {
          type: 'tool.call',
          toolCallId: 'c2',
          tool: 'generate_item',
          input: { packageDir: '/pkg' },
        },
        { type: 'text.complete' },
      ],
      [{ type: 'text.delta', text: 'done' }, { type: 'text.complete' }],
    ]);

    const events = await collect(
      runAgentLoop(requestFor('explain curriculum design'), {
        runtime,
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        packageDir: '/pkg',
      }),
    );

    expect(runtime.calls).toBe(3);
    const completed = events.filter((event) => event.type === 'tool.completed');
    expect(completed).toHaveLength(2);
  });

  it('halts at the maxSteps bound and emits a runtime-error', async () => {
    const { tool } = recordingTool('generate_item', 'item.generate');
    const runtime = new FakeRuntime([
      [
        { type: 'tool.call', toolCallId: 'c1', tool: 'generate_item', input: {} },
        { type: 'text.complete' },
      ],
      [
        { type: 'tool.call', toolCallId: 'c2', tool: 'generate_item', input: {} },
        { type: 'text.complete' },
      ],
      [
        { type: 'tool.call', toolCallId: 'c3', tool: 'generate_item', input: {} },
        { type: 'text.complete' },
      ],
    ]);

    const events = await collect(
      runAgentLoop(requestFor('explain pedagogy'), {
        runtime,
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        packageDir: '/pkg',
        maxSteps: 2,
      }),
    );

    expect(runtime.calls).toBe(2);
    expect(events.some((event) => event.type === 'error')).toBe(true);
  });

  it('halts mid-loop on timeoutMs expiry via the injected clock', async () => {
    const { tool, calls } = recordingTool('generate_item', 'item.generate');
    let t = 0;
    const now = () => (t += 30); // 30 (deadline seed), 60 (step 0), 90 (step 1)…

    const events = await collect(
      runAgentLoop(requestFor('explain pedagogy'), {
        runtime: new FakeRuntime([
          [
            {
              type: 'tool.call',
              toolCallId: 'c1',
              tool: 'generate_item',
              input: { packageDir: '/pkg' },
            },
            { type: 'text.complete' },
          ],
          [{ type: 'text.delta', text: 'done' }, { type: 'text.complete' }],
        ]),
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        packageDir: '/pkg',
        timeoutMs: 50, // deadline = 30 + 50 = 80
        now,
      }),
    );

    // Step 0 runs (t=60 ≤ 80); the next step check (t=90 > 80) halts the loop.
    expect(calls).toHaveLength(1);
    expect(events.some((event) => event.type === 'error')).toBe(true);
  });

  it('halts on an aborted signal with a cancelled error', async () => {
    const { tool, calls } = recordingTool('generate_item', 'item.generate');
    const controller = new AbortController();
    controller.abort();

    const events = await collect(
      runAgentLoop(requestFor('explain pedagogy'), {
        runtime: new FakeRuntime([[]]),
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        signal: controller.signal,
      }),
    );

    expect(calls).toHaveLength(0);
    const error = events.find((event) => event.type === 'error');
    expect(error).toBeDefined();
    expect((error as { error: { code: string } }).error.code).toBe('cancelled');
  });

  it('denies a tool not covered by the permission set and never executes it', async () => {
    const { tool, calls } = recordingTool('generate_item', 'item.generate');
    const restricted: CompanionPermissions = {
      allowed: [{ id: 'course.generate', kind: 'propose' }],
      requireApprovalFor: ['commit', 'destructive'],
    };

    const events = await collect(
      runAgentLoop(
        { ...requestFor('explain'), permissions: restricted },
        {
          runtime: new FakeRuntime([
            [{ type: 'tool.call', toolCallId: 'c1', tool: 'generate_item', input: {} }],
          ]),
          tools: new InMemoryToolRegistry([tool]),
          policy: defaultPermissionPolicy,
        },
      ),
    );

    expect(calls).toHaveLength(0);
    const error = events.find((event) => event.type === 'error');
    expect((error as { error: { code: string } }).error.code).toBe('permission-denied');
  });

  it('rejects invalid tool input with validation-failed without executing', async () => {
    const { tool, calls } = recordingTool('generate_item', 'item.generate', {
      schema: z.object({ notes: z.string() }),
    });

    const events = await collect(
      runAgentLoop(requestFor('explain'), {
        runtime: new FakeRuntime([
          [{ type: 'tool.call', toolCallId: 'c1', tool: 'generate_item', input: { bad: 1 } }],
        ]),
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
      }),
    );

    expect(calls).toHaveLength(0);
    const error = events.find((event) => event.type === 'error');
    expect((error as { error: { code: string } }).error.code).toBe('validation-failed');
  });

  it('pauses for approval on a commit-kind tool and never executes it', async () => {
    const { tool, calls } = recordingTool('generate_item', 'item.generate', { kind: 'commit' });
    const commitPermissions: CompanionPermissions = {
      ...proposePermissions,
      requireApprovalFor: ['commit'],
    };

    const events = await collect(
      runAgentLoop(
        { ...requestFor('explain'), permissions: commitPermissions },
        {
          runtime: new FakeRuntime([
            [{ type: 'tool.call', toolCallId: 'c1', tool: 'generate_item', input: {} }],
          ]),
          tools: new InMemoryToolRegistry([tool]),
          policy: defaultPermissionPolicy,
        },
      ),
    );

    expect(calls).toHaveLength(0);
    expect(events.some((event) => event.type === 'approval.required')).toBe(true);
  });

  it('injects packageDir and completeText into the tool execution context', async () => {
    const captured: Array<{ input: unknown; ctx: Record<string, unknown> }> = [];
    const tool: CompanionTool = {
      id: 'generate_item',
      description: 'Draft a new lesson, quiz, or practice item.',
      inputSchema: z.object({ kind: z.string(), description: z.string() }),
      permission: { id: 'item.generate', kind: 'propose' },
      async execute(input, ctx) {
        captured.push({ input, ctx });
        return { ok: true, value: [{ kind: 'quiz', title: 'Quiz', content: '{}' }] };
      },
    };
    const completeText = vi.fn();
    const runtime = new FakeRuntime([
      [
        {
          type: 'tool.call',
          toolCallId: 'c1',
          tool: 'generate_item',
          input: { kind: 'quiz', description: 'A quiz about fractions' },
        },
        { type: 'text.complete' },
      ],
      [{ type: 'text.delta', text: 'ready' }, { type: 'text.complete' }],
    ]);

    await collect(
      runAgentLoop(requestFor('explain syllabus design'), {
        runtime,
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        packageDir: '/pkg',
        completeText,
      }),
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]!.input).toEqual({ kind: 'quiz', description: 'A quiz about fractions' });
    expect(captured[0]!.ctx.packageDir).toBe('/pkg');
    expect(captured[0]!.ctx.completeText).toBe(completeText);
  });

  it('injects request.context.authoring into model-loop tool execution', async () => {
    const captured: Array<{ input: unknown; ctx: Record<string, unknown> }> = [];
    const tool: CompanionTool = {
      id: 'generate_item',
      description: 'Draft item',
      inputSchema: z.object({ kind: z.string(), description: z.string() }),
      permission: { id: 'item.generate', kind: 'propose' },
      async execute(input, ctx) {
        captured.push({ input, ctx });
        return { ok: true, value: [] };
      },
    };
    const runtime = new FakeRuntime([
      [
        {
          type: 'tool.call',
          toolCallId: 'c1',
          tool: 'generate_item',
          input: { kind: 'lesson', description: 'x' },
        },
        { type: 'text.complete' },
      ],
      [{ type: 'text.complete' }],
    ]);

    await collect(
      runAgentLoop(
        {
          ...requestFor('explain'),
          context: { ...context, authoring: authoringFixture },
        },
        {
          runtime,
          tools: new InMemoryToolRegistry([tool]),
          policy: defaultPermissionPolicy,
          packageDir: '/pkg',
        },
      ),
    );

    expect(captured[0]!.ctx.authoring).toEqual(authoringFixture);
  });

  it('passes request.context.authoring to draftActivity on the deterministic generate_item path', async () => {
    mockDraftActivity.mockResolvedValue({
      ok: true,
      items: [{ kind: 'quiz', title: 'Q', content: '{}' }],
    });
    const { tool } = recordingTool('generate_item', 'item.generate');
    const runtime = new FakeRuntime([[]]);

    await collect(
      runAgentLoop(
        {
          ...requestFor('create a quiz about photosynthesis'),
          context: { ...context, authoring: authoringFixture },
        },
        {
          runtime,
          tools: new InMemoryToolRegistry([tool]),
          policy: defaultPermissionPolicy,
          packageDir: '/pkg',
        },
      ),
    );

    expect(mockDraftActivity).toHaveBeenCalledWith(
      expect.objectContaining({ authoring: authoringFixture }),
    );
  });

  it('preserves the provided conversation history as the model seed', async () => {
    const { tool } = recordingTool('generate_item', 'item.generate');
    const runtime = new FakeRuntime([
      [{ type: 'text.delta', text: 'hi' }, { type: 'text.complete' }],
    ]);
    const history = [
      { role: 'user' as const, content: 'earlier turn that mentions fractions' },
      { role: 'assistant' as const, content: 'earlier assistant reply' },
      { role: 'user' as const, content: 'explain syllabus design' },
    ];

    const events = await collect(
      runAgentLoop(requestFor('explain syllabus design'), {
        runtime,
        tools: new InMemoryToolRegistry([tool]),
        policy: defaultPermissionPolicy,
        messages: history,
        packageDir: '/pkg',
      }),
    );

    expect(runtime.requests[0]!.messages).toEqual(history);
    expect(events.some((event) => event.type === 'message.delta')).toBe(true);
  });
});

describe('runAgentLoop — skills (Phase 7)', () => {
  it('restricts the declared tool set and appends instructions when a skill matches', async () => {
    const { tool } = recordingTool('generate_item', 'item.generate');
    const courseTool = recordingTool('generate_course', 'course.generate');
    const runtime = new FakeRuntime([[{ type: 'text.delta', text: 'hi' }]]);
    const skills = createSkillResolver(new InMemorySkillRegistry());

    await collect(
      runAgentLoop(
        { ...requestFor('adapt this lesson'), context: learnerContext },
        {
          runtime,
          tools: new InMemoryToolRegistry([tool, courseTool.tool]),
          policy: defaultPermissionPolicy,
          systemPrompt: 'base system prompt',
          skills,
          packageDir: '/pkg',
        },
      ),
    );

    const request = runtime.requests[0]!;
    const toolNames = (request.tools ?? []).map((spec) => spec.name);
    expect(toolNames).toContain('generate_item');
    expect(toolNames).not.toContain('generate_course');
    expect(request.systemPrompt).toContain('learner profile');
  });
});

describe('runAgentLoop — tasks (Phase 8)', () => {
  it('persists the task lifecycle with a real id', async () => {
    const tasks = new Map<string, Task>();
    const taskStore: TaskStore = {
      async create(task) {
        tasks.set(task.id, task);
      },
      async update(id, patch) {
        const existing = tasks.get(id);
        if (existing) tasks.set(id, { ...existing, ...patch });
      },
      async get(id) {
        return tasks.get(id);
      },
      async listByConversation(conversationId) {
        return [...tasks.values()].filter((task) => task.conversationId === conversationId);
      },
    };
    const runtime = new FakeRuntime([
      [{ type: 'text.delta', text: 'hi' }, { type: 'text.complete' }],
    ]);

    const events = await collect(
      runAgentLoop(requestFor('explain pedagogy'), {
        runtime,
        tools: new InMemoryToolRegistry([recordingTool('generate_item', 'item.generate').tool]),
        policy: defaultPermissionPolicy,
        taskStore,
      }),
    );

    const started = events.find((event) => event.type === 'task.started') as
      | { taskId: string }
      | undefined;
    expect(started).toBeDefined();
    const taskId = started!.taskId;
    expect(taskId).toBeTruthy();

    const persisted = await taskStore.get(taskId);
    expect(persisted?.state).toBe('completed');
    expect(events.some((event) => event.type === 'task.completed')).toBe(true);
  });
});
