// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  WidgetRegistryStore,
  WidgetAlreadyInstalledError,
  WidgetValidationError,
} from './store.js';

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

describe('WidgetRegistryStore', () => {
  let rootDir: string;
  let store: WidgetRegistryStore;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'openedu-widget-registry-'));
    store = new WidgetRegistryStore(rootDir, 'http://localhost:4002');
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('installs a version writing manifest.json and index.html', async () => {
    const installed = await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });
    expect(installed).toEqual({
      publisher: 'publisher',
      widget: 'community.example.counter',
      version: '1.0.0',
    });

    const manifest = JSON.parse(
      await readFile(
        join(rootDir, 'publisher', 'community.example.counter', '1.0.0', 'manifest.json'),
        'utf-8',
      ),
    );
    expect(manifest.id).toBe('community.example.counter');

    const indexHtml = await readFile(
      join(rootDir, 'publisher', 'community.example.counter', '1.0.0', 'index.html'),
      'utf-8',
    );
    expect(indexHtml).toContain('open-edu.widget/1');
  });

  it('catalog lists the installed widget with manifestUrl, sandboxed trust tier and offline', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });

    const catalog = await store.catalog();
    expect(catalog.registryId).toBeTruthy();
    expect(catalog.origin).toBe('http://localhost:4002');
    expect(catalog.widgets).toHaveLength(1);
    expect(catalog.widgets[0]).toMatchObject({
      id: 'community.example.counter',
      version: '1.0.0',
      manifestUrl:
        'http://localhost:4002/widget-registry/publisher/community.example.counter/1.0.0/manifest.json',
      trustTier: 'sandboxed',
      offline: true,
    });
  });

  it('readDocument returns the exact installed bytes', async () => {
    const documentBytes = encode(SELF_CONTAINED_HTML);
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes,
    });

    const bytes = await store.readDocument('publisher', 'community.example.counter', '1.0.0');
    expect(bytes).toEqual(documentBytes);
  });

  it('refuses to overwrite the same version', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });
    await expect(
      store.install({
        publisher: 'publisher',
        widgetId: 'community.example.counter',
        manifestJson: validManifest(),
        documentBytes: encode(SELF_CONTAINED_HTML),
      }),
    ).rejects.toBeInstanceOf(WidgetAlreadyInstalledError);
  });

  it('uses an explicit registryId when provided', async () => {
    const custom = new WidgetRegistryStore(rootDir, 'http://localhost:4002', 'localdev');
    await custom.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });
    expect((await custom.catalog()).registryId).toBe('localdev');
  });

  it('revoking a version writes revoked.json and keeps it in the catalog with status revoked', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });

    await store.revoke('publisher', 'community.example.counter', '1.0.0');

    const revoked = JSON.parse(
      await readFile(
        join(rootDir, 'publisher', 'community.example.counter', '1.0.0', 'revoked.json'),
        'utf-8',
      ),
    );
    expect(typeof revoked.revokedAt).toBe('string');
    const catalog = await store.catalog();
    expect(catalog.widgets).toHaveLength(1);
    expect(catalog.widgets[0]).toMatchObject({
      id: 'community.example.counter',
      version: '1.0.0',
      status: 'revoked',
    });
  });

  it('deprecating a version keeps it in the catalog with status deprecated', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });

    await store.deprecate('publisher', 'community.example.counter', '1.0.0');

    const catalog = await store.catalog();
    expect(catalog.widgets).toHaveLength(1);
    expect(catalog.widgets[0]!.status).toBe('deprecated');
  });

  it('setEnabled(false) removes a widget from catalog; setEnabled(true) restores it', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });

    await store.setEnabled('publisher', 'community.example.counter', '1.0.0', false);
    expect((await store.catalog()).widgets).toHaveLength(0);

    await store.setEnabled('publisher', 'community.example.counter', '1.0.0', true);
    expect((await store.catalog()).widgets).toHaveLength(1);
  });

  it('listInstalled reports all installed versions with their status', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });
    await store.deprecate('publisher', 'community.example.counter', '1.0.0');

    const installed = await store.listInstalled();
    expect(installed).toEqual([
      {
        publisher: 'publisher',
        widget: 'community.example.counter',
        version: '1.0.0',
        status: 'deprecated',
      },
    ]);
  });

  it('rejects an invalid package with WidgetValidationError', async () => {
    const manifest = validManifest();
    manifest.artifact.documentIntegrity = `sha256-${'0'.repeat(64)}`;
    await expect(
      store.install({
        publisher: 'publisher',
        widgetId: 'community.example.counter',
        manifestJson: manifest,
        documentBytes: encode(SELF_CONTAINED_HTML),
      }),
    ).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it('rejects when the requested publisher/widgetId does not match the manifest', async () => {
    await expect(
      store.install({
        publisher: 'other-publisher',
        widgetId: 'community.example.counter',
        manifestJson: validManifest(),
        documentBytes: encode(SELF_CONTAINED_HTML),
      }),
    ).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it('writes artifact.zip when archiveBytes are provided', async () => {
    const archiveBytes = encode('zip-binary-content');
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

    const zip = new Uint8Array(
      await readFile(
        join(rootDir, 'publisher', 'community.example.counter', '1.0.0', 'artifact.zip'),
      ),
    );
    expect(zip).toEqual(archiveBytes);
  });

  it('revoking a whole widget keeps all of its versions listed with status revoked', async () => {
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest(),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });
    await store.install({
      publisher: 'publisher',
      widgetId: 'community.example.counter',
      manifestJson: validManifest({ version: '1.1.0' }),
      documentBytes: encode(SELF_CONTAINED_HTML),
    });

    await store.revoke('publisher', 'community.example.counter');

    const catalog = await store.catalog();
    expect(catalog.widgets).toHaveLength(2);
    expect(catalog.widgets.every((w) => w.status === 'revoked')).toBe(true);
    expect((await store.listInstalled()).every((w) => w.status === 'revoked')).toBe(true);
  });

  it('throws WidgetNotFoundError when reading an uninstalled version', async () => {
    await expect(
      store.readManifest('publisher', 'community.example.counter', '9.9.9'),
    ).rejects.toThrow('widget not found');
    await expect(
      store.readDocument('publisher', 'community.example.counter', '9.9.9'),
    ).rejects.toThrow('widget not found');
  });

  describe('assertSafeSegment (path traversal prevention)', () => {
    it('rejects path traversal via publisher segment (../)', async () => {
      await expect(
        store.install({
          publisher: '../etc',
          widgetId: 'community.example.counter',
          manifestJson: validManifest({ publisher: { id: '../etc', name: 'Test' } }),
          documentBytes: encode(SELF_CONTAINED_HTML),
        }),
      ).rejects.toBeInstanceOf(WidgetValidationError);
    });

    it('rejects null byte in widget name', async () => {
      await expect(
        store.install({
          publisher: 'publisher',
          widgetId: 'test\0evil',
          manifestJson: validManifest({
            id: 'test\0evil',
            publisher: { id: 'publisher', name: 'Test' },
          }),
          documentBytes: encode(SELF_CONTAINED_HTML),
        }),
      ).rejects.toBeInstanceOf(WidgetValidationError);
    });

    it('rejects .. as version', async () => {
      await expect(
        store.install({
          publisher: 'publisher',
          widgetId: 'community.example.counter',
          manifestJson: validManifest({
            version: '..',
            publisher: { id: 'publisher', name: 'Test' },
          }),
          documentBytes: encode(SELF_CONTAINED_HTML),
        }),
      ).rejects.toBeInstanceOf(WidgetValidationError);
    });

    it('rejects . as version', async () => {
      await expect(
        store.install({
          publisher: 'publisher',
          widgetId: 'community.example.counter',
          manifestJson: validManifest({
            version: '.',
            publisher: { id: 'publisher', name: 'Test' },
          }),
          documentBytes: encode(SELF_CONTAINED_HTML),
        }),
      ).rejects.toBeInstanceOf(WidgetValidationError);
    });

    it('rejects empty string as publisher', async () => {
      await expect(
        store.install({
          publisher: '',
          widgetId: 'community.example.counter',
          manifestJson: validManifest({ publisher: { id: '', name: 'Test' } }),
          documentBytes: encode(SELF_CONTAINED_HTML),
        }),
      ).rejects.toBeInstanceOf(WidgetValidationError);
    });

    it('rejects Windows-style path (C:\\) in publisher', async () => {
      await expect(
        store.install({
          publisher: 'C:\\Users',
          widgetId: 'community.example.counter',
          manifestJson: validManifest({ publisher: { id: 'C:\\Users', name: 'Test' } }),
          documentBytes: encode(SELF_CONTAINED_HTML),
        }),
      ).rejects.toBeInstanceOf(WidgetValidationError);
    });

    it('rejects backslash in widget name', async () => {
      await expect(
        store.install({
          publisher: 'publisher',
          widgetId: 'foo\\bar',
          manifestJson: validManifest({
            id: 'foo\\bar',
            publisher: { id: 'publisher', name: 'Test' },
          }),
          documentBytes: encode(SELF_CONTAINED_HTML),
        }),
      ).rejects.toBeInstanceOf(WidgetValidationError);
    });

    it('accepts normal publisher, widget, and version values', async () => {
      const installed = await store.install({
        publisher: 'publisher',
        widgetId: 'community.example.counter',
        manifestJson: validManifest(),
        documentBytes: encode(SELF_CONTAINED_HTML),
      });
      expect(installed).toEqual({
        publisher: 'publisher',
        widget: 'community.example.counter',
        version: '1.0.0',
      });
    });
  });
});
