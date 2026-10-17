import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from '@open-edu/packs';

export const authoringFixture: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
  learner: 'neurotypical',
  availableActivities: [
    {
      id: 'math.number-line',
      name: 'Number Line',
      domain: 'math',
      intents: [LearningIntent.Practice],
      subjectTags: [],
    },
  ],
  concepts: [],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent fractions visually',
      concepts: [],
      requiresIntents: [LearningIntent.Practice],
    },
  ],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};
