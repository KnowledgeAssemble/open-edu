import { describe, it, expect } from 'vitest';
import { WIDGET_ALIAS_MAP } from './widget-alias';

describe('WIDGET_ALIAS_MAP', () => {
  it('maps the deprecated practice widget to core.multiple-choice', () => {
    expect(WIDGET_ALIAS_MAP['open-edu.multiple-choice-practice']).toBe('core.multiple-choice');
  });

  it('contains 15 alias entries', () => {
    expect(Object.keys(WIDGET_ALIAS_MAP)).toHaveLength(15);
  });
});
