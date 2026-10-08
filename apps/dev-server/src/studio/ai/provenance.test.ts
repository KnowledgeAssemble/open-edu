import { describe, it, expect } from 'vitest';
import type { CourseModel } from '@open-edu/course-compiler';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from '@open-edu/packs';
import { buildProvenance, factsFromModel } from './provenance.js';

const authoring: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
  learner: 'neurotypical',
  availableActivities: [
    {
      id: 'math.number-line',
      name: 'Number Line',
      intents: [LearningIntent.Practice, LearningIntent.Compare],
      subjectTags: ['math', 'fractions'],
    },
  ],
  concepts: [],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent three-quarters.',
      concepts: [{ pack: 'openedu-fractions', concept: 'fraction' }],
      requiresIntents: [LearningIntent.Practice],
    },
    {
      id: 'name-parts',
      description: 'Name the parts.',
      concepts: [],
      requiresIntents: [LearningIntent.Recall],
    },
  ],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

function model(): CourseModel {
  return {
    metadata: { title: 'Fractions', description: 'D', language: 'en', audience: 'neurotypical' },
    modules: [
      {
        id: 'm1',
        title: 'M1',
        lessons: [
          {
            id: 'represent',
            title: 'Represent',
            objectives: [
              { id: 'o1', description: 'Represent three-quarters.' },
              { id: 'o2', description: 'Name the parts.' },
            ],
            content: '# Represent',
            activities: [{ id: 'a1', type: 'widget', widgetId: 'math.number-line', config: {} }],
          },
        ],
      },
    ],
  };
}

describe('factsFromModel', () => {
  it('flattens modules into lessons with widget ids', () => {
    const facts = factsFromModel(model());
    expect(facts.audience).toBe('neurotypical');
    expect(facts.lessons).toEqual([
      {
        id: 'represent',
        objectives: ['Represent three-quarters.', 'Name the parts.'],
        widgetIds: ['math.number-line'],
      },
    ]);
  });
});

describe('buildProvenance', () => {
  it('maps nodes to objectives/concepts/widgets and per-node gaps by description', () => {
    const { record, capabilityGaps } = buildProvenance(
      authoring,
      model(),
      '2026-10-08T00:00:00.000Z',
    );
    expect(record.contextFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(record.generatedAt).toBe('2026-10-08T00:00:00.000Z');
    expect(record.packs).toEqual(authoring.packs);
    expect(record.nodes).toHaveLength(1);
    const node = record.nodes[0]!;
    expect(node.path).toBe('nodes/represent.md');
    expect(node.objectives).toEqual(['represent-fraction', 'name-parts']);
    expect(node.concepts).toEqual([{ pack: 'openedu-fractions', concept: 'fraction' }]);
    expect(node.widgets).toEqual(['math.number-line']);
    expect(capabilityGaps).toEqual(['objective-name-parts: no activity matched intents [recall]']);
    expect(node.capabilityGaps).toEqual([
      'objective-name-parts: no activity matched intents [recall]',
    ]);
  });

  it('falls back to objective order when descriptions do not match', () => {
    const custom: AuthoringContext = {
      ...authoring,
      objectives: [{ ...authoring.objectives[0]!, description: 'Different description.' }],
    };
    const { record } = buildProvenance(custom, model(), 'now');
    expect(record.nodes[0]!.objectives).toEqual(['represent-fraction']);
  });

  it('matches paraphrased lesson objectives by containment when exact match fails', () => {
    const custom: AuthoringContext = {
      ...authoring,
      objectives: [
        {
          id: 'like-denominators',
          description: 'Fractions with like denominators.',
          concepts: [],
          requiresIntents: [LearningIntent.Practice],
        },
      ],
    };
    const customModel = model();
    customModel.modules[0]!.lessons[0]!.objectives = [
      {
        id: 'o1',
        description: 'This lesson covers fractions with like denominators and ordering.',
      },
    ];
    const { record } = buildProvenance(custom, customModel, 'now');
    expect(record.nodes[0]!.objectives).toEqual(['like-denominators']);
  });
});
