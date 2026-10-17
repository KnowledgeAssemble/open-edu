import { describe, expect, it } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from '@open-edu/packs';
import { matchAuthoringObjectives } from './objectiveMatch.js';

const custom: AuthoringContext = {
  packs: [],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent fractions visually',
      concepts: [],
      requiresIntents: [LearningIntent.Practice],
    },
    {
      id: 'compare-fractions',
      description: 'Compare fractions',
      concepts: [],
      requiresIntents: [LearningIntent.Compare],
    },
  ],
  concepts: [],
  availableActivities: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('matchAuthoringObjectives', () => {
  it('matches by substring', () => {
    const matches = matchAuthoringObjectives(
      custom,
      'Let us practice Represent fractions visually',
    );
    expect(matches.map((m) => m.id)).toContain('represent-fraction');
  });

  it('returns [] when nothing matches', () => {
    expect(matchAuthoringObjectives(custom, 'unrelated text with no objective words')).toEqual([]);
  });
});
