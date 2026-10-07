import type {
  AiEndpointErrorCode,
  AiItemAddResult,
  AiItemEditResult,
  CourseDraftResult,
  ItemIntent,
  ItemIntentParams,
} from './ai/types.js';
import type { LibraryEntry } from './library/types.js';
import type { LoadedPackage } from '@open-edu/core';
import type {
  StudioApi,
  StudioApiError,
  CourseSummary,
  ExportResult,
  LibraryResult,
  OutlineResult,
  PackageFileEntry,
  StorageStatus,
  ValidationResult,
} from './studioApi.js';
import { createStudioApiWorkspace } from './studioApiWorkspace.js';

const API_BASE = '/api/package';
const AI_BASE = '/api/studio/ai';
const LIBRARY_BASE = '/api/studio/library';

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details || `Request failed: ${res.status}`);
  }
  return data as T;
}

async function aiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${AI_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = (await res.json().catch(() => null)) as {
    error?: string;
    details?: string;
    code?: string;
  } | null;
  if (!res.ok) {
    const message = data?.error || data?.details || `Request failed: ${res.status}`;
    const error = new Error(message) as StudioApiError;
    error.code = data?.code as AiEndpointErrorCode | undefined;
    throw error;
  }
  return data as T;
}

async function libraryRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${LIBRARY_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details || `Request failed: ${res.status}`);
  }
  return data as T;
}

export function createLocalStudioApi(): StudioApi {
  const api: StudioApi = {
    getPackageDir: () => apiRequest<{ packageDir: string }>('/dir').then((d) => d.packageDir),
    getWorkspace: () => Promise.resolve(createStudioApiWorkspace(api)),
    validate: () =>
      apiRequest<ValidationResult>('/validate', {
        method: 'POST',
      }),
    getOutline: () => apiRequest<OutlineResult>('/outline'),
    saveOutlineOrder: (orderedPaths: string[]) =>
      apiRequest<{ success: boolean }>('/outline', {
        method: 'PUT',
        body: JSON.stringify({ orderedPaths }),
      }),
    applyTemplate: (templateId: string) =>
      apiRequest<{ success: boolean }>('/create-from-template', {
        method: 'POST',
        body: JSON.stringify({ templateId, force: true }),
      }),
    exportOep: () => downloadBlob(`${API_BASE}/export-oep`, 'course.oep'),
    importOep: async (): Promise<CourseSummary> => {
      throw new Error('Browser .oep import is not supported in local filesystem mode');
    },
    readFile: (path: string) =>
      apiRequest<{ path: string; content: string }>(`/file?path=${encodeURIComponent(path)}`),
    writeFile: (path: string, content: string) =>
      apiRequest<{ success: boolean }>('/file', {
        method: 'PUT',
        body: JSON.stringify({ path, content, validate: true }),
      }),
    deleteFile: (path: string) =>
      apiRequest<{ success: boolean; path: string }>(`/file?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      }),
    listFiles: () => apiRequest<{ files: PackageFileEntry[] }>('/tree').then((d) => d.files),
    createFile: (path: string, content?: string) =>
      apiRequest<{ success: boolean; path: string }>('/file', {
        method: 'POST',
        body: JSON.stringify({ path, content, validate: true }),
      }),
    renameFile: (oldPath: string, newPath: string) =>
      apiRequest<{ success: boolean; oldPath: string; newPath: string }>('/rename', {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath }),
      }),
    uploadAsset: (file: File, path?: string) => uploadAssetRequest(file, path),
    getPreviewPackage: async () => null as LoadedPackage | null,
    getStorageStatus: async (): Promise<StorageStatus> => ({ available: true }),
    getAiStatus: () =>
      aiRequest<{ available: boolean; reason?: string }>('/status', {}).then((s) => ({
        available: s.available,
        reason: s.reason as 'missing-key' | 'disabled' | undefined,
      })),
    generateFromNotes: (notes: string, force?: boolean) =>
      aiRequest<CourseDraftResult>('/generate-draft', {
        method: 'POST',
        body: JSON.stringify({ notes, force }),
      }),
    uploadSpec: (spec: string, specExt: '.json' | '.md', force?: boolean) =>
      aiRequest<CourseDraftResult>('/generate-draft', {
        method: 'POST',
        body: JSON.stringify({ spec, specExt, force }),
      }),
    generateCourseDraft: (notes: string) =>
      aiRequest<CourseDraftResult>('/generate-draft', {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    uploadSpecDraft: (spec: string, specExt: '.json' | '.md') =>
      aiRequest<CourseDraftResult>('/generate-draft', {
        method: 'POST',
        body: JSON.stringify({ spec, specExt }),
      }),
    commitCourseDraft: (draftId: string, force?: boolean) =>
      aiRequest<{ success: boolean; title?: string; error?: string }>('/commit', {
        method: 'POST',
        body: JSON.stringify({ draftId, force }),
      }),
    discardCourseDraft: (draftId: string) =>
      aiRequest<{ success: boolean }>('/discard-draft', {
        method: 'POST',
        body: JSON.stringify({ draftId }),
      }),
    generateItemAdd: (kind: 'lesson' | 'quiz' | 'practice', description: string) =>
      aiRequest<AiItemAddResult>('/item/add', {
        method: 'POST',
        body: JSON.stringify({ kind, description }),
      }),
    generateItemEdit: (
      kind: 'lesson' | 'quiz' | 'practice',
      intent: ItemIntent,
      currentContent: string,
      params?: ItemIntentParams,
    ) =>
      aiRequest<AiItemEditResult>('/item/edit', {
        method: 'POST',
        body: JSON.stringify({ kind, intent, currentContent, params }),
      }),
    getLibrary: () => libraryRequest<LibraryResult>(''),
    openLibraryCourse: (relativePath: string) =>
      libraryRequest<{ success: boolean; packageDir: string }>('/open', {
        method: 'POST',
        body: JSON.stringify({ relativePath }),
      }),
    duplicateCourse: (relativePath: string, newId: string, newTitle: string) =>
      libraryRequest<{ success: boolean; entry: LibraryEntry }>('/duplicate', {
        method: 'POST',
        body: JSON.stringify({ relativePath, newId, newTitle }),
      }),
    renameCourse: (relativePath: string, newTitle: string) =>
      libraryRequest<{ success: boolean; entry: LibraryEntry }>('/rename', {
        method: 'POST',
        body: JSON.stringify({ relativePath, newTitle }),
      }),
    archiveCourse: (relativePath: string) =>
      libraryRequest<{ success: boolean; archivedPath: string }>('/archive', {
        method: 'POST',
        body: JSON.stringify({ relativePath }),
      }),
    importCourseFolder: (sourcePath: string) =>
      libraryRequest<{ success: boolean; entry: LibraryEntry }>('/import', {
        method: 'POST',
        body: JSON.stringify({ sourcePath }),
      }),
    createUnit: (title: string, courseRelativePaths: string[]) =>
      libraryRequest<{ success: boolean; entry: LibraryEntry }>('/create-unit', {
        method: 'POST',
        body: JSON.stringify({ title, courseRelativePaths }),
      }),
    exportUnitOep: (relativePath: string) =>
      downloadBlob(`${LIBRARY_BASE}/export-unit-oep`, 'unit.oep', { relativePath }),
  };
  return api;
}

async function downloadBlob(
  url: string,
  fallbackName: string,
  body?: unknown,
): Promise<ExportResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Export failed');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob, fileName: match?.[1] || fallbackName };
}

async function uploadAssetRequest(
  file: File,
  path?: string,
): Promise<{ success: boolean; path: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (path) {
    formData.append('path', path);
  }
  const res = await fetch(`${API_BASE}/assets/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }
  return data as { success: boolean; path: string };
}
