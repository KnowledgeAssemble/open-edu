import { describe, expect, it } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from '@open-edu/packs';
import { renderItemAuthoringSection } from './authoringContext.js';
import { buildLessonAddPrompt } from './itemAddPrompts.js';

const ctx: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
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
      description: 'Represent fractions',
      concepts: [],
      requiresIntents: [LearningIntent.Practice],
    },
  ],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('renderItemAuthoringSection', () => {
  it('renders a compact block with objectives and available activities', () => {
    const section = renderItemAuthoringSection(ctx);
    expect(section).toContain('AUTHORING CONTEXT');
    expect(section).toContain('requiresIntents');
    expect(section).toContain(ctx.availableActivities[0]!.id);
    expect(section).not.toContain('Provenance (packs');
  });
});

describe('item add prompts', () => {
  it('inserts the authoring section above the course context when provided', () => {
    const prompt = buildLessonAddPrompt('Explain fractions', 'COURSE CONTEXT', 'AUTHORING CONTEXT…');
    const authIdx = prompt.indexOf('AUTHORING CONTEXT…');
    const ctxIdx = prompt.indexOf('COURSE CONTEXT');
    expect(authIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(ctxIdx);
  });

  it('produces the legacy prompt when no section is provided', () => {
    expect(buildLessonAddPrompt('Explain fractions', 'COURSE CONTEXT')).toBe(
      buildLessonAddPrompt('Explain fractions', 'COURSE CONTEXT', undefined),
    );
  });
});
