import { resolve } from 'node:path';
import { loadPackDirectory, PackValidationError } from '@open-edu/packs/loader';
import type { CliResult } from '../utils/json-output.js';

export async function validatePack(
  packDir: string,
  options?: { json?: boolean },
): Promise<CliResult> {
  void options;
  try {
    const loaded = loadPackDirectory(resolve(packDir));
    return {
      success: true,
      data: {
        valid: true,
        id: loaded.manifest.id,
        type: loaded.manifest.type,
        version: loaded.manifest.version,
        concepts: loaded.concepts?.length ?? 0,
        units: loaded.curriculum?.units.length ?? 0,
      },
    };
  } catch (error) {
    const diagnostics =
      error instanceof PackValidationError
        ? error.diagnostics
        : [{ code: 'PACK_MANIFEST_INVALID', severity: 'error', message: String(error) }];
    return {
      success: false,
      error: diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'),
      code: 1,
    };
  }
}
