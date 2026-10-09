import { describe, it, expect } from 'vitest';
import { LearningIntent } from '../learning-intents';

describe('LearningIntent', () => {
  it('defines all 11 learning intents', () => {
    const intents = Object.values(LearningIntent);
    expect(intents).toContain('assess');
    expect(intents).toContain('practice');
    expect(intents).toContain('observe');
    expect(intents).toContain('compare');
    expect(intents).toContain('explore');
    expect(intents).toContain('create');
    expect(intents).toContain('reflect');
    expect(intents).toContain('apply');
    expect(intents).toContain('listen');
    expect(intents).toContain('recall');
    expect(intents).toContain('understand');
    expect(intents).toHaveLength(11);
  });
});
