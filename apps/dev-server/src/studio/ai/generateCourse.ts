import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile as compileFromCourseCompiler } from '@open-edu/course-compiler';
import { parseCourseSpec, parseCourseSpecJSON } from '@open-edu/course-compiler';
import { loadPackage } from '@open-edu/core';
import { getProfile } from '@open-edu/domain-guidance';
import { validateBlueprint } from '@open-edu/packs';
import { buildProvenance, factsFromModel } from './provenance.js';
import { mapDiagnosticsToQuality } from './qualityMap.js';
import { detectActivityKind, titleFromMarkdown, titleFromQuizJson } from '../outlineModel.js';
import type { AiGenerateErrorCode, CourseDraftResult } from './types.js';
import { resolveCourseSpec, type CourseSpecSource } from './generateCoursePackage.js';
import type { AuthoringContext } from '@open-edu/packs';

const DRAFT_TTL_MS = 30 * 60 * 1000;

export type CourseDraftSource = CourseSpecSource;

export interface GenerateCourseOptions {
  source: CourseDraftSource;
  packageDir: string;
  compile?: typeof compileFromCourseCompiler;
  authoring?: AuthoringContext;
  locale?: string;
  finalize?: boolean;
}

interface DraftEntry {
  tempDir: string;
  outputDir: string;
  specPath: string;
  title?: string;
  createdAt: number;
  authoring?: AuthoringContext;
}

const activeDrafts = new Map<string, DraftEntry>();

function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getDraftEntry(draftId: string): DraftEntry | undefined {
  const entry = activeDrafts.get(draftId);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > DRAFT_TTL_MS) {
    activeDrafts.delete(draftId);
    rm(entry.tempDir, { recursive: true, force: true }).catch(() => {});
    return undefined;
  }
  return entry;
}

export function deleteDraft(draftId: string): void {
  const entry = activeDrafts.get(draftId);
  if (entry) {
    activeDrafts.delete(draftId);
    rm(entry.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Base64 file list for a still-live server draft (browser OPFS consumers).
 *  Returns null when the draft no longer exists or its output cannot be read. */
export function readDraftFiles(
  draftId: string,
): Array<{ path: string; content: string; encoding: 'base64' }> | null {
  const entry = getDraftEntry(draftId);
  if (!entry) return null;

  const files: Array<{ path: string; content: string; encoding: 'base64' }> = [];
  const walk = (dir: string, prefix = ''): void => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      try {
        const stat = statSync(abs);
        if (stat.isDirectory()) {
          walk(abs, `${prefix}${name}/`);
        } else if (stat.isFile()) {
          files.push({
            path: `${prefix}${name}`,
            content: readFileSync(abs).toString('base64'),
            encoding: 'base64',
          });
        }
      } catch {
        // skip unreadable entries
      }
    }
  };
  walk(entry.outputDir);
  return files;
}

function errorResult(code: AiGenerateErrorCode, error: string): CourseDraftResult {
  return { success: false, code, quality: [], outlinePreview: [], error, draftId: '' };
}

function fallbackOutline(packageDir: string): Array<{ title: string; kind: string }> {
  try {
    const workflowPath = join(packageDir, 'workflow.json');
    if (!existsSync(workflowPath)) return [];
    const workflow = JSON.parse(readFileSync(workflowPath, 'utf-8')) as {
      routing?: Record<string, unknown>;
    };
    return Object.keys(workflow.routing ?? {}).map((path) => ({
      title: path.split('/').pop() ?? path,
      kind: 'other',
    }));
  } catch {
    return [];
  }
}

async function buildOutlinePreview(
  packageDir: string,
): Promise<Array<{ title: string; kind: string }>> {
  try {
    const pkg = await loadPackage(packageDir);
    const routingPaths = Object.keys(pkg.workflow?.routing ?? {});
    const nodeContent = new Map(pkg.nodes.map((node) => [node.relativePath, node.content]));
    return routingPaths.map((path) => {
      const content = nodeContent.get(path) ?? '';
      const kind = detectActivityKind(path, content);
      const title =
        kind === 'lesson'
          ? titleFromMarkdown(content)
          : kind === 'quiz'
            ? titleFromQuizJson(content)
            : (path.split('/').pop() ?? path);
      return { title, kind };
    });
  } catch {
    return fallbackOutline(packageDir);
  }
}

/**
 * Local draft generation using the shared `resolveCourseSpec` service.
 * Adds local-only in-memory draft storage with TTL for the Vite middleware.
 * Unlike the hosted `generateCoursePackage`, this preserves the temp directory
 * so `commitCourseDraft` can write to packageDir later.
 */
export async function generateCourseDraft(
  options: GenerateCourseOptions,
): Promise<CourseDraftResult> {
  const { source } = options;
  const compile = options.compile ?? compileFromCourseCompiler;

  // Validate and resolve spec using the shared service.
  let specText: string;
  try {
    specText = await resolveCourseSpec(source);
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error ? (error as { code: string }).code : 'compile';
    return errorResult(
      code === 'notes-too-short'
        ? 'notes-too-short'
        : code === 'spec-invalid'
          ? 'spec-invalid'
          : code === 'llm'
            ? 'llm'
            : code === 'parse'
              ? 'parse'
              : 'compile',
      error instanceof Error ? error.message : 'Could not resolve course spec.',
    );
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'openedu-studio-ai-'));
  const scratchName =
    source.kind === 'notes' ? 'course-spec.json' : `course-spec${source.extension}`;
  const specPath = join(tempDir, scratchName);
  try {
    await writeFile(specPath, specText, 'utf-8');
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return errorResult('write', 'Could not write the draft.');
  }

  const outputDir = join(tempDir, 'out');
  let result;
  try {
    result = await compile(specPath, { output: outputDir, validate: true });
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return errorResult('compile', 'Could not compile the draft.');
  }

  const outlinePreview = await buildOutlinePreview(outputDir);
  const quality = mapDiagnosticsToQuality(result.diagnostics, outlinePreview);
  const firstError = result.diagnostics.find((diagnostic) => diagnostic.severity === 'error');

  if (result.success && options.finalize && options.authoring) {
    const specText = readFileSync(specPath, 'utf-8');
    const model = specPath.endsWith('.json')
      ? parseCourseSpecJSON(specText).model
      : parseCourseSpec(specText).model;
    if (!model) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return errorResult('invalid-blueprint', 'course spec failed to parse');
    }
    const facts = factsFromModel(model);
    facts.expectedAudience = options.authoring.learner
      ? getProfile(options.authoring.learner)?.audience
      : undefined;
    const { violations } = validateBlueprint(options.authoring, facts);
    if (violations.length > 0) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return errorResult('invalid-blueprint', violations[0]!.message);
    }
    const provenance = buildProvenance(options.authoring, model, new Date().toISOString());
    await writeFile(
      join(outputDir, 'provenance.json'),
      JSON.stringify(provenance.record, null, 2),
      'utf-8',
    );
  }

  const draftId = generateDraftId();
  activeDrafts.set(draftId, {
    tempDir,
    outputDir,
    specPath,
    createdAt: Date.now(),
    ...(options.authoring ? { authoring: options.authoring } : {}),
  });

  if (!result.success) {
    return {
      success: false,
      code: 'compile',
      quality,
      outlinePreview,
      draftId,
      error: firstError?.message ?? 'Could not compile the draft.',
    };
  }

  // Read title from compiled output.
  let title: string | undefined;
  try {
    const manifestPath = join(outputDir, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { title?: string };
      title = manifest.title;
    }
  } catch {
    // Title is optional.
  }

  activeDrafts.get(draftId)!.title = title;

  return {
    success: true,
    quality,
    outlinePreview,
    title,
    draftId,
  };
}
