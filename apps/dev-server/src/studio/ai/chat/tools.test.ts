import { describe, it, expect, vi } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from '@open-edu/packs';
import { draftActivity, generateCourseDraftTool } from './tools';

const authoringFixture: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  availableActivities: [
    {
      id: 'math.number-line',
      name: 'Number Line',
      intents: [LearningIntent.Practice],
      subjectTags: [],
    },
  ],
  concepts: [],
  objectives: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

vi.mock('../itemGenerate', () => ({
  generateItemAdd: vi.fn(),
  generateItemEdit: vi.fn(),
  ItemRequestError: class extends Error {
    code = 'invalid-request';
    constructor(reason: string) {
      super(reason);
    }
  },
}));

vi.mock('../generateCourse', () => ({
  generateCourseDraft: vi.fn(),
}));

describe('draftActivity', () => {
  it('wraps generateItemAdd for new lesson drafts', async () => {
    const { generateItemAdd } = await import('../itemGenerate');
    vi.mocked(generateItemAdd).mockResolvedValueOnce({
      ok: true,
      item: { kind: 'lesson', title: 'Water Cycle', content: '# Water Cycle\n' },
    });

    const result = await draftActivity({
      type: 'draft_new',
      kind: 'lesson',
      description: 'Create a lesson about the water cycle',
      packageDir: '/test/course',
    });

    expect(generateItemAdd).toHaveBeenCalledWith({
      kind: 'lesson',
      description: 'Create a lesson about the water cycle',
      packageDir: '/test/course',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.kind).toBe('lesson');
    }
  });

  it('forwards authoring from ToolCallRequest to generateItemAdd', async () => {
    const { generateItemAdd } = await import('../itemGenerate');
    vi.mocked(generateItemAdd).mockResolvedValueOnce({
      ok: true,
      item: { kind: 'lesson', title: 'T', content: '# T\n' },
    });
    await draftActivity({
      type: 'draft_new',
      kind: 'lesson',
      description: 'x',
      packageDir: '/pkg',
      authoring: authoringFixture,
    });
    expect(generateItemAdd).toHaveBeenCalledWith(
      expect.objectContaining({ authoring: authoringFixture }),
    );
  });

  it('wraps generateItemEdit for existing activity edits', async () => {
    const { generateItemEdit } = await import('../itemGenerate');
    vi.mocked(generateItemEdit).mockResolvedValueOnce({
      ok: true,
      items: [{ kind: 'quiz', title: 'Q1', content: '{}' }],
    });

    const result = await draftActivity({
      type: 'edit_existing',
      kind: 'quiz',
      currentContent: '{"type":"quiz"}',
      intent: 'rewrite',
      packageDir: '/test/course',
    });

    expect(generateItemEdit).toHaveBeenCalledWith({
      kind: 'quiz',
      intent: 'rewrite',
      currentContent: '{"type":"quiz"}',
      params: undefined,
      packageDir: '/test/course',
    });
    expect(result.ok).toBe(true);
  });

  it('returns error when generateItemAdd fails', async () => {
    const { generateItemAdd } = await import('../itemGenerate');
    vi.mocked(generateItemAdd).mockResolvedValueOnce({
      ok: false,
      code: 'item-retry-failed',
      error: 'LLM failure',
    });

    const result = await draftActivity({
      type: 'draft_new',
      kind: 'lesson',
      description: 'Test',
      packageDir: '/test/course',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('LLM failure');
    }
  });

  it('requires currentContent for edits', async () => {
    const result = await draftActivity({
      type: 'edit_existing',
      kind: 'lesson',
      intent: 'rewrite',
      packageDir: '/test/course',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('currentContent');
    }
  });
});

describe('generateCourseDraftTool', () => {
  it('passes notes source through to generateCourseDraft', async () => {
    const { generateCourseDraft } = await import('../generateCourse');
    vi.mocked(generateCourseDraft).mockResolvedValueOnce({
      success: true,
      draftId: 'draft-1',
      title: 'Notes Course',
      outlinePreview: [{ title: 'Intro', kind: 'lesson' }],
      quality: [],
    });

    const completeText = vi.fn();
    const result = await generateCourseDraftTool({
      notes: 'Build a course about fractions',
      packageDir: '/test/course',
      completeText,
    });

    expect(generateCourseDraft).toHaveBeenCalledWith({
      source: {
        kind: 'notes',
        notes: 'Build a course about fractions',
        completeText,
      },
      packageDir: '/test/course',
    });
    expect(result.ok).toBe(true);
  });

  it('passes spec + specExt through to generateCourseDraft', async () => {
    const { generateCourseDraft } = await import('../generateCourse');
    vi.mocked(generateCourseDraft).mockResolvedValueOnce({
      success: true,
      draftId: 'draft-2',
      title: 'Spec Course',
      outlinePreview: [{ title: 'Intro', kind: 'lesson' }],
      quality: [],
    });

    const result = await generateCourseDraftTool({
      spec: '{"format":"openedu-course-spec"}',
      specExt: '.json',
      packageDir: '/test/course',
      completeText: vi.fn(),
    });

    expect(generateCourseDraft).toHaveBeenCalledWith({
      source: {
        kind: 'spec',
        spec: '{"format":"openedu-course-spec"}',
        extension: '.json',
      },
      packageDir: '/test/course',
    });
    expect(result.ok).toBe(true);
  });

  it('maps notes-too-short failures to teacher-readable errors', async () => {
    const { generateCourseDraft } = await import('../generateCourse');
    vi.mocked(generateCourseDraft).mockResolvedValueOnce({
      success: false,
      draftId: '',
      outlinePreview: [],
      quality: [],
      code: 'notes-too-short',
      error: 'too short',
    });

    const result = await generateCourseDraftTool({
      notes: 'hi',
      packageDir: '/test/course',
      completeText: vi.fn(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too short/i);
    }
  });
});
