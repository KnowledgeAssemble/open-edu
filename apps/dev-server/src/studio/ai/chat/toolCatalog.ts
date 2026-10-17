import { z } from 'zod';
import type { CompanionTool, ToolContext } from '@open-edu/companion';
import type { AuthoringContext } from '@open-edu/packs';
import { draftActivity, generateCourseDraftTool } from './tools.js';
import type { ToolCallRequest, GenerateCourseRequest } from './tools.js';

/**
 * The tool input schemas describe only the fields the model should supply.
 * Server-side execution inputs (`packageDir`, `completeText`) are deliberately
 * NOT part of the schema — the agent loop injects them via the `ToolContext`
 * second argument so the model never has to (and never can) hallucinate a
 * filesystem path or provider callback.
 */
export const generateCourseInput = z.object({
  notes: z.string(),
});

export const generateItemInput = z.object({
  kind: z.enum(['lesson', 'quiz', 'practice']),
  description: z.string(),
});

export const editItemInput = z.object({
  kind: z.enum(['lesson', 'quiz', 'practice']),
  intent: z.string(),
  currentContent: z.string(),
  params: z.unknown().optional(),
});

interface GenerationToolContext extends ToolContext {
  packageDir?: string;
  completeText?: (prompt: string) => Promise<string>;
  authoring?: AuthoringContext;
}

function packageDirFrom(ctx: GenerationToolContext): string {
  return typeof ctx.packageDir === 'string' ? ctx.packageDir : '';
}

export const companionToolCatalog: CompanionTool[] = [
  {
    id: 'generate_course',
    description: 'Generate a full course draft from author notes.',
    inputSchema: generateCourseInput,
    permission: { id: 'course.generate', kind: 'propose' },
    async execute(input, ctx: GenerationToolContext) {
      const req = input as { notes: string };
      if (!ctx.completeText) {
        return { ok: false as const, error: 'Course generation is not configured' };
      }
      const result = await generateCourseDraftTool({
        notes: req.notes,
        packageDir: packageDirFrom(ctx),
        completeText: ctx.completeText,
        ...(ctx.authoring ? { authoring: ctx.authoring, locale: ctx.authoring.locale } : {}),
      } satisfies GenerateCourseRequest);
      return result.ok
        ? { ok: true as const, value: result.courseDraft }
        : { ok: false as const, error: result.error };
    },
  },
  {
    id: 'generate_item',
    description: 'Draft a new lesson, quiz, or practice item.',
    inputSchema: generateItemInput,
    permission: { id: 'item.generate', kind: 'propose' },
    async execute(input, ctx: GenerationToolContext) {
      const req = input as {
        kind: 'lesson' | 'quiz' | 'practice';
        description: string;
      };
      const result = await draftActivity({
        type: 'draft_new',
        kind: req.kind,
        description: req.description,
        packageDir: packageDirFrom(ctx),
        ...(ctx.authoring ? { authoring: ctx.authoring } : {}),
      } satisfies ToolCallRequest);
      return result.ok
        ? { ok: true as const, value: result.items }
        : { ok: false as const, error: result.error };
    },
  },
  {
    id: 'edit_item',
    description: 'Edit an existing activity (rewrite, translate, adjust difficulty, …).',
    inputSchema: editItemInput,
    permission: { id: 'item.edit', kind: 'propose' },
    async execute(input, ctx: GenerationToolContext) {
      const req = input as {
        kind: 'lesson' | 'quiz' | 'practice';
        intent: ToolCallRequest['intent'];
        currentContent: string;
        params?: ToolCallRequest['params'];
      };
      const result = await draftActivity({
        type: 'edit_existing',
        kind: req.kind,
        intent: req.intent ?? 'rewrite',
        currentContent: req.currentContent,
        params: req.params,
        packageDir: packageDirFrom(ctx),
        ...(ctx.authoring ? { authoring: ctx.authoring } : {}),
      } satisfies ToolCallRequest);
      return result.ok
        ? { ok: true as const, value: result.items }
        : { ok: false as const, error: result.error };
    },
  },
];
