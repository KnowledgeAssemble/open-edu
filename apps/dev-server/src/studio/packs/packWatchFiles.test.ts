import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listPackWatchFiles } from './packWatchFiles.js';

const createdDirs: string[] = [];

function tempPack(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pack-watch-'));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (createdDirs.length) {
    rmSync(createdDirs.pop()!, { recursive: true, force: true });
  }
});

describe('listPackWatchFiles', () => {
  it('returns only files that exist for a pack', () => {
    const dir = tempPack();
    writeFileSync(join(dir, 'manifest.json'), '{}');
    writeFileSync(join(dir, 'concepts.json'), '[]');
    expect(listPackWatchFiles([{ dir }])).toEqual([
      join(dir, 'manifest.json'),
      join(dir, 'concepts.json'),
    ]);
  });

  it('skips files a curriculum pack does not carry', () => {
    const dir = tempPack();
    writeFileSync(join(dir, 'manifest.json'), '{}');
    writeFileSync(join(dir, 'curriculum.json'), '{}');
    const files = listPackWatchFiles([{ dir }]);
    expect(files).toEqual([join(dir, 'manifest.json'), join(dir, 'curriculum.json')]);
    expect(files.some((f) => f.endsWith('concepts.json'))).toBe(false);
    expect(files.some((f) => f.endsWith('sources.json'))).toBe(false);
  });

  it('covers every pack in order', () => {
    const first = tempPack();
    const second = tempPack();
    writeFileSync(join(first, 'manifest.json'), '{}');
    writeFileSync(join(second, 'manifest.json'), '{}');
    expect(listPackWatchFiles([{ dir: first }, { dir: second }])).toEqual([
      join(first, 'manifest.json'),
      join(second, 'manifest.json'),
    ]);
  });
});
