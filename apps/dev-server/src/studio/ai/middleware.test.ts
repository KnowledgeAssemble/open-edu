import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createStudioAiMiddleware } from './middleware.js';

vi.mock('./studioLlm', () => ({
  isAiAvailable: vi.fn(() => false),
  completeWithLlm: vi.fn(),
}));

vi.mock('./chat/rateLimit', () => ({
  checkRateLimit: vi.fn(() => false),
  resetRateLimits: vi.fn(),
}));

const { isAiAvailable } = await import('./studioLlm.js');

function makeReq(body: unknown, url: string, method = 'POST'): IncomingMessage {
  const readable = Readable.from([JSON.stringify(body)]);
  return Object.assign(readable, {
    method,
    url,
    headers: { host: 'localhost' },
  }) as unknown as IncomingMessage;
}

function makeRes() {
  const res = {
    headersSent: false,
    writableEnded: false,
    statusCode: 200,
    written: [] as Array<{ status: number; headers: Record<string, string>; body: unknown }>,
    setHeader() {
      // no-op
    },
    writeHead(status: number, headers: Record<string, string>) {
      this.headersSent = true;
      this.statusCode = status;
      this.written.push({ status, headers, body: undefined });
    },
    end(body?: unknown) {
      this.writableEnded = true;
      if (this.written.length > 0) {
        this.written[this.written.length - 1]!.body = body;
      } else {
        this.written.push({ status: this.statusCode, headers: {}, body });
      }
    },
    write() {
      return true;
    },
    once() {
      // no-op for abort-signal registration
    },
  };
  return res as unknown as ServerResponse & {
    headersSent: boolean;
    writableEnded: boolean;
    statusCode: number;
    written: Array<{ status: number; headers: Record<string, string>; body: unknown }>;
  };
}

async function runMiddleware(
  req: IncomingMessage,
  res: ServerResponse & { written: Array<{ status: number; body: unknown }> },
  packageDir: string,
): Promise<void> {
  const middleware = createStudioAiMiddleware({ getPackageDir: () => packageDir });
  await middleware(req, res, () => {
    res.statusCode = 404;
    res.end('unhandled');
  });
}

describe('createStudioAiMiddleware (single backend, storage-independent)', () => {
  beforeEach(() => {
    vi.mocked(isAiAvailable).mockReturnValue(false);
  });

  it('item/add works without a filesystem package when existingTitles are supplied (browser/OPFS)', async () => {
    const res = makeRes();
    await runMiddleware(
      makeReq(
        { kind: 'quiz', description: 'Add a quiz', existingTitles: ['Water Cycle'] },
        '/api/studio/ai/item/add',
      ),
      res,
      '', // browser mode: no packageDir, course lives in OPFS
    );

    // It bypasses the no-active-package guard (storage lives in OPFS) and only
    // reports AI-unavailable because the test env has no LLM config.
    expect(res.statusCode).toBe(400);
    expect(JSON.parse((res.written[0]!.body as string) ?? '{}') as { code: string }).toMatchObject({
      code: 'ai-unavailable',
    });
  });

  it('item/add returns 400 for an invalid authoring body field', async () => {
    const res = makeRes();
    await runMiddleware(
      makeReq(
        { kind: 'lesson', description: 'x', existingTitles: ['A'], authoring: { packs: 'nope' } },
        '/api/studio/ai/item/add',
      ),
      res,
      '',
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse((res.written[0]!.body as string) ?? '{}')).toMatchObject({
      code: 'invalid-request',
    });
  });

  it('item/add still rejects when there is neither package nor existingTitles', async () => {
    const res = makeRes();
    await runMiddleware(
      makeReq({ kind: 'lesson', description: 'x' }, '/api/studio/ai/item/add'),
      res,
      '',
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse((res.written[0]!.body as string) ?? '{}')).toMatchObject({
      code: 'no-active-package',
    });
  });

  it('item/edit works without a package when existingTitles are supplied', async () => {
    const res = makeRes();
    await runMiddleware(
      makeReq(
        {
          kind: 'lesson',
          intent: 'rewrite',
          currentContent: '# Original',
          existingTitles: ['Water Cycle'],
        },
        '/api/studio/ai/item/edit',
      ),
      res,
      '',
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse((res.written[0]!.body as string) ?? '{}') as { code: string }).toMatchObject({
      code: 'ai-unavailable',
    });
  });

  it('chat is reachable in browser mode (no packageDir) and gates on AI availability', async () => {
    const res = makeRes();
    await runMiddleware(
      makeReq(
        {
          messages: [{ role: 'user', content: 'hello' }],
          context: { view: 'outline', locale: 'en', aiAvailable: true },
        },
        '/api/studio/ai/chat',
      ),
      res,
      '',
    );
    expect(res.statusCode).toBe(503);
    expect(JSON.parse((res.written[0]!.body as string) ?? '{}')).toEqual({
      error: 'ai-unavailable',
    });
  });

  it('reports status without needing a package', async () => {
    const res = makeRes();
    await runMiddleware(makeReq({}, '/api/studio/ai/status', 'GET'), res, '');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse((res.written[0]!.body as string) ?? '{}')).toMatchObject({
      available: false,
    });
  });
});
