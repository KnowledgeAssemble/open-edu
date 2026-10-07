import { describe, it, expect, vi } from 'vitest';
import { buildOpenEduBridge, buildSemanticTokens, readCssTokens } from '../src/bridge';

describe('buildOpenEduBridge', () => {
  const announce = vi.fn();
  const onEvent = vi.fn();
  const inputs = {
    locale: 'en',
    tokens: { emphasis: '#112233', danger: '#cc0000' },
    reducedMotion: true,
    t: (key: string) => `t:${key}`,
    announce,
    onEvent,
    resolveAsset: (id: string) => `/assets/${id}`,
  };

  it('maps each host input onto the OpenEduBridge contract', () => {
    const bridge = buildOpenEduBridge(inputs);
    expect(bridge.locale).toBe('en');
    expect(bridge.reducedMotion).toBe(true);
    expect(bridge.tokens).toEqual(inputs.tokens);
    expect(bridge.t('runtime.loaded')).toBe('t:runtime.loaded');
    expect(bridge.t('x', { n: '5' })).toBe('t:x');
    bridge.announce('hello');
    expect(announce).toHaveBeenCalledWith('hello');
    bridge.onEvent({ seq: 1, name: 'engine-ready', instanceId: 'a' });
    expect(onEvent).toHaveBeenCalledWith({
      seq: 1,
      name: 'engine-ready',
      instanceId: 'a',
    });
    expect(bridge.resolveAsset('map.png')).toBe('/assets/map.png');
  });

  it('wraps the input onEvent without dropping fields', () => {
    const bridge = buildOpenEduBridge({ ...inputs, reducedMotion: false });
    bridge.onEvent({
      seq: 2,
      name: 'timeline.event-selected',
      instanceId: 'tl',
      action: { type: 'focus' },
    });
    expect(onEvent).toHaveBeenLastCalledWith({
      seq: 2,
      name: 'timeline.event-selected',
      instanceId: 'tl',
      action: { type: 'focus' },
    });
  });
});

describe('readCssTokens', () => {
  it('extracts --oe-* custom properties from the document root', () => {
    const el = document.documentElement;
    el.style.setProperty('--oe-color-primary', '#123456');
    el.style.setProperty('some-other-var', '#999');
    const tokens = readCssTokens(document);
    expect(tokens['--oe-color-primary']).toContain('#123456');
    expect(tokens['some-other-var']).toBeUndefined();
  });
});

describe('buildSemanticTokens', () => {
  it('maps semantic aliases from --oe-* theme variables', () => {
    const el = document.documentElement;
    el.style.setProperty('--oe-color-primary', '#112233');
    el.style.setProperty('--oe-color-error', '#cc0000');
    const tokens = buildSemanticTokens(document);
    expect(tokens.emphasis).toContain('#112233');
    expect(tokens.danger).toContain('#cc0000');
    expect(tokens['--oe-color-primary']).toContain('#112233');
  });
});
