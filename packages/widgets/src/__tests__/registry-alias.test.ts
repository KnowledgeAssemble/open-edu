import { describe, it, expect } from 'vitest';
import { createWidgetRegistry, registerAllBuiltins, createDefaultRegistry } from '../registry';
import type { WidgetDefinition, WidgetDefinitionV2 } from '../types';

function makeWidget(id: string, overrides?: Partial<WidgetDefinition>): WidgetDefinition {
  return { id, render: () => null, ...overrides };
}

function makeWidgetV2(id: string, overrides?: Partial<WidgetDefinitionV2>): WidgetDefinitionV2 {
  return {
    id,
    name: id,
    description: `Widget ${id}`,
    domain: id.split('.')[0] ?? '',
    learningIntents: [],
    capabilities: {},
    accessibility: {},
    analytics: {},
    reward: {},
    ai: {},
    status: 'stable',
    render: () => null,
    ...overrides,
  };
}

describe('WidgetRegistry alias resolution', () => {
  it('resolves legacy ID to new ID via alias', () => {
    const registry = createWidgetRegistry();
    registry.register(makeWidget('core.matching'));
    registry.registerAlias('open-edu.matching', 'core.matching');
    expect(registry.has('core.matching')).toBe(true);
    expect(registry.has('open-edu.matching')).toBe(true);
    expect(registry.get('open-edu.matching')?.id).toBe('core.matching');
  });

  it('resolveAlias returns original ID if no alias exists', () => {
    const registry = createWidgetRegistry();
    expect(registry.resolveAlias('core.matching')).toBe('core.matching');
    expect(registry.resolveAlias('unknown.widget')).toBe('unknown.widget');
  });

  it('resolveAlias returns aliased ID', () => {
    const registry = createWidgetRegistry();
    registry.registerAlias('open-edu.matching', 'core.matching');
    expect(registry.resolveAlias('open-edu.matching')).toBe('core.matching');
  });

  it('get returns widget for both old and new IDs', () => {
    const registry = createWidgetRegistry();
    const widget = makeWidgetV2('core.matching', { domain: 'core', name: 'Matching' });
    registry.register(widget);
    registry.registerAlias('open-edu.matching', 'core.matching');
    expect(registry.get('core.matching')).toBe(widget);
    expect(registry.get('open-edu.matching')).toBe(widget);
  });

  it('getAll returns all registered widgets', () => {
    const registry = createWidgetRegistry();
    registry.register(makeWidget('core.matching'));
    registry.register(makeWidget('core.multiple-choice'));
    registry.register(makeWidget('math.fraction-visual'));
    const all = registry.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((w) => w.id)).toContain('core.matching');
    expect(all.map((w) => w.id)).toContain('math.fraction-visual');
  });

  it('getByDomain filters widgets by domain prefix', () => {
    const registry = createWidgetRegistry();
    registry.register(makeWidget('core.matching'));
    registry.register(makeWidget('core.multiple-choice'));
    registry.register(makeWidget('math.fraction-visual'));
    registry.register(makeWidget('math.clock-time'));
    const coreWidgets = registry.getByDomain('core');
    expect(coreWidgets).toHaveLength(2);
    expect(coreWidgets.map((w) => w.id)).toContain('core.matching');
    const mathWidgets = registry.getByDomain('math');
    expect(mathWidgets).toHaveLength(2);
    expect(mathWidgets.map((w) => w.id)).toContain('math.fraction-visual');
  });

  it('search finds widgets by name, description, or keywords', () => {
    const registry = createWidgetRegistry();
    registry.register(
      makeWidgetV2('core.matching', {
        name: 'Matching',
        description: 'Match pairs of items together',
        keywords: ['match', 'pairs', 'connect'],
      }),
    );
    registry.register(
      makeWidgetV2('core.multiple-choice', {
        name: 'Multiple Choice',
        description: 'Select the correct answer from options',
        keywords: ['quiz', 'test', 'select'],
      }),
    );
    expect(registry.search('matching')).toHaveLength(1);
    expect(registry.search('match')).toHaveLength(1);
    expect(registry.search('pairs')).toHaveLength(1);
    expect(registry.search('quiz')).toHaveLength(1);
    expect(registry.search('nonexistent')).toHaveLength(0);
  });

  it('search is case-insensitive', () => {
    const registry = createWidgetRegistry();
    registry.register(
      makeWidgetV2('core.matching', {
        name: 'Matching',
        description: 'Match pairs',
        keywords: ['match'],
      }),
    );
    expect(registry.search('MATCHING')).toHaveLength(1);
    expect(registry.search('Matching')).toHaveLength(1);
    expect(registry.search('matching')).toHaveLength(1);
  });

  it('throws on duplicate registration', () => {
    const registry = createWidgetRegistry();
    registry.register(makeWidget('core.matching'));
    expect(() => registry.register(makeWidget('core.matching'))).toThrow('already registered');
  });

  it('registers builtin widgets with alias resolution', () => {
    const registry = createWidgetRegistry();
    registerAllBuiltins(registry);
    expect(registry.has('core.matching')).toBe(true);
    expect(registry.has('open-edu.matching')).toBe(true);
    expect(registry.has('core.multiple-choice')).toBe(true);
    expect(registry.has('open-edu.multiple-choice')).toBe(true);
  });

  it('resolves the retired practice alias to core.multiple-choice without listing it', () => {
    const registry = createDefaultRegistry();
    expect(registry.get('open-edu.multiple-choice-practice')?.id).toBe('core.multiple-choice');
    expect(registry.getAll().map((w) => w.id)).not.toContain('open-edu.multiple-choice-practice');
  });
});
