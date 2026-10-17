import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AuthoringContextSchema, type AuthoringContext } from '@open-edu/packs';
import { ContentNodeSchema, ExerciseNodeSchema } from '@open-edu/schemas';
import { detectActivityKind, titleFromMarkdown, titleFromQuizJson } from '../outlineModel.js';
import { completeWithLlm, isAiAvailable } from './studioLlm.js';
import { extractJsonObject } from './prompts/index.js';
import {
  buildLessonAddPrompt,
  buildQuizAddPrompt,
  buildPracticeAddPrompt,
  buildLessonEditPrompt,
  buildQuizEditPrompt,
  buildPracticeEditPrompt,
  renderCourseContext,
} from './prompts/index.js';
import { renderItemAuthoringSection } from './prompts/authoringContext.js';
import { parseExerciseNode, serializeExerciseNode } from '../widgets/exerciseNode.js';
import { getCuratedWidget } from '../widgets/curatedCatalog.js';
import type { ItemIntent, ItemIntentParams } from './types.js';
import type { DraftItem } from './types.js';
import type { AiItemAddResult, AiItemEditResult } from './types.js';

export type ItemKind = DraftItem['kind'];

const INTENTS_BY_KIND: Record<ItemKind, ItemIntent[]> = {
  lesson: ['rewrite', 'expand', 'fix-quality', 'difficulty', 'translate'],
  quiz: ['rewrite', 'difficulty', 'fix-quality', 'translate', 'add-questions'],
  practice: ['improve-prompt', 'difficulty', 'translate'],
};

export interface ItemValidationOptions {
  expectedOptionCount: number;
  availableActivityIds?: ReadonlySet<string>;
}

export interface ItemAddRequest {
  kind: ItemKind;
  description: string;
  packageDir: string;
  /** Existing activity titles used as prompt context. Overrides packageDir scan. */
  existingTitles?: string[];
  /** AbortSignal to cancel the LLM call on timeout or client disconnect. */
  signal?: AbortSignal;
  authoring?: AuthoringContext;
}

export interface ItemEditRequest {
  kind: ItemKind;
  intent: ItemIntent;
  currentContent: string;
  packageDir: string;
  params?: ItemIntentParams;
  /** Existing activity titles used as prompt context. Overrides packageDir scan. */
  existingTitles?: string[];
  /** AbortSignal to cancel the LLM call on timeout or client disconnect. */
  signal?: AbortSignal;
  authoring?: AuthoringContext;
}

export class ItemRequestError extends Error {
  code: 'invalid-request';
  reason: string;

  constructor(reason: string) {
    super(reason);
    this.code = 'invalid-request';
    this.reason = reason;
  }
}

function invalidRequest(reason: string): ItemRequestError {
  return new ItemRequestError(reason);
}

function countQuizOptions(currentContent: string): number {
  try {
    const parsed = JSON.parse(currentContent) as {
      options?: Array<unknown>;
    };
    if (Array.isArray(parsed.options)) return parsed.options.length;
  } catch {
    // fall through
  }
  return 0;
}

export function readCourseContext(packageDir: string): string[] {
  let orderedPaths: string[] = [];
  const workflowPath = join(packageDir, 'workflow.json');
  try {
    if (existsSync(workflowPath)) {
      const workflow = JSON.parse(readFileSync(workflowPath, 'utf-8')) as {
        routing?: Record<string, unknown>;
      };
      orderedPaths = Object.keys(workflow.routing ?? {});
    }
  } catch {
    orderedPaths = [];
  }

  if (orderedPaths.length === 0) {
    const nodesDir = join(packageDir, 'nodes');
    try {
      if (existsSync(nodesDir)) {
        orderedPaths = readdirSync(nodesDir)
          .filter((name) => name.endsWith('.md') || name.endsWith('.json'))
          .sort()
          .map((name) => `nodes/${name}`);
      }
    } catch {
      orderedPaths = [];
    }
  }

  const titles: string[] = [];
  for (const path of orderedPaths) {
    try {
      const absPath = join(packageDir, path);
      if (!existsSync(absPath)) continue;
      const content = readFileSync(absPath, 'utf-8');
      const kind = detectActivityKind(path, content);
      const title =
        kind === 'lesson'
          ? titleFromMarkdown(content)
          : kind === 'quiz'
            ? titleFromQuizJson(content)
            : (path.split('/').pop() ?? path);
      titles.push(title);
    } catch {
      // skip unreadable files
    }
  }
  return titles;
}

export function validateItemDraft(item: DraftItem, opts: ItemValidationOptions): string | null {
  if (item.kind === 'lesson') {
    if (!/^#{1,6}\s/m.test(item.content)) {
      return 'Lesson markdown must contain a # heading';
    }
    return null;
  }

  if (item.kind === 'quiz') {
    let node: unknown;
    try {
      node = JSON.parse(item.content);
    } catch {
      return 'Quiz content must be valid JSON';
    }
    const result = ContentNodeSchema.safeParse(node);
    if (!result.success) {
      return `Quiz does not match the node schema: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`;
    }
    if (result.data.type !== 'quiz') {
      return 'Quiz content must have type "quiz"';
    }
    if (result.data.options.length !== opts.expectedOptionCount) {
      return `Quiz must have exactly ${opts.expectedOptionCount} options`;
    }
    const correctCount = result.data.options.filter((option) => option.correct === true).length;
    if (correctCount !== 1) {
      return 'Quiz must have exactly one correct answer';
    }
    return null;
  }

  const node = parseExerciseNode(item.content);
  if (!node) {
    return 'Practice content must be a serialized exercise node';
  }
  if (!getCuratedWidget(node.widget)) {
    return `Widget "${node.widget}" is not in the curated catalog`;
  }
  if (opts.availableActivityIds && !opts.availableActivityIds.has(node.widget)) {
    return `Widget "${node.widget}" is not in the selected pack's available activities`;
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(item.content);
  } catch {
    return 'Practice content must be valid JSON';
  }
  const schemaResult = ExerciseNodeSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    return `Practice does not match the exercise schema: ${schemaResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`;
  }
  return null;
}

function parseOptions(options: unknown): Array<{ text: string; correct: boolean }> {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is { text: string; correct: boolean } =>
      Boolean(option && typeof option === 'object' && 'text' in option && 'correct' in option),
    )
    .map((option) => ({
      text: String(option.text),
      correct: option.correct === true,
    }));
}

export function mapToDraftItem(kind: ItemKind, parsed: Record<string, unknown>): DraftItem {
  if (kind === 'lesson') {
    return {
      kind,
      title: typeof parsed.title === 'string' ? parsed.title : 'New lesson',
      content: typeof parsed.markdown === 'string' ? parsed.markdown : '',
    };
  }

  if (kind === 'quiz') {
    const options = parseOptions(parsed.options);
    const node = {
      type: 'quiz' as const,
      question: typeof parsed.question === 'string' ? parsed.question : '',
      options: options.map((option, index) => ({
        id: String.fromCharCode(97 + index),
        text: option.text,
        correct: option.correct,
      })),
    };
    return {
      kind,
      title: typeof parsed.title === 'string' ? parsed.title : node.question,
      content: JSON.stringify(node, null, 2),
    };
  }

  const widget = typeof parsed.widget === 'string' ? parsed.widget : '';
  const title = typeof parsed.title === 'string' && parsed.title ? parsed.title : undefined;
  const config = (parsed.config as Record<string, unknown>) ?? {};
  return {
    kind,
    title: title ?? (widget || 'New practice'),
    content: serializeExerciseNode({ type: 'exercise', title, widget, config }),
  };
}

function appendValidationFeedback(prompt: string, error: string): string {
  return [
    prompt,
    '',
    `The previous draft was invalid: ${error}`,
    'Please fix it and output ONLY the corrected JSON object.',
  ].join('\n');
}

type ItemRetryFailure = { ok: false; code: 'item-retry-failed'; error: string };

function retryFailed(error: string): ItemRetryFailure {
  return { ok: false, code: 'item-retry-failed', error };
}

function parseRaw(raw: string): Record<string, unknown> {
  return extractJsonObject(raw);
}

export async function generateItemAdd(request: ItemAddRequest): Promise<AiItemAddResult> {
  if (!isAiAvailable()) {
    return { ok: false, code: 'item-retry-failed', error: 'AI is unavailable' };
  }
  const context = renderCourseContext(
    request.existingTitles ?? readCourseContext(request.packageDir),
  );
  const authoringSection = request.authoring
    ? renderItemAuthoringSection(request.authoring)
    : undefined;
  const availableActivityIds =
    request.authoring && request.authoring.availableActivities.length > 0
      ? new Set(request.authoring.availableActivities.map((a) => a.id))
      : undefined;
  const expectedOptionCount = request.kind === 'quiz' ? 4 : 1;
  const buildPrompt = () => {
    switch (request.kind) {
      case 'lesson':
        return buildLessonAddPrompt(request.description, context, authoringSection);
      case 'quiz':
        return buildQuizAddPrompt(request.description, context, authoringSection);
      case 'practice':
        return buildPracticeAddPrompt(request.description, context, authoringSection);
    }
  };

  let prompt = buildPrompt();
  let lastError = 'AI draft failed validation after retry';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await completeWithLlm(prompt, request.signal);
      const parsed = parseRaw(raw);
      const item = mapToDraftItem(request.kind, parsed);
      const validationError = validateItemDraft(item, {
        expectedOptionCount,
        availableActivityIds,
      });
      if (!validationError) {
        return { ok: true, item };
      }
      lastError = validationError;
      prompt = appendValidationFeedback(prompt, validationError);
    } catch (err) {
      return retryFailed(err instanceof Error ? err.message : String(err));
    }
  }
  return retryFailed(lastError);
}

async function generateQuizBatch(
  currentContent: string,
  context: string,
  authoringSection?: string,
  params?: ItemIntentParams,
  signal?: AbortSignal,
): Promise<AiItemEditResult> {
  const buildPrompt = () =>
    buildQuizEditPrompt('add-questions', currentContent, 4, context, params, authoringSection);

  let prompt = buildPrompt();
  let lastError = 'AI draft failed validation after retry';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await completeWithLlm(prompt, signal);
      const parsed = parseRaw(raw);
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      if (rawQuestions.length === 0) {
        throw new Error('No quiz questions were generated');
      }
      const items = rawQuestions
        .filter((question): question is Record<string, unknown> =>
          Boolean(question && typeof question === 'object'),
        )
        .map((question) => mapToDraftItem('quiz', question));
      const errors = items
        .map((item) => validateItemDraft(item, { expectedOptionCount: 4 }))
        .filter((error): error is string => Boolean(error));
      if (errors.length === 0) {
        return { ok: true, items };
      }
      lastError = errors.join('; ');
      prompt = appendValidationFeedback(prompt, lastError);
    } catch (err) {
      return retryFailed(err instanceof Error ? err.message : String(err));
    }
  }
  return retryFailed(lastError);
}

export async function generateItemEdit(request: ItemEditRequest): Promise<AiItemEditResult> {
  if (!isAiAvailable()) {
    return { ok: false, code: 'item-retry-failed', error: 'AI is unavailable' };
  }
  const allowlist = INTENTS_BY_KIND[request.kind];
  if (!allowlist.includes(request.intent)) {
    throw invalidRequest(`Unsupported intent "${request.intent}" for kind "${request.kind}"`);
  }
  const context = renderCourseContext(
    request.existingTitles ?? readCourseContext(request.packageDir),
  );
  const authoringSection = request.authoring
    ? renderItemAuthoringSection(request.authoring)
    : undefined;
  const availableActivityIds =
    request.authoring && request.authoring.availableActivities.length > 0
      ? new Set(request.authoring.availableActivities.map((a) => a.id))
      : undefined;

  if (request.kind === 'quiz' && request.intent === 'add-questions') {
    return generateQuizBatch(
      request.currentContent,
      context,
      authoringSection,
      request.params,
      request.signal,
    );
  }

  const sourceOptionCount = request.kind === 'quiz' ? countQuizOptions(request.currentContent) : 1;
  const expectedOptionCount = request.kind === 'quiz' ? sourceOptionCount : 1;

  const buildPrompt = () => {
    switch (request.kind) {
      case 'lesson':
        return buildLessonEditPrompt(
          request.intent,
          request.currentContent,
          context,
          request.params,
          authoringSection,
        );
      case 'quiz':
        return buildQuizEditPrompt(
          request.intent,
          request.currentContent,
          sourceOptionCount,
          context,
          request.params,
          authoringSection,
        );
      case 'practice':
        return buildPracticeEditPrompt(
          request.intent,
          request.currentContent,
          context,
          request.params,
          authoringSection,
        );
    }
  };

  let prompt = buildPrompt();
  let lastError = 'AI draft failed validation after retry';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await completeWithLlm(prompt, request.signal);
      const parsed = parseRaw(raw);
      const item = mapToDraftItem(request.kind, parsed);
      const validationError = validateItemDraft(item, {
        expectedOptionCount,
        availableActivityIds,
      });
      if (!validationError) {
        return { ok: true, items: [item] };
      }
      lastError = validationError;
      prompt = appendValidationFeedback(prompt, validationError);
    } catch (err) {
      return retryFailed(err instanceof Error ? err.message : String(err));
    }
  }
  return retryFailed(lastError);
}

function parseAuthoring(value: unknown): AuthoringContext | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = AuthoringContextSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest('Invalid authoring context');
  return parsed.data;
}

export function assertItemAddBody(body: unknown): {
  kind: ItemKind;
  description: string;
  existingTitles?: string[];
  authoring?: AuthoringContext;
} {
  const candidate = (body ?? {}) as {
    kind?: unknown;
    description?: unknown;
    existingTitles?: unknown;
    authoring?: unknown;
  };
  if (candidate.kind !== 'lesson' && candidate.kind !== 'quiz' && candidate.kind !== 'practice') {
    throw invalidRequest('kind must be one of lesson, quiz, practice');
  }
  if (typeof candidate.description !== 'string' || candidate.description.trim().length === 0) {
    throw invalidRequest('description must be a non-empty string');
  }
  const existingTitles = normalizeExistingTitles(candidate.existingTitles);
  const authoring = parseAuthoring(candidate.authoring);
  return {
    kind: candidate.kind,
    description: candidate.description,
    ...(existingTitles ? { existingTitles } : {}),
    ...(authoring ? { authoring } : {}),
  };
}

export function assertItemEditBody(body: unknown): {
  kind: ItemKind;
  intent: ItemIntent;
  currentContent: string;
  params?: ItemIntentParams;
  existingTitles?: string[];
  authoring?: AuthoringContext;
} {
  const candidate = (body ?? {}) as {
    kind?: unknown;
    intent?: unknown;
    currentContent?: unknown;
    params?: unknown;
    existingTitles?: unknown;
    authoring?: unknown;
  };
  if (candidate.kind !== 'lesson' && candidate.kind !== 'quiz' && candidate.kind !== 'practice') {
    throw invalidRequest('kind must be one of lesson, quiz, practice');
  }
  const allowlist = INTENTS_BY_KIND[candidate.kind];
  if (typeof candidate.intent !== 'string' || !allowlist.includes(candidate.intent as ItemIntent)) {
    throw invalidRequest(`Unsupported intent for kind "${candidate.kind}"`);
  }
  const intent = candidate.intent as ItemIntent;
  const authoring = parseAuthoring(candidate.authoring);
  if (
    typeof candidate.currentContent !== 'string' ||
    candidate.currentContent.trim().length === 0
  ) {
    throw invalidRequest('currentContent must be a non-empty string');
  }
  const params = candidate.params as ItemIntentParams | undefined;
  if (intent === 'translate') {
    if (
      !params ||
      !('targetLocale' in params) ||
      typeof params.targetLocale !== 'string' ||
      params.targetLocale.length === 0
    ) {
      throw invalidRequest('translate requires a targetLocale param');
    }
    return {
      kind: candidate.kind,
      intent,
      currentContent: candidate.currentContent,
      params,
      ...(normalizeExistingTitles(candidate.existingTitles)
        ? { existingTitles: normalizeExistingTitles(candidate.existingTitles) }
        : {}),
      ...(authoring ? { authoring } : {}),
    };
  }
  if (intent === 'difficulty') {
    if (
      !params ||
      !('direction' in params) ||
      (params.direction !== 'easier' && params.direction !== 'harder')
    ) {
      throw invalidRequest('difficulty requires a direction param of easier|harder');
    }
    return {
      kind: candidate.kind,
      intent,
      currentContent: candidate.currentContent,
      params,
      ...(normalizeExistingTitles(candidate.existingTitles)
        ? { existingTitles: normalizeExistingTitles(candidate.existingTitles) }
        : {}),
      ...(authoring ? { authoring } : {}),
    };
  }
  if (candidate.params !== undefined && candidate.params !== null) {
    throw invalidRequest(`Intent "${intent}" does not accept params`);
  }
  const result: {
    kind: ItemKind;
    intent: ItemIntent;
    currentContent: string;
    existingTitles?: string[];
    authoring?: AuthoringContext;
  } = { kind: candidate.kind, intent, currentContent: candidate.currentContent };
  const existingTitles = normalizeExistingTitles(candidate.existingTitles);
  if (existingTitles) result.existingTitles = existingTitles;
  if (authoring) result.authoring = authoring;
  return result;
}

function normalizeExistingTitles(value: unknown): string[] | undefined {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  ) {
    return value.map(String).slice(0, 100);
  }
  return undefined;
}
