import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryWorkspace } from '@open-edu/storage';
import { applyDraft, applyDraftBatch } from './applyDraft';
import type { DraftItem } from './types';
import type { CourseWorkspace } from '@open-edu/storage';
import { authoringFixture } from '../test/authoringFixture.js';

vi.mock('./provenanceRefresh.js', () => ({
  refreshProvenanceAfterApply: vi.fn().mockResolvedValue(undefined),
}));

import { refreshProvenanceAfterApply } from './provenanceRefresh.js';

function fakeApi(workspace: CourseWorkspace) {
  return {
    getWorkspace: vi.fn().mockResolvedValue(workspace),
    getOutline: vi.fn().mockResolvedValue({
      activities: [{ id: 'n1', path: 'nodes/lesson-1.md', title: 'Lesson 1', kind: 'lesson' }],
      title: 'Test Course',
    }),
    saveOutlineOrder: vi.fn().mockResolvedValue({ success: true }),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
  };
}

describe('applyDraft', () => {
  let ws: MemoryWorkspace;
  let api: ReturnType<typeof fakeApi>;

  beforeEach(() => {
    ws = new MemoryWorkspace({
      initialFiles: new Map([
        [
          'package.json',
          new TextEncoder().encode('{"id":"c1","title":"Test","entry":"nodes/lesson-1.md"}'),
        ],
        ['workflow.json', new TextEncoder().encode('{"routing":{"nodes/lesson-1.md":1}}')],
        ['nodes/lesson-1.md', new TextEncoder().encode('# Lesson 1')],
      ]),
    });
    api = fakeApi(ws);
    vi.mocked(refreshProvenanceAfterApply).mockClear();
  });

  it('commits a single draft file via the workspace transaction', async () => {
    const draft: DraftItem = {
      kind: 'lesson',
      title: 'New Lesson',
      content: '# New Lesson\n\nContent',
    };

    const result = await applyDraft(api as any, draft, { mode: 'file' });

    expect(result.path).toBeTruthy();
    expect(await ws.readText(result.path!)).toBe('# New Lesson\n\nContent');
    expect(api.getWorkspace).toHaveBeenCalled();
    // Outline append still goes through the existing outline endpoint.
    expect(api.getOutline).toHaveBeenCalled();
    expect(api.saveOutlineOrder).toHaveBeenCalled();
  });

  it('uses a custom path when provided', async () => {
    const draft: DraftItem = {
      kind: 'lesson',
      title: 'Custom Path',
      content: '# Custom\n\nContent',
    };

    await applyDraft(api as any, draft, { mode: 'file', path: 'nodes/my-custom-lesson.md' });

    expect(await ws.readText('nodes/my-custom-lesson.md')).toBe('# Custom\n\nContent');
  });

  it('applies draft to buffer using applyToEditor callback without touching the workspace', async () => {
    const draft: DraftItem = {
      kind: 'lesson',
      title: 'Updated Lesson',
      content: '# Updated\n\nNew content',
    };

    const applyToEditor = vi.fn();

    const result = await applyDraft(api as any, draft, {
      mode: 'buffer',
      applyToEditor,
    });

    expect(applyToEditor).toHaveBeenCalledWith(draft);
    expect(api.getWorkspace).not.toHaveBeenCalled();
    expect(result.path).toBeUndefined();
    expect(refreshProvenanceAfterApply).not.toHaveBeenCalled();
  });

  it('refreshes provenance after a successful file apply', async () => {
    const draft: DraftItem = {
      kind: 'lesson',
      title: 'New Lesson',
      content: '# New Lesson\n\nContent',
    };
    await applyDraft(api as never, draft, { mode: 'file', authoring: authoringFixture });
    expect(refreshProvenanceAfterApply).toHaveBeenCalledWith(
      api,
      expect.arrayContaining([
        expect.objectContaining({ content: draft.content, title: draft.title }),
      ]),
      authoringFixture,
    );
  });
});

describe('applyDraftBatch', () => {
  let ws: MemoryWorkspace;
  let api: ReturnType<typeof fakeApi>;

  beforeEach(() => {
    ws = new MemoryWorkspace({
      initialFiles: new Map([
        [
          'package.json',
          new TextEncoder().encode('{"id":"c1","title":"Test","entry":"nodes/lesson-1.md"}'),
        ],
        ['workflow.json', new TextEncoder().encode('{"routing":{"nodes/lesson-1.md":1}}')],
        ['nodes/lesson-1.md', new TextEncoder().encode('# Lesson 1')],
      ]),
    });
    api = fakeApi(ws);
  });

  it('commits a multi-file draft as a single atomic workspace commit', async () => {
    const drafts: DraftItem[] = [
      { kind: 'lesson', title: 'Lesson 1', content: '# Lesson 1\n\nContent' },
      { kind: 'quiz', title: 'Quiz 1', content: '{"type":"quiz","question":"Q?","options":[]}' },
    ];

    const result = await applyDraftBatch(api as any, drafts);

    // All items land in the workspace in one commit; no per-file writeFile path.
    expect(api.getWorkspace).toHaveBeenCalledTimes(1);
    const paths = result.paths;
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(await ws.exists(path)).toBe(true);
    }
    // The outline append remains a follow-up outline update.
    expect(api.getOutline).toHaveBeenCalled();
    expect(api.saveOutlineOrder).toHaveBeenCalled();
    expect(api.writeFile).not.toHaveBeenCalled();
  });

  it('exposes a diff preview for the committed change set', async () => {
    const drafts: DraftItem[] = [
      { kind: 'lesson', title: 'L1', content: '# L1' },
      { kind: 'quiz', title: 'Q1', content: '{}' },
    ];

    const result = await applyDraftBatch(api as any, drafts);

    expect(result.preview.length).toBe(2);
    expect(result.preview.every((d) => d.marker === 'added')).toBe(true);
    expect(result.changeSetId).toBeTruthy();
  });

  it('batch applies one refresh with all paths', async () => {
    const drafts: DraftItem[] = [
      { kind: 'lesson', title: 'L1', content: '# L1' },
      { kind: 'quiz', title: 'Q1', content: '{}' },
    ];
    await applyDraftBatch(api as never, drafts, { authoring: authoringFixture });
    expect(refreshProvenanceAfterApply).toHaveBeenCalledWith(
      api,
      expect.arrayContaining([
        expect.objectContaining({ content: '# L1' }),
        expect.objectContaining({ content: '{}' }),
      ]),
      authoringFixture,
    );
  });
});
