import type { LearningIntent } from './metadata/learning-intents.js';

export interface IntentTagEntry {
  intents?: readonly LearningIntent[];
  subjectTags?: readonly string[];
}

export interface IntentTagFilters {
  intents?: readonly LearningIntent[];
  subjectTags?: readonly string[];
}

/** All-of `intents` against `entry.intents`; any-of `subjectTags` against `entry.subjectTags`. */
export function matchesIntentTagFilters(entry: IntentTagEntry, filters: IntentTagFilters): boolean {
  if (filters.intents && filters.intents.length > 0) {
    const declared = entry.intents ?? [];
    if (!filters.intents.every((i) => declared.includes(i))) return false;
  }
  if (filters.subjectTags && filters.subjectTags.length > 0) {
    const declared = entry.subjectTags ?? [];
    if (!filters.subjectTags.some((t) => declared.includes(t))) return false;
  }
  return true;
}
