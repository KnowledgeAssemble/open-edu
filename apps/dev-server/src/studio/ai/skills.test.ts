import { describe, it, expect } from 'vitest';
import type { StudioContextSnapshot } from '@open-edu/companion/context';
import { InMemorySkillRegistry } from './skillRegistry.js';
import { learnerAdaptationSkill } from './skills/learner-adaptation.js';
import { createSkillResolver } from './skills/resolveSkills.js';

const baseCtx: StudioContextSnapshot = {
  view: 'outline',
  locale: 'en',
  aiAvailable: true,
  course: {
    id: 'c1',
    title: 'Fractions',
    activityCount: 1,
    outline: [{ title: 'A', kind: 'lesson', path: 'nodes/a.md' }],
  },
};

describe('InMemorySkillRegistry', () => {
  it('ships learner-adaptation + 6 engine skills by default and lists registered skills', () => {
    const registry = new InMemorySkillRegistry();
    const ids = registry.list().map((skill) => skill.id);
    expect(ids).toContain('learner-adaptation');
    expect(ids).toContain('interactive-visual');
    expect(ids).toContain('interactive-chart');
    expect(ids).toContain('interactive-geomap');
    expect(ids).toContain('interactive-timeline');
    expect(ids).toContain('interactive-diagram');
    expect(ids).toContain('interactive-composition');
    expect(ids).toContain('interactive-authoring');
    expect(ids).toHaveLength(8);
    expect(learnerAdaptationSkill.tools).toContain('edit_item');
  });

  it('registering a duplicate id overwrites the prior skill', () => {
    const registry = new InMemorySkillRegistry([]);
    registry.register({ id: 'x', description: 'one' });
    registry.register({ id: 'x', description: 'two' });
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]!.description).toBe('two');
  });
});

describe('createSkillResolver', () => {
  const resolver = createSkillResolver(new InMemorySkillRegistry());

  it('resolves learner-adaptation only when the context carries a learner profile', () => {
    expect(resolver.resolve(baseCtx)).toHaveLength(0);
    const withLearner: StudioContextSnapshot = {
      ...baseCtx,
      learner: { id: 'autism-1', label: 'Autism', kind: 'autism' },
    };
    const skills = resolver.resolve(withLearner);
    expect(skills.map((skill) => skill.id)).toEqual(['learner-adaptation']);
    expect(skills[0]?.instructions).toContain('Autism Spectrum');
    expect(skills[0]?.instructions).toContain('literal language');
  });

  it('is additive: a plain snapshot resolves no skills (whole library not injected)', () => {
    expect(resolver.resolve(baseCtx as never)).toHaveLength(0);
  });
});
