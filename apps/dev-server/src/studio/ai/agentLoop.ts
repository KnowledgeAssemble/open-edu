import type {
  AgentRuntime,
  AgentRuntimeMessage,
  AgentRuntimeToolSpec,
  CompanionError,
  CompanionEvent,
  CompanionRequest,
  CourseDraftResult,
  DraftItem,
  PermissionPolicy,
  SkillResolver,
  Task,
  TaskStore,
  ToolRegistry,
} from '@open-edu/companion';
import { parseIntentFromMessage } from './chat/intent.js';
import { routeIntent, type RoutedTool } from './chat/route.js';
import { studioChatMessage } from './chat/messages.js';
import { draftActivity, generateCourseDraftTool } from './chat/tools.js';

export interface AgentLoopOptions {
  runtime: AgentRuntime;
  tools: ToolRegistry;
  policy: PermissionPolicy;
  /** Phase 7: per-request skill resolution. */
  skills?: SkillResolver;
  systemPrompt?: string;
  /** Prior conversation history (null/empty → a single turn with `request.message`). */
  messages?: AgentRuntimeMessage[];
  maxSteps?: number; // default 6
  timeoutMs?: number; // default 120_000
  now?: () => number; // test seam
  signal?: AbortSignal;
  /** Execution-path inputs for the deterministic generation tools. */
  packageDir?: string;
  completeText?: (prompt: string) => Promise<string>;
  /** Phase 8: persistent task record (default: a no-op store). */
  taskStore?: TaskStore;
}

const noopTaskStore: TaskStore = {
  async create(): Promise<void> {},
  async update(): Promise<void> {},
  async get() {
    return undefined;
  },
  async listByConversation() {
    return [];
  },
};

let taskSequence = 0;
function createTaskId(): string {
  taskSequence += 1;
  return `task-${Date.now()}-${taskSequence}`;
}

function taskKindFor(route: RoutedTool): Task['kind'] {
  switch (route.tool) {
    case 'generate_course':
      return 'generate_course';
    case 'generate_item':
      return 'generate_item';
    case 'edit_item':
      return 'edit_item';
    case 'explain':
      return 'explain';
  }
}

function errorEvent(code: CompanionError['code'], message: string): CompanionEvent {
  return { type: 'error', error: { code, message } };
}

interface DeterministicContext {
  route: RoutedTool;
  request: CompanionRequest;
  options: AgentLoopOptions;
  taskId: string;
  taskStore: TaskStore;
}

const msg = (key: string, locale: string, params?: Record<string, string>): string =>
  studioChatMessage(key, locale, params);

/**
 * Controlled multi-step agent loop (spec §9). Hard bounds: `maxSteps`,
 * `timeoutMs`, cancellation, permission checks, output validation, and approval
 * gating — every bound short-circuits to an explicit `error`/`approval.required`
 * event. Deterministic intents run the existing generation tools single-step
 * (identical output to the Phase 2 handler); anything else runs a bounded
 * model-driven loop via `AgentRuntime`. The loop never imports the AI SDK and
 * never mutates course files itself (tools produce drafts/ChangeSets).
 */
export async function* runAgentLoop(
  request: CompanionRequest,
  options: AgentLoopOptions,
): AsyncGenerator<CompanionEvent> {
  const maxSteps = options.maxSteps ?? 6;
  const deadline = (options.now?.() ?? Date.now()) + (options.timeoutMs ?? 120_000);
  const signal = options.signal;
  const store = options.taskStore ?? noopTaskStore;
  const taskId = createTaskId();

  // 1–2. Assemble context + resolve skills. `request.context` is already a
  // validated StudioContextSnapshot (INV-007).
  const skills = options.skills?.resolve(request.context) ?? [];

  // 3–4. Resolve permissions + determine intent.
  const route = routeIntent(parseIntentFromMessage(request.message), request.context);

  // Phase 8: open a task record and emit task.started with a real id.
  const initialKind = taskKindFor(route);
  await store.create({
    id: taskId,
    conversationId: request.conversationId,
    state: 'started',
    kind: initialKind,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  yield { type: 'task.started', taskId };

  // 5. Deterministic single-step path (preserves Phase 2 behavior exactly).
  if (route.tool !== 'explain') {
    yield* runDeterministicTool({ route, request, options, taskId, taskStore: store });
    return;
  }

  // Model-driven, bounded loop (spec §9 diagram). Seed with the full
  // conversation history when provided so the model retains multi-turn context;
  // otherwise fall back to a single user turn.
  const messages: AgentRuntimeMessage[] =
    options.messages && options.messages.length > 0
      ? [...options.messages]
      : [{ role: 'user', content: request.message }];
  const toolSpecs: AgentRuntimeToolSpec[] = options.tools
    .list()
    .filter((tool) => options.policy.check(tool, request.permissions))
    .filter(
      (tool) =>
        skills.length === 0 ||
        skills.some((skill) => !skill.tools || skill.tools!.includes(tool.id)),
    )
    .map((tool) => ({
      name: tool.id,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  const skillInstructions = skills
    .map((skill) => skill.instructions)
    .filter((instructions): instructions is string => Boolean(instructions))
    .join('\n\n');
  const effectiveSystemPrompt = [options.systemPrompt ?? '', skillInstructions]
    .filter((part) => part.length > 0)
    .join('\n\n');

  let sawModelTool = false;
  let reachedStepBound = false;
  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) {
      await store.update(taskId, { state: 'cancelled', error: 'Cancelled' });
      yield errorEvent('cancelled', 'Cancelled');
      return;
    }
    if ((options.now?.() ?? Date.now()) > deadline) {
      await store.update(taskId, { state: 'failed', error: 'Timed out' });
      yield errorEvent('runtime-error', 'Timed out');
      return;
    }

    await store.update(taskId, { state: 'running' });

    // Invoke the model (this surfaces synchronous provider failures on the very
    // next generator step) before reporting the step, so callers can prime the
    // sync-throw window without iterating the model stream.
    const iterable = options.runtime.run({
      messages,
      systemPrompt: effectiveSystemPrompt,
      tools: toolSpecs,
      signal,
    });
    yield { type: 'task.progress', taskId, message: `step ${step + 1}` };

    let calledTool = false;
    for await (const event of iterable) {
      if (event.type === 'tool.call') {
        calledTool = true;
        sawModelTool = true;
        yield { type: 'tool.started', toolCallId: event.toolCallId, tool: event.tool };
        const tool = options.tools.get(event.tool);
        if (!tool || !options.policy.check(tool, request.permissions)) {
          await store.update(taskId, {
            state: 'failed',
            error: `Tool ${event.tool} is not permitted`,
          });
          yield errorEvent('permission-denied', `Tool ${event.tool} is not permitted`);
          return;
        }
        const parsed = tool.inputSchema.safeParse(event.input);
        if (!parsed.success) {
          await store.update(taskId, { state: 'failed', error: 'Invalid tool input' });
          yield errorEvent('validation-failed', 'Invalid tool input');
          return;
        }
        if (options.policy.requiresApproval(tool.permission, request.permissions)) {
          await store.update(taskId, { state: 'waiting-for-approval' });
          yield {
            type: 'approval.required',
            approval: {
              id: event.toolCallId,
              changeSetId: '',
              kind: tool.permission.kind === 'destructive' ? 'destructive' : 'commit',
              summary: tool.id,
              requestedAt: Date.now(),
            },
          };
          return; // no commit executes without approval (INV-003, INV-010)
        }
        const result = await tool.execute(parsed.data, {
          signal: signal ?? undefined,
          // Server-side execution inputs: the model only supplies the
          // activity/course description, never the filesystem path or the
          // provider callback (the input schemas intentionally omit them).
          packageDir: options.packageDir ?? '',
          completeText: options.completeText,
        });
        yield { type: 'tool.completed', toolCallId: event.toolCallId, result };
        if (result.ok) {
          yield { type: 'draft.created', draft: result.value as DraftItem[] | CourseDraftResult };
        }
        messages.push({
          role: 'assistant',
          // Non-empty content keeps the provider from serializing this turn's
          // `content` as null (some OpenAI-compatible providers reject null).
          content: `Called tool ${event.tool}`,
          toolCalls: [{ toolCallId: event.toolCallId, tool: event.tool, input: parsed.data }],
        });
        messages.push({
          role: 'tool',
          toolCallId: event.toolCallId,
          content: result.ok ? JSON.stringify(result.value) : result.error,
        });
      } else if (event.type === 'text.delta') {
        yield { type: 'message.delta', text: event.text };
      } else if (event.type === 'error') {
        await store.update(taskId, { state: 'failed', error: event.error });
        yield errorEvent('runtime-error', event.error);
        return;
      }
    }
    if (!calledTool) break;
    if (step >= maxSteps - 1) reachedStepBound = true;
  }

  if (reachedStepBound) {
    yield errorEvent('runtime-error', 'Max steps reached');
  }

  // Phase 8: persist the terminal task state and emit task.completed.
  await store.update(taskId, {
    state: 'completed',
    ...(sawModelTool ? { kind: 'multi-step' as Task['kind'] } : {}),
  });
  yield { type: 'task.completed', taskId };
  yield { type: 'message.complete' };
}

/**
 * Deterministic single-step execution of the intent-routed generation tool,
 * reproducing `handler.ts`'s exact guards + messages (Phase 2 note in the plan).
 * Message metadata (draft / course_draft / explain) is reconstructed by the
 * caller from the emitted events, so the loop stays UI-agnostic.
 */
export async function* runDeterministicTool(
  ctx: DeterministicContext,
): AsyncGenerator<CompanionEvent> {
  const { route, request, options, taskId, taskStore } = ctx;
  const locale = request.context.locale || 'en';

  const completeWithoutPackage = async function* (
    messageKey: string,
  ): AsyncGenerator<CompanionEvent> {
    yield { type: 'message.delta', text: msg(messageKey, locale) };
    await taskStore.update(taskId, { state: 'completed' });
    yield { type: 'task.completed', taskId };
    yield { type: 'message.complete' };
  };

  if (route.tool === 'generate_course') {
    if (!options.packageDir) {
      yield* completeWithoutPackage('assistant.chat.needPackageDraft');
      return;
    }
    const callId = `${taskId}-tool`;
    yield { type: 'tool.started', toolCallId: callId, tool: 'generate_course' };
    const result = await generateCourseDraftTool({
      notes: route.description,
      packageDir: options.packageDir,
      completeText:
        options.completeText ?? (() => Promise.reject(new Error('completeText not injected'))),
      authoring: request.context.authoring,
      locale: request.context.authoring?.locale ?? request.context.locale,
    });
    yield { type: 'tool.completed', toolCallId: callId, result };
    if (result.ok) {
      yield { type: 'draft.created', draft: result.courseDraft };
      yield { type: 'message.delta', text: msg('assistant.chat.courseDraftReady', locale) };
    } else {
      yield {
        type: 'message.delta',
        text: msg('assistant.chat.courseDraftFailed', locale, { error: result.error }),
      };
    }
    await taskStore.update(taskId, { state: 'completed' });
    yield { type: 'task.completed', taskId };
    yield { type: 'message.complete' };
    return;
  }

  if (route.tool === 'generate_item') {
    if (!options.packageDir) {
      yield* completeWithoutPackage('assistant.chat.needPackageDraft');
      return;
    }
    const callId = `${taskId}-tool`;
    yield { type: 'tool.started', toolCallId: callId, tool: 'generate_item' };
    const result = await draftActivity({
      type: 'draft_new',
      kind: route.kind,
      description: route.description,
      packageDir: options.packageDir,
    });
    yield { type: 'tool.completed', toolCallId: callId, result };
    if (result.ok) {
      yield { type: 'draft.created', draft: result.items };
      yield {
        type: 'message.delta',
        text: msg('assistant.chat.draftReady', locale, { kind: route.kind }),
      };
    } else {
      yield {
        type: 'message.delta',
        text: msg('assistant.chat.draftFailed', locale, { error: result.error }),
      };
    }
    await taskStore.update(taskId, { state: 'completed' });
    yield { type: 'task.completed', taskId };
    yield { type: 'message.complete' };
    return;
  }

  // edit_item — routeIntent guarantees `context.activity` here.
  if (route.tool === 'edit_item') {
    if (!options.packageDir) {
      yield* completeWithoutPackage('assistant.chat.needPackageEdit');
      return;
    }
    const callId = `${taskId}-tool`;
    yield { type: 'tool.started', toolCallId: callId, tool: 'edit_item' };
    const result = await draftActivity({
      type: 'edit_existing',
      kind: route.kind,
      currentContent: route.currentContent,
      intent: route.intent,
      params: route.params,
      packageDir: options.packageDir,
    });
    yield { type: 'tool.completed', toolCallId: callId, result };
    if (result.ok) {
      yield { type: 'draft.created', draft: result.items };
      yield { type: 'message.delta', text: msg('assistant.chat.editReady', locale) };
    } else {
      yield {
        type: 'message.delta',
        text: msg('assistant.chat.editFailed', locale, { error: result.error }),
      };
    }
    await taskStore.update(taskId, { state: 'completed' });
    yield { type: 'task.completed', taskId };
    yield { type: 'message.complete' };
    return;
  }
}
