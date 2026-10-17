import { describe, it, expect } from 'vitest';
import { LearningIntent, LEARNING_INTENTS } from './learning-intents.js';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isValidLocale } from './locale.js';
import { matchesIntentTagFilters } from './intent-tags.js';

describe('pack contracts', () => {
  it('exposes the canonical learning intents', () => {
    expect(LEARNING_INTENTS).toContain(LearningIntent.Practice);
    expect(LEARNING_INTENTS).toHaveLength(Object.values(LearningIntent).length);
  });

  it('validates supported locales', () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
    expect(isValidLocale('hi')).toBe(true);
    expect(isValidLocale('zz')).toBe(false);
  });

  it('matches intents all-of and subject tags any-of', () => {
    const entry = {
      intents: [LearningIntent.Practice, LearningIntent.Compare],
      subjectTags: ['math'],
    };
    expect(matchesIntentTagFilters(entry, { intents: [LearningIntent.Practice] })).toBe(true);
    expect(matchesIntentTagFilters(entry, { intents: [LearningIntent.Assess] })).toBe(false);
    expect(matchesIntentTagFilters(entry, { subjectTags: ['science', 'math'] })).toBe(true);
    expect(matchesIntentTagFilters(entry, {})).toBe(true);
  });
});
