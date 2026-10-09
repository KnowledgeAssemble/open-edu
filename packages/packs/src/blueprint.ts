import type { AuthoringContext } from './context.js';
import type { PackDiagnostic } from './types.js';

export interface BlueprintFacts {
  audience?: string;
  expectedAudience?: string; // set by the caller from getProfile(learner).audience
  lessons: Array<{ id: string; objectives: string[]; widgetIds: string[] }>;
}
export interface BlueprintValidation {
  violations: PackDiagnostic[];
  capabilityGaps: string[];
}

export function validateBlueprint(
  authoring: AuthoringContext,
  facts: BlueprintFacts,
): BlueprintValidation {
  const available = new Map(authoring.availableActivities.map((a) => [a.id, a]));
  const violations: PackDiagnostic[] = [];
  const gaps: string[] = [];

  // Check 1 — every emitted widgetId must be an available activity.
  for (const lesson of facts.lessons) {
    for (const widgetId of lesson.widgetIds) {
      if (!available.has(widgetId)) {
        violations.push({
          code: 'BLUEPRINT_WIDGET_UNKNOWN',
          severity: 'error',
          message: `lesson "${lesson.id}" references unavailable widget "${widgetId}"`,
        });
      }
    }
  }

  // Check 3 — audience must match the selected profile when both are present.
  if (facts.expectedAudience && facts.audience && facts.audience !== facts.expectedAudience) {
    violations.push({
      code: 'BLUEPRINT_AUDIENCE_MISMATCH',
      severity: 'error',
      message: `metadata.audience "${facts.audience}" does not match the selected profile audience "${facts.expectedAudience}"`,
    });
  }

  // Check 2 — every objective's requiresIntents is satisfied by the emitted
  // activities (all-of across the union of their intents), else CAPABILITY_GAP.
  const emittedWidgetIds = new Set(facts.lessons.flatMap((l) => l.widgetIds));
  const emittedIntents = new Set<string>();
  for (const id of emittedWidgetIds) {
    const activity = available.get(id);
    if (activity) {
      for (const intent of activity.intents) emittedIntents.add(intent);
    }
  }
  for (const objective of authoring.objectives) {
    const satisfied = objective.requiresIntents.every((i) => emittedIntents.has(i));
    if (!satisfied) {
      gaps.push(
        `objective-${objective.id}: no activity matched intents [${objective.requiresIntents.join(', ')}]`,
      );
    }
  }

  return { violations, capabilityGaps: gaps };
}
