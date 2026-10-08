import { describe, it, expect } from 'vitest';
import type { AuthoringContext } from '@open-edu/packs';
import { LearningIntent } from '@open-edu/widgets/intents';
import { renderAuthoringContextBlock } from '../authoringContext.js';

const context: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
  learner: 'neurotypical',
  locale: 'en',
  availableActivities: [
    {
      id: 'math.number-line',
      name: 'Number Line',
      intents: [LearningIntent.Practice],
      subjectTags: ['math'],
    },
  ],
  concepts: [
    { ref: { pack: 'openedu-fractions', concept: 'fraction' }, summary: 'Parts of a whole.' },
  ],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent three-quarters.',
      bloomLevel: 'apply',
      concepts: [{ pack: 'openedu-fractions', concept: 'fraction' }],
      requiresIntents: [LearningIntent.Practice],
    },
  ],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [{ pack: 'openedu-fractions', version: '0.1.0', documents: ['nios-math-ch1'] }],
};

describe('renderAuthoringContextBlock', () => {
  it('renders packs, objectives, concepts, activities and provenance', () => {
    const block = renderAuthoringContextBlock(context);
    expect(block).toContain('AUTHORING CONTEXT:');
    expect(block).toContain('curriculum/nios-math-level-a@0.1.0');
    expect(block).toContain('represent-fraction (apply)');
    expect(block).toContain('requiresIntents: [practice]');
    expect(block).toContain('openedu-fractions/fraction: Parts of a whole.');
    expect(block).toContain('math.number-line');
    expect(block).toContain('openedu-fractions@0.1.0: nios-math-ch1');
  });

  it('renders (none) placeholders for an empty context', () => {
    const empty: AuthoringContext = {
      packs: [],
      availableActivities: [],
      concepts: [],
      objectives: [],
      budget: { maxChars: 20000, usedChars: 0, truncated: [] },
      provenance: [],
    };
    const block = renderAuthoringContextBlock(empty);
    expect(block).toContain('Curriculum unit: (none selected)');
    expect(block).toContain('Objectives —');
    expect(block).toContain('- (none)');
  });
});
