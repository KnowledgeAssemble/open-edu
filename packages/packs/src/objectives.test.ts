import { describe, it, expect } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AvailableActivity } from './context.js';
import type { Concept } from './concept.js';
import { resolveObjectiveCandidates } from './objectives.js';

const concepts: Record<string, Concept> = {
  'p/fraction': {
    id: 'fraction',
    title: 'Fraction',
    summary: 'A fraction.',
    domainTags: ['math', 'fractions'],
  },
};

const byRef = (pack: string, concept: string): Concept | undefined =>
  concepts[`${pack}/${concept}`];

const activity = (
  id: string,
  intents: LearningIntent[],
  subjectTags: string[],
): AvailableActivity => ({
  id,
  name: id,
  intents,
  subjectTags,
});

describe('resolveObjectiveCandidates', () => {
  const objectives = [
    {
      id: 'represent-fraction',
      description: 'Represent.',
      concepts: [{ pack: 'p', concept: 'fraction' }],
      requiresIntents: [LearningIntent.Practice, LearningIntent.Compare],
    },
  ];

  it('matches all-of intents and any-of subjectTags', () => {
    const activities = [
      activity('a', [LearningIntent.Practice, LearningIntent.Compare], ['math']),
      activity('b', [LearningIntent.Practice], ['math']),
      activity('c', [LearningIntent.Practice, LearningIntent.Compare], ['science']),
    ];
    const [result] = resolveObjectiveCandidates(objectives, byRef, activities);
    expect(result?.candidates.map((c) => c.id)).toEqual(['a']);
  });

  it('caps candidates at the limit (default 5) in catalog order', () => {
    const activities = Array.from({ length: 8 }, (_, i) =>
      activity(`w${i}`, [LearningIntent.Practice, LearningIntent.Compare], ['math']),
    );
    const [result] = resolveObjectiveCandidates(objectives, byRef, activities);
    expect(result?.candidates.map((c) => c.id)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4']);
  });

  it('returns no candidates when nothing matches', () => {
    const objectives2 = [
      {
        id: 'recall',
        description: 'Recall.',
        concepts: [{ pack: 'p', concept: 'fraction' }],
        requiresIntents: [LearningIntent.Recall],
      },
    ];
    const [result] = resolveObjectiveCandidates(objectives2, byRef, [
      activity('a', [LearningIntent.Practice], ['math']),
    ]);
    expect(result?.candidates).toEqual([]);
  });
});
