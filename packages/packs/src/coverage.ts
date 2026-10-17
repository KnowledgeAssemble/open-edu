import type { AuthoringContext } from './context.js';

export interface ObjectiveCoverage {
  id: string;
  description: string;
  requiresIntents: string[];
  covered: boolean;
  satisfiedBy: string[];
}

export function computeObjectiveCoverage(
  authoring: AuthoringContext,
  lessons: Array<{ id: string; widgetIds: string[] }>,
): ObjectiveCoverage[] {
  const available = new Map(authoring.availableActivities.map((a) => [a.id, a]));
  const contributing = new Map<string, Set<string>>();
  for (const lesson of lessons) {
    for (const widgetId of lesson.widgetIds) {
      const activity = available.get(widgetId);
      if (!activity) continue;
      for (const intent of activity.intents) {
        if (!contributing.has(intent)) contributing.set(intent, new Set());
        contributing.get(intent)!.add(widgetId);
      }
    }
  }
  return authoring.objectives.map((objective) => {
    const satisfiedBy = new Set<string>();
    let covered = true;
    for (const intent of objective.requiresIntents) {
      const ids = contributing.get(intent);
      if (!ids || ids.size === 0) {
        covered = false;
        continue;
      }
      for (const id of ids) satisfiedBy.add(id);
    }
    return {
      id: objective.id,
      description: objective.description,
      requiresIntents: [...objective.requiresIntents],
      covered,
      satisfiedBy: [...satisfiedBy],
    };
  });
}
