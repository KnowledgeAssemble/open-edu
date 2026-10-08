import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePack } from './pack.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const KNOWLEDGE_FIXTURE = join(REPO_ROOT, 'examples/packs/knowledge/openedu-fractions');

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('validatePack', () => {
  it('returns success for a valid pack fixture', async () => {
    const result = await validatePack(KNOWLEDGE_FIXTURE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('openedu-fractions');
      expect(result.data.type).toBe('knowledge');
      expect(result.data.concepts).toBe(5);
    }
  });

  it('returns a diagnostic and code 1 for an invalid pack', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'openedu-pack-cli-'));
    tempDirs.push(dir);
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ nope: true }));
    const result = await validatePack(dir);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe(1);
      expect(result.error).toContain('PACK_MANIFEST_INVALID');
    }
  });

  it('reports a missing manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'openedu-pack-cli-'));
    tempDirs.push(dir);
    const result = await validatePack(dir);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('PACK_MANIFEST_MISSING');
  });
});
