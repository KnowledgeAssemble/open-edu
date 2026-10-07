import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { loadPackage, serializeResolvedNodes, hasUnresolvedGeoSources } from '@open-edu/core';
import { OepWriter } from '@open-edu/oep-distribution';
import { OEP_FORMAT, OEP_FORMAT_VERSION, type DistributionManifest } from '@open-edu/schemas';
import type { CliResult } from '../utils/json-output.js';
import { formatValidationError, printMessages } from '../utils/format.js';
import { createLogger } from '@open-edu/logger';

const logger = createLogger({ scope: 'cli:oep-build' });

function collectCourseFiles(packageDir: string): Map<string, Uint8Array> {
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
        const relPath = relative(packageDir, fullPath);
        files.set(relPath, new Uint8Array(readFileSync(fullPath)));
      }
    }
  }

  walk(packageDir);
  return files;
}

export async function buildOep(
  packageDir: string,
  outputDir?: string,
  options?: { json?: boolean; geoAssetsDir?: string },
): Promise<CliResult> {
  logger.info('Building .oep archive', { packageDir, outputDir: outputDir ?? null });
  try {
    const pkg = await loadPackage(packageDir, { geoAssetsDir: options?.geoAssetsDir });
    const outDir = outputDir ?? process.cwd();

    if (!existsSync(outDir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(outDir, { recursive: true });
    }

    const courseFiles = collectCourseFiles(packageDir);

    // Overlay resolved geo data from in-memory loaded nodes onto the on-disk
    // file content so the archive carries inlined FeatureCollections.
    for (const [path, bytes] of serializeResolvedNodes(pkg.nodes)) {
      courseFiles.set(path, bytes);
    }

    // Fail-closed: if any node still has unresolved `openedu://geo/*` refs the
    // catalog was not found and the archive would ship a blank map.
    if (hasUnresolvedGeoSources(pkg.nodes)) {
      const msg =
        'Course contains unresolved openedu://geo/* URIs. ' +
        'Set OPEN_EDU_GEO_ASSETS_DIR, vendor a geo-assets/ catalog in the package, or pass --geo-assets-dir.';
      if (options?.json) {
        return { success: false, error: msg, code: 1 };
      }
      printMessages([{ type: 'error', text: msg }]);
      return { success: false, error: msg, code: 1 };
    }

    const distManifest = {
      format: OEP_FORMAT,
      formatVersion: OEP_FORMAT_VERSION,
      id: pkg.manifest.id,
      version: pkg.manifest.version,
      title: pkg.manifest.title,
      checksum: { algorithm: 'sha256' as const, value: '' },
      contentRoot: 'course/',
      signature: { status: 'unsigned' as const },
    } as DistributionManifest;

    const result = await OepWriter.build({ manifest: distManifest, courseFiles });
    const oepFileName = `${pkg.manifest.id}-${pkg.manifest.version}.oep`;
    const oepPath = resolve(join(outDir, oepFileName));

    writeFileSync(oepPath, result.bytes);

    if (options?.json) {
      return {
        success: true,
        data: {
          packageDir,
          oepPath,
          oepFileName,
          checksum: result.checksumValue,
        },
      };
    }

    printMessages([
      { type: 'success', text: `Built ${oepFileName}` },
      { type: 'info', text: `  SHA-256: ${result.checksumValue}` },
      { type: 'info', text: `  Size: ${(result.bytes.length / 1024).toFixed(1)} KiB` },
    ]);
    logger.info('.oep archive built', { oepPath, checksum: result.checksumValue });
    return { success: true, data: {} };
  } catch (error) {
    logger.error('.oep build failed', { packageDir, error: String(error) });
    if (options?.json) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        code: 1,
      };
    }
    const messages = formatValidationError(error);
    printMessages(messages);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 1,
    };
  }
}
