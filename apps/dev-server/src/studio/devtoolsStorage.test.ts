import { describe, it, expect, beforeEach } from 'vitest';
import { readDevtoolsState, writeDevtoolsState, type DevtoolsState } from './devtoolsStorage';

describe('devtoolsStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to closed with telemetry tab', () => {
    expect(readDevtoolsState()).toEqual({ open: false, tab: 'telemetry' });
  });

  it('persists and restores an open state with a chosen tab', () => {
    const state: DevtoolsState = { open: true, tab: 'logs' };
    writeDevtoolsState(state);
    expect(readDevtoolsState()).toEqual(state);
  });

  it('returns default when stored value is not valid JSON', () => {
    sessionStorage.setItem('openedu.studio.devtools', 'not-json');
    expect(readDevtoolsState()).toEqual({ open: false, tab: 'telemetry' });
  });

  it('ignores an invalid tab and falls back to telemetry', () => {
    writeDevtoolsState({ open: true, tab: 'bogus' as DevtoolsState['tab'] });
    expect(readDevtoolsState()).toEqual({ open: true, tab: 'telemetry' });
  });
});
