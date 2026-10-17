import type { LoadedPackage } from '@open-edu/core';
import { computeObjectiveCoverage, type ObjectiveCoverage } from '@open-edu/packs';
import type { AuthoringContext } from '@open-edu/packs';
import { parseExerciseNode } from '../widgets/exerciseNode.js';

export function coverageFromPackage(
  pkg: LoadedPackage | null,
  authoring: AuthoringContext | null,
): ObjectiveCoverage[] {
  if (!authoring || authoring.objectives.length === 0) return [];
  const lessons = (pkg?.nodes ?? []).map((n) => {
    const exercise = parseExerciseNode(n.content);
    return { id: n.relativePath, widgetIds: exercise?.widget ? [exercise.widget] : [] };
  });
  return computeObjectiveCoverage(authoring, lessons);
}
