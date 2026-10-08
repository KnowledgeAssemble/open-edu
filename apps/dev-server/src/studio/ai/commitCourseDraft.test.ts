import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { commitCourseDraft, resolveNewCourseDir } from './commitCourseDraft';
import { generateCourseDraft, getDraftEntry } from './generateCourse';
import type { AuthoringContext } from '@open-edu/packs';
import { LearningIntent } from '@open-edu/widgets/intents';

const NOTES = 'Teach fourth graders how to add and subtract fractions with like denominators.';

async function makePackageDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'openedu-studio-commit-test-'));
}

describe('commitCourseDraft', () => {
  it('rejects an unknown draftId', async () => {
    const packageDir = await makePackageDir();
    try {
      const result = await commitCourseDraft({
        draftId: 'nonexistent',
        packageDir,
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('draft-not-found');
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('refuses to commit when package has content and force is not set', async () => {
    const packageDir = await makePackageDir();
    try {
      const compile = vi
        .fn()
        .mockImplementation(async (_specPath: string, options: { output: string }) => {
          await mkdir(join(options.output, 'nodes'), { recursive: true });
          await writeFile(
            join(options.output, 'package.json'),
            JSON.stringify({ id: 'test', title: 'Test', version: '1.0.0', author: 'T' }),
            'utf-8',
          );
          return { success: true, diagnostics: [], outputPath: options.output };
        });

      // Generate draft on empty package
      const draft = await generateCourseDraft({
        source: {
          kind: 'notes',
          notes: NOTES,
          completeText: vi
            .fn()
            .mockResolvedValue(
              '{"format":"openedu-course-spec","version":1,"metadata":{"title":"T","description":"D","author":"A"},"lessons":[]}',
            ),
        },
        packageDir,
        compile,
      });

      expect(draft.success).toBe(true);
      expect(draft.draftId).toBeTruthy();

      // Now add content to package
      await mkdir(join(packageDir, 'nodes'), { recursive: true });
      await writeFile(join(packageDir, 'nodes/intro.md'), '# Intro\n\nExisting', 'utf-8');

      const result = await commitCourseDraft({
        draftId: draft.draftId,
        packageDir,
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('has-content');
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('commits a draft to an empty package successfully', async () => {
    const packageDir = await makePackageDir();
    try {
      const compile = vi
        .fn()
        .mockImplementation(async (_specPath: string, options: { output: string }) => {
          await mkdir(join(options.output, 'nodes'), { recursive: true });
          await writeFile(
            join(options.output, 'package.json'),
            JSON.stringify({
              id: 'test-course',
              title: 'Test',
              version: '1.0.0',
              author: 'Test Author',
              entry: 'nodes/intro.md',
            }),
            'utf-8',
          );
          await writeFile(
            join(options.output, 'workflow.json'),
            JSON.stringify({ routing: { 'nodes/intro.md': { onComplete: 'COMPLETED' } } }),
            'utf-8',
          );
          await writeFile(join(options.output, 'nodes/intro.md'), '# Test\n\nContent', 'utf-8');
          return { success: true, diagnostics: [], outputPath: options.output };
        });

      const draft = await generateCourseDraft({
        source: {
          kind: 'notes',
          notes: NOTES,
          completeText: vi
            .fn()
            .mockResolvedValue(
              '{"format":"openedu-course-spec","version":1,"metadata":{"title":"Test","description":"D","author":"A"},"lessons":[]}',
            ),
        },
        packageDir,
        compile,
      });

      expect(draft.success).toBe(true);
      expect(draft.draftId).toBeTruthy();

      const result = await commitCourseDraft({
        draftId: draft.draftId,
        packageDir,
      });

      expect(result.success).toBe(true);
      expect(result.title).toBe('Test');

      // Verify files were written to packageDir
      const { existsSync } = await import('node:fs');
      expect(existsSync(join(packageDir, 'package.json'))).toBe(true);
      expect(existsSync(join(packageDir, 'nodes/intro.md'))).toBe(true);
      expect(existsSync(join(packageDir, 'workflow.json'))).toBe(true);
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('commits even when package has content if force is true', async () => {
    const packageDir = await makePackageDir();
    try {
      const compile = vi
        .fn()
        .mockImplementation(async (_specPath: string, options: { output: string }) => {
          await mkdir(join(options.output, 'nodes'), { recursive: true });
          await writeFile(
            join(options.output, 'package.json'),
            JSON.stringify({
              id: 'new-course',
              title: 'New',
              version: '1.0.0',
              author: 'Test Author',
              entry: 'nodes/lesson.md',
            }),
            'utf-8',
          );
          await writeFile(join(options.output, 'nodes/lesson.md'), '# New\n\nContent', 'utf-8');
          return { success: true, diagnostics: [], outputPath: options.output };
        });

      // Generate draft on empty package
      const draft = await generateCourseDraft({
        source: {
          kind: 'notes',
          notes: NOTES,
          completeText: vi
            .fn()
            .mockResolvedValue(
              '{"format":"openedu-course-spec","version":1,"metadata":{"title":"New","description":"D","author":"A"},"lessons":[]}',
            ),
        },
        packageDir,
        compile,
      });

      expect(draft.success).toBe(true);
      expect(draft.draftId).toBeTruthy();

      // Now add content to package
      await mkdir(join(packageDir, 'nodes'), { recursive: true });
      await writeFile(join(packageDir, 'nodes/intro.md'), '# Old\n\nContent', 'utf-8');

      const result = await commitCourseDraft({
        draftId: draft.draftId,
        packageDir,
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.title).toBe('New');
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });
});

describe('resolveNewCourseDir', () => {
  it('slugifies the title into a directory name', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'openedu-ws-slug-'));
    try {
      const dir = resolveNewCourseDir(workspace, 'Fractions for Fourth Graders!');
      expect(dir).toBe(join(workspace, 'fractions-for-fourth-graders'));
      expect(basename(dir)).toBe('fractions-for-fourth-graders');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('falls back to course when the title is empty or only punctuation', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'openedu-ws-fallback-'));
    try {
      expect(basename(resolveNewCourseDir(workspace, ''))).toBe('course');
      expect(basename(resolveNewCourseDir(workspace, '!!!'))).toBe('course');
      expect(basename(resolveNewCourseDir(workspace))).toBe('course');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('de-duplicates against existing directories in the workspace', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'openedu-ws-dedupe-'));
    try {
      await mkdir(join(workspace, 'fractions'), { recursive: true });
      await mkdir(join(workspace, 'fractions-2'), { recursive: true });
      const dir = resolveNewCourseDir(workspace, 'Fractions');
      expect(dir).toBe(join(workspace, 'fractions-3'));
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('does not create anything on the filesystem', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'openedu-ws-pure-'));
    try {
      const dir = resolveNewCourseDir(workspace, 'Pure Function');
      const { existsSync } = await import('node:fs');
      expect(existsSync(dir)).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('commitCourseDraft blueprint validation + provenance', () => {
  const AUTHORING: AuthoringContext = {
    packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
    curriculumUnit: 'fractions',
    learner: 'neurotypical',
    availableActivities: [
      {
        id: 'math.number-line',
        name: 'Number Line',
        intents: [LearningIntent.Practice, LearningIntent.Compare],
        subjectTags: ['math', 'fractions'],
      },
    ],
    concepts: [],
    objectives: [
      {
        id: 'represent-fraction',
        description: 'Represent.',
        concepts: [{ pack: 'openedu-fractions', concept: 'fraction' }],
        requiresIntents: [LearningIntent.Practice],
      },
    ],
    budget: { maxChars: 20000, usedChars: 0, truncated: [] },
    provenance: [],
  };

  function spec(widgetId: string): string {
    return JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-10-08T00:00:00.000Z',
      metadata: { title: 'Fractions', description: 'D', generated: false },
      lessons: [
        {
          id: 'represent',
          title: 'Represent',
          objectives: ['Represent.'],
          coreIdea: 'Parts of a whole.',
          activities: [
            {
              step: 'independent_practice',
              order: 1,
              type: 'widget',
              description: 'Practise representing.',
              widgetId,
              widgetConfig: {},
            },
          ],
        },
      ],
    });
  }

  function compileMock() {
    return vi.fn().mockImplementation(async (_specPath: string, options: { output: string }) => {
      await mkdir(join(options.output, 'nodes'), { recursive: true });
      await writeFile(
        join(options.output, 'package.json'),
        JSON.stringify({ id: 'fractions', title: 'Fractions', version: '1.0.0', author: 'T' }),
        'utf-8',
      );
      await writeFile(join(options.output, 'nodes/represent.md'), '# Represent\n', 'utf-8');
      return { success: true, diagnostics: [] };
    });
  }

  async function makeDraft(packageDir: string, widgetId: string, authoring?: AuthoringContext) {
    return generateCourseDraft({
      source: {
        kind: 'notes',
        notes: NOTES,
        completeText: vi.fn().mockResolvedValue(spec(widgetId)),
      },
      packageDir,
      compile: compileMock(),
      authoring,
    });
  }

  it('rejects a draft that references an unavailable widget and keeps the draft', async () => {
    const packageDir = await makePackageDir();
    try {
      const draft = await makeDraft(packageDir, 'ghost.widget', AUTHORING);
      const result = await commitCourseDraft({ draftId: draft.draftId, packageDir });
      expect(result.success).toBe(false);
      expect(result.code).toBe('invalid-blueprint');
      expect(existsSync(join(packageDir, 'package.json'))).toBe(false);
      expect(getDraftEntry(draft.draftId)).toBeDefined();
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('returns spec-invalid when the draft spec can no longer be read', async () => {
    const packageDir = await makePackageDir();
    try {
      const draft = await makeDraft(packageDir, 'math.number-line', AUTHORING);
      const entry = getDraftEntry(draft.draftId)!;
      await rm(join(entry.tempDir, 'course-spec.json'), { force: true });
      const result = await commitCourseDraft({ draftId: draft.draftId, packageDir });
      expect(result.success).toBe(false);
      expect(result.code).toBe('spec-invalid');
      expect(existsSync(join(packageDir, 'package.json'))).toBe(false);
      expect(getDraftEntry(draft.draftId)).toBeDefined();
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('commits a valid authoring draft and writes provenance.json', async () => {
    const packageDir = await makePackageDir();
    try {
      const draft = await makeDraft(packageDir, 'math.number-line', AUTHORING);
      const result = await commitCourseDraft({ draftId: draft.draftId, packageDir });
      expect(result.success).toBe(true);
      expect(result.capabilityGaps).toEqual([]);
      const record = JSON.parse(readFileSync(join(packageDir, 'provenance.json'), 'utf-8'));
      expect(record.contextFingerprint).toMatch(/^sha256:/);
      expect(record.nodes[0].path).toBe('nodes/represent.md');
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });

  it('removes a stale provenance.json on the force path', async () => {
    const packageDir = await makePackageDir();
    try {
      await mkdir(join(packageDir, 'nodes'), { recursive: true });
      await writeFile(join(packageDir, 'nodes/old.md'), '# Old\n', 'utf-8');
      await writeFile(join(packageDir, 'provenance.json'), '{"stale":true}', 'utf-8');
      const draft = await makeDraft(packageDir, 'math.number-line');
      const result = await commitCourseDraft({ draftId: draft.draftId, packageDir, force: true });
      expect(result.success).toBe(true);
      expect(existsSync(join(packageDir, 'provenance.json'))).toBe(false);
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });
});
