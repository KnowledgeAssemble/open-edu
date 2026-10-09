import {
  saveStudioDraft,
  getStudioDraft,
  deleteStudioDraft,
  listStudioDraftsByCourse,
  type StoredStudioDraft,
  type StoredStudioFile,
} from '@open-edu/storage';
import type { AiStatus } from './ai/types.js';
import type { CourseDraftResult } from './ai/types.js';

/**
 * Browser-side AI transport for the single Node Studio backend. Calls only the
 * always-mounted `/api/studio/ai/*` endpoints (status, course-draft with file
 * export, item add/edit). It never sends API keys and keeps draft persistence
 * in the browser-owned studio-drafts store so commits land in the per-user OPFS
 * workspace without a filesystem-package dependency.
 */
export interface BrowserAiGateway {
  getStatus(): Promise<AiStatus>;
  generateDraft(
    input: {
      notes?: string;
      spec?: string;
      specExt?: '.json' | '.md';
      authoring?: unknown;
      locale?: string;
    },
    courseId: string,
  ): Promise<CourseDraftResult & { files: StoredStudioFile[] }>;
  listDrafts(courseId: string): Promise<StoredStudioDraft[]>;
  getDraft(draftId: string): Promise<StoredStudioDraft | undefined>;
  discardDraft(draftId: string): Promise<void>;
  generateItem(body: unknown): Promise<unknown>;
}

interface GatewayGeneratedFile {
  path: string;
  content: string;
  encoding: 'utf8' | 'base64';
}

function decodeFile(file: GatewayGeneratedFile): Uint8Array {
  if (file.encoding === 'base64') {
    const binary = atob(file.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new TextEncoder().encode(file.content);
}

async function parseEventlessJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json().catch(() => null);
}

function finalizeDraft(
  data: CourseDraftResult & { files?: GatewayGeneratedFile[] },
  courseId: string,
): Promise<StoredStudioDraft> {
  const files: StoredStudioFile[] = (data.files ?? []).map((file) => ({
    path: file.path,
    data: decodeFile(file).buffer.slice(0) as ArrayBuffer,
  }));

  const draftId = data.draftId || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const draft: StoredStudioDraft = {
    id: draftId,
    courseId,
    version: '1.0.0',
    title: data.title ?? '',
    files,
    createdAt: now,
    updatedAt: now,
  };
  return saveStudioDraft(draft).then(() => draft);
}

/** The browser Studio uses this gateway-backed AI transport by default. */
export function createBrowserAiGateway(): BrowserAiGateway {
  return {
    async getStatus() {
      try {
        const data = (await parseEventlessJson(await fetch('/api/studio/ai/status'))) as {
          available: boolean;
          reason?: string;
        } | null;
        return {
          available: Boolean(data?.available),
          reason: data?.reason as AiStatus['reason'],
        };
      } catch {
        return { available: false, reason: 'disabled' };
      }
    },

    async generateDraft(input, courseId) {
      const response = await fetch('/api/studio/ai/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, includeFiles: true }),
      });
      const data = (await parseEventlessJson(response)) as CourseDraftResult & {
        files?: GatewayGeneratedFile[];
      };
      if (data.success === false) {
        return { ...data, draftId: data.draftId || '', files: [] } as CourseDraftResult & {
          files: StoredStudioFile[];
        };
      }
      const draft = await finalizeDraft(data, courseId);
      return {
        ...data,
        draftId: data.draftId || draft.id,
        title: data.title ?? draft.title,
        files: draft.files,
      } as CourseDraftResult & { files: StoredStudioFile[] };
    },

    listDrafts: (courseId) => listStudioDraftsByCourse(courseId),
    getDraft: (draftId) => getStudioDraft(draftId),
    discardDraft: (draftId) => deleteStudioDraft(draftId),

    async generateItem(body) {
      const candidate = (body ?? {}) as { intent?: unknown };
      const isEdit = typeof candidate.intent === 'string' && candidate.intent.length > 0;
      const response = await fetch(
        isEdit ? '/api/studio/ai/item/edit' : '/api/studio/ai/item/add',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      return parseEventlessJson(response);
    },
  };
}
