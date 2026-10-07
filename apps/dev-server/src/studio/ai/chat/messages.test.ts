import { describe, it, expect } from 'vitest';
import { studioChatMessage } from './messages';

describe('studioChatMessage', () => {
  it('resolves English studio chat keys', () => {
    expect(studioChatMessage('assistant.chat.editReady')).toContain('updated version');
  });

  it('interpolates params', () => {
    expect(studioChatMessage('assistant.chat.draftReady', 'en', { kind: 'lesson' })).toContain(
      'lesson',
    );
  });

  it('falls back to the key when missing', () => {
    expect(studioChatMessage('assistant.chat.missing.key')).toBe('assistant.chat.missing.key');
  });
});
