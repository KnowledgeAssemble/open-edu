import type { AuthoringContext, PackDiagnostic } from '@open-edu/packs';
import type { StoredPackAuthoring } from './studioSession.js';

export type AuthoringScopeAction = 'keep' | 'clear';

export interface AuthoringScopeInput {
  previousCourseKey: string | null;
  nextCourseKey: string | null;
  hasPendingSelection: boolean;
}

export function nextAuthoringScope({
  previousCourseKey,
  nextCourseKey,
  hasPendingSelection,
}: AuthoringScopeInput): AuthoringScopeAction {
  if (previousCourseKey === nextCourseKey) return 'keep';
  if (nextCourseKey !== null && previousCourseKey === null && hasPendingSelection) return 'keep';
  return 'clear';
}

export interface RestoredAuthoring {
  authoring: AuthoringContext | null;
  warnings: PackDiagnostic[];
  pending: boolean;
}

export function restoreInitialAuthoring(
  stored: StoredPackAuthoring | null,
  currentCourseKey: string | null,
): RestoredAuthoring {
  if (!stored) return { authoring: null, warnings: [], pending: false };
  const applies = stored.pending || stored.courseKey === currentCourseKey;
  return {
    authoring: applies ? stored.context : null,
    warnings: applies ? stored.warnings : [],
    pending: stored.pending,
  };
}
