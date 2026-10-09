import { describe, expect, it } from 'vitest';
import type { AuthoringContext, PackDiagnostic } from '@open-edu/packs';
import type { StoredPackAuthoring } from './studioSession.js';
import { nextAuthoringScope, restoreInitialAuthoring } from './authoringScope.js';

describe('nextAuthoringScope', () => {
  it('keeps the context when the course does not change', () => {
    expect(
      nextAuthoringScope({
        previousCourseKey: 'c',
        nextCourseKey: 'c',
        hasPendingSelection: false,
      }),
    ).toBe('keep');
  });

  it('keeps a fresh pack selection on the first course it grounds', () => {
    expect(
      nextAuthoringScope({
        previousCourseKey: null,
        nextCourseKey: 'c',
        hasPendingSelection: true,
      }),
    ).toBe('keep');
  });

  it('clears authoring when a course loads without a pending selection', () => {
    expect(
      nextAuthoringScope({
        previousCourseKey: null,
        nextCourseKey: 'c',
        hasPendingSelection: false,
      }),
    ).toBe('clear');
  });

  it('clears stale authoring when switching between courses', () => {
    expect(
      nextAuthoringScope({
        previousCourseKey: 'a',
        nextCourseKey: 'b',
        hasPendingSelection: false,
      }),
    ).toBe('clear');
    expect(
      nextAuthoringScope({
        previousCourseKey: 'a',
        nextCourseKey: 'b',
        hasPendingSelection: true,
      }),
    ).toBe('clear');
  });

  it('clears authoring when the course closes', () => {
    expect(
      nextAuthoringScope({
        previousCourseKey: 'a',
        nextCourseKey: null,
        hasPendingSelection: false,
      }),
    ).toBe('clear');
  });
});

describe('restoreInitialAuthoring', () => {
  const context: AuthoringContext = {
    packs: [],
    availableActivities: [],
    concepts: [],
    objectives: [],
    budget: { maxChars: 1000, usedChars: 0, truncated: [] },
    provenance: [],
  };
  const warnings: PackDiagnostic[] = [
    { code: 'CAPABILITY_GAP', severity: 'warning', message: 'no gap' },
  ];

  it('returns empty state when nothing is stored', () => {
    expect(restoreInitialAuthoring(null, null)).toEqual({
      authoring: null,
      warnings: [],
      pending: false,
    });
  });

  it('restores a pending selection onto any course', () => {
    const stored: StoredPackAuthoring = { courseKey: null, pending: true, context, warnings };
    expect(restoreInitialAuthoring(stored, 'browser://lesson-quiz::lesson-quiz')).toEqual({
      authoring: context,
      warnings,
      pending: true,
    });
  });

  it('restores a stamped selection only for its matching course', () => {
    const stored: StoredPackAuthoring = {
      courseKey: 'browser://lesson-quiz::lesson-quiz',
      pending: false,
      context,
      warnings,
    };
    expect(restoreInitialAuthoring(stored, 'browser://lesson-quiz::lesson-quiz').authoring).toEqual(
      context,
    );
    expect(restoreInitialAuthoring(stored, 'browser://other::other').authoring).toBeNull();
    expect(restoreInitialAuthoring(stored, 'browser://other::other').warnings).toEqual([]);
  });
});
