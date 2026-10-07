import { describe, it, expect, beforeEach } from 'vitest';
import { writeAiReview, readAiReview, clearAiReview, migrateLegacyReview } from './aiSession';
import type { AiGenerateResult } from './types.js';

const SAMPLE_RESULT: AiGenerateResult = {
  success: true,
  quality: [{ id: 'objectives', labelKey: 'studio.ai.quality.objectives', passed: true }],
  outlinePreview: [{ title: 'Intro', kind: 'lesson' }],
  title: 'AI Course',
};

describe('aiSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips an AI review result', () => {
    writeAiReview(SAMPLE_RESULT);
    expect(readAiReview()).toEqual(SAMPLE_RESULT);
  });

  it('returns null when nothing is stored', () => {
    expect(readAiReview()).toBeNull();
  });

  it('clears the stored review', () => {
    writeAiReview(SAMPLE_RESULT);
    clearAiReview();
    expect(readAiReview()).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    sessionStorage.setItem('openedu.studio.ai.review', 'not-json{');
    expect(readAiReview()).toBeNull();
  });

  it('returns null for malformed shapes', () => {
    sessionStorage.setItem('openedu.studio.ai.review', JSON.stringify({ foo: 'bar' }));
    expect(readAiReview()).toBeNull();
  });

  it('overwrites the previous review', () => {
    writeAiReview(SAMPLE_RESULT);
    const next: AiGenerateResult = {
      success: false,
      quality: [],
      outlinePreview: [],
      error: 'Add more detail',
    };
    writeAiReview(next);
    expect(readAiReview()).toEqual(next);
  });

  it('migrateLegacyReview converts a successful review and clears storage', () => {
    writeAiReview(SAMPLE_RESULT);
    const migrated = migrateLegacyReview();
    expect(migrated).toMatchObject({
      success: true,
      title: 'AI Course',
      draftId: '',
      outlinePreview: SAMPLE_RESULT.outlinePreview,
    });
    expect(readAiReview()).toBeNull();
  });

  it('migrateLegacyReview returns null for unsuccessful reviews after clear', () => {
    writeAiReview({
      success: false,
      quality: [],
      outlinePreview: [],
      error: 'failed',
    });
    expect(migrateLegacyReview()).toBeNull();
    expect(readAiReview()).toBeNull();
  });
});
