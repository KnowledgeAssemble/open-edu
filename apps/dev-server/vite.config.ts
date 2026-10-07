import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { readFile, writeFile, unlink, mkdir, rename, rm } from 'node:fs/promises';
import { join, extname, dirname, relative, sep, resolve } from 'node:path';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadPackage, loadBundle } from '@open-edu/core';
import type { LoadedPackage, LoadedBundle } from '@open-edu/core';
import {
  PackageManifestSchema,
  WorkflowSchema,
  RewardsSchema,
  CardDefinitionsSchema,
  ContentNodeSchema,
  type DistributionManifest,
} from '@open-edu/schemas';
import { OepWriter } from '@open-edu/oep-distribution';
import { activitiesFromEntryOrder, buildLinearWorkflow } from './src/studio/outlineModel.js';
import { getTemplateById } from './src/studio/templates/catalog.js';
import { createStudioAiMiddleware } from './src/studio/ai/middleware.js';
import {
  resolveWorkspace,
  scanWorkspace,
  isSafeRelativePath,
} from './src/studio/library/libraryIndex.js';
import {
  duplicateCourse,
  renameCourse,
  archiveCourse,
  importCourseFolder,
} from './src/studio/library/courseOps.js';
import { createUnit, buildUnitOep } from './src/studio/library/unitBuilder.js';
import type { ActivitySummary } from './src/studio/types.js';
import {
  createWidgetRegistryMiddleware,
  WidgetRegistryStore,
} from './src/widget-registry/routes.js';

const VIRTUAL_MODULE_ID = 'virtual:open-edu-package';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_MODULE_ID}`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const requireFromInteractiveRuntime = createRequire(
  resolve(__dirname, '../../packages/interactive-runtime/package.json'),
);

function resolveKnowledgeAssembleInteractiveReact(): string | undefined {
  try {
    const resolved = requireFromInteractiveRuntime.resolve('@knowledgeassemble/interactive-react');
    const parent = dirname(resolved);
    if (parent.endsWith(`${sep}src`)) {
      return dirname(parent);
    }
    return parent;
  } catch {
    return undefined;
  }
}

const widgetRegistryStore = new WidgetRegistryStore(process.env.OPEN_EDU_WIDGET_REGISTRY);

const SERVER_ENV_KEYS = new Set(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY']);

const ASSET_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

const EDITABLE_EXTS = new Set(['.md', '.json']);
const IGNORE_DIRS = new Set(['node_modules', '.git', '.vite', 'dist']);

function toForwardSlashes(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

function collectAllFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string) {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          walk(fullPath);
        }
      } else {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getFileLabel(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath;
  if (filePath === 'package.json') return 'Manifest (package.json)';
  if (filePath === 'workflow.json') return 'Workflow (workflow.json)';
  if (filePath === 'rewards.json') return 'Rewards (rewards.json)';
  if (filePath === 'cards.json') return 'Cards (cards.json)';
  return name;
}

function getFileCategory(filePath: string): string {
  if (filePath === 'package.json') return 'manifest';
  if (filePath === 'workflow.json') return 'workflow';
  if (filePath === 'rewards.json') return 'rewards';
  if (filePath === 'cards.json') return 'cards';
  if (filePath.startsWith('nodes/') || filePath.startsWith('nodes\\')) return 'nodes';
  if (filePath.startsWith('assets/') || filePath.startsWith('assets\\')) return 'assets';
  return 'other';
}

interface FileEntry {
  path: string;
  label: string;
  category: string;
  extension: string;
}

function validateFile(filePath: string, content: string): string | null {
  const ext = extname(filePath).toLowerCase();
  const basename = filePath.split('/').pop()?.toLowerCase() ?? '';

  // Markdown files must have at least one # Heading
  if (ext === '.md') {
    if (!/^#{1,6}\s/m.test(content)) {
      return 'Markdown content must include at least one heading (# Heading)';
    }
    return null;
  }

  if (ext !== '.json') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return 'Invalid JSON syntax';
  }

  if (basename === 'package.json') {
    const result = PackageManifestSchema.safeParse(parsed);
    if (!result.success) {
      return result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    }
  } else if (basename === 'workflow.json') {
    const result = WorkflowSchema.safeParse(parsed);
    if (!result.success) {
      return result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    }
  } else if (basename === 'rewards.json') {
    const result = RewardsSchema.safeParse(parsed);
    if (!result.success) {
      return result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    }
  } else if (basename === 'cards.json') {
    const result = CardDefinitionsSchema.safeParse(parsed);
    if (!result.success) {
      return result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    }
  } else if (filePath.startsWith('nodes/') || filePath.startsWith('nodes\\')) {
    const result = ContentNodeSchema.safeParse(parsed);
    if (!result.success) {
      return result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    }
  }

  return null;
}

function collectCourseFiles(packageDir: string): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();

  function walk(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === 'dist' || entry === 'node_modules' || entry === '.git' || entry === '.edu') {
          continue;
        }
        walk(fullPath);
      } else if (stat.isFile()) {
        const relPath = relative(packageDir, fullPath);
        files.set(relPath, new Uint8Array(readFileSync(fullPath)));
      }
    }
  }

  walk(packageDir);
  return files;
}

function readNodeFiles(dir: string, nodePaths: string[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const relPath of nodePaths) {
    const absPath = join(dir, relPath);
    if (!existsSync(absPath)) continue;
    try {
      files.set(relPath, readFileSync(absPath, 'utf-8'));
    } catch {
      // skip unreadable files
    }
  }
  return files;
}

function orderNodes(currentDir: string, entry: string | undefined): string[] {
  const nodesDir = join(currentDir, 'nodes');
  let paths: string[] = [];
  if (existsSync(nodesDir)) {
    paths = readdirSync(nodesDir)
      .filter((name) => EDITABLE_EXTS.has(extname(name)))
      .map((name) => `nodes/${name}`)
      .sort();
  }
  if (entry && paths.includes(entry)) {
    paths = [entry, ...paths.filter((p) => p !== entry)];
  }
  return paths;
}

interface MultipartPart {
  name: string;
  filename?: string;
  data: Buffer;
  contentType?: string;
}
function multipartParse(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);

  let searchStart = 0;
  while (searchStart < body.length) {
    const boundaryStart = body.indexOf(boundaryBuf, searchStart);
    if (boundaryStart === -1) break;

    const afterBoundary = boundaryStart + boundaryBuf.length;
    const nextBoundaryStart = body.indexOf(boundaryBuf, afterBoundary);
    if (nextBoundaryStart === -1) break;

    const partBuf = body.subarray(afterBoundary, nextBoundaryStart);
    const headerEnd = partBuf.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      searchStart = nextBoundaryStart;
      continue;
    }

    const headerSection = partBuf.subarray(0, headerEnd).toString('utf-8');
    let dataSection = partBuf.subarray(headerEnd + 4);

    const nameMatch = headerSection.match(/name="([^"]*)"/);
    const filenameMatch = headerSection.match(/filename="([^"]*)"/);
    const contentTypeMatch = headerSection.match(/Content-Type:\s*(\S+)/i);

    // Strip trailing \r\n
    if (
      dataSection.length >= 2 &&
      dataSection[dataSection.length - 2] === 13 &&
      dataSection[dataSection.length - 1] === 10
    ) {
      dataSection = dataSection.subarray(0, dataSection.length - 2);
    }

    const part: MultipartPart = {
      name: nameMatch?.[1] ?? '',
      data: dataSection,
    };

    if (filenameMatch) part.filename = filenameMatch[1];
    if (contentTypeMatch) part.contentType = contentTypeMatch[1];

    parts.push(part);

    // Check if this is the end boundary
    if (
      body
        .subarray(nextBoundaryStart, nextBoundaryStart + boundaryBuf.length + 2)
        .equals(Buffer.from(`--${boundary}--`))
    ) {
      break;
    }

    searchStart = nextBoundaryStart;
  }

  return parts;
}

function widgetRegistryPlugin(): Plugin {
  return {
    name: 'open-edu-widget-registry',
    configureServer(server) {
      server.middlewares.use(createWidgetRegistryMiddleware(widgetRegistryStore));
    },
  };
}

function eduPackageLoader(): Plugin {
  let packageData: LoadedPackage | null = null;
  let bundleData: LoadedBundle | null = null;
  let server: ViteDevServer | null = null;
  let packageDir = '';
  let bundleDir = '';
  let isBundleMode = false;
  let aiGenerating = false;

  return {
    name: 'edu-package-loader',
    enforce: 'pre',

    configResolved() {
      packageDir = process.env.OPEN_EDU_PACKAGE_DIR ?? '';
      bundleDir = process.env.OPEN_EDU_BUNDLE_DIR ?? '';

      if (bundleDir) {
        isBundleMode = true;
      } else if (packageDir) {
        const hasPackageJson = existsSync(join(packageDir, 'package.json'));
        const hasBundleJson = existsSync(join(packageDir, 'bundle.json'));
        if (hasBundleJson && !hasPackageJson) {
          isBundleMode = true;
          bundleDir = packageDir;
          packageDir = '';
        }
      }
    },

    async buildStart() {
      if (isBundleMode && bundleDir) {
        try {
          bundleData = await loadBundle(bundleDir);
          console.log(
            `[edu-dev] Loaded bundle: ${bundleData.manifest.title} (${bundleData.modules.length} modules)`,
          );
        } catch (err) {
          console.error('[edu-dev] Failed to load bundle:', err);
        }
      } else if (packageDir) {
        try {
          packageData = await loadPackage(packageDir);
          console.log(`[edu-dev] Loaded package: ${packageData.manifest.title}`);
        } catch (err) {
          console.error('[edu-dev] Failed to load package:', err);
        }
      } else {
        console.warn('[edu-dev] No OPEN_EDU_PACKAGE_DIR or OPEN_EDU_BUNDLE_DIR defined');
      }
    },

    configureServer(srv) {
      server = srv;
      const getCurrentDir = () => packageDir || bundleDir;
      const watchDir = bundleDir || packageDir;
      if (!watchDir) return;

      srv.watcher.add(watchDir);
      srv.watcher.on('change', async (filePath) => {
        if (filePath.startsWith(getCurrentDir()) && !aiGenerating) {
          try {
            if (isBundleMode) {
              bundleData = await loadBundle(bundleDir);
            } else {
              packageData = await loadPackage(packageDir);
            }
            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });
          } catch (err) {
            console.error('[edu-dev] Failed to reload:', err);
          }
        }
      });

      // Serve static assets from the active package's assets/ directory.
      // The directory is resolved per request so switching courses updates it live.
      const regexp = /^\/assets\//;
      srv.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const requestPath = decodeURIComponent(req.url ?? '');
        const match = requestPath.match(regexp);
        if (!match) return next();
        const currentAssetsDir = packageDir ? join(packageDir, 'assets') : null;
        if (!currentAssetsDir || !existsSync(currentAssetsDir)) return next();
        const relativePath = requestPath.slice(match[0].length);
        const filePath = join(currentAssetsDir, relativePath);
        if (!filePath.startsWith(currentAssetsDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
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
          // file not found, fall through
        }
        next();
      });

      // ---- Studio AI API Routes (Node-side only; never exposes API keys).
      // The single AI request surface (`/api/studio/ai/*` including the chat
      // loop at `/api/studio/ai/chat`). Shared with browser mode via
      // `createStudioAiMiddleware` so both modes hit the same Node backend.
      srv.middlewares.use(
        createStudioAiMiddleware({
          getPackageDir: () => packageDir,
          setPackageDir: (dir: string) => {
            packageDir = dir;
            srv.watcher.add(dir);
          },
          onCommitStart: () => {
            aiGenerating = true;
          },
          onCommitSuccess: (dir: string) => {
            void (async () => {
              try {
                packageData = await loadPackage(dir);
                const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
                if (mod) {
                  srv.moduleGraph.invalidateModule(mod);
                }
              } catch (err) {
                console.error('[edu-dev] Failed to reload after AI commit:', err);
              }
              setImmediate(() => {
                aiGenerating = false;
                try {
                  srv.ws.send({ type: 'full-reload' });
                } catch (err) {
                  console.error('[edu-dev] Failed to send AI commit reload:', err);
                }
              });
            })();
          },
        }),
      );

      // ---- Studio Library API Routes ----
      // Registered before the package API catch-all so /api/studio/library*
      // requests are not swallowed by it. Lets the creator switch the active
      // course (mutates packageDir) without restarting Vite.
      const studioLibraryRegexp = /^\/api\/studio\/library/;
      srv.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';
        if (!studioLibraryRegexp.test(url)) return next();

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');

        const slugify = (title: string): string => {
          const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          return slug || 'unit';
        };

        const rejectRelativePath = (relativePath: string): string | null => {
          if (!isSafeRelativePath(relativePath)) {
            return 'Invalid relativePath';
          }
          return null;
        };

        try {
          const parsedUrl = new URL(url, `http://${req.headers.host ?? 'localhost'}`);
          const pathname = parsedUrl.pathname;
          const method = req.method ?? 'GET';

          // GET /api/studio/library — list workspace entries
          if (pathname === '/api/studio/library' && method === 'GET') {
            if (!packageDir) {
              res.end(JSON.stringify({ workspace: '', entries: [] }));
              return;
            }
            const workspace = resolveWorkspace(packageDir);
            res.end(JSON.stringify({ workspace, entries: scanWorkspace(workspace) }));
            return;
          }

          if (!packageDir) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No active package' }));
            return;
          }

          // POST /api/studio/library/open — switch the active course package
          if (pathname === '/api/studio/library/open' && method === 'POST') {
            const body = (await parseJsonBody(req)) as { relativePath?: string };
            const guardError = rejectRelativePath(body.relativePath ?? '');
            if (guardError) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: guardError }));
              return;
            }
            const workspace = resolveWorkspace(packageDir);
            const newDir = join(workspace, body.relativePath ?? '');
            if (!existsSync(join(newDir, 'package.json'))) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'No package.json in that directory' }));
              return;
            }
            let loaded: LoadedPackage;
            try {
              loaded = await loadPackage(newDir);
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: (err as Error).message }));
              return;
            }
            packageDir = newDir;
            packageData = loaded;
            srv.watcher.add(newDir);
            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            res.end(JSON.stringify({ success: true, packageDir }));
            // Defer the full-reload so the open response reaches the client first.
            setImmediate(() => {
              try {
                srv.ws.send({ type: 'full-reload' });
              } catch (err) {
                console.error('[edu-dev] Failed to send library reload:', err);
              }
            });
            return;
          }

          // POST /api/studio/library/duplicate — copy a course under a new id/title
          if (pathname === '/api/studio/library/duplicate' && method === 'POST') {
            const body = (await parseJsonBody(req)) as {
              relativePath?: string;
              newId?: string;
              newTitle?: string;
            };
            const guardError = rejectRelativePath(body.relativePath ?? '');
            if (guardError) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: guardError }));
              return;
            }
            const workspace = resolveWorkspace(packageDir);
            const entry = await duplicateCourse(
              join(workspace, body.relativePath ?? ''),
              workspace,
              body.newId ?? '',
              body.newTitle ?? '',
            );
            res.end(JSON.stringify({ success: true, entry }));
            return;
          }

          // POST /api/studio/library/rename — retitle a course/unit in place
          if (pathname === '/api/studio/library/rename' && method === 'POST') {
            const body = (await parseJsonBody(req)) as {
              relativePath?: string;
              newTitle?: string;
            };
            const guardError = rejectRelativePath(body.relativePath ?? '');
            if (guardError) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: guardError }));
              return;
            }
            const workspace = resolveWorkspace(packageDir);
            const entry = await renameCourse(
              join(workspace, body.relativePath ?? ''),
              workspace,
              body.newTitle ?? '',
            );
            res.end(JSON.stringify({ success: true, entry }));
            return;
          }

          // POST /api/studio/library/archive — move a course/unit into .archive/
          if (pathname === '/api/studio/library/archive' && method === 'POST') {
            const body = (await parseJsonBody(req)) as { relativePath?: string };
            const guardError = rejectRelativePath(body.relativePath ?? '');
            if (guardError) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: guardError }));
              return;
            }
            const workspace = resolveWorkspace(packageDir);
            const archivedPath = await archiveCourse(
              join(workspace, body.relativePath ?? ''),
              workspace,
            );
            res.end(JSON.stringify({ success: true, archivedPath }));
            return;
          }

          // POST /api/studio/library/import — copy an external course folder in
          if (pathname === '/api/studio/library/import' && method === 'POST') {
            const body = (await parseJsonBody(req)) as { sourcePath?: string };
            if (!body.sourcePath || typeof body.sourcePath !== 'string') {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing sourcePath' }));
              return;
            }
            try {
              const workspace = resolveWorkspace(packageDir);
              const entry = await importCourseFolder(body.sourcePath, workspace);
              res.end(JSON.stringify({ success: true, entry }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: (err as Error).message }));
            }
            return;
          }

          // POST /api/studio/library/create-unit — bundle 2-5 courses into a unit
          if (pathname === '/api/studio/library/create-unit' && method === 'POST') {
            const body = (await parseJsonBody(req)) as {
              title?: string;
              courseRelativePaths?: string[];
            };
            const title =
              typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Unit';
            const courseRelativePaths = Array.isArray(body.courseRelativePaths)
              ? body.courseRelativePaths
              : [];
            const unsafePath = courseRelativePaths.find(
              (path) => typeof path !== 'string' || !isSafeRelativePath(path),
            );
            if (unsafePath !== undefined) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid courseRelativePaths' }));
              return;
            }
            const unitId = slugify(title);
            const workspace = resolveWorkspace(packageDir);
            const entry = await createUnit({
              workspaceRoot: workspace,
              courseRelativePaths,
              unitId,
              unitTitle: title,
              author: 'OpenEdu Studio',
            });
            res.end(JSON.stringify({ success: true, entry }));
            return;
          }

          // POST /api/studio/library/export-unit-oep — download a unit bundle .oep
          if (pathname === '/api/studio/library/export-unit-oep' && method === 'POST') {
            const body = (await parseJsonBody(req)) as { relativePath?: string };
            const guardError = rejectRelativePath(body.relativePath ?? '');
            if (guardError) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: guardError }));
              return;
            }
            const workspace = resolveWorkspace(packageDir);
            const unitDir = join(workspace, body.relativePath ?? '');
            try {
              const bytes = await buildUnitOep(unitDir);
              const bundlePath = join(unitDir, 'bundle.json');
              const bundleJson = existsSync(bundlePath)
                ? (JSON.parse(readFileSync(bundlePath, 'utf-8')) as {
                    id?: string;
                    version?: string;
                  })
                : {};
              const entryId = bundleJson.id ?? 'unit';
              const version = bundleJson.version ?? '1.0.0';
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader(
                'Content-Disposition',
                `attachment; filename="${entryId}-${version}.oep"`,
              );
              res.end(Buffer.from(bytes));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: (err as Error).message }));
            }
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Unknown library endpoint' }));
        } catch (err) {
          console.error('[edu-dev] Library API error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });

      // ---- Package Editor API Routes ----
      if (!getCurrentDir()) return;

      const apiRegexp = /^\/api\//;

      srv.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';
        if (!apiRegexp.test(url)) return next();

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');

        try {
          const parsedUrl = new URL(url, `http://${req.headers.host ?? 'localhost'}`);
          const pathname = parsedUrl.pathname;
          const method = req.method ?? 'GET';

          // GET /api/package/tree — list all files
          if (pathname === '/api/package/tree' && method === 'GET') {
            const filePath = parsedUrl.searchParams.get('path');

            if (filePath) {
              const normalizedPath = toForwardSlashes(filePath);
              const absPath = join(getCurrentDir(), normalizedPath);
              if (!absPath.startsWith(getCurrentDir())) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: 'Forbidden' }));
                return;
              }
              if (!existsSync(absPath)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'File not found' }));
                return;
              }
              const content = await readFile(absPath, 'utf-8');
              const ext = extname(filePath).toLowerCase();
              res.end(
                JSON.stringify({
                  path: normalizedPath,
                  content,
                  isEditable: EDITABLE_EXTS.has(ext),
                  extension: ext,
                }),
              );
            } else {
              const allFiles = collectAllFiles(getCurrentDir());
              const files: FileEntry[] = allFiles
                .map((f) => {
                  const relPath = toForwardSlashes(relative(getCurrentDir(), f));
                  return {
                    path: relPath,
                    label: getFileLabel(relPath),
                    category: getFileCategory(relPath),
                    extension: extname(f).toLowerCase(),
                  };
                })
                .filter((f) => EDITABLE_EXTS.has(f.extension) || f.category === 'assets');
              res.end(JSON.stringify({ files }));
            }
            return;
          }

          // GET /api/package/file — read a single file
          if (pathname === '/api/package/file' && method === 'GET') {
            const filePath = toForwardSlashes(
              decodeURIComponent(parsedUrl.searchParams.get('path') ?? ''),
            );
            if (!filePath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing path parameter' }));
              return;
            }
            const absPath = join(getCurrentDir(), filePath);
            if (!absPath.startsWith(getCurrentDir())) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }
            if (!existsSync(absPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
              return;
            }
            const content = await readFile(absPath, 'utf-8');
            const ext = extname(filePath).toLowerCase();
            res.end(
              JSON.stringify({
                path: filePath,
                content,
                isEditable: EDITABLE_EXTS.has(ext),
                extension: ext,
              }),
            );
            return;
          }

          // PUT /api/package/file — write/update a file
          if (pathname === '/api/package/file' && method === 'PUT') {
            const body = (await parseJsonBody(req)) as {
              path: string;
              content: string;
              validate?: boolean;
            };
            const filePath = toForwardSlashes(body.path);
            const content = body.content;

            if (!filePath || content === undefined) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing path or content' }));
              return;
            }

            const absPath = join(getCurrentDir(), filePath);
            if (!absPath.startsWith(getCurrentDir())) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }

            if (body.validate !== false) {
              const validationError = validateFile(filePath, content);
              if (validationError) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: 'Validation failed', details: validationError }));
                return;
              }
            }

            const dir = dirname(absPath);
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }

            await writeFile(absPath, content, 'utf-8');

            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });

            res.end(JSON.stringify({ success: true, path: filePath }));
            return;
          }

          // POST /api/package/file — create a new file
          if (pathname === '/api/package/file' && method === 'POST') {
            const body = (await parseJsonBody(req)) as {
              path: string;
              content?: string;
              entry?: boolean;
              validate?: boolean;
            };
            const filePath = toForwardSlashes(body.path);

            if (!filePath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing path' }));
              return;
            }

            const absPath = join(getCurrentDir(), filePath);
            if (!absPath.startsWith(getCurrentDir())) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }

            if (existsSync(absPath)) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: 'File already exists' }));
              return;
            }

            const content =
              body.content ??
              (filePath.endsWith('.md') ? '# New Node\n\nStart writing here...' : '{}');

            if (body.validate !== false) {
              const validationError = validateFile(filePath, content);
              if (validationError) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: 'Validation failed', details: validationError }));
                return;
              }
            }

            const dir = dirname(absPath);
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }

            await writeFile(absPath, content, 'utf-8');

            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });

            res.end(JSON.stringify({ success: true, path: filePath }));
            return;
          }

          // DELETE /api/package/file — delete a file
          if (pathname === '/api/package/file' && method === 'DELETE') {
            const filePath = toForwardSlashes(
              decodeURIComponent(parsedUrl.searchParams.get('path') ?? ''),
            );
            if (!filePath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing path parameter' }));
              return;
            }

            const absPath = join(getCurrentDir(), filePath);
            if (!absPath.startsWith(getCurrentDir())) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }

            if (!existsSync(absPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
              return;
            }

            await unlink(absPath);

            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });

            res.end(JSON.stringify({ success: true, path: filePath }));
            return;
          }

          // POST /api/package/rename — rename a file
          if (pathname === '/api/package/rename' && method === 'POST') {
            const body = (await parseJsonBody(req)) as {
              oldPath: string;
              newPath: string;
            };
            const oldPath = toForwardSlashes(body.oldPath);
            const newPath = toForwardSlashes(body.newPath);

            if (!oldPath || !newPath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing oldPath or newPath' }));
              return;
            }

            const absOldPath = join(getCurrentDir(), oldPath);
            const absNewPath = join(getCurrentDir(), newPath);

            if (
              !absOldPath.startsWith(getCurrentDir()) ||
              !absNewPath.startsWith(getCurrentDir())
            ) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }

            if (!existsSync(absOldPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Source file not found' }));
              return;
            }

            if (existsSync(absNewPath)) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: 'Target file already exists' }));
              return;
            }

            const newDir = dirname(absNewPath);
            if (!existsSync(newDir)) {
              mkdirSync(newDir, { recursive: true });
            }

            await rename(absOldPath, absNewPath);

            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });

            res.end(JSON.stringify({ success: true, oldPath, newPath }));
            return;
          }

          // POST /api/package/validate — run full package validation
          if (pathname === '/api/package/validate' && method === 'POST') {
            try {
              const errors: Array<{ path: string; error: string }> = [];
              const allFiles = collectAllFiles(getCurrentDir());
              for (const f of allFiles) {
                const relPath = toForwardSlashes(relative(getCurrentDir(), f));
                if (!EDITABLE_EXTS.has(extname(f).toLowerCase())) continue;
                if (IGNORE_DIRS.has(f.split('/').pop() ?? '')) continue;
                try {
                  const content = readFileSync(f, 'utf-8');
                  const validationError = validateFile(relPath, content);
                  if (validationError) {
                    errors.push({ path: relPath, error: validationError });
                  }
                } catch {
                  errors.push({ path: relPath, error: 'Failed to read file' });
                }
              }
              res.end(JSON.stringify({ valid: errors.length === 0, errors }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: (err as Error).message }));
            }
            return;
          }

          // POST /api/package/assets/upload — upload an asset
          if (pathname === '/api/package/assets/upload' && method === 'POST') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.includes('multipart/form-data')) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Expected multipart/form-data' }));
              return;
            }

            const boundary = contentType.split('boundary=')[1]?.trim();
            if (!boundary) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'No boundary found' }));
              return;
            }

            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const fullBody = Buffer.concat(chunks);

            const parts = multipartParse(fullBody, boundary);
            const filePart = parts.find((p) => p.name === 'file');

            if (!filePart || !filePart.filename) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'No file provided' }));
              return;
            }

            const pathPart = parts.find((p) => p.name === 'path');
            const targetPath = toForwardSlashes(
              pathPart?.data.toString('utf-8').trim() || `assets/${filePart.filename}`,
            );
            const absPath = join(getCurrentDir(), targetPath);

            if (!absPath.startsWith(getCurrentDir())) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }

            const dir = dirname(absPath);
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }

            writeFileSync(absPath, filePart.data);

            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });

            res.end(JSON.stringify({ success: true, path: targetPath }));
            return;
          }

          // GET /api/package/outline — derive ordered activities + title
          if (pathname === '/api/package/outline' && method === 'GET') {
            if (isBundleMode) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  error: 'Creator package APIs are not available in bundle mode.',
                }),
              );
              return;
            }
            const manifestPath = join(getCurrentDir(), 'package.json');
            if (!existsSync(manifestPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'No package.json in this directory' }));
              return;
            }
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
              title?: string;
              entry?: string;
            };
            const workflowPath = join(getCurrentDir(), 'workflow.json');
            let orderedPaths: string[] = [];
            if (existsSync(workflowPath)) {
              const workflow = JSON.parse(readFileSync(workflowPath, 'utf-8')) as {
                routing?: Record<string, unknown>;
              };
              orderedPaths = Object.keys(workflow.routing ?? {});
            } else {
              orderedPaths = orderNodes(getCurrentDir(), manifest.entry);
            }
            const files = readNodeFiles(getCurrentDir(), orderedPaths);
            const activities = activitiesFromEntryOrder(orderedPaths, files);
            res.end(JSON.stringify({ title: manifest.title ?? '', activities }));
            return;
          }

          // PUT /api/package/outline — persist linear order into workflow.json + manifest entry
          if (pathname === '/api/package/outline' && method === 'PUT') {
            if (isBundleMode) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  error: 'Creator package APIs are not available in bundle mode.',
                }),
              );
              return;
            }
            const body = (await parseJsonBody(req)) as { orderedPaths?: string[] };
            const orderedPaths = Array.isArray(body.orderedPaths) ? body.orderedPaths : [];
            if (orderedPaths.length === 0) {
              await writeFile(
                join(getCurrentDir(), 'workflow.json'),
                JSON.stringify({ routing: {} }, null, 2),
                'utf-8',
              );
              const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
              if (mod) {
                srv.moduleGraph.invalidateModule(mod);
              }
              srv.ws.send({ type: 'full-reload' });
              res.end(JSON.stringify({ success: true }));
              return;
            }
            const entry = orderedPaths[0]!;
            const workflow = buildLinearWorkflow(orderedPaths, entry);
            const workflowResult = WorkflowSchema.safeParse({ routing: workflow.routing });
            if (!workflowResult.success) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: 'Generated workflow is invalid',
                  details: workflowResult.error.message,
                }),
              );
              return;
            }

            const manifestPath = join(getCurrentDir(), 'package.json');
            let manifest = existsSync(manifestPath)
              ? (JSON.parse(readFileSync(manifestPath, 'utf-8')) as { entry?: string })
              : null;

            if (manifest) {
              const nextManifest = { ...manifest, entry };
              const manifestResult = PackageManifestSchema.safeParse(nextManifest);
              if (!manifestResult.success) {
                res.statusCode = 422;
                res.end(
                  JSON.stringify({
                    error: 'Updated manifest is invalid',
                    details: manifestResult.error.message,
                  }),
                );
                return;
              }
              manifest = nextManifest;
            }

            await writeFile(
              join(getCurrentDir(), 'workflow.json'),
              JSON.stringify({ routing: workflow.routing }, null, 2),
              'utf-8',
            );

            if (manifest) {
              await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
            }

            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });

            res.end(JSON.stringify({ success: true }));
            return;
          }

          // POST /api/package/create-from-template — write a starter template into the package dir
          if (pathname === '/api/package/create-from-template' && method === 'POST') {
            const body = (await parseJsonBody(req)) as {
              templateId?: string;
              force?: boolean;
            };
            const template = getTemplateById(body.templateId ?? '');
            if (!template) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Unknown template: ${body.templateId}` }));
              return;
            }

            if (isBundleMode) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  error: 'Creator package APIs are not available in bundle mode.',
                }),
              );
              return;
            }

            if (body.force === true) {
              // Replace the whole course: clear nodes + course sidecars so the
              // exported .oep never carries orphans from a previous course.
              const nodesDir = join(getCurrentDir(), 'nodes');
              if (existsSync(nodesDir)) {
                await rm(nodesDir, { recursive: true, force: true });
              }
              const assetsDir = join(getCurrentDir(), 'assets');
              if (existsSync(assetsDir)) {
                await rm(assetsDir, { recursive: true, force: true });
              }
              for (const rel of ['workflow.json', 'package.json', 'rewards.json', 'cards.json']) {
                const abs = join(getCurrentDir(), rel);
                if (existsSync(abs)) {
                  await rm(abs, { force: true });
                }
              }
            } else {
              const nodesDir = join(getCurrentDir(), 'nodes');
              const hasNodes = existsSync(nodesDir) && readdirSync(nodesDir).length > 0;
              if (hasNodes) {
                res.statusCode = 409;
                res.end(
                  JSON.stringify({
                    error: 'Directory already contains nodes. Pass force: true to overwrite.',
                  }),
                );
                return;
              }
            }

            for (const [relPath, content] of Object.entries(template.files)) {
              const absPath = join(getCurrentDir(), relPath);
              const dir = dirname(absPath);
              if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
              }
              await writeFile(absPath, content, 'utf-8');
            }

            const mod = srv.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
            if (mod) {
              srv.moduleGraph.invalidateModule(mod);
            }
            srv.ws.send({ type: 'full-reload' });

            res.end(JSON.stringify({ success: true }));
            return;
          }

          // POST /api/package/export-oep — build a .oep archive and stream it as a download
          if (pathname === '/api/package/export-oep' && method === 'POST') {
            if (isBundleMode) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  error: 'Creator package APIs are not available in bundle mode.',
                }),
              );
              return;
            }
            try {
              const pkg = await loadPackage(getCurrentDir());
              const courseFiles = collectCourseFiles(getCurrentDir());
              const distManifest = {
                format: 'openedu-package' as const,
                formatVersion: 1 as const,
                type: 'course' as const,
                id: pkg.manifest.id,
                version: pkg.manifest.version,
                title: pkg.manifest.title,
                checksum: { algorithm: 'sha256' as const, value: '' },
                contentRoot: 'course/',
                signature: { status: 'unsigned' as const },
              } as DistributionManifest;

              const result = await OepWriter.build({ manifest: distManifest, courseFiles });
              const oepFileName = `${pkg.manifest.id}-${pkg.manifest.version}.oep`;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="${oepFileName}"`);
              res.end(Buffer.from(result.bytes));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Export failed';
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: message, errors: [{ path: '', error: message }] }));
            }
            return;
          }

          // Fallback route for /api/package/dir — return package directory path
          if (pathname === '/api/package/dir' && method === 'GET') {
            res.end(JSON.stringify({ packageDir: getCurrentDir() }));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Unknown API endpoint' }));
        } catch (err) {
          console.error('[edu-dev] API error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        if (isBundleMode && bundleData) {
          const serialized = {
            ...bundleData,
            moduleMap: Array.from(bundleData.moduleMap.entries()),
          };
          return `export const packageData = null;\nexport const bundleData = ${JSON.stringify(serialized)};`;
        }
        if (packageData) {
          return `export const packageData = ${JSON.stringify(packageData)};\nexport const bundleData = null;`;
        }
        return 'export const packageData = null;\nexport const bundleData = null;';
      }
    },
  };
}

function virtualPackagePlugin(): Plugin {
  return {
    name: 'resolve-virtual-package',
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        return 'export const packageData = null;\nexport const bundleData = null;';
      }
    },
  };
}

function localStudioAiPlugin(): Plugin {
  return {
    name: 'open-edu-local-studio-ai',
    configureServer(server) {
      // Browser mode has no filesystem-owning `eduPackageLoader`, but it runs
      // under a Node Vite dev server, so it can still host the single Studio AI
      // surface (`/api/studio/ai/*` incl. the chat loop). `packageDir` is empty:
      // course storage lives in the browser (OPFS); item/course draft generation
      // works via `existingTitles` / returned files respectively.
      server.middlewares.use(
        createStudioAiMiddleware({
          getPackageDir: () => '',
        }),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = resolve(__dirname);
  const env = loadEnv(mode, envDir, '');
  for (const [key, value] of Object.entries(env)) {
    if (
      (key.startsWith('LLM_') ||
        key.startsWith('OPEN_EDU_STUDIO_LLM_') ||
        SERVER_ENV_KEYS.has(key)) &&
      !process.env[key]
    ) {
      process.env[key] = value;
    }
  }

  const isBrowserMode = mode === 'browser';

  const interactiveReactRoot = resolveKnowledgeAssembleInteractiveReact();
  const knowledgeAssembleAliases = interactiveReactRoot
    ? { '@knowledgeassemble/interactive-react': interactiveReactRoot }
    : {};

  return {
    // In browser mode the Node-only eduPackageLoader is excluded. The virtual
    // package module still needs a resolution so DevApp can always import it;
    // browser mode always uses the local BrowserStudioProvider instead.
    plugins: isBrowserMode
      ? [react(), widgetRegistryPlugin(), virtualPackagePlugin(), localStudioAiPlugin()]
      : [react(), widgetRegistryPlugin(), eduPackageLoader()],
    resolve: isBrowserMode
      ? {
          alias: {
            '@open-edu/ai-companion': resolve(__dirname, 'src/stubs/ai-companion.ts'),
            ...knowledgeAssembleAliases,
          },
        }
      : Object.keys(knowledgeAssembleAliases).length > 0
        ? { alias: knowledgeAssembleAliases }
        : undefined,
    optimizeDeps: {
      // Linked file: packages must not be served from a stale Vite prebundle.
      exclude: ['@knowledgeassemble/interactive-react'],
    },
    define: {
      'import.meta.env.VITE_OPEN_EDU_BROWSER': JSON.stringify(isBrowserMode ? '1' : '0'),
      OPEN_EDU_PACKAGE_DIR: process.env.OPEN_EDU_PACKAGE_DIR
        ? JSON.stringify(process.env.OPEN_EDU_PACKAGE_DIR)
        : '""',
      OPEN_EDU_STUDIO_ASSISTANT: process.env.OPEN_EDU_STUDIO_ASSISTANT
        ? JSON.stringify(process.env.OPEN_EDU_STUDIO_ASSISTANT)
        : '""',
    },
    build: {
      outDir: isBrowserMode ? 'dist' : undefined,
      emptyOutDir: true,
    },
    server: {
      port: 4000,
      open: isBrowserMode ? false : true,
    },
  };
});
