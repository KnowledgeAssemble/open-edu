import { generateItemAdd, generateItemEdit, ItemRequestError } from '../itemGenerate';
import { generateCourseDraft } from '../generateCourse';
import type { DraftItem, ItemIntent, ItemIntentParams, CourseDraftResult } from '../types';
import type { AuthoringContext } from '@open-edu/packs';

export interface ToolCallRequest {
  type: 'draft_new' | 'edit_existing';
  kind: 'lesson' | 'quiz' | 'practice';
  description?: string;
  currentContent?: string;
  intent?: ItemIntent;
  params?: ItemIntentParams;
  packageDir: string;
}

export interface GenerateCourseRequest {
  notes?: string;
  spec?: string;
  specExt?: '.json' | '.md';
  packageDir: string;
  completeText: (prompt: string) => Promise<string>;
  authoring?: AuthoringContext;
  locale?: string;
}

export type ToolCallResult = { ok: true; items: DraftItem[] } | { ok: false; error: string };

export type GenerateCourseToolResult =
  | { ok: true; courseDraft: CourseDraftResult }
  | { ok: false; error: string };

/**
 * Thin wrappers around generateItemAdd / generateItemEdit for chat tool use.
 * Draft-then-commit: never writes package files.
 */
export async function draftActivity(request: ToolCallRequest): Promise<ToolCallResult> {
  try {
    if (request.type === 'draft_new') {
      const result = await generateItemAdd({
        kind: request.kind,
        description: request.description || `Create a new ${request.kind}`,
        packageDir: request.packageDir,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, items: [result.item] };
    }

    const currentContent = request.currentContent;
    if (!currentContent) {
      return { ok: false, error: 'currentContent is required for edit' };
    }

    const result = await generateItemEdit({
      kind: request.kind,
      intent: request.intent || (request.kind === 'practice' ? 'improve-prompt' : 'rewrite'),
      currentContent,
      params: request.params,
      packageDir: request.packageDir,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, items: result.items };
  } catch (err) {
    if (err instanceof ItemRequestError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Generate a full course draft from notes or a spec file.
 * Draft-then-commit: never writes package files.
 */
export async function generateCourseDraftTool(
  request: GenerateCourseRequest,
): Promise<GenerateCourseToolResult> {
  try {
    const source = request.notes
      ? {
          kind: 'notes' as const,
          notes: request.notes,
          completeText: request.completeText,
          authoring: request.authoring,
          locale: request.locale,
        }
      : {
          kind: 'spec' as const,
          spec: request.spec || '',
          extension: request.specExt || ('.json' as '.json' | '.md'),
        };

    const result = await generateCourseDraft({
      source,
      packageDir: request.packageDir,
      authoring: request.authoring,
      locale: request.locale,
    });

    if (!result.success) {
      const errorMsg =
        result.code === 'notes-too-short'
          ? 'Your notes are too short. Add more detail about what the course should cover.'
          : result.code === 'llm'
            ? `AI generation failed: ${result.error || 'Please check your LLM configuration and try again.'}`
            : result.code === 'parse'
              ? 'Could not understand the generated spec. Try rephrasing your notes.'
              : result.code === 'compile'
                ? `Course compilation had issues: ${result.error || 'Unknown error'}`
                : `Could not generate the course: ${result.error || 'Unknown error'}`;

      return { ok: false, error: errorMsg };
    }

    return { ok: true, courseDraft: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
