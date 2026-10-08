import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  generateCourseDraft,
  deleteDraft,
  getDraftEntry,
  readDraftFiles,
  type CourseDraftSource,
} from './generateCourse.js';
import { commitCourseDraft, resolveNewCourseDir } from './commitCourseDraft.js';
import {
  assertItemAddBody,
  assertItemEditBody,
  generateItemAdd,
  generateItemEdit,
  ItemRequestError,
} from './itemGenerate.js';
import { completeWithLlm, isAiAvailable } from './studioLlm.js';
import { createStudioAssistantHandler } from './chat/handler.js';
import { AuthoringContextSchema } from '@open-edu/packs';

const STUDIO_AI_REGEXP = /^\/api\/studio\/ai\//;

export interface StudioAiMiddlewareOptions {
  /** Resolve the currently-active course directory ('' in browser mode). */
  getPackageDir: () => string;
  /** Adopt a newly committed course directory (normal mode only). */
  setPackageDir?: (dir: string) => void;
  /** Called before a commit begins so the host can suppress file-watcher reloads. */
  onCommitStart?: () => void;
  /** Invoked after a successful commit so the host can reload the package. */
  onCommitSuccess?: (packageDir: string) => void;
}

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    req.on('data', (chunk: Buffer | string) => chunks.push(chunk.toString()));
    req.on('end', () => {
      try {
        resolve(JSON.parse(chunks.join('')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * The single Studio AI request surface. Mounted in both normal mode
 * (`eduPackageLoader`) and browser mode (`localStudioAiPlugin`) behind the
 * Node Vite dev server. Handles `/api/studio/ai/*`: status, course-draft
 * generation/commit/cancel, item add/edit, and the chat loop at
 * `/api/studio/ai/chat`. Never exposes API keys to the client.
 */
export function createStudioAiMiddleware(
  options: StudioAiMiddlewareOptions,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void> {
  const { getPackageDir, setPackageDir, onCommitStart, onCommitSuccess } = options;

  return async (req, res, next) => {
    const url = req.url ?? '';
    if (!STUDIO_AI_REGEXP.test(url)) return next();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    try {
      const parsedUrl = new URL(url, `http://${req.headers.host ?? 'localhost'}`);
      const pathname = parsedUrl.pathname;
      const method = req.method ?? 'GET';
      const packageDir = getPackageDir();

      // GET /api/studio/ai/status — AI availability without leaking secrets
      if (pathname === '/api/studio/ai/status' && method === 'GET') {
        const available = isAiAvailable();
        res.end(JSON.stringify({ available, reason: available ? undefined : 'missing-key' }));
        return;
      }

      // POST /api/studio/ai/generate — notes → draft package via LLM + course-compiler,
      // or an uploaded course-spec.json / course-spec.md compiled without the LLM.
      // Draft-only: does NOT copy to packageDir. Use /api/studio/ai/commit to write.
      if (pathname === '/api/studio/ai/generate' && method === 'POST') {
        const body = (await parseJsonBody(req)) as {
          notes?: string;
          spec?: string;
          specExt?: string;
          force?: boolean;
        };
        let source: CourseDraftSource;
        if (body.notes && typeof body.notes === 'string') {
          source = { kind: 'notes', notes: body.notes, completeText: completeWithLlm };
        } else if (body.spec && typeof body.spec === 'string') {
          if (body.specExt !== '.json' && body.specExt !== '.md') {
            res.statusCode = 400;
            res.end(JSON.stringify({ code: 'spec-invalid', error: 'Unsupported spec extension' }));
            return;
          }
          source = { kind: 'spec', spec: body.spec, extension: body.specExt };
        } else {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'missing-spec', error: 'Missing spec or notes' }));
          return;
        }
        const result = await generateCourseDraft({ source, packageDir });

        // Legacy /generate endpoint — draft-only now. The legacy client
        // would have navigated to ai-review; the new flow is through the
        // Author Assistant sidebar with explicit draft-commit.
        // Inline HMR suppression is removed; drafts no longer write to disk.
        res.end(JSON.stringify(result));
        return;
      }

      // POST /api/studio/ai/generate-draft — draft-only course generation.
      // Accepts `includeFiles: true` so browser (OPFS) storage can persist the
      // compiled files and commit them to the per-user workspace locally.
      if (pathname === '/api/studio/ai/generate-draft' && method === 'POST') {
        const body = (await parseJsonBody(req)) as {
          notes?: string;
          spec?: string;
          specExt?: string;
          includeFiles?: boolean;
          authoring?: unknown;
          locale?: string;
        };
        let authoring = undefined as ReturnType<typeof AuthoringContextSchema.parse> | undefined;
        if (body.authoring !== undefined) {
          const parsedAuthoring = AuthoringContextSchema.safeParse(body.authoring);
          if (!parsedAuthoring.success) {
            res.statusCode = 400;
            res.end(JSON.stringify({ code: 'spec-invalid', error: 'Invalid authoring context' }));
            return;
          }
          authoring = parsedAuthoring.data;
        }
        let source: CourseDraftSource;
        if (body.notes && typeof body.notes === 'string') {
          source = {
            kind: 'notes',
            notes: body.notes,
            completeText: completeWithLlm,
            authoring,
            locale: body.locale,
          };
        } else if (body.spec && typeof body.spec === 'string') {
          if (body.specExt !== '.json' && body.specExt !== '.md') {
            res.statusCode = 400;
            res.end(JSON.stringify({ code: 'spec-invalid', error: 'Unsupported spec extension' }));
            return;
          }
          source = { kind: 'spec', spec: body.spec, extension: body.specExt };
        } else {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'missing-spec', error: 'Missing spec or notes' }));
          return;
        }
        const draftResult = await generateCourseDraft({
          source,
          packageDir,
          authoring,
          locale: body.locale,
          finalize: body.includeFiles === true,
        });
        if (body.includeFiles === true && draftResult.success && draftResult.draftId) {
          const files = readDraftFiles(draftResult.draftId) ?? [];
          res.end(JSON.stringify({ ...draftResult, files }));
          return;
        }
        res.end(JSON.stringify(draftResult));
        return;
      }

      // POST /api/studio/ai/commit — commit a draft to the active package, or
      // to a brand-new course directory when none is open.
      if (pathname === '/api/studio/ai/commit' && method === 'POST') {
        const body = (await parseJsonBody(req)) as {
          draftId?: string;
          force?: boolean;
        };
        if (!body.draftId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'invalid-request', error: 'Missing draftId' }));
          return;
        }
        // Without an active package, commit into a fresh course directory so
        // the AI can create a brand-new course from scratch.
        const isNewCourse = !packageDir;
        let targetDir = packageDir;
        if (isNewCourse) {
          const workspaceRoot =
            process.env.OPEN_EDU_STUDIO_WORKSPACE || join(process.cwd(), 'courses');
          const draftTitle = getDraftEntry(body.draftId)?.title;
          targetDir = resolveNewCourseDir(workspaceRoot, draftTitle);
          await mkdir(targetDir, { recursive: true });
        }
        onCommitStart?.();
        const commitResult = await commitCourseDraft({
          draftId: body.draftId,
          packageDir: targetDir,
          force: body.force === true,
        });

        if (commitResult.success) {
          if (isNewCourse && setPackageDir) {
            setPackageDir(targetDir);
          }
          onCommitSuccess?.(targetDir);
        }

        res.end(JSON.stringify(commitResult));
        return;
      }

      // POST /api/studio/ai/discard-draft — drop a temp course draft without writing
      if (pathname === '/api/studio/ai/discard-draft' && method === 'POST') {
        const body = (await parseJsonBody(req)) as { draftId?: string };
        if (!body.draftId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'invalid-request', error: 'Missing draftId' }));
          return;
        }
        deleteDraft(body.draftId);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /api/studio/ai/item/add — draft a single new lesson/quiz/practice item.
      // Draft-then-commit: the server never writes to packageDir; the client's
      // Accept goes through the normal writeFile + saveOutlineOrder path.
      if (pathname === '/api/studio/ai/item/add' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { kind, description, existingTitles } = assertItemAddBody(body);
        if (!packageDir && !existingTitles) {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'no-active-package', error: 'No active package' }));
          return;
        }
        if (!isAiAvailable()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'ai-unavailable', error: 'AI is unavailable' }));
          return;
        }
        const result = await generateItemAdd({ kind, description, packageDir, existingTitles });
        res.end(JSON.stringify(result));
        return;
      }

      // POST /api/studio/ai/item/edit — draft a revised item (or a batch of new
      // quizzes for add-questions). Never writes to packageDir.
      if (pathname === '/api/studio/ai/item/edit' && method === 'POST') {
        if (!isAiAvailable()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'ai-unavailable', error: 'AI is unavailable' }));
          return;
        }
        const body = await parseJsonBody(req);
        const { kind, intent, currentContent, params, existingTitles } = assertItemEditBody(body);
        if (!packageDir && !existingTitles) {
          res.statusCode = 400;
          res.end(JSON.stringify({ code: 'no-active-package', error: 'No active package' }));
          return;
        }
        const result = await generateItemEdit({
          kind,
          intent,
          currentContent,
          params,
          packageDir,
          existingTitles,
        });
        res.end(JSON.stringify(result));
        return;
      }

      // POST /api/studio/ai/chat — Author Assistant chat (explain + item drafts)
      // Streams an SSE UI message stream (see `createStudioAssistantHandler`).
      if (pathname === '/api/studio/ai/chat' && method === 'POST') {
        if (!isAiAvailable()) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'ai-unavailable' }));
          return;
        }
        await createStudioAssistantHandler(req, res, { packageDir });
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ code: 'unknown-ai-endpoint', error: 'Unknown AI endpoint' }));
    } catch (err) {
      if (err instanceof ItemRequestError) {
        res.statusCode = 400;
        res.end(JSON.stringify({ code: 'invalid-request', reason: err.reason }));
        return;
      }
      console.error('[edu-dev] AI API error:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ code: 'internal-error', error: 'An internal error occurred.' }));
    }
  };
}
