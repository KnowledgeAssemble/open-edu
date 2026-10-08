import { describe, it, expect } from 'vitest';
import { createWidgetRegistry } from '../registry';
import type { WidgetDefinitionV2, WidgetSearchFilters } from '../types';
import { LearningIntent } from '../metadata/learning-intents';
import { matchesIntentTagFilters } from '../search-filter';

function v2(id: string, overrides: Partial<WidgetDefinitionV2> = {}): WidgetDefinitionV2 {
  return {
    id,
    name: id,
    description: id,
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

describe('Registry searchWithFilters', () => {
  it('filters by domain', () => {
    const r = createWidgetRegistry();
    r.register(v2('core.matching', { domain: 'core' }));
    r.register(v2('math.fraction-visual', { domain: 'math' }));
    expect(r.searchWithFilters({ domain: 'core' })).toHaveLength(1);
    expect(r.searchWithFilters({ domain: 'math' })).toHaveLength(1);
    expect(r.searchWithFilters({ domain: 'science' })).toHaveLength(0);
  });

  it('filters by learning intent', () => {
    const r = createWidgetRegistry();
    r.register(v2('core.matching', { learningIntents: [LearningIntent.Practice] }));
    r.register(v2('core.multiple-choice', { learningIntents: [LearningIntent.Assess] }));
    expect(r.searchWithFilters({ intent: LearningIntent.Practice })).toHaveLength(1);
    expect(r.searchWithFilters({ intent: LearningIntent.Assess })).toHaveLength(1);
  });

  it('filters by learning intents with all-of logic', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { learningIntents: [LearningIntent.Practice, LearningIntent.Compare] }));
    r.register(v2('b', { learningIntents: [LearningIntent.Practice] }));
    const result = r.searchWithFilters({
      intents: [LearningIntent.Practice, LearningIntent.Compare],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('filters by a single intent in the intents array like the old intent field', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { learningIntents: [LearningIntent.Assess] }));
    r.register(v2('b', { learningIntents: [LearningIntent.Practice] }));
    expect(r.searchWithFilters({ intents: [LearningIntent.Assess] })).toHaveLength(1);
  });

  it('keeps the singular intent field as a deprecated alias', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { learningIntents: [LearningIntent.Practice] }));
    r.register(v2('b', { learningIntents: [LearningIntent.Assess] }));
    expect(r.searchWithFilters({ intent: LearningIntent.Practice })).toHaveLength(1);
  });

  it('filters by subjectTags with any-of logic', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { ai: { subjectTags: ['math', 'fractions'] } }));
    r.register(v2('b', { ai: { subjectTags: ['science'] } }));
    const onlyA = r.searchWithFilters({ subjectTags: ['fractions'] });
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0]!.id).toBe('a');
    expect(r.searchWithFilters({ subjectTags: ['math', 'science'] })).toHaveLength(2);
  });

  it('treats an empty subjectTags array as no constraint', () => {
    const r = createWidgetRegistry();
    r.register(v2('a'));
    r.register(v2('b'));
    expect(r.searchWithFilters({ subjectTags: [] })).toHaveLength(2);
  });

  it('requires both intents and subjectTags when combined', () => {
    const r = createWidgetRegistry();
    r.register(
      v2('a', { learningIntents: [LearningIntent.Practice], ai: { subjectTags: ['math'] } }),
    );
    r.register(
      v2('b', { learningIntents: [LearningIntent.Practice], ai: { subjectTags: ['science'] } }),
    );
    const result = r.searchWithFilters({
      intents: [LearningIntent.Practice],
      subjectTags: ['math'],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('filters by difficulty', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { ai: { difficulty: 'easy' } }));
    r.register(v2('b', { ai: { difficulty: 'hard' } }));
    expect(r.searchWithFilters({ difficulty: 'easy' })).toHaveLength(1);
  });

  it('filters by status', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { status: 'stable' }));
    r.register(v2('b', { status: 'experimental' }));
    expect(r.searchWithFilters({ status: 'stable' })).toHaveLength(1);
  });

  it('filters by capability flag', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { capabilities: { supportsKeyboard: true } }));
    r.register(v2('b', { capabilities: {} }));
    expect(r.searchWithFilters({ capability: 'supportsKeyboard' })).toHaveLength(1);
  });

  it('filters by accessibility flag', () => {
    const r = createWidgetRegistry();
    r.register(v2('a', { accessibility: { screenReader: true } }));
    r.register(v2('b', { accessibility: {} }));
    expect(r.searchWithFilters({ accessibility: 'screenReader' })).toHaveLength(1);
  });

  it('combines multiple filters with AND logic', () => {
    const r = createWidgetRegistry();
    r.register(
      v2('a', { domain: 'core', learningIntents: [LearningIntent.Practice], status: 'stable' }),
    );
    r.register(
      v2('b', { domain: 'core', learningIntents: [LearningIntent.Assess], status: 'stable' }),
    );
    r.register(
      v2('c', { domain: 'math', learningIntents: [LearningIntent.Practice], status: 'stable' }),
    );
    const result = r.searchWithFilters({ domain: 'core', intent: LearningIntent.Practice });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('returns all widgets when no filters specified', () => {
    const r = createWidgetRegistry();
    r.register(v2('a'));
    r.register(v2('b'));
    expect(r.searchWithFilters({})).toHaveLength(2);
  });

  it('searches text in combination with filters', () => {
    const r = createWidgetRegistry();
    r.register(v2('core.matching', { name: 'Matching', domain: 'core', keywords: ['match'] }));
    r.register(v2('core.drag-drop', { name: 'Drag Drop', domain: 'core', keywords: ['drag'] }));
    const result = r.searchWithFilters({ domain: 'core', query: 'match' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('core.matching');
  });

  it('delegates intent/tag matching to matchesIntentTagFilters', () => {
    const widget = v2('core.matching', {
      learningIntents: [LearningIntent.Practice, LearningIntent.Compare],
      ai: { subjectTags: ['math'] },
    });
    const r = createWidgetRegistry();
    r.register(widget);
    const cases: WidgetSearchFilters[] = [
      { intents: [LearningIntent.Practice] },
      { intents: [LearningIntent.Practice], subjectTags: ['math'] },
      { subjectTags: ['science'] },
      { intent: LearningIntent.Compare },
    ];
    for (const filters of cases) {
      const intents = filters.intents ?? (filters.intent ? [filters.intent] : undefined);
      const expected = matchesIntentTagFilters(
        { intents: widget.learningIntents, subjectTags: widget.ai.subjectTags },
        { intents, subjectTags: filters.subjectTags },
      );
      expect(r.searchWithFilters(filters).length === 1).toBe(expected);
    }
  });
});
