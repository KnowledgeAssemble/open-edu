import { describe, it, expect } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from '@open-edu/packs';
import { coverageFromPackage } from './coverageFromPackage.js';

const authoringFixture: AuthoringContext = {
  packs: [],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent fractions',
      concepts: [],
      requiresIntents: [LearningIntent.Practice],
    },
  ],
  availableActivities: [
    {
      id: 'a.visual',
      name: 'Visual',
      domain: '',
      intents: [LearningIntent.Practice],
      subjectTags: [],
    },
  ],
  concepts: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('coverageFromPackage', () => {
  it('extracts practice widget ids via parseExerciseNode and computes coverage', () => {
    const pkg = {
      rootDir: '/test',
      manifest: {
        id: 'c',
        title: 'C',
        version: '1',
        author: 'a',
        entry: 'nodes/p1.json',
      },
      workflow: { routing: {} },
      rewards: null,
      cards: null,
      assetPaths: [],
      nodes: [
        {
          relativePath: 'nodes/p1.json',
          content: JSON.stringify({ type: 'exercise', widget: 'a.visual', config: {} }),
          node: { type: 'exercise' },
        },
        { relativePath: 'nodes/l1.md', content: '# Lesson', node: { type: 'lesson' } },
      ],
    };
    const result = coverageFromPackage(pkg as never, authoringFixture);
    expect(result.find((r) => r.id === 'represent-fraction')?.covered).toBe(true);
  });

  it('returns [] without authoring or with zero objectives', () => {
    expect(coverageFromPackage(null, null)).toEqual([]);
    expect(
      coverageFromPackage({ nodes: [] } as never, { ...authoringFixture, objectives: [] }),
    ).toEqual([]);
  });
});
