import { describe, it, expect } from 'vitest';
import { matchesIntentTagFilters } from '../search-filter';
import { LearningIntent } from '../metadata/learning-intents';

describe('matchesIntentTagFilters', () => {
  it('matches all-of intents', () => {
    const entry = { intents: [LearningIntent.Practice, LearningIntent.Compare] };
    expect(matchesIntentTagFilters(entry, { intents: [LearningIntent.Practice] })).toBe(true);
    expect(
      matchesIntentTagFilters(entry, {
        intents: [LearningIntent.Practice, LearningIntent.Compare],
      }),
    ).toBe(true);
    expect(matchesIntentTagFilters(entry, { intents: [LearningIntent.Assess] })).toBe(false);
  });

  it('matches any-of subjectTags', () => {
    const entry = { subjectTags: ['math', 'fractions'] };
    expect(matchesIntentTagFilters(entry, { subjectTags: ['fractions'] })).toBe(true);
    expect(matchesIntentTagFilters(entry, { subjectTags: ['science'] })).toBe(false);
    expect(matchesIntentTagFilters(entry, { subjectTags: ['science', 'math'] })).toBe(true);
  });

  it('treats empty filters as no constraint', () => {
    expect(matchesIntentTagFilters({}, {})).toBe(true);
    expect(matchesIntentTagFilters({}, { intents: [] })).toBe(true);
    expect(matchesIntentTagFilters({}, { subjectTags: [] })).toBe(true);
    expect(matchesIntentTagFilters({}, { intents: [LearningIntent.Practice] })).toBe(false);
  });

  it('requires both intents and subjectTags when combined', () => {
    const entry = { intents: [LearningIntent.Practice], subjectTags: ['math'] };
    expect(
      matchesIntentTagFilters(entry, {
        intents: [LearningIntent.Practice],
        subjectTags: ['math'],
      }),
    ).toBe(true);
    expect(
      matchesIntentTagFilters(entry, {
        intents: [LearningIntent.Practice],
        subjectTags: ['science'],
      }),
    ).toBe(false);
  });
});
