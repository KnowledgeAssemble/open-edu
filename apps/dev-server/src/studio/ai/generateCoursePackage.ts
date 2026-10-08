import { readdir, readFile } from 'node:fs/promises';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile as compileFromCourseCompiler } from '@open-edu/course-compiler';
import { loadPackageFromFiles } from '@open-edu/core';
import type { PackageFileSource } from '@open-edu/core';
import { buildCourseSpecPrompt, extractJsonObject } from './prompts/index.js';
import { mapDiagnosticsToQuality } from './qualityMap.js';
import type { AiQualityItem } from './types.js';
import type { AuthoringContext } from '@open-edu/packs';

export const MIN_NOTES_LENGTH = 40;

export type CourseSpecSource =
  | {
      kind: 'notes';
      notes: string;
      completeText: (prompt: string, signal?: AbortSignal) => Promise<string>;
      signal?: AbortSignal;
      locale?: string;
      authoring?: AuthoringContext;
    }
  | { kind: 'spec'; spec: string; extension: '.json' | '.md' };

/**
 * Resolve a course spec source into raw spec text. For notes, calls the LLM
 * and extracts JSON. For spec sources, returns the raw text. This is the
 * shared, transport-independent spec resolution used by the Studio AI
 * middleware (local and browser modes).
 */
export async function resolveCourseSpec(source: CourseSpecSource): Promise<string> {
  if (source.kind === 'spec') {
    if (source.spec.trim().length === 0) {
      throw new GenerateCoursePackageError('spec-invalid', 'Spec file is empty');
    }
    return source.spec;
  }

  if (source.notes.trim().length < MIN_NOTES_LENGTH) {
    throw new GenerateCoursePackageError('notes-too-short', 'Add more detail');
  }

  let raw: string;
  try {
    raw = await source.completeText(
      buildCourseSpecPrompt(source.notes, { locale: source.locale, authoring: source.authoring }),
      source.signal,
    );
  } catch (error) {
    throw new GenerateCoursePackageError(
      'llm',
      `AI generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let spec: Record<string, unknown>;
  try {
    spec = extractJsonObject(raw);
  } catch {
    throw new GenerateCoursePackageError('parse', 'Could not parse the draft');
  }
  return JSON.stringify(spec, null, 2);
}

export interface CompiledCourseFiles {
  /** Logical package paths -> UTF-8 text content (all compiled files). */
  files: Map<string, string>;
  title: string;
  outlinePreview: Array<{ title: string; kind: string }>;
  quality: AiQualityItem[];
}

export class GenerateCoursePackageError extends Error {
  public readonly code: 'llm' | 'parse' | 'write' | 'compile' | 'notes-too-short' | 'spec-invalid';

  constructor(code: GenerateCoursePackageError['code'], message: string) {
    super(message);
    this.name = 'GenerateCoursePackageError';
    this.code = code;
  }
}

/**
 * Stateless, browser-independent course generation. It compiles a course from
 * notes or an uploaded spec in a request-scoped temporary directory, reads the
 * complete output into memory, and deletes the temporary files in `finally`.
 *
 * Unlike the legacy `generateCourse()` draft path, this never keeps a
 * server-side draft registry. The caller owns the returned file set.
 */
export async function generateCoursePackage(
  source: CourseSpecSource,
  options: { compile?: typeof compileFromCourseCompiler } = {},
): Promise<CompiledCourseFiles> {
  const compile = options.compile ?? compileFromCourseCompiler;

  let specText: string;
  try {
    specText = await resolveCourseSpec(source);
  } catch (err) {
    if (err instanceof GenerateCoursePackageError) throw err;
    throw new GenerateCoursePackageError('compile', 'Could not resolve course spec');
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'openedu-gw-course-'));
  const scratchName =
    source.kind === 'notes' ? 'course-spec.json' : `course-spec${source.extension}`;
  const specPath = join(tempDir, scratchName);

  try {
    await writeFile(specPath, specText, 'utf-8');
    const outputDir = join(tempDir, 'out');
    const result = await compile(specPath, { output: outputDir, validate: true });

    if (!result.success) {
      const firstError = result.diagnostics.find((d) => d.severity === 'error');
      throw new GenerateCoursePackageError(
        'compile',
        firstError?.message ?? 'Could not compile the course',
      );
    }

    const files = await readAllFiles(outputDir);
    if (!files.has('package.json')) {
      throw new GenerateCoursePackageError('compile', 'Compiled package is missing package.json');
    }

    const pkg = await loadPackageFromFiles(sourceToPackageSource(files), `browser://${tempDir}`);
    const outlinePreview = (Object.keys(pkg.workflow?.routing ?? {}) ?? []).length
      ? Object.keys(pkg.workflow!.routing).map((path) => {
          const node = pkg.nodes.find((n) => n.relativePath === path);
          const kind = node?.node.type ?? 'other';
          const title =
            node?.node.type === 'lesson'
              ? (node.node.title ?? path)
              : (path.split('/').pop() ?? path);
          if (node?.node.type === 'quiz') {
            return {
              title:
                'quiz' in node.node
                  ? String((node.node as { question?: unknown }).question ?? path)
                  : path,
              kind,
            };
          }
          return { title, kind };
        })
      : [];

    const quality = mapDiagnosticsToQuality(result.diagnostics, outlinePreview);

    return {
      files,
      title: pkg.manifest.title,
      outlinePreview,
      quality,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function readAllFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  async function walk(current: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        files.set(rel, await readFile(full, 'utf-8'));
      }
    }
  }
  await walk(dir);
  return files;
}

function sourceToPackageSource(files: Map<string, string>): PackageFileSource {
  const bytes = new Map<string, Uint8Array>();
  for (const [path, content] of files) {
    bytes.set(path, new TextEncoder().encode(content));
  }
  const keys = Array.from(bytes.keys()).sort();
  return {
    get: (path) => bytes.get(path),
    list: (prefix) => (prefix ? keys.filter((p) => p.startsWith(prefix)) : keys),
  };
}
