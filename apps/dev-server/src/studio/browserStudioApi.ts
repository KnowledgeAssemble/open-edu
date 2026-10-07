import type { LoadedPackage } from '@open-edu/core';
import { loadPackageFromFiles } from '@open-edu/core/browser';
import type { DistributionManifest } from '@open-edu/schemas';
import { OepReader, OepWriter } from '@open-edu/oep-distribution';
import {
  OpfsQuotaError,
  OpfsUnsupportedError,
  WorkspaceNotFoundError,
  WorkspaceUnavailableError,
  getOpfsRoot,
  type CourseWorkspace,
  walkWorkspace,
} from '@open-edu/storage';
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
import { getFileCategory } from './packageFileCategory.js';
import {
  createBrowserCourseStore,
  buildFileIndex,
  type BrowserCourse,
  type BrowserCourseStore,
  type BrowserCourseSummary,
} from './browserCourseStore.js';
import { assertSafeCoursePath, sortCourseFiles, type StudioFile } from './courseFiles.js';
import { getTemplateById } from './templates/catalog.js';
import { activitiesFromEntryOrder, buildLinearWorkflow } from './outlineModel.js';
import type { LibraryEntry } from './library/types.js';
import { createBrowserAiGateway, type BrowserAiGateway } from './browserAiGateway.js';
import { applyChangeSet } from './ai/applyChangeSet.js';
import { createChangeSet, type WorkspaceChange } from '@open-edu/storage';
import type {
  CourseDraftResult,
  AiItemAddResult,
  AiItemEditResult,
  DraftItem,
} from './ai/types.js';

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();

export class BrowserStudioApiError extends Error implements StudioApiError {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BrowserStudioApiError';
    this.code = code;
  }
}

export interface BrowserStudioSession {
  activeCourseId: string | null;
  setActiveCourse(id: string | null): void;
}

export interface BrowserStudioApiOptions {
  store?: BrowserCourseStore;
  session?: BrowserStudioSession;
  onPackageChanged?: () => void;
  aiClient?: BrowserAiGateway;
}

export function createBrowserStudioSession(): BrowserStudioSession {
  let activeCourseId: string | null = null;
  return {
    get activeCourseId() {
      return activeCourseId;
    },
    setActiveCourse(id: string | null) {
      activeCourseId = id;
    },
  };
}

function makeUnsupported(method: string): never {
  throw new BrowserStudioApiError(
    'unsupported-in-browser',
    `${method} is not supported in browser mode yet`,
  );
}

function makeSourceFromFiles(files: StudioFile[]): {
  get(path: string): Uint8Array | undefined;
  list(prefix?: string): string[];
} {
  const index = buildFileIndex(files);
  const keys = Array.from(index.keys()).sort();
  return {
    get: (path) => index.get(path),
    list: (prefix) => (prefix ? keys.filter((p) => p.startsWith(prefix)) : keys),
  };
}

function summaryFromCourse(course: BrowserCourse): CourseSummary {
  return {
    id: course.id,
    title: course.title,
    version: course.version,
    updatedAt: course.updatedAt,
    fileCount: course.files.length,
  };
}

function summaryToLibraryEntry(summary: BrowserCourseSummary): LibraryEntry {
  return {
    id: summary.id,
    title: summary.title,
    kind: 'course',
    relativePath: summary.id,
    version: summary.version,
    updatedAt: summary.updatedAt,
  };
}

async function nextAvailableImportId(store: BrowserCourseStore, baseId: string): Promise<string> {
  let candidate = baseId;
  let suffix = 0;
  while (await store.get(candidate)) {
    suffix += 1;
    candidate = `${baseId}-imported${suffix === 1 ? '' : `-${suffix}`}`;
  }
  return candidate;
}

function updateManifestId(files: StudioFile[], id: string): StudioFile[] {
  const manifestIndex = files.findIndex((file) => file.path === 'package.json');
  if (manifestIndex === -1) return files;
  const manifest = JSON.parse(TEXT_DECODER.decode(files[manifestIndex]!.data)) as Record<
    string,
    unknown
  >;
  return files.map((file, index) =>
    index === manifestIndex
      ? { ...file, data: TEXT_ENCODER.encode(JSON.stringify({ ...manifest, id }, null, 2)) }
      : file,
  );
}

export function createBrowserStudioApi(options: BrowserStudioApiOptions = {}): StudioApi {
  const store = options.store ?? createBrowserCourseStore();
  const session = options.session ?? createBrowserStudioSession();
  const onPackageChanged = options.onPackageChanged ?? (() => {});
  const aiClient = options.aiClient ?? createBrowserAiGateway();

  async function requireActiveCourse(): Promise<BrowserCourse> {
    if (!session.activeCourseId) {
      throw new BrowserStudioApiError('no-active-course', 'No course is open');
    }
    const course = await store.get(session.activeCourseId);
    if (!course) {
      throw new BrowserStudioApiError(
        'course-not-found',
        `Course ${session.activeCourseId} not found`,
      );
    }
    return course;
  }

  async function requireActiveWorkspace(): Promise<CourseWorkspace> {
    if (!session.activeCourseId) {
      throw new BrowserStudioApiError('no-active-course', 'No course is open');
    }
    const ws = await store.workspaceOf?.(session.activeCourseId);
    if (!ws) {
      throw new BrowserStudioApiError(
        'course-not-found',
        `Course ${session.activeCourseId} not found`,
      );
    }
    return ws;
  }

  async function loadCurrentPackage(): Promise<LoadedPackage> {
    const course = await requireActiveCourse();
    return loadPackageFromFiles(makeSourceFromFiles(course.files), `browser://${course.id}`);
  }

  async function validate(): Promise<ValidationResult> {
    if (!session.activeCourseId) {
      return { valid: false, errors: [{ path: '', error: 'No course is open' }] };
    }
    const course = await store.get(session.activeCourseId);
    if (!course) {
      return {
        valid: false,
        errors: [{ path: '', error: `Course ${session.activeCourseId} not found` }],
      };
    }
    try {
      await loadPackageFromFiles(makeSourceFromFiles(course.files), `browser://${course.id}`);
      return { valid: true, errors: [] };
    } catch (err) {
      const e = err as { code?: string; file?: string; path?: string; message?: string };
      return {
        valid: false,
        errors: [{ path: e.file ?? e.path ?? '', error: e.message ?? String(err) }],
      };
    }
  }

  async function getOutline(): Promise<OutlineResult> {
    const ws = await requireActiveWorkspace();

    let title = '';
    let entry: string | undefined;
    try {
      const manifestRaw = await ws.readText('package.json');
      const manifest = JSON.parse(manifestRaw) as { title?: string; entry?: string };
      title = manifest.title ?? '';
      entry = typeof manifest.entry === 'string' ? manifest.entry : undefined;
    } catch {
      // no readable manifest; fall back to empty decoration
    }

    let orderedPaths: string[] = [];
    try {
      const workflowRaw = await ws.readText('workflow.json');
      const workflow = JSON.parse(workflowRaw) as { routing?: Record<string, unknown> };
      orderedPaths = Object.keys(workflow.routing ?? {});
    } catch {
      orderedPaths = [];
    }

    if (orderedPaths.length === 0) {
      let nodeFiles: string[] = [];
      try {
        const entries = await ws.list('nodes');
        nodeFiles = entries
          .filter((e) => e.kind === 'file' && /\.(md|json)$/.test(e.name))
          .map((e) => e.path)
          .sort();
      } catch {
        nodeFiles = [];
      }
      orderedPaths = nodeFiles;
      if (entry && orderedPaths.includes(entry)) {
        orderedPaths = [entry, ...orderedPaths.filter((p) => p !== entry)];
      }
    }

    const files = new Map<string, string>();
    for (const path of orderedPaths) {
      try {
        files.set(path, await ws.readText(path));
      } catch {
        // skip unreadable members
      }
    }

    return { title, activities: activitiesFromEntryOrder(orderedPaths, files) };
  }

  async function saveOutlineOrder(paths: string[]): Promise<{ success: boolean }> {
    const ws = await requireActiveWorkspace();
    let manifest: Record<string, unknown> = {};
    try {
      manifest = JSON.parse(await ws.readText('package.json')) as Record<string, unknown>;
    } catch {
      manifest = {};
    }
    const entry = paths[0] ?? (typeof manifest.entry === 'string' ? manifest.entry : '');
    const linear = buildLinearWorkflow(paths, entry);
    await ws.writeText('workflow.json', JSON.stringify({ routing: linear.routing }, null, 2));
    await ws.writeText(
      'package.json',
      JSON.stringify({ ...manifest, entry: linear.entry }, null, 2),
    );
    onPackageChanged();
    return { success: true };
  }

  async function applyTemplate(templateId: string): Promise<{ success: boolean }> {
    const template = getTemplateById(templateId);
    if (!template) {
      throw new BrowserStudioApiError('invalid-template', `Unknown template: ${templateId}`);
    }
    const files: StudioFile[] = Object.entries(template.files).map(([path, content]) => ({
      path: assertSafeCoursePath(path),
      data: TEXT_ENCODER.encode(content),
    }));
    const manifestRaw = buildFileIndex(files).get('package.json');
    let id = templateId;
    let title = template.titleKey;
    let version = '1.0.0';
    if (manifestRaw) {
      try {
        const manifest = JSON.parse(TEXT_DECODER.decode(manifestRaw)) as {
          id?: string;
          title?: string;
          version?: string;
        };
        id = manifest.id ?? id;
        title = manifest.title ?? title;
        version = manifest.version ?? version;
      } catch {
        // keep template defaults
      }
    }
    const course: BrowserCourse = {
      id,
      version,
      title,
      files,
      updatedAt: Date.now(),
      source: { kind: 'template', label: templateId },
    };
    // Replacing an existing template course keeps edits consistent; creating a
    // brand new record is the normal path.
    const existing = await store.get(id);
    if (existing) {
      await store.replace(id, course);
    } else {
      await store.create(course);
    }
    session.setActiveCourse(id);
    onPackageChanged();
    return { success: true };
  }

  async function getLibrary(): Promise<LibraryResult> {
    const summaries = await store.list();
    return {
      workspace: 'browser',
      entries: summaries.map(summaryToLibraryEntry),
    };
  }

  async function openLibraryCourse(
    relativePath: string,
  ): Promise<{ success: boolean; packageDir: string }> {
    const course = await store.get(relativePath);
    if (!course) {
      throw new BrowserStudioApiError('course-not-found', `Course ${relativePath} not found`);
    }
    session.setActiveCourse(course.id);
    onPackageChanged();
    return { success: true, packageDir: `browser://${course.id}` };
  }

  async function duplicateCourse(
    relativePath: string,
    newId: string,
    newTitle: string,
  ): Promise<{ success: boolean; entry: LibraryEntry }> {
    const dup = await store.duplicate(relativePath, newId, newTitle);
    return {
      success: true,
      entry: summaryToLibraryEntry({ ...summaryFromCourse(dup), fileCount: dup.files.length }),
    };
  }

  async function renameCourse(
    relativePath: string,
    newTitle: string,
  ): Promise<{ success: boolean; entry: LibraryEntry }> {
    const course = await store.get(relativePath);
    if (!course) {
      throw new BrowserStudioApiError('course-not-found', `Course ${relativePath} not found`);
    }
    const index = buildFileIndex(course.files);
    let manifest: Record<string, unknown> = {};
    const manifestRaw = index.get('package.json');
    if (manifestRaw) {
      try {
        manifest = JSON.parse(TEXT_DECODER.decode(manifestRaw)) as Record<string, unknown>;
      } catch {
        manifest = {};
      }
    }
    const nextCourse: BrowserCourse = {
      ...course,
      title: newTitle,
      files: course.files.map((f) =>
        f.path === 'package.json'
          ? {
              path: f.path,
              data: TEXT_ENCODER.encode(JSON.stringify({ ...manifest, title: newTitle }, null, 2)),
            }
          : f,
      ),
      updatedAt: Date.now(),
    };
    await store.replace(relativePath, nextCourse);
    if (session.activeCourseId === relativePath) {
      onPackageChanged();
    }
    return {
      success: true,
      entry: summaryToLibraryEntry({
        ...summaryFromCourse(nextCourse),
        fileCount: nextCourse.files.length,
      }),
    };
  }

  async function archiveCourse(
    relativePath: string,
  ): Promise<{ success: boolean; archivedPath?: string }> {
    await store.delete(relativePath);
    if (session.activeCourseId === relativePath) {
      session.setActiveCourse(null);
    }
    onPackageChanged();
    return { success: true };
  }

  async function exportOep(): Promise<ExportResult> {
    const ws = await requireActiveWorkspace();
    const files = await walkWorkspace(ws);
    const courseFiles = new Map<string, Uint8Array>();
    for (const file of sortCourseFiles(files.map((f) => ({ path: f.path, data: f.data })))) {
      courseFiles.set(file.path, new Uint8Array(file.data));
    }
    const pkg = await loadPackageFromFiles(
      makeSourceFromFiles(files.map((f) => ({ path: f.path, data: f.data }))),
      `browser://${session.activeCourseId}`,
    );
    const distManifest: DistributionManifest = {
      format: 'openedu-package',
      formatVersion: 1,
      type: 'course',
      id: pkg.manifest.id,
      version: pkg.manifest.version,
      title: pkg.manifest.title,
      checksum: { algorithm: 'sha256', value: '' },
      contentRoot: 'course/',
      signature: { status: 'unsigned' },
    };
    const result = await OepWriter.build({ manifest: distManifest, courseFiles });
    const blob = new Blob([result.bytes as unknown as ArrayBuffer], {
      type: 'application/octet-stream',
    });
    return { blob, fileName: `${pkg.manifest.id}-${pkg.manifest.version}.oep` };
  }

  async function importOep(bytes: Uint8Array): Promise<CourseSummary> {
    const reader = new OepReader();
    const extraction = await reader.read(bytes);
    if (extraction.manifest.type === 'bundle') {
      throw new BrowserStudioApiError(
        'unsupported-in-browser',
        'Importing .oep bundles is not supported in browser mode yet',
      );
    }
    const contentRoot = extraction.manifest.contentRoot || 'course/';
    const files: StudioFile[] = [];
    for (const [path, data] of Object.entries(extraction.rawEntries)) {
      if (!path.startsWith(contentRoot) || data.length === 0) continue;
      const rel = path.slice(contentRoot.length);
      if (!rel) continue;
      files.push({ path: assertSafeCoursePath(rel), data: new Uint8Array(data) });
    }
    if (files.length === 0) {
      throw new BrowserStudioApiError('invalid-archive', 'Archive contains no course files');
    }

    const originalId = extraction.manifest.id;
    const id = await nextAvailableImportId(store, originalId);
    const title = extraction.manifest.title;
    const version = extraction.manifest.version;
    const importedFiles = id === originalId ? files : updateManifestId(files, id);
    const course: BrowserCourse = {
      id,
      version,
      title,
      files: importedFiles,
      updatedAt: Date.now(),
      source: { kind: 'oep-import', label: `${id}-${version}.oep` },
    };

    // Validate the complete file set before persisting anything.
    try {
      await loadPackageFromFiles(makeSourceFromFiles(importedFiles), `browser://${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BrowserStudioApiError('invalid-package', `Imported course is invalid: ${message}`);
    }

    await store.create(course);
    session.setActiveCourse(id);
    onPackageChanged();
    return summaryFromCourse(course);
  }

  async function readFile(path: string): Promise<{ path: string; content: string }> {
    const ws = await requireActiveWorkspace();
    try {
      const content = await ws.readText(path);
      return { path, content };
    } catch (err) {
      if (err instanceof WorkspaceNotFoundError) {
        throw new BrowserStudioApiError('file-not-found', `File not found: ${path}`);
      }
      if (err instanceof WorkspaceUnavailableError) {
        throw new BrowserStudioApiError(
          err instanceof OpfsQuotaError ? 'quota-exceeded' : 'storage-unavailable',
          err.message,
        );
      }
      throw new BrowserStudioApiError(
        'binary-file',
        `File is binary and cannot be opened as text: ${path}`,
      );
    }
  }

  async function writeFile(path: string, content: string): Promise<{ success: boolean }> {
    const safePath = assertSafeCoursePath(path);
    const ws = await requireActiveWorkspace();
    await ws.writeText(safePath, content);
    onPackageChanged();
    return { success: true };
  }

  async function deleteFile(path: string): Promise<{ success: boolean; path: string }> {
    const safePath = assertSafeCoursePath(path);
    const ws = await requireActiveWorkspace();
    if (!(await ws.exists(safePath))) {
      throw new BrowserStudioApiError('file-not-found', `File not found: ${path}`);
    }
    await ws.delete(safePath);
    onPackageChanged();
    return { success: true, path: safePath };
  }

  async function listFiles(): Promise<PackageFileEntry[]> {
    const ws = await requireActiveWorkspace();
    const files = await walkWorkspace(ws);
    return files.map((file) => {
      const label = file.path.split('/').pop() ?? file.path;
      const dot = file.path.lastIndexOf('.');
      const extension = dot > 0 ? file.path.slice(dot) : '';
      return {
        path: file.path,
        label,
        category: getFileCategory(file.path),
        extension,
      };
    });
  }

  async function createFile(
    path: string,
    content?: string,
  ): Promise<{ success: boolean; path: string }> {
    const safePath = assertSafeCoursePath(path);
    const ws = await requireActiveWorkspace();
    await ws.writeText(safePath, content ?? '');
    onPackageChanged();
    return { success: true, path: safePath };
  }

  async function renameFile(
    oldPath: string,
    newPath: string,
  ): Promise<{ success: boolean; oldPath: string; newPath: string }> {
    const from = assertSafeCoursePath(oldPath);
    const to = assertSafeCoursePath(newPath);
    const ws = await requireActiveWorkspace();
    await ws.move(from, to);
    onPackageChanged();
    return { success: true, oldPath: from, newPath: to };
  }

  async function uploadAsset(
    file: File,
    path?: string,
  ): Promise<{ success: boolean; path: string }> {
    const data = file.arrayBuffer ? await file.arrayBuffer() : await new Blob([file]).arrayBuffer();
    const buf = new Uint8Array(data);
    const dest = path ?? `assets/${file.name}`;
    const safeDest = assertSafeCoursePath(dest);
    const ws = await requireActiveWorkspace();
    await ws.write(safeDest, buf);
    onPackageChanged();
    return { success: true, path: safeDest };
  }

  async function getPreviewPackage(): Promise<LoadedPackage | null> {
    if (!session.activeCourseId) return null;
    try {
      return await loadCurrentPackage();
    } catch {
      return null;
    }
  }

  async function getStorageStatus(): Promise<StorageStatus> {
    try {
      await getOpfsRoot();
      return { available: true };
    } catch (err) {
      if (err instanceof OpfsUnsupportedError) {
        return { available: false, reason: 'unsupported' };
      }
      if (err instanceof OpfsQuotaError) {
        return { available: false, reason: 'quota-exceeded' };
      }
      return { available: false, reason: 'storage-unavailable' };
    }
  }

  function toCourseDraftResult(
    id: string,
    hasFiles: boolean,
    title: string | undefined,
    outlinePreview: Array<{ title: string; kind: string }>,
    quality: Array<{ id: string; labelKey: string; passed: boolean; detail?: string }>,
  ): CourseDraftResult {
    return {
      success: hasFiles,
      title,
      outlinePreview,
      quality,
      draftId: hasFiles ? id : '',
      error: hasFiles ? undefined : 'Could not generate a course draft.',
      code: hasFiles ? undefined : 'compile',
    };
  }

  async function generateAndPersistDraft(input: {
    notes?: string;
    spec?: string;
    specExt?: '.json' | '.md';
  }): Promise<CourseDraftResult> {
    if (!session.activeCourseId) {
      throw new BrowserStudioApiError('no-active-course', 'No course is open');
    }
    try {
      const response = await aiClient.generateDraft(input, session.activeCourseId);
      return toCourseDraftResult(
        response.draftId,
        response.files.length > 0,
        response.title,
        response.outlinePreview,
        response.quality,
      );
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'llm';
      return {
        success: false,
        title: undefined,
        outlinePreview: [],
        quality: [],
        draftId: '',
        error: err instanceof Error ? err.message : 'Could not generate a draft.',
        code: code === 'provider-error' ? 'llm' : 'compile',
      };
    }
  }

  async function commitLocalDraft(
    draftId: string,
    force?: boolean,
  ): Promise<{ success: boolean; title?: string; error?: string }> {
    void force;
    if (!session.activeCourseId) {
      return { success: false, error: 'No course is open' };
    }
    const draft = await aiClient.getDraft(draftId);
    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }
    const ws = await requireActiveWorkspace();
    const changes: WorkspaceChange[] = draft.files.map((f) => ({
      path: f.path,
      operation: 'create',
      newContent: new Uint8Array(f.data),
    }));
    const changeSet = createChangeSet('ai', `Apply AI draft "${draft.title}"`, changes);
    const result = await applyChangeSet(changeSet, ws);
    if (!result.success) {
      return { success: false, error: result.error ?? 'Could not apply draft.' };
    }
    await aiClient.discardDraft(draftId);
    onPackageChanged();
    return { success: true, title: draft.title };
  }

  /** Existing activity titles from the active course, used as LLM context so the
   *  gateway can draft items that fit the course outline. Returns undefined when
   *  no course is open or the outline cannot be read. */
  async function readActiveCourseTitles(): Promise<string[] | undefined> {
    if (!session.activeCourseId) return undefined;
    try {
      const outline = await getOutline();
      const titles = outline.activities.map((a) => a.title).filter((t) => t.length > 0);
      return titles.length > 0 ? titles : undefined;
    } catch {
      return undefined;
    }
  }

  return {
    getPackageDir: async () => `browser://${session.activeCourseId ?? 'no-course'}`,
    getWorkspace: () => requireActiveWorkspace(),
    validate,
    getOutline,
    saveOutlineOrder,
    applyTemplate,
    getLibrary,
    openLibraryCourse,
    duplicateCourse,
    renameCourse,
    archiveCourse,
    exportOep,
    importOep,
    readFile,
    writeFile,
    deleteFile,
    listFiles,
    createFile,
    renameFile,
    uploadAsset,
    getPreviewPackage,
    getStorageStatus,
    getAiStatus: () => aiClient.getStatus(),
    generateFromNotes: (notes: string) => generateAndPersistDraft({ notes }),
    uploadSpec: (spec: string, specExt: '.json' | '.md') =>
      generateAndPersistDraft({ spec, specExt }),
    generateCourseDraft: (notes: string) => generateAndPersistDraft({ notes }),
    uploadSpecDraft: (spec: string, specExt: '.json' | '.md') =>
      generateAndPersistDraft({ spec, specExt }),
    commitCourseDraft: (draftId: string, force?: boolean) => commitLocalDraft(draftId, force),
    discardCourseDraft: async (draftId: string) => {
      await aiClient.discardDraft(draftId);
      return { success: true };
    },
    generateItemAdd: async (kind, description): Promise<AiItemAddResult> => {
      const existingTitles = await readActiveCourseTitles();
      const result = await aiClient.generateItem({
        kind,
        description,
        ...(existingTitles ? { existingTitles } : {}),
      });
      const item = (result as { item?: unknown }).item;
      if (item) {
        return { ok: true, item: item as DraftItem };
      }
      return { ok: false, code: 'item-retry-failed', error: 'Item generation failed.' };
    },
    generateItemEdit: async (kind, intent, currentContent, params): Promise<AiItemEditResult> => {
      const existingTitles = await readActiveCourseTitles();
      const result = await aiClient.generateItem({
        kind,
        intent,
        currentContent,
        ...(params ? { params } : {}),
        ...(existingTitles ? { existingTitles } : {}),
      });
      const items = (result as { items?: unknown }).items;
      if (Array.isArray(items)) {
        return { ok: true, items: items as DraftItem[] };
      }
      return { ok: false, code: 'item-retry-failed', error: 'Item generation failed.' };
    },
    importCourseFolder: async () => makeUnsupported('importCourseFolder'),
    createUnit: async () => makeUnsupported('createUnit'),
    exportUnitOep: async () => makeUnsupported('exportUnitOep'),
  };
}
