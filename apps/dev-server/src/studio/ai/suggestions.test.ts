import { describe, it, expect } from 'vitest';
import { resolveSuggestions, resolvePostCommitSuggestions } from './suggestions';
import type { StudioContextSnapshot } from './context';

describe('resolveSuggestions', () => {
  const mockT = (key: string) => key;

  const baseCtx: Partial<StudioContextSnapshot> = {
    aiAvailable: true,
    locale: 'en',
  };

  it('returns empty array when AI is unavailable', () => {
    const ctx = { ...baseCtx, aiAvailable: false, view: 'home' } as StudioContextSnapshot;
    expect(resolveSuggestions(ctx, mockT)).toEqual([]);
  });

  it('returns create_from_notes when on home view with no course', () => {
    const ctx = { ...baseCtx, view: 'home' } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions.some((s) => s.id === 'create_from_notes')).toBe(true);
    expect(suggestions.some((s) => s.id === 'summarize_course')).toBe(false);
  });

  it('returns create_from_notes first when on home view with a course', () => {
    const ctx = {
      ...baseCtx,
      view: 'home',
      course: { id: '1', title: 'Test', activityCount: 0, outline: [] },
    } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions[0]?.id).toBe('create_from_notes');
    expect(suggestions.some((s) => s.id === 'summarize_course')).toBe(true);
  });

  it('returns correct chips for outline view', () => {
    const ctx = { ...baseCtx, view: 'outline' } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions.map((s) => s.id)).toContain('add_lesson');
    expect(suggestions.map((s) => s.id)).toContain('add_quiz');
    expect(suggestions.map((s) => s.id)).toContain('check_flow');
  });

  it('returns correct chips for edit-activity view', () => {
    const ctx = { ...baseCtx, view: 'edit-activity' } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions.map((s) => s.id)).toContain('improve_activity');
    expect(suggestions.map((s) => s.id)).toContain('check_quality');
    expect(suggestions.map((s) => s.id)).toContain('simplify');
  });

  it('returns correct chips for preview view', () => {
    const ctx = { ...baseCtx, view: 'preview' } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions.map((s) => s.id)).toContain('preview_feedback');
    expect(suggestions.map((s) => s.id)).toContain('add_followup');
  });

  it('returns correct chips for share view', () => {
    const ctx = { ...baseCtx, view: 'share' } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions.map((s) => s.id)).toContain('fix_issues');
    expect(suggestions.map((s) => s.id)).toContain('improve_description');
  });

  it('returns correct chips for library view', () => {
    const ctx = { ...baseCtx, view: 'library' } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions.map((s) => s.id)).toContain('create_course');
    expect(suggestions.map((s) => s.id)).toContain('organize_library');
  });

  it('returns selection-aware chips when activity has a selection', () => {
    const ctx = {
      ...baseCtx,
      view: 'edit-activity',
      activity: {
        path: 'nodes/a.md',
        kind: 'lesson',
        selection: { start: 0, end: 5, text: 'Hello' },
      },
    } as StudioContextSnapshot;
    const suggestions = resolveSuggestions(ctx, mockT);
    expect(suggestions.map((s) => s.id)).toEqual(['rewrite_selection', 'simplify_selection']);
    expect(suggestions[0]!.action.message).toContain('Hello');
  });
});

describe('resolvePostCommitSuggestions', () => {
  const mockT = (key: string, options?: { list?: string }) =>
    options?.list ? `${key}:${options.list}` : key;

  it('returns next-step chips after accept', () => {
    const chips = resolvePostCommitSuggestions(mockT, []);
    expect(chips.map((c) => c.id)).toEqual(['post_add_activity', 'post_preview', 'post_share']);
  });

  it('prepends fix-checks chip listing failed quality ids', () => {
    const chips = resolvePostCommitSuggestions(mockT, [
      { id: 'objectives', labelKey: 'studio.ai.quality.objectives', passed: true },
      {
        id: 'assessment',
        labelKey: 'studio.ai.quality.assessment',
        passed: false,
        detail: 'Add a quiz',
      },
    ]);
    expect(chips[0]?.id).toBe('post_fix_checks');
    expect(chips[0]?.action.message).toContain('assessment');
    expect(chips[0]?.action.message).toContain('Add a quiz');
  });
});
