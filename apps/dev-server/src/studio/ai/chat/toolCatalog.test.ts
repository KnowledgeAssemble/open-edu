import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  companionToolCatalog,
  editItemInput,
  generateCourseInput,
  generateItemInput,
} from './toolCatalog.js';
import { draftActivity, generateCourseDraftTool } from './tools.js';
import { authoringFixture } from '../../test/authoringFixture.js';

vi.mock('./tools.js', () => ({
  draftActivity: vi.fn(),
  generateCourseDraftTool: vi.fn(),
}));

describe('companionToolCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('registers the three generation tools with contract metadata', () => {
    expect(companionToolCatalog.map((t) => t.id)).toEqual([
      'generate_course',
      'generate_item',
      'edit_item',
    ]);
    for (const tool of companionToolCatalog) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.permission.kind).toBe('propose');
    }
  });

  it('validates generate_course input without a packageDir field', () => {
    const parsed = generateCourseInput.parse({ notes: 'math' });
    expect(parsed.notes).toBe('math');
    expect(generateCourseInput.safeParse({ notes: 'x' }).success).toBe(true);
  });

  it('validates generate_item input and rejects unknown kinds', () => {
    const parsed = generateItemInput.parse({ kind: 'quiz', description: 'a quiz' });
    expect(parsed.kind).toBe('quiz');
    expect(generateItemInput.safeParse({ kind: 'reflection', description: 'x' }).success).toBe(
      false,
    );
  });

  it('validates edit_item input with optional params', () => {
    const parsed = editItemInput.parse({
      kind: 'lesson',
      intent: 'rewrite',
      currentContent: '# Original',
    });
    expect(parsed.intent).toBe('rewrite');
    expect(parsed.params).toBeUndefined();

    const withParams = editItemInput.parse({
      kind: 'lesson',
      intent: 'difficulty',
      currentContent: '# Original',
      params: { direction: 'easier' },
    });
    expect(withParams.params).toEqual({ direction: 'easier' });
  });

  it('executes generate_item using the packageDir from the tool context', async () => {
    vi.mocked(draftActivity).mockResolvedValueOnce({
      ok: true,
      items: [{ kind: 'lesson', title: 'L', content: '# L' }],
    });
    const tool = companionToolCatalog.find((t) => t.id === 'generate_item')!;

    const result = await tool.execute(
      { kind: 'lesson', description: 'Explain fractions' },
      { packageDir: '/pkg' },
    );

    expect(result.ok).toBe(true);
    expect(draftActivity).toHaveBeenCalledWith({
      type: 'draft_new',
      kind: 'lesson',
      description: 'Explain fractions',
      packageDir: '/pkg',
    });
  });

  it('executes generate_course without throwing when completeText is injected', async () => {
    vi.mocked(generateCourseDraftTool).mockResolvedValueOnce({
      ok: true,
      courseDraft: {
        success: true,
        title: 'Course',
        outlinePreview: [],
        quality: [],
        draftId: 'd1',
      },
    });
    const tool = companionToolCatalog.find((t) => t.id === 'generate_course')!;
    const completeText = vi.fn();

    const result = await tool.execute(
      { notes: 'Build a course' },
      { packageDir: '/pkg', completeText },
    );

    expect(result.ok).toBe(true);
    expect(generateCourseDraftTool).toHaveBeenCalledWith({
      notes: 'Build a course',
      packageDir: '/pkg',
      completeText,
    });
  });

  it('returns an error from generate_course when completeText is missing', async () => {
    const tool = companionToolCatalog.find((t) => t.id === 'generate_course')!;

    const result = await tool.execute({ notes: 'Build a course' }, { packageDir: '/pkg' });

    expect(result.ok).toBe(false);
    expect(generateCourseDraftTool).not.toHaveBeenCalled();
  });

  it('generate_course forwards ctx.authoring and locale into generateCourseDraftTool', async () => {
    vi.mocked(generateCourseDraftTool).mockResolvedValueOnce({
      ok: true,
      courseDraft: {
        success: true,
        title: 'Course',
        outlinePreview: [],
        quality: [],
        draftId: 'd1',
      },
    });
    const tool = companionToolCatalog.find((t) => t.id === 'generate_course')!;
    const completeText = vi.fn();
    await tool.execute(
      { notes: 'Build a course' },
      { packageDir: '/pkg', completeText, authoring: authoringFixture },
    );
    expect(generateCourseDraftTool).toHaveBeenCalledWith({
      notes: 'Build a course',
      packageDir: '/pkg',
      completeText,
      authoring: authoringFixture,
      locale: authoringFixture.locale,
    });
  });

  it('generate_item forwards ctx.authoring into draftActivity', async () => {
    vi.mocked(draftActivity).mockResolvedValueOnce({
      ok: true,
      items: [{ kind: 'lesson', title: 'L', content: '# L' }],
    });
    const tool = companionToolCatalog.find((t) => t.id === 'generate_item')!;
    await tool.execute(
      { kind: 'lesson', description: 'Explain fractions' },
      { packageDir: '/pkg', authoring: authoringFixture },
    );
    expect(draftActivity).toHaveBeenCalledWith({
      type: 'draft_new',
      kind: 'lesson',
      description: 'Explain fractions',
      packageDir: '/pkg',
      authoring: authoringFixture,
    });
  });

  it('edit_item forwards ctx.authoring into draftActivity', async () => {
    vi.mocked(draftActivity).mockResolvedValueOnce({
      ok: true,
      items: [{ kind: 'lesson', title: 'L', content: '# L' }],
    });
    const tool = companionToolCatalog.find((t) => t.id === 'edit_item')!;
    await tool.execute(
      { kind: 'lesson', intent: 'rewrite', currentContent: '# Hi' },
      { packageDir: '/pkg', authoring: authoringFixture },
    );
    expect(draftActivity).toHaveBeenCalledWith({
      type: 'edit_existing',
      kind: 'lesson',
      intent: 'rewrite',
      currentContent: '# Hi',
      packageDir: '/pkg',
      authoring: authoringFixture,
    });
  });
});
