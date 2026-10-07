import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { loadPackage, serializeResolvedNodes, hasUnresolvedGeoSources } from '@open-edu/core';
import { OepWriter } from '@open-edu/oep-distribution';
import {
  OEP_FORMAT,
  OEP_FORMAT_VERSION,
  BundleManifestSchema,
  type DistributionManifest,
} from '@open-edu/schemas';
import type { CliResult } from '../utils/json-output.js';
import { formatValidationError, printMessages } from '../utils/format.js';
import { createLogger } from '@open-edu/logger';

const logger = createLogger({ scope: 'cli:oep-build-bundle' });

function collectModuleFiles(moduleDir: string): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();

  function walk(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (
          entry === 'dist' ||
          entry === 'node_modules' ||
          entry === '.git' ||
          entry === '.edu' ||
          entry === 'geo-assets'
        ) {
          continue;
        }
        walk(fullPath);
      } else if (stat.isFile()) {
        const relPath = relative(moduleDir, fullPath);
        files.set(relPath, new Uint8Array(readFileSync(fullPath)));
      }
    }
  }

  walk(moduleDir);
  return files;
}

function collectBundleRootFiles(bundleDir: string): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const name of ['rewards.json', 'cards.json']) {
    const p = join(bundleDir, name);
    if (existsSync(p)) {
      files.set(`bundle/${name}`, new Uint8Array(readFileSync(p)));
    }
  }
  return files;
}

export async function buildOepBundle(
  bundleDir: string,
  outputDir?: string,
  options?: { json?: boolean; geoAssetsDir?: string },
): Promise<CliResult> {
  logger.info('Building .oep bundle archive', { bundleDir, outputDir: outputDir ?? null });
  try {
    const outDir = outputDir ?? process.cwd();

    if (!existsSync(outDir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(outDir, { recursive: true });
    }

    const bundleJsonPath = join(bundleDir, 'bundle.json');
    if (!existsSync(bundleJsonPath)) {
      return {
        success: false,
        error: `bundle.json not found in ${bundleDir}`,
        code: 1,
      };
    }

    const bundleJsonRaw = readFileSync(bundleJsonPath, 'utf-8');
    let bundleJson: Record<string, unknown>;
    try {
      bundleJson = JSON.parse(bundleJsonRaw);
    } catch {
      return {
        success: false,
        error: `Invalid JSON in bundle.json`,
        code: 1,
      };
    }

    const bundleManifest = BundleManifestSchema.parse(bundleJson);

    const moduleFiles = new Map<string, Map<string, Uint8Array>>();
    for (const mod of bundleManifest.modules) {
      const moduleDir = resolve(bundleDir, mod.path);
      if (!existsSync(moduleDir)) {
        return {
          success: false,
          error: `Module directory not found: ${moduleDir} (module: ${mod.id})`,
          code: 1,
        };
      }
      const files = collectModuleFiles(moduleDir);

      // Load and resolve geo URIs for this module, then overlay resolved
      // node content onto the on-disk files so the bundle carries inlined data.
      const modPkg = await loadPackage(moduleDir, { geoAssetsDir: options?.geoAssetsDir });
      for (const [path, bytes] of serializeResolvedNodes(modPkg.nodes)) {
        files.set(path, bytes);
      }
      if (hasUnresolvedGeoSources(modPkg.nodes)) {
        const msg = `Module "${mod.id}" has unresolved openedu://geo/* URIs. Set OPEN_EDU_GEO_ASSETS_DIR, vendor a geo-assets/ catalog, or pass --geo-assets-dir.`;
        if (options?.json) {
          return { success: false, error: msg, code: 1 };
        }
        printMessages([{ type: 'error', text: msg }]);
        return { success: false, error: msg, code: 1 };
      }

      moduleFiles.set(mod.id, files);
    }

    const distManifest = {
      format: OEP_FORMAT,
      formatVersion: OEP_FORMAT_VERSION,
      id: bundleManifest.id,
      version: bundleManifest.version,
      title: bundleManifest.title,
      checksum: { algorithm: 'sha256' as const, value: '' },
      contentRoot: 'bundle/',
      signature: { status: 'unsigned' as const },
    } as DistributionManifest;

    const bundleFiles = collectBundleRootFiles(bundleDir);

    const result = await OepWriter.buildBundle({
      manifest: distManifest,
      bundleManifest,
      moduleFiles,
      bundleFiles,
    });

    const oepFileName = `${bundleManifest.id}-${bundleManifest.version}.oep`;
    const oepPath = resolve(join(outDir, oepFileName));

    writeFileSync(oepPath, result.bytes);

    if (options?.json) {
      return {
        success: true,
        data: {
          bundleDir,
          oepPath,
          oepFileName,
          checksum: result.checksumValue,
          modules: bundleManifest.modules.length,
        },
      };
    }

    printMessages([
      { type: 'success', text: `Built bundle ${oepFileName}` },
      { type: 'info', text: `  SHA-256: ${result.checksumValue}` },
      { type: 'info', text: `  Size: ${(result.bytes.length / 1024).toFixed(1)} KiB` },
      { type: 'info', text: `  Modules: ${bundleManifest.modules.length}` },
    ]);
    logger.info('.oep bundle archive built', { oepPath, checksum: result.checksumValue });
    return { success: true, data: {} };
  } catch (error) {
    logger.error('.oep bundle build failed', { bundleDir, error: String(error) });
    const messages = formatValidationError(error);
    printMessages(messages);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 1,
    };
  }
}
