import { describe, it, expect } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from './context.js';
import { validateBlueprint } from './blueprint.js';

const authoring: AuthoringContext = {
  packs: [],
  availableActivities: [
    {
      id: 'math.number-line',
      name: 'Number Line',
      intents: [LearningIntent.Practice, LearningIntent.Compare],
      subjectTags: ['math'],
    },
  ],
  concepts: [],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent.',
      concepts: [],
      requiresIntents: [LearningIntent.Practice],
    },
  ],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('validateBlueprint', () => {
  it('flags an unavailable widget id', () => {
    const { violations } = validateBlueprint(authoring, {
      lessons: [{ id: 'l1', objectives: [], widgetIds: ['ghost.widget'] }],
    });
    expect(violations.map((v) => v.code)).toContain('BLUEPRINT_WIDGET_UNKNOWN');
  });

  it('flags an audience mismatch when both are present', () => {
    const { violations } = validateBlueprint(authoring, {
      audience: 'adult',
      expectedAudience: 'school',
      lessons: [],
    });
    expect(violations.map((v) => v.code)).toContain('BLUEPRINT_AUDIENCE_MISMATCH');
  });

  it('does not flag an audience when only one side is present', () => {
    expect(validateBlueprint(authoring, { audience: 'adult', lessons: [] }).violations).toEqual([]);
  });

  it('reports no gap when an emitted activity satisfies the objective intents', () => {
    const { capabilityGaps } = validateBlueprint(authoring, {
      lessons: [{ id: 'l1', objectives: [], widgetIds: ['math.number-line'] }],
    });
    expect(capabilityGaps).toEqual([]);
  });

  it('reports a gap with the documented message format when unsatisfied', () => {
    const smaller: AuthoringContext = {
      ...authoring,
      objectives: [
        {
          id: 'name-parts',
          description: 'Name.',
          concepts: [],
          requiresIntents: [LearningIntent.Recall],
        },
      ],
    };
    const { capabilityGaps } = validateBlueprint(smaller, {
      lessons: [{ id: 'l1', objectives: [], widgetIds: ['math.number-line'] }],
    });
    expect(capabilityGaps).toEqual(['objective-name-parts: no activity matched intents [recall]']);
  });

  it('gaps every objective when there are no widget activities', () => {
    const { capabilityGaps } = validateBlueprint(authoring, {
      lessons: [{ id: 'l1', objectives: [], widgetIds: [] }],
    });
    expect(capabilityGaps).toHaveLength(1);
    expect(capabilityGaps[0]).toContain('objective-represent-fraction');
  });
});
