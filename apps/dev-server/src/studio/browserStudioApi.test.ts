import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDatabase, resetDatabase } from '@open-edu/storage';
import { createBrowserStudioApi, createBrowserStudioSession } from './browserStudioApi.js';
import type { BrowserAiGateway } from './browserAiGateway.js';
import {
  createBrowserCourseStore,
  buildFileIndex,
  type BrowserCourse,
} from './browserCourseStore.js';
import type { CourseWorkspace } from '@open-edu/storage';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const FIXTURE_DIR = resolve(__dirname, '../../../../packages/core/src/__fixtures__/browser-studio');

const enc = (s: string) => new TextEncoder().encode(s);

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function fixtureBytes(): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  async function walk(rel: string): Promise<void> {
    const full = join(FIXTURE_DIR, rel);
    const s = await stat(full);
    if (s.isDirectory()) {
      for (const entry of await readdir(full)) {
        await walk(rel ? `${rel}/${entry}` : entry);
      }
    } else {
      files.set(rel, new Uint8Array(await readFile(full)));
    }
  }
  await walk('');
  return files;
}

async function fixtureOepBytes(): Promise<Uint8Array> {
  const files = await fixtureBytes();
  const api = createBrowserApi();
  const session = api.session;
  const course: BrowserCourse = {
    id: 'browser-studio',
    version: '1.0.0',
    title: 'Browser Studio Composite',
    files: Array.from(files.entries()).map(([path, data]) => ({ path, data })),
    updatedAt: Date.now(),
  };
  await api.store.create(course);
  session.setActiveCourse('browser-studio');
  const { blob } = await api.api.exportOep();
  const bytes = new Uint8Array(await blobToBytes(blob));
  await api.store.delete('browser-studio');
  return bytes;
}

function createBrowserApi() {
  const store = createBrowserCourseStore({ nonPersistent: true });
  const session = createBrowserStudioSession();
  const api = createBrowserStudioApi({ store, session });
  return { store, session, api };
}

async function activeWorkspace(
  store: ReturnType<typeof createBrowserCourseStore>,
  id: string,
): Promise<CourseWorkspace> {
  const ws = await store.workspaceOf?.(id);
  if (!ws) throw new Error('workspace missing');
  return ws;
}

describe('BrowserStudioApi', () => {
  beforeEach(async () => {
    resetDatabase();
    const db = await openDatabase();
    await db.clear('studio-courses');
    db.close();
    resetDatabase();
  });

  it('creates a template course from the shared catalog', async () => {
    const { store, session, api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    expect(session.activeCourseId).toBe('lesson-quiz');
    const course = await store.get('lesson-quiz');
    expect(course).not.toBeNull();
    const index = buildFileIndex(course!.files);
    expect(index.has('package.json')).toBe(true);
    expect(index.has('nodes/lesson.md')).toBe(true);
    expect(index.has('nodes/quiz.json')).toBe(true);
    expect(course!.title).toBe('Lesson and Quiz');
    const pkg = JSON.parse(new TextDecoder().decode(index.get('package.json')!)) as {
      id?: string;
    };
    expect(pkg.id).toBe('lesson-quiz');
  });

  it('lists and opens library courses by browser id', async () => {
    const { session, api } = createBrowserApi();
    await api.applyTemplate('reading-lesson');
    await api.openLibraryCourse('reading-lesson');

    const library = await api.getLibrary();
    expect(library.workspace).toBe('browser');
    expect(library.entries.map((e) => e.id)).toContain('reading-lesson');
    expect(library.entries[0]!.relativePath).toBe('reading-lesson');
    expect(library.entries[0]!.kind).toBe('course');

    const opened = await api.openLibraryCourse('reading-lesson');
    expect(opened.success).toBe(true);
    expect(opened.packageDir).toBe('browser://reading-lesson');
    expect(session.activeCourseId).toBe('reading-lesson');
  });

  it('reports the stable browser package directory identifier', async () => {
    const { api } = createBrowserApi();
    expect(await api.getPackageDir()).toBe('browser://no-course');
  });

  it('reads, writes, and deletes files through the workspace', async () => {
    const { store, session, api } = createBrowserApi();
    await api.applyTemplate('reading-lesson');
    await api.openLibraryCourse('reading-lesson');

    const original = await api.readFile('nodes/lesson.md');
    expect(original.content).toContain('# Reading Lesson');

    const ws = await activeWorkspace(store, 'reading-lesson');
    const writeSpy = vi.spyOn(ws, 'writeText');
    const readSpy = vi.spyOn(ws, 'readText');

    await api.writeFile('nodes/lesson.md', '# Updated Lesson\n\nNew content.');
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledWith('nodes/lesson.md', '# Updated Lesson\n\nNew content.');
    const updated = await api.readFile('nodes/lesson.md');
    expect(updated.content).toContain('# Updated Lesson');

    await api.writeFile('notes.txt', 'A new unknown file');
    const afterWrite = buildFileIndex((await store.get('reading-lesson'))!.files);
    expect(new TextDecoder().decode(afterWrite.get('notes.txt'))).toBe('A new unknown file');

    readSpy.mockClear();
    const del = await api.deleteFile('notes.txt');
    expect(del.success).toBe(true);
    const afterDelete = buildFileIndex((await store.get('reading-lesson'))!.files);
    expect(afterDelete.has('notes.txt')).toBe(false);
    expect(session.activeCourseId).toBe('reading-lesson');
  });

  it('delegates single-file writes without touching unrelated files', async () => {
    const { store, api } = createBrowserApi();
    await api.applyTemplate('reading-lesson');
    await api.openLibraryCourse('reading-lesson');
    const ws = await activeWorkspace(store, 'reading-lesson');
    const readSpy = vi.spyOn(ws, 'read');
    await api.writeFile('nodes/quiz.json', '{"type":"quiz"}');
    expect(readSpy).not.toHaveBeenCalled();
    expect(
      new TextDecoder().decode(
        buildFileIndex((await store.get('reading-lesson'))!.files).get('nodes/quiz.json'),
      ),
    ).toBe('{"type":"quiz"}');
  });

  it('derives the outline reading only manifest, workflow, and outline members', async () => {
    const { store, api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    await api.openLibraryCourse('lesson-quiz');
    const ws = await activeWorkspace(store, 'lesson-quiz');
    const readSpy = vi.spyOn(ws, 'readText');

    const outline = await api.getOutline();
    expect(outline.title).toBe('Lesson and Quiz');
    expect(outline.activities.map((a) => a.path)).toEqual(['nodes/lesson.md', 'nodes/quiz.json']);
    expect(outline.activities[1]!.kind).toBe('quiz');

    const readPaths = readSpy.mock.calls.map((c) => c[0]);
    expect(readPaths).toContain('package.json');
    expect(readPaths).toContain('workflow.json');
    expect(readPaths.every((p) => !p.startsWith('assets/'))).toBe(true);
    expect(readPaths.every((p) => !p.startsWith('.openu'))).toBe(true);
  });

  it('rejects reading binary files as text', async () => {
    const { store, session, api } = createBrowserApi();
    await api.applyTemplate('reading-lesson');
    await api.openLibraryCourse('reading-lesson');
    await api.writeFile('assets/pic.png', 'placeholder');
    // Fetch the post-write file set, then replace the bytes with real binary.
    const afterWrite = (await store.get('reading-lesson'))!;
    const png = new Uint8Array([137, 80, 78, 71, 0, 1, 2]);
    await store.replace('reading-lesson', {
      ...afterWrite,
      files: afterWrite.files.map((f) =>
        f.path === 'assets/pic.png' ? { path: f.path, data: png } : f,
      ),
    });
    session.setActiveCourse('reading-lesson');
    await expect(api.readFile('assets/pic.png')).rejects.toMatchObject({ code: 'binary-file' });
  });

  it('validates packages through the shared loader', async () => {
    const { store, session, api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    await api.openLibraryCourse('lesson-quiz');
    expect(await api.validate()).toEqual({ valid: true, errors: [] });

    // Break the manifest: entry node missing.
    const course = (await store.get('lesson-quiz'))!;
    const index = buildFileIndex(course.files);
    const manifest = JSON.parse(new TextDecoder().decode(index.get('package.json')!)) as {
      entry?: string;
    };
    manifest.entry = 'nodes/missing.md';
    await store.replace('lesson-quiz', {
      ...course,
      files: course.files.map((f) =>
        f.path === 'package.json'
          ? { path: f.path, data: enc(JSON.stringify(manifest, null, 2)) }
          : f,
      ),
    });
    session.setActiveCourse('lesson-quiz');

    const result = await api.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.path).toBe('nodes/missing.md');
  });

  it('derives the outline from workflow routing order', async () => {
    const { api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    await api.openLibraryCourse('lesson-quiz');

    const outline = await api.getOutline();
    expect(outline.title).toBe('Lesson and Quiz');
    expect(outline.activities.map((a) => a.path)).toEqual(['nodes/lesson.md', 'nodes/quiz.json']);
    expect(outline.activities[1]!.kind).toBe('quiz');
  });

  it('persists outline reorder into manifest and workflow only', async () => {
    const { store, session, api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    await api.openLibraryCourse('lesson-quiz');
    const ws = await activeWorkspace(store, 'lesson-quiz');
    const writeSpy = vi.spyOn(ws, 'writeText');

    await api.saveOutlineOrder(['nodes/quiz.json', 'nodes/lesson.md']);
    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy.mock.calls.map((c) => c[0]).sort()).toEqual(['package.json', 'workflow.json']);
    const course = (await store.get('lesson-quiz'))!;
    const index = buildFileIndex(course.files);
    const workflow = JSON.parse(new TextDecoder().decode(index.get('workflow.json')!)) as {
      routing?: Record<string, unknown>;
    };
    expect(Object.keys(workflow.routing ?? {})).toEqual(['nodes/quiz.json', 'nodes/lesson.md']);
    const manifest = JSON.parse(new TextDecoder().decode(index.get('package.json')!)) as {
      entry?: string;
    };
    expect(manifest.entry).toBe('nodes/quiz.json');
    expect(session.activeCourseId).toBe('lesson-quiz');
  });

  it('duplicates and renames courses', async () => {
    const { api } = createBrowserApi();
    await api.applyTemplate('reading-lesson');
    const dup = await api.duplicateCourse('reading-lesson', 'reading-copy', 'Reading Copy');
    expect(dup.success).toBe(true);
    const loaded = await api.openLibraryCourse('reading-copy');
    expect(loaded.packageDir).toBe('browser://reading-copy');

    const renamed = await api.renameCourse('reading-copy', 'Reading Copy v2');
    expect(renamed.entry.title).toBe('Reading Copy v2');
  });

  it('archives (hard-deletes) without a fabricated archivedPath', async () => {
    const { store, api } = createBrowserApi();
    await api.applyTemplate('reading-lesson');
    const result = await api.archiveCourse('reading-lesson');
    expect(result.success).toBe(true);
    expect(result.archivedPath).toBeUndefined();
    expect(await store.get('reading-lesson')).toBeNull();
    await expect(api.openLibraryCourse('reading-lesson')).rejects.toMatchObject({
      code: 'course-not-found',
    });
  });

  it('round-trips .oep export and import with unknown and binary files intact', async () => {
    const api1 = createBrowserApi();
    const files = await fixtureBytes();
    const course: BrowserCourse = {
      id: 'browser-studio',
      version: '1.0.0',
      title: 'Browser Studio Composite',
      files: Array.from(files.entries()).map(([path, data]) => ({ path, data })),
      updatedAt: Date.now(),
    };
    await api1.store.create(course);
    api1.session.setActiveCourse('browser-studio');

    const { blob, fileName } = await api1.api.exportOep();
    expect(fileName).toBe('browser-studio-1.0.0.oep');
    const bytes = new Uint8Array(await blobToBytes(blob));
    await api1.store.delete('browser-studio');

    const api2 = createBrowserApi();
    const summary = await api2.api.importOep(bytes);
    expect(summary.id).toBe('browser-studio');
    expect(summary.title).toBe('Browser Studio Composite');

    const imported = await api2.store.get('browser-studio');
    expect(imported).not.toBeNull();
    const index = buildFileIndex(imported!.files);
    expect(index.has('package.json')).toBe(true);
    expect(index.has('workflow.json')).toBe(true);
    expect(index.has('rewards.json')).toBe(true);
    expect(index.has('cards.json')).toBe(true);
    expect(index.has('nodes/lesson.md')).toBe(true);
    expect(index.has('nodes/quiz.json')).toBe(true);
    expect(index.has('assets/notes.txt')).toBe(true);
    const png = await fixtureBytes();
    expect(index.get('assets/diagram.png')).toEqual(png.get('assets/diagram.png'));
    expect(new TextDecoder().decode(index.get('assets/notes.txt')!)).toContain('Unknown text file');
    expect(api2.session.activeCourseId).toBe('browser-studio');
  });

  it('imports .oep into a new course without clobbering an existing one', async () => {
    const bytes = await fixtureOepBytes();
    const api = createBrowserApi();
    await api.api.applyTemplate('reading-lesson');
    const summary = await api.api.importOep(bytes);
    expect(summary.id).toBe('browser-studio');
    expect(await api.store.get('reading-lesson')).not.toBeNull();
    expect(api.session.activeCourseId).toBe('browser-studio');
  });

  it('export excludes derived .openu data (SPEC §43)', async () => {
    const api1 = createBrowserApi();
    await api1.api.applyTemplate('reading-lesson');
    const ws = await api1.store.workspaceOf?.('reading-lesson');
    await ws!.writeText('.openu/history.json', '{"derived":true}');
    await ws!.writeText('nodes/lesson.md', '# Changed');

    const { blob } = await api1.api.exportOep();
    const bytes = new Uint8Array(await blobToBytes(blob));
    await api1.store.delete('reading-lesson');

    const api2 = createBrowserApi();
    const summary = await api2.api.importOep(bytes);
    const imported = await api2.store.get(summary.id);
    const keys = buildFileIndex(imported!.files);
    expect(Array.from(keys.keys()).some((p) => p.startsWith('.openu'))).toBe(false);
    expect(keys.has('nodes/lesson.md')).toBe(true);
    expect(new TextDecoder().decode(keys.get('nodes/lesson.md'))).toBe('# Changed');
  });

  it('assigns a new id when importing an archive whose id already exists', async () => {
    const bytes = await fixtureOepBytes();
    const api = createBrowserApi();
    await api.api.applyTemplate('reading-lesson');
    await api.api.importOep(bytes);

    const imported = await api.api.importOep(bytes);
    expect(imported.id).toBe('browser-studio-imported');
    expect(await api.store.get('browser-studio')).not.toBeNull();
    expect(await api.store.get('browser-studio-imported')).not.toBeNull();
    expect(api.session.activeCourseId).toBe('browser-studio-imported');
  });

  it('returns unsupported errors for unit/folder operations', async () => {
    const { api } = createBrowserApi();
    for (const operation of [
      () => api.importCourseFolder('/tmp/x'),
      () => api.createUnit('U', ['a', 'b']),
      () => api.exportUnitOep('units/u'),
    ]) {
      await expect(operation()).rejects.toMatchObject({ code: 'unsupported-in-browser' });
    }
  });

  it('includes active course activity titles when drafting an item', async () => {
    const store = createBrowserCourseStore({ nonPersistent: true });
    const session = createBrowserStudioSession();
    const generateItem = vi.fn().mockResolvedValue({
      item: { kind: 'lesson', title: 'Fractions', content: '# Fractions\n\nBody' },
    });
    const aiClient = { generateItem } as unknown as BrowserAiGateway;
    const api = createBrowserStudioApi({ store, session, aiClient });
    await api.applyTemplate('lesson-quiz');
    await api.openLibraryCourse('lesson-quiz');

    const result = await api.generateItemAdd('lesson', 'Explain fractions');
    expect(result.ok).toBe(true);
    expect(generateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'lesson',
        description: 'Explain fractions',
        existingTitles: ['The Water Cycle', 'The Water Cycle Check'],
      }),
    );
  });

  it('committing an AI draft touches only draft files and never replaces the course', async () => {
    const store = createBrowserCourseStore({ nonPersistent: true });
    const session = createBrowserStudioSession();
    const draft = {
      id: 'draft-1',
      courseId: 'reading-lesson',
      version: '1.0.0',
      title: 'AI Draft',
      files: [{ path: 'nodes/ai-lesson.md', data: enc('ai content').buffer }],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    const discardDraft = vi.fn().mockResolvedValue(undefined);
    const aiClient = {
      getDraft: vi.fn().mockResolvedValue(draft),
      discardDraft,
    } as unknown as BrowserAiGateway;
    const api = createBrowserStudioApi({ store, session, aiClient });
    await api.applyTemplate('reading-lesson');
    await api.openLibraryCourse('reading-lesson');

    const before = buildFileIndex((await store.get('reading-lesson'))!.files);
    expect(before.has('nodes/ai-lesson.md')).toBe(false);

    const result = await api.commitCourseDraft('draft-1');
    expect(result.success).toBe(true);
    const after = buildFileIndex((await store.get('reading-lesson'))!.files);
    expect(after.has('nodes/ai-lesson.md')).toBe(true);
    expect(new TextDecoder().decode(after.get('nodes/ai-lesson.md'))).toBe('ai content');
    // Unrelated files are untouched.
    expect(after.get('nodes/lesson.md')).toEqual(before.get('nodes/lesson.md'));
    expect(discardDraft).toHaveBeenCalledWith('draft-1');
  });

  it('rejecting an AI draft leaves the course untouched (approval is required)', async () => {
    const store = createBrowserCourseStore({ nonPersistent: true });
    const session = createBrowserStudioSession();
    const draft = {
      id: 'draft-rejected',
      courseId: 'reading-lesson',
      version: '1.0.0',
      title: 'AI Draft',
      files: [{ path: 'nodes/ai-lesson.md', data: enc('ai content').buffer }],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    const getDraft = vi.fn().mockResolvedValue(draft);
    const discardDraft = vi.fn().mockResolvedValue(undefined);
    const aiClient = { getDraft, discardDraft } as unknown as BrowserAiGateway;
    const api = createBrowserStudioApi({ store, session, aiClient });
    await api.applyTemplate('reading-lesson');
    await api.openLibraryCourse('reading-lesson');

    // Reject step: discard without committing.
    const rejected = await api.discardCourseDraft('draft-rejected');
    expect(rejected.success).toBe(true);
    expect(discardDraft).toHaveBeenCalledWith('draft-rejected');
    const after = buildFileIndex((await store.get('reading-lesson'))!.files);
    expect(after.has('nodes/ai-lesson.md')).toBe(false);
  });

  it('omits activity titles when no course is open', async () => {
    const store = createBrowserCourseStore({ nonPersistent: true });
    const session = createBrowserStudioSession();
    const generateItem = vi.fn().mockResolvedValue({
      item: { kind: 'lesson', title: 'Fractions', content: '# Fractions\n\nBody' },
    });
    const aiClient = { generateItem } as unknown as BrowserAiGateway;
    const api = createBrowserStudioApi({ store, session, aiClient });
    await session.setActiveCourse('nonexistent');

    await api.generateItemAdd('lesson', 'Explain fractions');
    expect(generateItem).toHaveBeenCalledWith(
      expect.not.objectContaining({ existingTitles: expect.anything() }),
    );
  });

  it('reports AI availability through the gateway client (unavailable without fetch)', async () => {
    const { api } = createBrowserApi();
    // Without a stubbed fetch the client reports AI as unavailable (manual
    // authoring continues to work) rather than throwing.
    const status = await api.getAiStatus();
    expect(status.available).toBe(false);
  });

  it('reports storage support via the OPFS availability probe', async () => {
    const { api } = createBrowserApi();
    // jsdom has no navigator.storage so OPFS is reported unsupported.
    const status = await api.getStorageStatus();
    expect(status.available).toBe(false);
    expect(status.reason).toBe('unsupported');
  });

  it('returns a preview package for the active course', async () => {
    const { api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    const pkg = await api.getPreviewPackage();
    expect(pkg).not.toBeNull();
    expect(pkg!.rootDir).toBe('browser://lesson-quiz');
    expect(pkg!.manifest.id).toBe('lesson-quiz');
    expect(pkg!.assetPaths).toEqual([]);
  });

  it('lists package files with category and extension', async () => {
    const { api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    await api.openLibraryCourse('lesson-quiz');

    const files = await api.listFiles();
    const manifest = files.find((f) => f.path === 'package.json');
    expect(manifest).toBeDefined();
    expect(manifest!.category).toBe('manifest');
    expect(manifest!.extension).toBe('.json');
    const node = files.find((f) => f.path === 'nodes/lesson.md');
    expect(node).toBeDefined();
    expect(node!.category).toBe('nodes');
    expect(node!.extension).toBe('.md');
  });

  it('creates, renames, and uploads files', async () => {
    const { api } = createBrowserApi();
    await api.applyTemplate('lesson-quiz');
    await api.openLibraryCourse('lesson-quiz');

    const created = await api.createFile('notes.txt', 'hi');
    expect(created.success).toBe(true);
    const read = await api.readFile('notes.txt');
    expect(read.content).toBe('hi');

    const renamed = await api.renameFile('notes.txt', 'notes-renamed.txt');
    expect(renamed.success).toBe(true);
    expect(renamed.newPath).toBe('notes-renamed.txt');
    await expect(api.readFile('notes.txt')).rejects.toMatchObject({ code: 'file-not-found' });

    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    file.arrayBuffer = async () => new TextEncoder().encode('x').buffer;
    const uploaded = await api.uploadAsset(file);
    expect(uploaded.success).toBe(true);
    expect(uploaded.path).toBe('assets/pic.png');
  });

  it('exposes pack methods backed by the virtual pack module stub', async () => {
    const { api } = createBrowserApi();
    expect(typeof api.listPacks).toBe('function');
    expect(typeof api.getPackDetail).toBe('function');
    expect(typeof api.setAuthoringSelection).toBe('function');
    expect(await api.listPacks()).toEqual([]);
    expect(await api.getPackDetail('nope', '0.0.0')).toBeNull();
    await expect(api.setAuthoringSelection({ curriculum: 'nope' })).rejects.toMatchObject({
      code: 'PACK_REFERENCE_MISSING',
    });
  });
});
