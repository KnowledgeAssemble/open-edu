import { describe, it, expect, vi } from 'vitest';
import { fingerprintAuthoringContext } from '@open-edu/packs/fingerprint';
import { mergeAppliedItem, refreshProvenanceAfterApply } from './provenanceRefresh.js';
import { authoringFixture } from '../test/authoringFixture.js';
import type { StudioApi } from '../studioApi.js';
import type { ReproductionRecord } from '@open-edu/schemas';

const VALID_RECORD: ReproductionRecord = {
  schemaVersion: 1,
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  generatedAt: '2026-01-01T00:00:00.000Z',
  contextFingerprint: 'sha256:abc',
  authoringScope: { curriculum: 'nios-math-level-a', unit: 'fractions' },
  nodes: [
    {
      path: 'nodes/other.json',
      objectives: ['old'],
      concepts: [],
      widgets: ['math.number-line'],
      capabilityGaps: [],
    },
  ],
};

const entry = {
  path: 'nodes/p1.json',
  objectives: ['represent-fraction'],
  concepts: [],
  widgets: ['core.multiple-choice'],
  capabilityGaps: [],
};

const applied = [
  {
    path: 'nodes/p1.json',
    title: 'Represent fractions visually',
    content: '{"widget":"core.multiple-choice"}',
  },
];

const mockApi = (overrides: Partial<StudioApi> = {}): StudioApi =>
  ({
    readFile: async () => ({ content: JSON.stringify(VALID_RECORD) }),
    writeFile: async () => ({ success: true }),
    ...overrides,
  }) as StudioApi;

describe('mergeAppliedItem', () => {
  it('upserts by path and preserves packs/scope/fingerprint', () => {
    const next = mergeAppliedItem(VALID_RECORD, entry, 'now', authoringFixture);
    expect(next!.packs).toEqual(VALID_RECORD.packs);
    expect(next!.authoringScope).toEqual(VALID_RECORD.authoringScope);
    expect(next!.contextFingerprint).toBe(VALID_RECORD.contextFingerprint);
    expect(next!.nodes).toHaveLength(2);
    expect(next!.nodes.find((n) => n.path === 'nodes/p1.json')).toEqual(entry);
    expect(next!.nodes.find((n) => n.path === 'nodes/other.json')).toBeTruthy();
  });

  it('appends a new node when the path is unknown', () => {
    const newEntry = { ...entry, path: 'nodes/new.json' };
    const next = mergeAppliedItem(VALID_RECORD, newEntry, 'now', null);
    expect(next!.nodes).toHaveLength(2);
    expect(next!.nodes.some((n) => n.path === 'nodes/new.json')).toBe(true);
  });

  it('creates a fresh record when record is null and authoring is provided', () => {
    const next = mergeAppliedItem(null, entry, '2026-02-01', authoringFixture);
    expect(next).not.toBeNull();
    expect(next!.packs).toEqual(
      authoringFixture.packs.map((p) => ({ id: p.id, version: p.version, type: p.type })),
    );
    expect(next!.contextFingerprint).toBe(fingerprintAuthoringContext(authoringFixture));
    expect(next!.authoringScope?.curriculum).toBe('nios-math-level-a');
    expect(next!.nodes).toEqual([entry]);
  });

  it('returns null when record is null and authoring is null (no-op)', () => {
    expect(mergeAppliedItem(null, entry, 'now', null)).toBeNull();
  });
});

describe('refreshProvenanceAfterApply', () => {
  it('reads the current record via api.readFile and writes the merged record', async () => {
    const writeFile = vi.fn().mockResolvedValue({ success: true });
    const api = mockApi({ writeFile });

    await refreshProvenanceAfterApply(api, applied, authoringFixture);

    expect(writeFile).toHaveBeenCalledWith(
      'provenance.json',
      expect.stringContaining('nodes/p1.json'),
    );
    const written = JSON.parse(writeFile.mock.calls[0]![1] as string) as ReproductionRecord;
    expect(written.nodes.some((n) => n.path === 'nodes/p1.json')).toBe(true);
    expect(written.nodes.find((n) => n.path === 'nodes/p1.json')!.objectives).toContain(
      'represent-fraction',
    );
  });

  it('treats a missing provenance.json as no record and creates when authoring is present', async () => {
    const writeFile = vi.fn().mockResolvedValue({ success: true });
    const api = mockApi({
      readFile: async () => {
        throw new Error('missing');
      },
      writeFile,
    });

    await refreshProvenanceAfterApply(api, applied, authoringFixture);

    expect(writeFile).toHaveBeenCalled();
  });

  it('never throws when writeFile rejects (advisory)', async () => {
    const api = mockApi({
      writeFile: async () => {
        throw new Error('disk full');
      },
    });
    await expect(
      refreshProvenanceAfterApply(api, applied, authoringFixture),
    ).resolves.toBeUndefined();
  });

  it('no-ops without a record and without authoring', async () => {
    const writeFile = vi.fn();
    const api = mockApi({
      readFile: async () => {
        throw new Error('missing');
      },
      writeFile,
    });
    await refreshProvenanceAfterApply(api, applied, null);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
