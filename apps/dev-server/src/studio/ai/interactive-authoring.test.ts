import { describe, it, expect } from 'vitest';
import {
  createInteractiveAuthoringSkills,
  interactiveAuthoringRouterSkill,
  detectEngineType,
} from './skills/interactive-authoring.js';
import { InMemorySkillRegistry } from './skillRegistry.js';

describe('createInteractiveAuthoringSkills', () => {
  it('returns six skills with ids interactive-visual through interactive-composition', () => {
    const skills = createInteractiveAuthoringSkills();
    expect(skills).toHaveLength(6);
    const ids = skills.map((s) => s.id);
    expect(ids).toContain('interactive-visual');
    expect(ids).toContain('interactive-chart');
    expect(ids).toContain('interactive-geomap');
    expect(ids).toContain('interactive-timeline');
    expect(ids).toContain('interactive-diagram');
    expect(ids).toContain('interactive-composition');
  });

  it('each skill has non-empty instructions and no packages/ or docs/ fragment', () => {
    const skills = createInteractiveAuthoringSkills();
    for (const skill of skills) {
      expect(skill.instructions).toBeTruthy();
      expect(skill.instructions!.length).toBeGreaterThan(0);
      expect(skill.instructions).not.toContain('packages/');
      expect(skill.instructions).not.toContain('docs/');
    }
  });

  it('each skill has tools and permissions', () => {
    const skills = createInteractiveAuthoringSkills();
    for (const skill of skills) {
      expect(skill.tools).toEqual(['generate_item', 'edit_item']);
      expect(skill.permissions).toEqual(['item.generate', 'item.edit']);
    }
  });
});

describe('interactiveAuthoringRouterSkill', () => {
  it('has the expected structure', () => {
    expect(interactiveAuthoringRouterSkill.id).toBe('interactive-authoring');
    expect(interactiveAuthoringRouterSkill.instructions).toBeTruthy();
    expect(interactiveAuthoringRouterSkill.tools).toEqual(['generate_item', 'edit_item']);
    expect(interactiveAuthoringRouterSkill.permissions).toEqual(['item.generate', 'item.edit']);
  });
});

describe('InMemorySkillRegistry with engine skills', () => {
  it('lists 7 skills when seeded with engine skills and router', () => {
    const engineSkills = createInteractiveAuthoringSkills();
    const registry = new InMemorySkillRegistry([...engineSkills, interactiveAuthoringRouterSkill]);
    const list = registry.list();
    expect(list).toHaveLength(7);
    const ids = list.map((s) => s.id);
    expect(ids).toContain('interactive-visual');
    expect(ids).toContain('interactive-chart');
    expect(ids).toContain('interactive-authoring');
  });

  it('duplicate registration overwrites existing skill', () => {
    const registry = new InMemorySkillRegistry([
      { id: 'interactive-visual', description: 'original', instructions: 'orig' },
    ]);
    registry.register({
      id: 'interactive-visual',
      description: 'overwritten',
      instructions: 'new',
    });
    const skills = registry.list().filter((s) => s.id === 'interactive-visual');
    expect(skills).toHaveLength(1);
    expect(skills[0]!.description).toBe('overwritten');
  });
});

describe('detectEngineType', () => {
  it('detects engine from "engine":"chart" pattern', () => {
    const result = detectEngineType('{"type":"interactive","engine":"chart"}', [
      'visual',
      'chart',
      'geomap',
    ]);
    expect(result).toBe('chart');
  });

  it('detects engine from single-quoted pattern', () => {
    const result = detectEngineType(`{'type':'interactive','engine':'geomap'}`, [
      'visual',
      'chart',
      'geomap',
    ]);
    expect(result).toBe('geomap');
  });

  it('returns null for unknown engine type', () => {
    const result = detectEngineType('{"type":"interactive","engine":"unknown"}', [
      'visual',
      'chart',
    ]);
    expect(result).toBeNull();
  });

  it('returns null when no engine token present', () => {
    const result = detectEngineType('{"type":"interactive"}', ['visual', 'chart']);
    expect(result).toBeNull();
  });
});
