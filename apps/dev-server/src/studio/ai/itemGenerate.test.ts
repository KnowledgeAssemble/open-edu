import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mapToDraftItem,
  validateItemDraft,
  generateItemAdd,
  generateItemEdit,
  assertItemAddBody,
  assertItemEditBody,
} from './itemGenerate';
import { completeWithLlm, isAiAvailable } from './studioLlm';
import type { CuratedWidget } from '../widgets/curatedCatalog.js';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from '@open-edu/packs';

vi.mock('./studioLlm.js', () => ({
  completeWithLlm: vi.fn(),
  isAiAvailable: vi.fn(),
}));

const multipleChoice: CuratedWidget = {
  id: 'core.multiple-choice',
  name: 'Multiple Choice',
  domain: 'core',
  source: 'builtin',
  trustTier: 'native',
  version: '0.1.0',
  guide: { configFields: [] },
};

vi.mock('../widgets/curatedCatalog.js', () => ({
  getCuratedWidget: (id: string) => (id === 'core.multiple-choice' ? multipleChoice : undefined),
  listCuratedWidgets: () => [multipleChoice],
}));

function validQuizJson(optionCount: number, correctIndex = 0): string {
  const options = Array.from({ length: optionCount }, (_, i) => ({
    id: String.fromCharCode(97 + i),
    text: `Option ${i + 1}`,
    correct: i === correctIndex,
  }));
  return JSON.stringify({ type: 'quiz', question: 'Q?', options }, null, 2);
}

describe('mapToDraftItem / validateItemDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiAvailable).mockReturnValue(true);
  });

  it('rejects a lesson without a heading', () => {
    const item = mapToDraftItem('lesson', { title: 'L', markdown: 'no heading' });
    expect(validateItemDraft(item, { expectedOptionCount: 1 })).toMatch(/heading/);
  });

  it('accepts a lesson with a heading', () => {
    const item = mapToDraftItem('lesson', { title: 'L', markdown: '# Title\n\nBody' });
    expect(validateItemDraft(item, { expectedOptionCount: 1 })).toBeNull();
  });

  it('rejects a quiz with 3 options when 4 expected', () => {
    const item = mapToDraftItem('quiz', {
      question: 'Q?',
      options: [
        { text: 'a', correct: true },
        { text: 'b', correct: false },
        { text: 'c', correct: false },
      ],
    });
    expect(validateItemDraft(item, { expectedOptionCount: 4 })).toMatch(/exactly 4 options/);
  });

  it('accepts a 4-option quiz with exactly one correct', () => {
    const item = mapToDraftItem('quiz', {
      question: 'Q?',
      options: [
        { text: 'a', correct: true },
        { text: 'b', correct: false },
        { text: 'c', correct: false },
        { text: 'd', correct: false },
      ],
    });
    expect(validateItemDraft(item, { expectedOptionCount: 4 })).toBeNull();
  });

  it('rejects a quiz with zero correct answers', () => {
    const item = mapToDraftItem('quiz', {
      question: 'Q?',
      options: [
        { text: 'a', correct: false },
        { text: 'b', correct: false },
        { text: 'c', correct: false },
        { text: 'd', correct: false },
      ],
    });
    expect(validateItemDraft(item, { expectedOptionCount: 4 })).toMatch(/one correct answer/);
  });

  it('rejects a quiz with two correct answers', () => {
    const item = mapToDraftItem('quiz', {
      question: 'Q?',
      options: [
        { text: 'a', correct: true },
        { text: 'b', correct: true },
        { text: 'c', correct: false },
        { text: 'd', correct: false },
      ],
    });
    expect(validateItemDraft(item, { expectedOptionCount: 4 })).toMatch(/one correct answer/);
  });

  it('accepts a 2-option quiz when the rewrite preserves its source count', () => {
    const item = mapToDraftItem('quiz', {
      question: 'Q?',
      options: [
        { text: 'a', correct: true },
        { text: 'b', correct: false },
      ],
    });
    expect(validateItemDraft(item, { expectedOptionCount: 2 })).toBeNull();
    const parsed = JSON.parse(item.content) as { options: Array<{ id: string }> };
    expect(parsed.options.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('mints ids a..e for a 5-option quiz', () => {
    const item = mapToDraftItem('quiz', {
      question: 'Q?',
      options: Array.from({ length: 5 }, (_, i) => ({
        text: `o${i}`,
        correct: i === 0,
      })),
    });
    expect(validateItemDraft(item, { expectedOptionCount: 5 })).toBeNull();
    const parsed = JSON.parse(item.content) as { options: Array<{ id: string }> };
    expect(parsed.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('rejects a practice with an unknown widget', () => {
    const item = mapToDraftItem('practice', {
      widget: 'unknown.widget',
      title: 'P',
      config: {},
    });
    expect(validateItemDraft(item, { expectedOptionCount: 1 })).toMatch(
      /not in the curated catalog/,
    );
  });

  it('accepts a practice with a valid widget and config', () => {
    const item = mapToDraftItem('practice', {
      widget: 'core.multiple-choice',
      title: 'P',
      config: { questions: [] },
    });
    expect(validateItemDraft(item, { expectedOptionCount: 1 })).toBeNull();
  });
});

describe('generateItemAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiAvailable).mockReturnValue(true);
  });

  it('returns a validated lesson item on success', async () => {
    vi.mocked(completeWithLlm).mockResolvedValueOnce(
      JSON.stringify({ title: 'Fractions', markdown: '# Fractions\n\nBody' }),
    );
    const packageDir = await mkdtemp(join(tmpdir(), 'openedu-item-add-'));
    try {
      const result = await generateItemAdd({
        kind: 'lesson',
        description: 'Explain fractions',
        packageDir,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.item).toMatchObject({ kind: 'lesson', title: 'Fractions' });
        expect(result.item.content).toContain('# Fractions');
      }
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('injects existing course titles into the add prompt when provided', async () => {
    vi.mocked(completeWithLlm).mockResolvedValueOnce(
      JSON.stringify({ title: 'Fractions', markdown: '# Fractions\n\nBody' }),
    );
    const result = await generateItemAdd({
      kind: 'lesson',
      description: 'Explain fractions',
      packageDir: '/does/not/matter',
      existingTitles: ['Water Basics', 'The Water Cycle'],
    });
    expect(result.ok).toBe(true);
    const prompt = vi.mocked(completeWithLlm).mock.calls[0]![0];
    expect(prompt).toContain('Water Basics');
    expect(prompt).toContain('The Water Cycle');
  });

  it('retries once when the first draft fails validation', async () => {
    vi.mocked(completeWithLlm)
      .mockResolvedValueOnce(
        JSON.stringify({
          question: 'Q?',
          options: Array.from({ length: 3 }, (_, i) => ({
            text: `o${i}`,
            correct: i === 0,
          })),
        }),
      )
      .mockResolvedValueOnce(validQuizJson(4));
    const packageDir = await mkdtemp(join(tmpdir(), 'openedu-item-add-'));
    try {
      const result = await generateItemAdd({
        kind: 'quiz',
        description: 'A quiz',
        packageDir,
      });
      expect(result.ok).toBe(true);
      expect(vi.mocked(completeWithLlm)).toHaveBeenCalledTimes(2);
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('fails twice and returns item-retry-failed', async () => {
    vi.mocked(completeWithLlm).mockResolvedValue('no json here');
    const packageDir = await mkdtemp(join(tmpdir(), 'openedu-item-add-'));
    try {
      const result = await generateItemAdd({
        kind: 'lesson',
        description: 'Explain fractions',
        packageDir,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('item-retry-failed');
      }
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('returns item-retry-failed when the LLM output is unparseable', async () => {
    vi.mocked(completeWithLlm).mockRejectedValueOnce(new Error('network down'));
    const packageDir = await mkdtemp(join(tmpdir(), 'openedu-item-add-'));
    try {
      const result = await generateItemAdd({
        kind: 'practice',
        description: 'A practice',
        packageDir,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('item-retry-failed');
      }
      expect(vi.mocked(completeWithLlm)).toHaveBeenCalledTimes(1);
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('never writes to packageDir', async () => {
    vi.mocked(completeWithLlm).mockResolvedValue(
      JSON.stringify({ title: 'Fractions', markdown: '# Fractions\n\nBody' }),
    );
    const packageDir = await mkdtemp(join(tmpdir(), 'openedu-item-add-'));
    try {
      await generateItemAdd({ kind: 'lesson', description: 'Explain fractions', packageDir });
      const entries = await readdir(packageDir);
      expect(entries).toEqual([]);
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });
});

describe('generateItemEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiAvailable).mockReturnValue(true);
  });

  it('preserves the source option count when rewriting a quiz', async () => {
    const source = validQuizJson(5);
    vi.mocked(completeWithLlm).mockResolvedValueOnce(
      JSON.stringify({
        question: 'New Q?',
        options: Array.from({ length: 5 }, (_, i) => ({
          text: `new ${i}`,
          correct: i === 1,
        })),
      }),
    );
    const result = await generateItemEdit({
      kind: 'quiz',
      intent: 'rewrite',
      currentContent: source,
      packageDir: '/tmp',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.items[0]!.content).options).toHaveLength(5);
    }
    const prompt = vi.mocked(completeWithLlm).mock.calls[0]![0];
    expect(prompt).toContain('exactly 5 options');
  });

  it('add-questions returns three validated quiz items', async () => {
    const questions = Array.from({ length: 3 }, (_, i) => ({
      question: `Q${i}?`,
      options: Array.from({ length: 4 }, (_, j) => ({
        text: `o${i}${j}`,
        correct: j === 0,
      })),
    }));
    vi.mocked(completeWithLlm).mockResolvedValueOnce(JSON.stringify({ questions }));
    const result = await generateItemEdit({
      kind: 'quiz',
      intent: 'add-questions',
      currentContent: validQuizJson(4),
      packageDir: '/tmp',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(3);
      for (const item of result.items) {
        expect(item.kind).toBe('quiz');
        expect(JSON.parse(item.content).options).toHaveLength(4);
      }
    }
  });

  it('throws an invalid-request error for an unknown intent on a kind', async () => {
    await expect(
      generateItemEdit({
        kind: 'lesson',
        intent: 'add-questions',
        currentContent: '# Hi',
        packageDir: '/tmp',
      }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  });

  it('injects the translate target locale into the prompt', async () => {
    vi.mocked(completeWithLlm).mockResolvedValueOnce(
      JSON.stringify({ title: 'Fracciones', markdown: '# Fracciones\n\nCuerpo' }),
    );
    await generateItemEdit({
      kind: 'lesson',
      intent: 'translate',
      currentContent: '# Fractions\n\nBody',
      packageDir: '/tmp',
      params: { targetLocale: 'es' },
    });
    const prompt = vi.mocked(completeWithLlm).mock.calls[0]![0];
    expect(prompt).toContain('es');
  });
});

const authoringFixture: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
  availableActivities: [
    {
      id: 'core.multiple-choice',
      name: 'Multiple Choice',
      intents: [LearningIntent.Practice],
      subjectTags: [],
    },
  ],
  concepts: [],
  objectives: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('item grounding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiAvailable).mockReturnValue(true);
  });

  it('includes the authoring section in the prompt when authoring is provided', async () => {
    vi.mocked(completeWithLlm).mockResolvedValue(
      JSON.stringify({ title: 'T', markdown: '# T\n\nbody' }),
    );
    await generateItemAdd({
      kind: 'lesson',
      description: 'Explain fractions',
      packageDir: '/tmp',
      authoring: authoringFixture,
    });
    const prompt = vi.mocked(completeWithLlm).mock.calls[0]![0] as string;
    expect(prompt).toContain('AUTHORING CONTEXT');
  });

  it('produces prompts without authoring section when authoring is absent', async () => {
    vi.mocked(completeWithLlm).mockResolvedValue(
      JSON.stringify({ title: 'T', markdown: '# T\n\nbody' }),
    );
    await generateItemAdd({
      kind: 'lesson',
      description: 'Explain fractions',
      packageDir: '/tmp',
    });
    const prompt = vi.mocked(completeWithLlm).mock.calls[0]![0] as string;
    expect(prompt).not.toContain('AUTHORING CONTEXT');
  });

  it('rejects a practice widget outside availableActivities', () => {
    const item = mapToDraftItem('practice', {
      widget: 'core.multiple-choice',
      title: 'Bad',
      config: {},
    });
    const err = validateItemDraft(item, {
      expectedOptionCount: 1,
      availableActivityIds: new Set(['math.number-line']),
    });
    expect(err).toMatch(/not in the selected pack/);
  });
});

describe('request validators', () => {
  it('assertItemAddBody accepts a valid body', () => {
    expect(assertItemAddBody({ kind: 'lesson', description: 'Explain fractions' })).toEqual({
      kind: 'lesson',
      description: 'Explain fractions',
    });
  });

  it('assertItemAddBody passes through existing course titles', () => {
    expect(
      assertItemAddBody({
        kind: 'quiz',
        description: 'A quiz',
        existingTitles: ['Water Basics', 'The Water Cycle'],
      }),
    ).toEqual({
      kind: 'quiz',
      description: 'A quiz',
      existingTitles: ['Water Basics', 'The Water Cycle'],
    });
  });

  it('assertItemAddBody ignores non-string existing titles', () => {
    expect(
      assertItemAddBody({
        kind: 'quiz',
        description: 'A quiz',
        existingTitles: ['ok', 42, null],
      }),
    ).toEqual({ kind: 'quiz', description: 'A quiz' });
  });

  it('assertItemAddBody throws on an unknown kind', () => {
    expect(() => assertItemAddBody({ kind: 'video', description: 'x' })).toThrow(
      /kind must be one of/,
    );
  });

  it('assertItemAddBody throws on an empty description', () => {
    expect(() => assertItemAddBody({ kind: 'quiz', description: '  ' })).toThrow(/non-empty/);
  });

  it('assertItemEditBody accepts each intent with valid params', () => {
    expect(
      assertItemEditBody({
        kind: 'lesson',
        intent: 'translate',
        currentContent: '# Hi',
        params: { targetLocale: 'fr' },
      }).params,
    ).toEqual({ targetLocale: 'fr' });
    expect(
      assertItemEditBody({
        kind: 'practice',
        intent: 'difficulty',
        currentContent: '{}',
        params: { direction: 'easier' },
      }).params,
    ).toEqual({ direction: 'easier' });
    expect(
      assertItemEditBody({
        kind: 'quiz',
        intent: 'add-questions',
        currentContent: '{}',
      }).intent,
    ).toBe('add-questions');
  });

  it('assertItemEditBody passes through existing course titles', () => {
    expect(
      assertItemEditBody({
        kind: 'lesson',
        intent: 'rewrite',
        currentContent: '# Hi',
        existingTitles: ['Water Basics', 'The Water Cycle'],
      }).existingTitles,
    ).toEqual(['Water Basics', 'The Water Cycle']);
  });

  it('assertItemEditBody throws on an unknown intent for the kind', () => {
    expect(() =>
      assertItemEditBody({ kind: 'practice', intent: 'expand', currentContent: '{}' }),
    ).toThrow(/Unsupported intent/);
  });

  it('assertItemEditBody throws on missing currentContent', () => {
    expect(() =>
      assertItemEditBody({ kind: 'lesson', intent: 'rewrite', currentContent: '' }),
    ).toThrow(/non-empty/);
  });

  it('assertItemEditBody throws on missing params for translate', () => {
    expect(() =>
      assertItemEditBody({ kind: 'lesson', intent: 'translate', currentContent: '# Hi' }),
    ).toThrow(/targetLocale/);
  });

  it('assertItemEditBody throws on wrong direction', () => {
    expect(() =>
      assertItemEditBody({
        kind: 'lesson',
        intent: 'difficulty',
        currentContent: '# Hi',
        params: { direction: 'medium' },
      }),
    ).toThrow(/direction/);
  });

  it('assertItemEditBody throws on unexpected params for a param-less intent', () => {
    expect(() =>
      assertItemEditBody({
        kind: 'lesson',
        intent: 'rewrite',
        currentContent: '# Hi',
        params: { targetLocale: 'es' },
      }),
    ).toThrow(/does not accept params/);
  });
});
