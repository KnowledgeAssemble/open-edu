import { describe, it, expect, beforeEach } from 'vitest';
import {
  readStudioView,
  writeStudioView,
  readSelectedPath,
  writeSelectedPath,
  readOutlineTab,
  writeOutlineTab,
  readFilesPath,
  writeFilesPath,
  readStoredPackAuthoring,
  writeStoredPackAuthoring,
  type StoredPackAuthoring,
} from './studioSession';

describe('studioSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to home view', () => {
    expect(readStudioView()).toBe('home');
  });

  it('persists and restores the view', () => {
    writeStudioView('outline');
    expect(readStudioView()).toBe('outline');
  });

  it('persists the library and unit-builder views', () => {
    writeStudioView('library');
    expect(readStudioView()).toBe('library');
    writeStudioView('unit-builder');
    expect(readStudioView()).toBe('unit-builder');
  });

  it('ignores invalid stored views', () => {
    sessionStorage.setItem('openedu.studio.view', 'nope');
    expect(readStudioView()).toBe('home');
  });

  it('persists and restores the selected path', () => {
    expect(readSelectedPath()).toBeNull();
    writeSelectedPath('nodes/lesson.md');
    expect(readSelectedPath()).toBe('nodes/lesson.md');
  });

  it('defaults to the outline tab', () => {
    expect(readOutlineTab()).toBe('outline');
  });

  it('persists and restores the outline tab', () => {
    writeOutlineTab('files');
    expect(readOutlineTab()).toBe('files');
  });

  it('ignores invalid stored outline tabs', () => {
    sessionStorage.setItem('openedu.studio.outlineTab', 'nope');
    expect(readOutlineTab()).toBe('outline');
  });

  it('persists and restores the files path', () => {
    expect(readFilesPath()).toBeNull();
    writeFilesPath('nodes/lesson.md');
    expect(readFilesPath()).toBe('nodes/lesson.md');
    writeFilesPath(null);
    expect(readFilesPath()).toBeNull();
  });

  it('returns null when no pack authoring is stored', () => {
    expect(readStoredPackAuthoring()).toBeNull();
  });

  it('persists and restores the pack authoring selection', () => {
    const stored: StoredPackAuthoring = {
      courseKey: 'browser://lesson-quiz::lesson-quiz',
      pending: false,
      context: {
        packs: [],
        availableActivities: [],
        concepts: [
          { ref: { pack: 'openedu-fractions', concept: 'fraction' }, summary: 'a fraction' },
        ],
        objectives: [],
        budget: { maxChars: 1000, usedChars: 0, truncated: [] },
        provenance: [{ pack: 'openedu-fractions', version: '0.1.0', documents: [] }],
      },
      warnings: [],
    };
    writeStoredPackAuthoring(stored);
    expect(readStoredPackAuthoring()).toEqual(stored);
  });

  it('clears the pack authoring selection', () => {
    writeStoredPackAuthoring({
      courseKey: null,
      pending: true,
      context: {
        packs: [],
        availableActivities: [],
        concepts: [],
        objectives: [],
        budget: { maxChars: 1000, usedChars: 0, truncated: [] },
        provenance: [],
      },
      warnings: [],
    });
    writeStoredPackAuthoring(null);
    expect(readStoredPackAuthoring()).toBeNull();
  });
});
