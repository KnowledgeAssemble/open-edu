// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDatabase, resetDatabase, listStudioDraftsByCourse } from '@open-edu/storage';
import { createBrowserAiGateway } from './browserAiGateway.js';

function mockResponse(status: number, body: unknown, contentType = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

describe('browserAiGateway (single Node backend)', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    resetDatabase();
    const db = await openDatabase();
    await db.clear('studio-drafts');
    db.close();
    resetDatabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports AI availability from /api/studio/ai/status', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { available: true }));
    const gateway = createBrowserAiGateway();
    const status = await gateway.getStatus();
    expect(status.available).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/studio/ai/status');
  });

  it('reports unavailable without throwing when the endpoint errors', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(503, { error: 'ai-unavailable' }));
    const gateway = createBrowserAiGateway();
    expect((await gateway.getStatus()).available).toBe(false);
  });

  it('never sends API keys in requests', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { available: true }));
    await createBrowserAiGateway().getStatus();
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/studio/ai/status');
  });

  it('generates a draft through /api/studio/ai/generate-draft and persists files locally', async () => {
    const response = {
      success: true,
      title: 'My Course',
      draftId: 'draft-server-1',
      outlinePreview: [{ title: 'Lesson', kind: 'lesson' }],
      quality: [{ id: 'objectives', labelKey: 'k', passed: true }],
      files: [
        { path: 'package.json', content: btoa('{"id":"x"}'), encoding: 'base64' },
        { path: 'nodes/lesson.md', content: btoa('# Lesson'), encoding: 'base64' },
      ],
    };
    fetchMock.mockResolvedValueOnce(mockResponse(200, response));

    const gateway = createBrowserAiGateway();
    const result = await gateway.generateDraft({ notes: 'teach fractions' }, 'course-a');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/studio/ai/generate-draft');
    const body = JSON.parse((init as RequestInit).body as string) as { includeFiles: boolean };
    expect(body.includeFiles).toBe(true);

    expect(result.success).toBe(true);
    expect(result.files.some((f) => f.path === 'nodes/lesson.md')).toBe(true);

    // The returned draftId round-trips through the browser studio-drafts store.
    const drafts = await listStudioDraftsByCourse('course-a');
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.id).toBe('draft-server-1');
    const stored = drafts[0]!.files.find((f) => f.path === 'nodes/lesson.md')!;
    expect(new TextDecoder().decode(new Uint8Array(stored.data))).toBe('# Lesson');
  });

  it('does not persist a draft when generation fails and propagates the code', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        success: false,
        code: 'invalid-blueprint',
        error: 'lesson "l1" references unavailable widget "ghost.widget"',
        draftId: '',
        title: undefined,
        outlinePreview: [],
        quality: [],
      }),
    );
    const gateway = createBrowserAiGateway();
    const result = await gateway.generateDraft({ notes: 'teach fractions' }, 'course-a');
    expect(result.success).toBe(false);
    expect(result.code).toBe('invalid-blueprint');
    expect(result.error).toContain('ghost.widget');
    const drafts = await listStudioDraftsByCourse('course-a');
    expect(drafts).toHaveLength(0);
  });

  it('routes item generation to item/add (no intent) and item/edit (intent)', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { ok: true, item: { kind: 'lesson', title: 'X', content: '# X' } }),
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        ok: true,
        items: [{ kind: 'lesson', title: 'Y', content: '# Y' }],
      }),
    );

    const gateway = createBrowserAiGateway();
    await gateway.generateItem({ kind: 'quiz', description: 'a quiz' });
    await gateway.generateItem({ kind: 'lesson', intent: 'rewrite', currentContent: '# A' });

    expect(fetchMock.mock.calls[0]![0]).toBe('/api/studio/ai/item/add');
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/studio/ai/item/edit');
  });
});
