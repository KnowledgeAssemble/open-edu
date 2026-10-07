import { describe, it, expect } from 'vitest';
import { loadNodes } from './nodes-fs';
import { parseNodeContent, loadNodesFromSource } from './nodes';
import { NodeLoadError } from './errors';
import { resolve, join } from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import type { PackageFileSource } from './types';

const fixturesDir = resolve(__dirname, '__fixtures__');

function makeSource(files: Record<string, string | Uint8Array>): PackageFileSource {
  const map = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(files)) {
    map.set(path, typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data));
  }
  const list = (prefix?: string) => {
    const names = Array.from(map.keys()).sort();
    return prefix ? names.filter((p) => p.startsWith(prefix)) : names;
  };
  return {
    get: (path) => map.get(path),
    list,
  };
}

const browserFixtureSource = makeSource({
  'package.json': JSON.stringify({
    id: 'browser-studio',
    title: 'Browser Studio Composite',
    version: '1.0.0',
    author: 'Open-Edu',
    entry: 'nodes/lesson.md',
  }),
  'workflow.json': JSON.stringify({
    routing: { 'nodes/lesson.md': { onComplete: 'nodes/quiz.json' } },
  }),
  'nodes/lesson.md': '# Why the Sky Is Blue\n\nSome text.',
  'nodes/quiz.json': JSON.stringify({
    type: 'quiz',
    title: 'Sky Quiz',
    question: 'Which color scatters the most?',
    options: [
      { id: 'a', text: 'Red', correct: false },
      { id: 'b', text: 'Blue', correct: true },
    ],
  }),
  'assets/diagram.png': new Uint8Array([137, 80, 78, 71]),
  'assets/notes.txt': 'Unknown text file',
});

describe('loadNodesFromSource', () => {
  it('loads markdown and JSON nodes from an in-memory source', () => {
    const nodes = loadNodesFromSource(browserFixtureSource);
    expect(nodes).toHaveLength(2);
    const paths = nodes.map((n) => n.relativePath).sort();
    expect(paths).toEqual(['nodes/lesson.md', 'nodes/quiz.json']);
    const lesson = nodes.find((n) => n.relativePath === 'nodes/lesson.md');
    expect(lesson!.node.title).toBe('Why the Sky Is Blue');
    const quiz = nodes.find((n) => n.relativePath === 'nodes/quiz.json');
    if (quiz!.node.type === 'quiz') {
      expect(quiz!.node.question).toBe('Which color scatters the most?');
    }
  });

  it('uses relative paths as both path and relativePath', () => {
    const [lesson] = loadNodesFromSource(browserFixtureSource);
    expect(lesson!.path).toBe('nodes/lesson.md');
    expect(lesson!.relativePath).toBe('nodes/lesson.md');
  });

  it('rejects subdirectories inside nodes/', () => {
    const source = makeSource({
      'nodes/lesson.md': '# Lesson',
      'nodes/sub/a.md': '# Nested',
    });
    expect(() => loadNodesFromSource(source)).toThrow(NodeLoadError);
    try {
      loadNodesFromSource(source);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('Subdirectories inside nodes/');
    }
  });

  it('returns an empty array when there are no nodes', () => {
    const source = makeSource({ 'package.json': '{}' });
    expect(loadNodesFromSource(source)).toEqual([]);
  });
});

describe('parseNodeContent', () => {
  it('preserves markdown title extraction', () => {
    expect(parseNodeContent('nodes/lesson.md', '# Getting Started')).toEqual({
      type: 'lesson',
      title: 'Getting Started',
    });
    expect(parseNodeContent('nodes/plain.md', 'No heading')).toEqual({
      type: 'lesson',
      title: undefined,
    });
  });

  it('parses a valid JSON node', () => {
    const node = parseNodeContent(
      'nodes/quiz.json',
      JSON.stringify({
        type: 'quiz',
        question: 'Q?',
        options: [
          { id: 'a', text: 'A', correct: true },
          { id: 'b', text: 'B', correct: false },
        ],
      }),
    );
    expect(node.type).toBe('quiz');
  });

  it('rejects malformed JSON nodes', () => {
    expect(() => parseNodeContent('nodes/quiz.json', 'not json')).toThrow(NodeLoadError);
  });

  it('rejects schema-invalid JSON nodes', () => {
    expect(() => parseNodeContent('nodes/quiz.json', JSON.stringify({ type: 'quiz' }))).toThrow(
      NodeLoadError,
    );
  });

  it('rejects JSON nodes without a type', () => {
    expect(() => parseNodeContent('nodes/x.json', JSON.stringify({ question: 'Q' }))).toThrow(
      NodeLoadError,
    );
  });

  it('rejects unsupported extensions', () => {
    expect(() => parseNodeContent('nodes/file.txt', 'hello')).toThrow(NodeLoadError);
  });

  it('uses logical paths in error messages', () => {
    try {
      parseNodeContent('nodes/quiz.json', '{bad');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('nodes/quiz.json');
      expect((err as Error).message).not.toMatch(/\/Users\//);
    }
  });
});

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = join(fixturesDir, `tmp-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, 'nodes'), { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('loadNodes', () => {
  it('should load all node files from valid-package', async () => {
    const nodes = await loadNodes(join(fixturesDir, 'valid-package'));
    expect(nodes).toHaveLength(3);
  });

  it('uses forward slashes in relativePath regardless of platform', async () => {
    const nodes = await loadNodes(join(fixturesDir, 'valid-package'));
    const paths = nodes.map((n) => n.relativePath);
    expect(paths).toContain('nodes/lesson-01.md');
    expect(paths).toContain('nodes/quiz-01.json');
    expect(paths).toContain('nodes/reflection-01.json');
    for (const p of paths) {
      expect(p.includes('\\')).toBe(false);
    }
  });

  it('should detect lesson node from .md file', async () => {
    const nodes = await loadNodes(join(fixturesDir, 'valid-package'));
    const lesson = nodes.find((n) => n.relativePath === 'nodes/lesson-01.md');
    expect(lesson).toBeDefined();
    expect(lesson!.node.type).toBe('lesson');
    expect(lesson!.node.title).toBe('Introduction to Variables');
    expect(lesson!.content).toContain('# Introduction to Variables');
  });

  it('should detect quiz node from .json file', async () => {
    const nodes = await loadNodes(join(fixturesDir, 'valid-package'));
    const quiz = nodes.find((n) => n.relativePath === 'nodes/quiz-01.json');
    expect(quiz).toBeDefined();
    expect(quiz!.node.type).toBe('quiz');
    if (quiz!.node.type === 'quiz') {
      expect(quiz!.node.question).toBe('Which keyword creates a constant?');
      expect(quiz!.node.options).toHaveLength(3);
    }
  });

  it('should detect reflection node from .json file', async () => {
    const nodes = await loadNodes(join(fixturesDir, 'valid-package'));
    const reflection = nodes.find((n) => n.relativePath === 'nodes/reflection-01.json');
    expect(reflection).toBeDefined();
    expect(reflection!.node.type).toBe('reflection');
    if (reflection!.node.type === 'reflection') {
      expect(reflection!.node.prompt).toBe('Describe what you learned.');
    }
  });

  it('should return empty array when nodes/ directory is missing', async () => {
    const nodes = await loadNodes(join(fixturesDir, 'nonexistent'));
    expect(nodes).toEqual([]);
  });

  it('should reject invalid JSON node files', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'nodes', 'bad.json'), 'not json');
      await expect(loadNodes(dir)).rejects.toThrow(NodeLoadError);
    });
  });

  it('should reject JSON node without type field', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'nodes', 'notype.json'), JSON.stringify({ question: 'test' }));
      await expect(loadNodes(dir)).rejects.toThrow(NodeLoadError);
    });
  });

  it('should reject subdirectories inside nodes/ with a NodeLoadError', async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, 'nodes', 'subdir'), { recursive: true });
      await writeFile(join(dir, 'nodes', 'subdir', 'a.md'), '# A');
      await expect(loadNodes(dir)).rejects.toThrow(NodeLoadError);
    });
  });

  it('should extract title from first # heading in markdown', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'nodes', 'intro.md'),
        '# Getting Started\n\nSome content.\n\n## Subheading\n\nMore content.',
      );
      const nodes = await loadNodes(dir);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.node.title).toBe('Getting Started');
    });
  });

  it('should return undefined title for markdown without # heading', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'nodes', 'plain.md'), 'Just some text without a heading.');
      const nodes = await loadNodes(dir);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.node.title).toBeUndefined();
    });
  });

  it('should use only the first # heading as title', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'nodes', 'multi.md'),
        '# First Heading\n\nContent.\n\n# Second Heading\n\nMore content.',
      );
      const nodes = await loadNodes(dir);
      expect(nodes[0]!.node.title).toBe('First Heading');
    });
  });

  it('should preserve title from JSON node files', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'nodes', 'quiz.json'),
        JSON.stringify({
          type: 'quiz',
          title: 'My Quiz',
          question: 'Test?',
          options: [
            { id: 'a', text: 'yes', correct: true },
            { id: 'b', text: 'no', correct: false },
          ],
        }),
      );
      const nodes = await loadNodes(dir);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.node.title).toBe('My Quiz');
    });
  });

  it('should return undefined title for JSON node files without title field', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'nodes', 'quiz.json'),
        JSON.stringify({
          type: 'quiz',
          question: 'Test?',
          options: [
            { id: 'a', text: 'yes', correct: true },
            { id: 'b', text: 'no', correct: false },
          ],
        }),
      );
      const nodes = await loadNodes(dir);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.node.title).toBeUndefined();
    });
  });
});
