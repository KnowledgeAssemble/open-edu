import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDatabase, resetDatabase } from '@open-edu/storage';
import { createLocalStudioApi } from './localStudioApi.js';
import { createBrowserStudioApi, createBrowserStudioSession } from './browserStudioApi.js';
import type { StudioApi } from './studioApi.js';

describe('StudioApi contract', () => {
  beforeEach(async () => {
    resetDatabase();
    const db = await openDatabase();
    await db.clear('studio-courses');
    db.close();
    resetDatabase();
  });

  it('both factories type-check against the explicit StudioApi interface', () => {
    // Type-level conformance: assignments would fail to compile if a factory
    // drifted from the interface.
    const local: StudioApi = createLocalStudioApi();
    const browser: StudioApi = createBrowserStudioApi({
      session: createBrowserStudioSession(),
    });
    expect(local).toBeDefined();
    expect(browser).toBeDefined();
  });

  it('both factories expose every StudioApi method', () => {
    const methodNames: Array<keyof StudioApi> = [
      'getPackageDir',
      'getWorkspace',
      'validate',
      'getOutline',
      'saveOutlineOrder',
      'applyTemplate',
      'getLibrary',
      'openLibraryCourse',
      'duplicateCourse',
      'renameCourse',
      'archiveCourse',
      'exportOep',
      'importOep',
      'readFile',
      'writeFile',
      'deleteFile',
      'getPreviewPackage',
      'getStorageStatus',
      'getAiStatus',
      'generateFromNotes',
      'uploadSpec',
      'generateCourseDraft',
      'uploadSpecDraft',
      'commitCourseDraft',
      'discardCourseDraft',
      'generateItemAdd',
      'generateItemEdit',
      'importCourseFolder',
      'createUnit',
      'exportUnitOep',
      'listPacks',
      'getPackDetail',
      'setAuthoringSelection',
    ];
    const local = createLocalStudioApi();
    const browser = createBrowserStudioApi({ session: createBrowserStudioSession() });
    for (const name of methodNames) {
      expect(typeof local[name], `local.${String(name)}`).toBe('function');
      expect(typeof browser[name], `browser.${String(name)}`).toBe('function');
    }
  });

  it('browser getPackageDir exposes a stable browser:// identifier, not a filesystem path', async () => {
    const session = createBrowserStudioSession();
    session.setActiveCourse('my-course');
    const browser = createBrowserStudioApi({ session });
    expect(await browser.getPackageDir()).toBe('browser://my-course');
  });

  it('browser archive hard-deletes and never fabricates an archivedPath', async () => {
    const browser = createBrowserStudioApi({ session: createBrowserStudioSession() });
    await browser.applyTemplate('reading-lesson');
    const result = await browser.archiveCourse('reading-lesson');
    expect(result.success).toBe(true);
    expect('archivedPath' in result ? result.archivedPath : undefined).toBeUndefined();
  });

  it('browser unsupported operations return stable unsupported-in-browser errors', async () => {
    const browser = createBrowserStudioApi({ session: createBrowserStudioSession() });
    await expect(browser.importCourseFolder('/tmp/x')).rejects.toMatchObject({
      code: 'unsupported-in-browser',
    });
    await expect(browser.createUnit('U', ['a'])).rejects.toMatchObject({
      code: 'unsupported-in-browser',
    });
    await expect(browser.exportUnitOep('units/u')).rejects.toMatchObject({
      code: 'unsupported-in-browser',
    });
  });

  it('local mode reports storage as available and browser preview as null', async () => {
    const local = createLocalStudioApi();
    expect(await local.getStorageStatus()).toEqual({ available: true });
    expect(await local.getPreviewPackage()).toBeNull();
  });
});
