import { matchesIntentTagFilters } from '@open-edu/widgets/search';
import type { AvailableActivity, AuthoringContext } from './context.js';
import type { Concept } from './concept.js';

export interface ObjectiveCandidates {
  id: string;
  candidates: AvailableActivity[];
}

export function resolveObjectiveCandidates(
  objectives: AuthoringContext['objectives'],
  conceptsByRef: (pack: string, concept: string) => Concept | undefined,
  availableActivities: AvailableActivity[],
  limit = 5,
): ObjectiveCandidates[] {
  return objectives.map((objective) => {
    const domainTags = objective.concepts.flatMap(
      (ref) => conceptsByRef(ref.pack, ref.concept)?.domainTags ?? [],
    );
    const candidates = availableActivities
      .filter((a) =>
        matchesIntentTagFilters(a, { intents: objective.requiresIntents, subjectTags: domainTags }),
      )
      .slice(0, limit);
    return { id: objective.id, candidates };
  });
}
