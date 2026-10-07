// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MULTI_FILE_CSP } from '@open-edu/widget-sdk';
import { createWidgetRegistryRouter, createWidgetRegistryMiddleware } from './routes.js';
import { WidgetRegistryStore } from './store.js';

const SELF_CONTAINED_HTML = `<!doctype html>
<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-x'; style-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; base-uri 'none';"></head>
<body><script>const w = { apiVersion: 'open-edu.widget/1' };</script></body></html>`;

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function integrityOf(bytes: Uint8Array): string {
  const hex = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  return `sha256-${hex}`;
}

function validManifest(overrides: Record<string, unknown> = {}) {
  const documentBytes = encode(SELF_CONTAINED_HTML);
  return {
    id: 'community.example.counter',
    version: '1.0.0',
    apiVersion: 'open-edu.widget/1',
    artifact: {
      documentUrl: 'https://registry.example/counter/index.html',
      documentIntegrity: integrityOf(documentBytes),
      sizeBytes: documentBytes.byteLength,
      format: 'self-contained-html',
    },
    publisher: { id: 'publisher', name: 'Publisher' },
    metadata: {},
    schemas: {},
    capabilities: ['resize'],
    accessibility: {},
    supportedThemes: ['light', 'dark', 'zen'],
    reducedMotion: 'not-applicable',
    compatibility: { runtime: 'open-edu.widget/1' },
    distribution: { offline: true, cachePolicy: 'immutable' },
    status: 'experimental',
    ...overrides,
  };
}

class FakeResponse {
  statusCode = 200;
  headers = new Map<string, string | number>();
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string | number>): this {
    this.statusCode = statusCode;
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        this.headers.set(name.toLowerCase(), value);
      }
    }
    return this;
  }

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.headers.set(name.toLowerCase(), value.toString());
    return this;
  }

  getHeader(name: string): string | number | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(data?: unknown) {
    if (data != null) {
      this.body = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
    }
  }
}

function fakeRequest(method: string, url: string, body?: unknown): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage;
  const asMutable = req as { method?: string; url?: string };
  asMutable.method = method;
  asMutable.url = url;
  if (body !== undefined) {
    const payload = Buffer.from(JSON.stringify(body), 'utf-8');
    queueMicrotask(() => {
      req.emit('data', payload);
      req.emit('end');
    });
  } else {
    queueMicrotask(() => req.emit('end'));
  }
  return req;
}

function installBody(
  overrides: Record<string, unknown> = {},
  extra: { archiveBase64?: string } = {},
): Record<string, unknown> {
  const documentBytes = encode(SELF_CONTAINED_HTML);
  return {
    publisher: 'publisher',
    widgetId: 'community.example.counter',
    manifestJson: validManifest(overrides),
    documentBase64: Buffer.from(documentBytes).toString('base64'),
    ...(extra.archiveBase64 ? { archiveBase64: extra.archiveBase64 } : {}),
  };
}

describe('createWidgetRegistryRouter', () => {
  let rootDir: string;
  let store: WidgetRegistryStore;
  let router: ReturnType<typeof createWidgetRegistryRouter>;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'openedu-widget-registry-routes-'));
    store = new WidgetRegistryStore(rootDir, 'http://localhost:4002');
    router = createWidgetRegistryRouter(store);
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('serves catalog.json with an immutable cache header', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });

    const res = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/catalog.json'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(200);
    const catalog = JSON.parse(res.body) as { widgets: unknown[] };
    expect(catalog.widgets).toHaveLength(1);
    expect(String(res.getHeader('Cache-Control'))).toContain('max-age=3600');
    expect(String(res.getHeader('Cache-Control'))).toContain('must-revalidate');
  });

  it('returns 404 for artifact.zip without leaking archive bytes', async () => {
    const archiveBytes = encode('ZIP-BINARY-CONTENT');
    const documentBytes = encode(SELF_CONTAINED_HTML);
    const manifest = validManifest({
      artifact: {
        documentUrl: 'https://registry.example/counter/index.html',
        documentIntegrity: integrityOf(documentBytes),
        sizeBytes: documentBytes.byteLength,
        format: 'multi-file',
        archiveUrl: 'https://registry.example/counter/counter.zip',
        archiveIntegrity: integrityOf(archiveBytes),
      },
      distribution: { offline: false, cachePolicy: 'immutable' },
    });
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: manifest,
      documentBytes,
      archiveBytes,
    });

    const res = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/publisher/community.example.counter/1.0.0/artifact.zip'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'archive download not available' });
    expect(res.body).not.toContain('ZIP-BINARY-CONTENT');
  });

  it('installs a widget via POST and lists it in catalog.json', async () => {
    const res = new FakeResponse();
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ ok: true });

    const catalogRes = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/catalog.json'),
      catalogRes as unknown as ServerResponse,
    );
    const catalog = JSON.parse(catalogRes.body) as { widgets: unknown[] };
    expect(catalog.widgets).toHaveLength(1);
  });

  it('revokes a widget via POST and keeps it in the catalog with status revoked', async () => {
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      new FakeResponse() as unknown as ServerResponse,
    );

    const res = new FakeResponse();
    await router(
      fakeRequest('POST', '/widget-registry/publisher/community.example.counter/1.0.0/revoke'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });

    const catalogRes = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/catalog.json'),
      catalogRes as unknown as ServerResponse,
    );
    const catalog = JSON.parse(catalogRes.body) as {
      widgets: { status: string }[];
    };
    expect(catalog.widgets).toHaveLength(1);
    expect(catalog.widgets[0]!.status).toBe('revoked');
  });

  it('returns 404 for an unknown route', async () => {
    const res = new FakeResponse();
    await router(fakeRequest('GET', '/widget-registry/nope'), res as unknown as ServerResponse);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'not found' });
  });

  it('serves manifest.json and index.html with a CSP header', async () => {
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      new FakeResponse() as unknown as ServerResponse,
    );

    const manifestRes = new FakeResponse();
    await router(
      fakeRequest(
        'GET',
        '/widget-registry/publisher/community.example.counter/1.0.0/manifest.json',
      ),
      manifestRes as unknown as ServerResponse,
    );
    expect(manifestRes.statusCode).toBe(200);
    expect(JSON.parse(manifestRes.body).id).toBe('community.example.counter');

    const htmlRes = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/publisher/community.example.counter/1.0.0/index.html'),
      htmlRes as unknown as ServerResponse,
    );
    expect(htmlRes.statusCode).toBe(200);
    expect(String(htmlRes.getHeader('Content-Security-Policy'))).toContain("connect-src 'none'");
    expect(htmlRes.body).toContain('open-edu.widget/1');
  });

  it('serves a multi-file index.html with MULTI_FILE_CSP', async () => {
    const documentBytes = encode(SELF_CONTAINED_HTML);
    const manifest = validManifest({
      artifact: {
        documentUrl: 'https://registry.example/counter/index.html',
        documentIntegrity: integrityOf(documentBytes),
        sizeBytes: documentBytes.byteLength,
        format: 'multi-file',
      },
      distribution: { offline: false, cachePolicy: 'immutable' },
    });
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: manifest,
      documentBytes,
    });

    const res = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/publisher/community.example.counter/1.0.0/index.html'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Content-Security-Policy')).toBe(MULTI_FILE_CSP);
  });

  it('returns 400 with details when validation fails', async () => {
    const manifest = validManifest();
    manifest.artifact.documentIntegrity = `sha256-${'0'.repeat(64)}`;

    const res = new FakeResponse();
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody(Object.assign({}, manifest))),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body) as { error: string; details: unknown };
    expect(parsed.error).toBeTruthy();
    expect(Array.isArray(parsed.details)).toBe(true);
  });

  it('returns 409 when the same version is already installed', async () => {
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      new FakeResponse() as unknown as ServerResponse,
    );

    const res = new FakeResponse();
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(409);
  });

  it('POST revoke does not set CORS headers', async () => {
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      new FakeResponse() as unknown as ServerResponse,
    );

    const res = new FakeResponse();
    await router(
      fakeRequest('POST', '/widget-registry/publisher/community.example.counter/1.0.0/revoke'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('access-control-allow-origin')).toBeUndefined();
  });

  it('POST install does not set CORS headers', async () => {
    const res = new FakeResponse();
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(201);
    expect(res.getHeader('access-control-allow-origin')).toBeUndefined();
  });

  it('GET manifest.json sets CORS headers', async () => {
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      new FakeResponse() as unknown as ServerResponse,
    );

    const res = new FakeResponse();
    await router(
      fakeRequest(
        'GET',
        '/widget-registry/publisher/community.example.counter/1.0.0/manifest.json',
      ),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('access-control-allow-origin')).toBe('*');
  });

  it('GET index.html sets CORS headers', async () => {
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      new FakeResponse() as unknown as ServerResponse,
    );

    const res = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/publisher/community.example.counter/1.0.0/index.html'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('access-control-allow-origin')).toBe('*');
  });

  it('GET catalog.json sets CORS headers', async () => {
    const res = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/catalog.json'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('access-control-allow-origin')).toBe('*');
  });

  it('404 error responses do not set CORS headers', async () => {
    const res = new FakeResponse();
    await router(fakeRequest('GET', '/widget-registry/nope'), res as unknown as ServerResponse);

    expect(res.statusCode).toBe(404);
    expect(res.getHeader('access-control-allow-origin')).toBeUndefined();
  });

  it('405 error responses do not set CORS headers', async () => {
    await router(
      fakeRequest('POST', '/widget-registry/install', installBody()),
      new FakeResponse() as unknown as ServerResponse,
    );

    const res = new FakeResponse();
    await router(
      fakeRequest('GET', '/widget-registry/publisher/community.example.counter/1.0.0/revoke'),
      res as unknown as ServerResponse,
    );

    expect(res.statusCode).toBe(405);
    expect(res.getHeader('access-control-allow-origin')).toBeUndefined();
  });

  describe('createWidgetRegistryMiddleware', () => {
    it('passes through non-widget-registry requests', () => {
      const middleware = createWidgetRegistryMiddleware(store);
      const next = vi.fn();

      middleware(
        fakeRequest('GET', '/assets/icon.png'),
        new FakeResponse() as unknown as ServerResponse,
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('handles widget-registry requests without calling next', async () => {
      await store.install({
        publisher: 'publisher',
        widgetId: 'community.example.counter',
        manifestJson: validManifest(),
        documentBytes: encode(SELF_CONTAINED_HTML),
      });

      const middleware = createWidgetRegistryMiddleware(store);
      const next = vi.fn();
      const res = new FakeResponse();

      middleware(
        fakeRequest('GET', '/widget-registry/catalog.json'),
        res as unknown as ServerResponse,
        next,
      );

      await vi.waitFor(() => expect(res.body).toContain('community.example.counter'));
      expect(next).not.toHaveBeenCalled();
      expect(JSON.parse(res.body).widgets).toHaveLength(1);
    });
  });
});
