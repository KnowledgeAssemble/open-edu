import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadPackage } from '@open-edu/core';
import { parseCourseSpec, parseCourseSpecJSON } from '@open-edu/course-compiler';
import { getProfile } from '@open-edu/domain-guidance';
import { validateBlueprint } from '@open-edu/packs';
import type { ReproductionRecord } from '@open-edu/schemas';
import { buildProvenance, factsFromModel } from './provenance.js';
import { getDraftEntry, deleteDraft } from './generateCourse.js';

/**
 * Resolve a brand-new course directory inside `workspaceRoot` derived from a
 * human-readable title. Slugifies the title into a kebab-case directory name
 * (falling back to `course` when nothing usable remains) and de-duplicates
 * against existing entries by appending `-2`, `-3`, ... This is a pure
 * function: it never touches the filesystem and returns a path that the caller
 * is responsible for creating.
 */
export function resolveNewCourseDir(workspaceRoot: string, title?: string): string {
  const slug = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = slug || 'course';

  const root = resolve(workspaceRoot);
  let candidate = base;
  let counter = 2;
  while (existsSync(join(root, candidate))) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return join(root, candidate);
}

export interface CommitCourseDraftOptions {
  draftId: string;
  packageDir: string;
  force?: boolean;
}

export interface CommitCourseDraftResult {
  success: boolean;
  title?: string;
  error?: string;
  code?: 'draft-not-found' | 'draft-expired' | 'has-content' | 'write' | 'invalid-blueprint';
  capabilityGaps?: string[];
}

function hasNodes(packageDir: string): boolean {
  const nodesDir = join(packageDir, 'nodes');
  return existsSync(nodesDir) && readdirSync(nodesDir).length > 0;
}

async function clearPackageContents(packageDir: string): Promise<void> {
  const nodesDir = join(packageDir, 'nodes');
  if (existsSync(nodesDir)) {
    await rm(nodesDir, { recursive: true, force: true });
  }
  const assetsDir = join(packageDir, 'assets');
  if (existsSync(assetsDir)) {
    await rm(assetsDir, { recursive: true, force: true });
  }
  for (const rel of [
    'workflow.json',
    'package.json',
    'rewards.json',
    'cards.json',
    'provenance.json',
  ]) {
    const abs = join(packageDir, rel);
    if (existsSync(abs)) {
      await rm(abs, { force: true });
    }
  }
}

export async function commitCourseDraft(
  options: CommitCourseDraftOptions,
): Promise<CommitCourseDraftResult> {
  const { draftId, packageDir, force = false } = options;

  const entry = getDraftEntry(draftId);
  if (!entry) {
    return {
      success: false,
      error: 'Draft not found or expired',
      code: 'draft-not-found',
    };
  }

  const packageHasContent = hasNodes(packageDir);
  if (!force && packageHasContent) {
    return {
      success: false,
      error: 'Package already has content',
      code: 'has-content',
    };
  }

  let provenanceRecord: ReproductionRecord | undefined;
  let capabilityGaps: string[] = [];
  if (entry.authoring) {
    const specText = readFileSync(entry.specPath, 'utf-8');
    const model = entry.specPath.endsWith('.json')
      ? parseCourseSpecJSON(specText).model
      : parseCourseSpec(specText).model;
    if (!model) {
      return {
        success: false,
        error: 'course spec failed to parse',
        code: 'invalid-blueprint',
      };
    }
    const facts = factsFromModel(model);
    facts.expectedAudience = entry.authoring.learner
      ? getProfile(entry.authoring.learner)?.audience
      : undefined;
    const { violations } = validateBlueprint(entry.authoring, facts);
    if (violations.length > 0) {
      return {
        success: false,
        error: violations[0]!.message,
        code: 'invalid-blueprint',
      };
    }
    const provenance = buildProvenance(entry.authoring, model, new Date().toISOString());
    provenanceRecord = provenance.record;
    capabilityGaps = provenance.capabilityGaps;
  }

  try {
    if (force && packageHasContent) {
      await clearPackageContents(packageDir);
    }
    await cp(entry.outputDir, packageDir, { recursive: true });
    if (provenanceRecord) {
      await writeFile(
        join(packageDir, 'provenance.json'),
        JSON.stringify(provenanceRecord, null, 2),
        'utf-8',
      );
    }
  } catch (error) {
    return {
      success: false,
      error: `Could not save draft: ${error instanceof Error ? error.message : String(error)}`,
      code: 'write',
    };
  }

  deleteDraft(draftId);

  let title: string | undefined;
  try {
    const pkg = await loadPackage(packageDir);
    title = pkg.manifest.title;
  } catch {
    // loadPackage may fail if the draft is incomplete; title remains undefined
  }

  return { success: true, title, capabilityGaps };
}
