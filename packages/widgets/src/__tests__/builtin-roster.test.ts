import { describe, it, expect } from 'vitest';
import {
  BUILTIN_WIDGETS,
  WIDGET_LEARNING_INTENTS,
  getLearningIntentsForWidget,
  getWidgetsByLearningIntent,
} from '../builtin-roster';
import { LearningIntent } from '../metadata/learning-intents';

describe('BUILTIN_WIDGETS', () => {
  it('contains 28 entries', () => {
    expect(BUILTIN_WIDGETS).toHaveLength(28);
  });

  it('has unique, kebab-case ids with a domain prefix', () => {
    const ids = BUILTIN_WIDGETS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*\.[a-z0-9-]+$/);
    }
  });

  it('retires the deprecated practice widget', () => {
    const ids = BUILTIN_WIDGETS.map((w) => w.id);
    expect(ids).not.toContain('open-edu.multiple-choice-practice');
    expect(ids).not.toContain('core.multiple-choice-practice');
  });

  it('includes core.process-explainer with observe and understand intents', () => {
    const widget = BUILTIN_WIDGETS.find((w) => w.id === 'core.process-explainer');
    expect(widget).toBeDefined();
    expect(widget!.learningIntents).toContain(LearningIntent.Observe);
    expect(widget!.learningIntents).toContain(LearningIntent.Understand);
  });
});

describe('WIDGET_LEARNING_INTENTS', () => {
  it('has the same key set as the roster ids', () => {
    const rosterIds = new Set(BUILTIN_WIDGETS.map((w) => w.id));
    const intentIds = new Set(Object.keys(WIDGET_LEARNING_INTENTS));
    expect(intentIds).toEqual(rosterIds);
    expect(intentIds.size).toBe(28);
  });

  it('resolves intents for a known widget and returns empty for unknown', () => {
    expect(getLearningIntentsForWidget('core.multiple-choice')).toContain(LearningIntent.Assess);
    expect(getLearningIntentsForWidget('unknown.widget')).toEqual([]);
  });

  it('finds widgets by learning intent', () => {
    const widgets = getWidgetsByLearningIntent(LearningIntent.Assess);
    expect(widgets).toContain('core.multiple-choice');
    expect(widgets.length).toBeGreaterThan(0);
  });
});
