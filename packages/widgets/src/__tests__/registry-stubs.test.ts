import { describe, it, expect } from 'vitest';
import { createWidgetRegistry, registerAllBuiltins } from '../registry';

describe('Widget registration', () => {
  const WIDGET_IDS = [
    'core.callout',
    'core.image-compare',
    'core.hotspot',
    'core.timeline',
    'science.label-diagram',
    'science.image-label',
  ];

  for (const id of WIDGET_IDS) {
    it(`registers ${id} in default registry`, () => {
      const registry = createWidgetRegistry();
      registerAllBuiltins(registry);
      expect(registry.has(id)).toBe(true);
      expect(registry.get(id)).toBeDefined();
    });
  }

  it('registers all 28 builtins', () => {
    const registry = createWidgetRegistry();
    registerAllBuiltins(registry);
    const all = registry.getAll();
    expect(all).toHaveLength(28);
    const stable = all.filter((w) => (w as unknown as Record<string, unknown>).status === 'stable');
    expect(stable.length).toBeGreaterThanOrEqual(20);
  });
});
