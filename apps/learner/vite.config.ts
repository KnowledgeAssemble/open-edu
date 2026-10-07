import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, resolve, dirname, relative, isAbsolute } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'url';
import { scanAll, scanPackages, loadPackage, loadBundle, ASSET_MIME_TYPES } from '@open-edu/core';
import type { PackageSummary, LoadedPackage, BundleSummary } from '@open-edu/core';
import { llmProxyHandler } from './src/llm-proxy/index.js';
import { handleDictionaryRequest } from './src/dictionary-server.js';
import { createPipiliHandler } from './src/pipili/index.js';
import { oepProxyHandler } from './src/oep-proxy/index.js';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const resolveEnvPath = (value: string): string =>
  isAbsolute(value) ? value : resolve(REPO_ROOT, value);
const CATALOG_DIR = process.env.EDU_CATALOG_DIR
  ? resolve(process.env.EDU_CATALOG_DIR)
  : resolve(__dirname, '../../examples');
const WIDGET_DIR = process.env.EDU_WIDGET_DIR
  ? resolveEnvPath(process.env.EDU_WIDGET_DIR)
  : undefined;
const WIDGET_REGISTRY_ORIGIN = 'http://localhost:4001';
const PKGS_DIR = resolve(__dirname, '../../packages');
const VIRTUAL_MODULE_ID = 'virtual:edu-data';
const RESOLVED_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

function findAssetsDirs(catalogDir: string): string[] {
  const dirs: string[] = [];
  try {
    const entries = readdirSync(catalogDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      const assetsDir = join(catalogDir, entry.name, 'assets');
      if (existsSync(assetsDir)) {
        dirs.push(assetsDir);
      }
      // Also check for standalone package directories
      if (
        existsSync(join(catalogDir, entry.name, 'package.json')) ||
        existsSync(join(catalogDir, entry.name, 'bundle.json'))
      ) {
        // already added above if assets exists
      }
    }
  } catch {
    // catalog dir not accessible, skip
  }
  return dirs;
}

type MiddlewareNext = () => void;
type MiddlewareServer = {
  middlewares: {
    use(handler: (req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) => void): void;
    use(
      route: string,
      handler: (req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) => void,
    ): void;
  };
};

function registerServerMiddlewares(server: MiddlewareServer): void {
  server.middlewares.use(oepProxyHandler);
  server.middlewares.use(llmProxyHandler);

  // Pipili AI Companion endpoint
  const pipiliHandler = createPipiliHandler();
  server.middlewares.use('/api/pipili', async (req, res, next) => {
    if (req.url?.startsWith('/chat')) {
      try {
        await pipiliHandler(req, res);
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INTERNAL_ERROR' }));
        }
      }
      return;
    }
    next();
  });

  // Dictionary API endpoints (remote FreeDictionaryAPI lookups; no local dict)
  server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) => {
    if (handleDictionaryRequest(req, res)) return;
    next();
  });

  const assetDirs = findAssetsDirs(CATALOG_DIR);
  if (assetDirs.length === 0) return;

  server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) => {
    const requestPath = decodeURIComponent(req.url ?? '');
    if (!requestPath.startsWith('/assets/')) return next();

    const relativePath = requestPath.slice('/assets/'.length);
    for (const assetsDir of assetDirs) {
      const filePath = join(assetsDir, relativePath);
      if (!filePath.startsWith(assetsDir)) continue;
      try {
        const stat = statSync(filePath);
        if (stat.isFile()) {
          const ext = extname(filePath).toLowerCase();
          res.setHeader('Content-Type', ASSET_MIME_TYPES[ext] ?? 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(readFileSync(filePath));
          return;
        }
      } catch {
        continue;
      }
    }
    next();
  });

  console.log(`[edu-data] Serving assets from ${assetDirs.length} package(s) (${CATALOG_DIR})`);
}

function eduDataPlugin(): Plugin {
  return {
    name: 'edu-data-loader',
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_MODULE_ID;
    },
    configureServer(server) {
      registerServerMiddlewares(server);
    },
    configurePreviewServer(server) {
      registerServerMiddlewares(server);
    },
    async generateBundle() {
      // Emit each catalog package's assets/ directory into the build output
      // under assets/<relative-path>. The runtime resolves catalog-course
      // assets (which have no assetMap) to /assets/<path>; the dev/preview
      // middleware serves those paths, and this hook makes them available on
      // static hosts (e.g. Vercel) where no middleware runs.
      const emitted = new Set<string>();
      const emitAssetDir = (assetsDir: string) => {
        const walk = (dir: string) => {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
            } else if (entry.isFile()) {
              const relPath = relative(assetsDir, fullPath).replace(/\\/g, '/');
              if (emitted.has(relPath)) continue;
              emitted.add(relPath);
              this.emitFile({
                type: 'asset',
                fileName: `assets/${relPath}`,
                source: readFileSync(fullPath),
              });
            }
          }
        };
        walk(assetsDir);
      };

      let catalogDirs: string[] = [];
      try {
        catalogDirs = readdirSync(CATALOG_DIR, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
          .map((e) => join(CATALOG_DIR, e.name));
      } catch {
        return;
      }
      for (const pkgDir of catalogDirs) {
        const assetsDir = join(pkgDir, 'assets');
        if (!existsSync(assetsDir)) continue;
        emitAssetDir(assetsDir);
      }
    },
    async load(id) {
      if (id !== RESOLVED_MODULE_ID) return;

      // Use scanAll to get filtered packages + bundles
      const { packages: catalogPackages, bundles: catalogBundles } = scanAll(CATALOG_DIR);

      // Load all top-level packages into the entries map
      const allPackageSummaries = scanPackages(CATALOG_DIR);
      const packageEntries: Record<string, LoadedPackage> = {};
      for (const summary of allPackageSummaries) {
        try {
          const pkg = await loadPackage(summary.rootDir);
          packageEntries[summary.manifest.id] = pkg;
        } catch {
          // skip invalid packages silently
        }
      }

      // Load bundles; convert moduleMap to array for JSON serialization
      const bundleEntries: Record<string, unknown> = {};
      for (const bundle of catalogBundles) {
        try {
          const loaded = await loadBundle(bundle.rootDir);
          // Add each module package from the bundle into packageEntries
          // so they can be launched from the bundle overview
          for (const [moduleId, modulePkg] of loaded.moduleMap) {
            if (!packageEntries[moduleId]) {
              packageEntries[moduleId] = modulePkg;
            }
          }
          bundleEntries[bundle.manifest.id] = {
            ...loaded,
            moduleMap: Array.from(loaded.moduleMap.entries()),
          };
        } catch {
          // skip invalid bundles silently
        }
      }

      const catalogJson = JSON.stringify(catalogPackages);
      const packagesJson = JSON.stringify(packageEntries);
      const bundlesJson = JSON.stringify(catalogBundles);
      const bundleEntriesJson = JSON.stringify(bundleEntries);

      return `
export const catalogPackages = ${catalogJson};
export const packageEntries = ${packagesJson};
export const catalogBundles = ${bundlesJson};
export const bundleEntries = ${bundleEntriesJson};
`;
    },
  };
}

function isSafeWidgetSegment(segment: string | undefined): segment is string {
  return (
    segment !== undefined &&
    segment !== '' &&
    segment !== '.' &&
    segment !== '..' &&
    !/[\\/\0]/.test(segment)
  );
}

function scanWidgetDir(dir: string) {
  const widgets: Array<{
    id: string;
    version: string;
    manifestUrl: string;
    status: string;
    trustTier: 'sandboxed';
    offline: boolean;
  }> = [];

  for (const publisher of readdirSync(dir, { withFileTypes: true })) {
    if (!publisher.isDirectory() || publisher.name.startsWith('.')) continue;
    for (const widget of readdirSync(join(dir, publisher.name), { withFileTypes: true })) {
      if (!widget.isDirectory() || widget.name.startsWith('.')) continue;
      for (const version of readdirSync(join(dir, publisher.name, widget.name), {
        withFileTypes: true,
      })) {
        if (!version.isDirectory() || version.name.startsWith('.')) continue;
        const manifestPath = join(dir, publisher.name, widget.name, version.name, 'manifest.json');
        if (!existsSync(manifestPath)) continue;
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          if (manifest.status === 'disabled' || manifest.status === 'revoked') continue;

          const docPath = join(dir, publisher.name, widget.name, version.name, 'index.html');
          if (existsSync(docPath)) {
            const docBytes = new Uint8Array(readFileSync(docPath));
            const docIntegrity = `sha256-${createHash('sha256').update(docBytes).digest('hex')}`;
            if (
              manifest.artifact?.documentIntegrity &&
              manifest.artifact.documentIntegrity !== docIntegrity
            ) {
              console.warn(
                `[widget-registry] integrity mismatch: ${publisher.name}/${widget.name}/${version.name} — skipping`,
              );
              continue;
            }
            if (
              manifest.artifact?.sizeBytes &&
              manifest.artifact.sizeBytes !== docBytes.byteLength
            ) {
              console.warn(
                `[widget-registry] size mismatch: ${publisher.name}/${widget.name}/${version.name} — skipping`,
              );
              continue;
            }
          }

          widgets.push({
            id: manifest.id ?? `${publisher.name}.${widget.name}`,
            version: manifest.version ?? version.name,
            manifestUrl: `${WIDGET_REGISTRY_ORIGIN}/widget-registry/${publisher.name}/${widget.name}/${version.name}/manifest.json`,
            status: manifest.status ?? 'experimental',
            trustTier: 'sandboxed',
            offline: true,
          });
        } catch {
          // skip invalid manifests
        }
      }
    }
  }

  return {
    registryId: 'local',
    origin: WIDGET_REGISTRY_ORIGIN,
    widgets,
  };
}

function widgetRegistryPlugin(): Plugin | undefined {
  if (!WIDGET_DIR) return undefined;

  const catalog = scanWidgetDir(WIDGET_DIR);

  return {
    name: 'widget-registry',
    configureServer(server) {
      console.log(
        `[widget-registry] Serving ${catalog.widgets.length} widget(s) from ${WIDGET_DIR} (registry: ${catalog.registryId})`,
      );

      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent(req.url ?? '');

        if (url === '/widget-registry/catalog.json' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(catalog));
          return;
        }

        const manifestMatch = url.match(
          /^\/widget-registry\/([^/]+)\/([^/]+)\/([^/]+)\/manifest\.json$/,
        );
        if (manifestMatch && req.method === 'GET') {
          const [, pub, id, ver] = manifestMatch;
          if (isSafeWidgetSegment(pub) && isSafeWidgetSegment(id) && isSafeWidgetSegment(ver)) {
            const filePath = join(WIDGET_DIR, pub, id, ver, 'manifest.json');
            if (existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(readFileSync(filePath));
              return;
            }
          }
        }

        const docMatch = url.match(/^\/widget-registry\/([^/]+)\/([^/]+)\/([^/]+)\/index\.html$/);
        if (docMatch && req.method === 'GET') {
          const [, pub, id, ver] = docMatch;
          if (isSafeWidgetSegment(pub) && isSafeWidgetSegment(id) && isSafeWidgetSegment(ver)) {
            const filePath = join(WIDGET_DIR, pub, id, ver, 'index.html');
            if (existsSync(filePath)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
              res.end(readFileSync(filePath));
              return;
            }
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = resolve(__dirname);
  const env = loadEnv(mode, envDir, '');
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('LLM_') && !process.env[key]) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 300,
                },
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: /\.(png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'course-assets',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 2592000,
                },
              },
            },
            {
              urlPattern: /\/api\/.*\/(catalog|metadata|summary)/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'metadata-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 86400,
                },
              },
            },
          ],
        },
      }),
      eduDataPlugin(),
      widgetRegistryPlugin(),
    ].filter((plugin): plugin is Plugin => plugin !== undefined),
    resolve: {
      alias: [
        { find: /^fs\/promises$/, replacement: resolve(__dirname, 'src/stubs/fs-promises.ts') },
        { find: /^fs$/, replacement: resolve(__dirname, 'src/stubs/fs.ts') },
        { find: /^path$/, replacement: resolve(__dirname, 'src/stubs/path.ts') },
        { find: /^child_process$/, replacement: resolve(__dirname, 'src/stubs/child_process.ts') },
        { find: /^util$/, replacement: resolve(__dirname, 'src/stubs/util.ts') },
        { find: '@', replacement: resolve(__dirname, './src') },
        {
          find: /^@open-edu\/telemetry$/,
          replacement: resolve(PKGS_DIR, 'telemetry/src/index.ts'),
        },
        { find: /^@open-edu\/rewards$/, replacement: resolve(PKGS_DIR, 'rewards/src/index.ts') },
      ],
    },
    server: {
      port: 4001,
      // Railway (and other reverse proxies) forward the deploy host in the
      // Host header; allow any host so requests aren't blocked by Vite's
      // DNS-rebinding protection.
      allowedHosts: true,
      headers: {
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    },
    preview: {
      allowedHosts: true,
      headers: {
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    },
  };
});
