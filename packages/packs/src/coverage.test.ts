import { describe, expect, it } from 'vitest';
import { LearningIntent } from '@open-edu/schemas/learning-intents';
import type { AuthoringContext } from './context.js';
import { computeObjectiveCoverage } from './coverage.js';

const authoring: AuthoringContext = {
  packs: [],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent fractions visually',
      concepts: [],
      requiresIntents: [LearningIntent.Understand, LearningIntent.Practice],
    },
    {
      id: 'compare-fraction',
      description: 'Compare fractions',
      concepts: [],
      requiresIntents: [LearningIntent.Compare],
    },
  ],
  availableActivities: [
    {
      id: 'a.visual',
      name: 'Visual',
      domain: '',
      intents: [LearningIntent.Understand, LearningIntent.Practice],
      subjectTags: [],
    },
    {
      id: 'b.compare',
      name: 'Compare',
      domain: '',
      intents: [LearningIntent.Compare],
      subjectTags: [],
    },
  ],
  concepts: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('computeObjectiveCoverage', () => {
  it('marks objectives covered when emitted widgets supply all required intents', () => {
    const result = computeObjectiveCoverage(authoring, [
      { id: 'l1', widgetIds: ['a.visual', 'b.compare'] },
    ]);
    expect(result.find((r) => r.id === 'represent-fraction')?.covered).toBe(true);
    expect(result.find((r) => r.id === 'compare-fraction')?.covered).toBe(true);
  });

  it('marks an objective uncovered when intents are missing', () => {
    const result = computeObjectiveCoverage(authoring, [{ id: 'l1', widgetIds: ['a.visual'] }]);
    expect(result.find((r) => r.id === 'compare-fraction')).toEqual({
      id: 'compare-fraction',
      description: 'Compare fractions',
      requiresIntents: [LearningIntent.Compare],
      covered: false,
      satisfiedBy: [],
    });
  });
});
