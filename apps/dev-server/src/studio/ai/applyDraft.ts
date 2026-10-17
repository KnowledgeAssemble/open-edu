import type { AuthoringContext } from '@open-edu/packs';
import type { StudioApi } from '../studioApi';
import type { DraftItem } from './types';
import { refreshProvenanceAfterApply } from './provenanceRefresh.js';
import { applyChangeSet } from './applyChangeSet';
import { buildItemChangeSet } from './buildItemChangeSet';
import { diffChangeSet, type FileDiff } from './changeSet';

export type ApplyMode = 'file' | 'buffer';

export interface ApplyDraftOptions {
  mode: ApplyMode;
  path?: string;
  applyToEditor?: (d: DraftItem) => void;
  openInEditor?: boolean;
  authoring?: AuthoringContext | null;
}

export interface ApplyDraftResult {
  path?: string;
  paths: string[];
  preview: FileDiff[];
  changeSetId: string;
}

export async function applyDraft(
  api: StudioApi,
  draft: DraftItem,
  options: ApplyDraftOptions,
): Promise<ApplyDraftResult> {
  if (options.mode === 'file') {
    return applyDraftToFile(api, draft, options);
  }
  return applyDraftToBuffer(draft, options);
}

/**
 * Apply a batch of generated items as a single atomic workspace commit (SPEC
 * §14, §17): build one ChangeSet, preview it with `diffChangeSet`, then commit
 * through the workspace transaction. There is no per-file partial-failure path.
 */
export async function applyDraftBatch(
  api: StudioApi,
  drafts: DraftItem[],
  options?: { authoring?: AuthoringContext | null },
): Promise<ApplyDraftResult> {
  const workspace = await api.getWorkspace();
  const changeSet = buildItemChangeSet(drafts, []);
  const preview = await diffChangeSet(changeSet, workspace);
  const result = await applyChangeSet(changeSet, workspace);
  if (!result.success) {
    throw new Error(result.error ?? 'Could not apply the draft');
  }
  const paths = changeSet.changes.map((c) => c.path);
  await appendToOutline(api, paths);
  void refreshProvenanceAfterApply(
    api,
    changeSet.changes.map((c, i) => ({
      path: c.path,
      title: drafts[i]?.title,
      content: drafts[i]?.content ?? '',
    })),
    options?.authoring ?? null,
  );
  return { paths, preview, changeSetId: changeSet.id };
}

async function applyDraftToFile(
  api: StudioApi,
  draft: DraftItem,
  options: ApplyDraftOptions,
): Promise<ApplyDraftResult> {
  const workspace = await api.getWorkspace();
  const explicitPaths = options.path ? [options.path] : undefined;
  const changeSet = buildItemChangeSet([draft], [], explicitPaths);
  const preview = await diffChangeSet(changeSet, workspace);
  const result = await applyChangeSet(changeSet, workspace);
  if (!result.success) {
    throw new Error(result.error ?? 'Could not apply the draft');
  }
  const path = changeSet.changes[0]?.path ?? options.path;
  await appendToOutline(api, path ? [path] : []);
  if (path) {
    void refreshProvenanceAfterApply(
      api,
      [{ path, title: draft.title, content: draft.content }],
      options.authoring ?? null,
    );
  }
  return { path, paths: path ? [path] : [], preview, changeSetId: changeSet.id };
}

async function applyDraftToBuffer(
  draft: DraftItem,
  options: ApplyDraftOptions,
): Promise<ApplyDraftResult> {
  if (options.applyToEditor) {
    options.applyToEditor(draft);
  }
  return { paths: [], preview: [], changeSetId: '' };
}

/** Append newly created node files to the outline (package.json + workflow.json). */
async function appendToOutline(api: StudioApi, newPaths: string[]): Promise<void> {
  try {
    const outline = await api.getOutline();
    const existing = outline.activities.map((a) => a.path);
    const toAdd = newPaths.filter((p) => !existing.includes(p));
    if (toAdd.length > 0) {
      await api.saveOutlineOrder([...existing, ...toAdd]);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Applied files but failed to update outline: ${message}`);
  }
}
