import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PACK_FILE_NAMES = [
  'manifest.json',
  'concepts.json',
  'curriculum.json',
  'sources.json',
] as const;

export function listPackWatchFiles(packs: ReadonlyArray<{ dir: string }>): string[] {
  const files: string[] = [];
  for (const pack of packs) {
    for (const file of PACK_FILE_NAMES) {
      const candidate = join(pack.dir, file);
      if (existsSync(candidate)) files.push(candidate);
    }
  }
  return files;
}
