import type { AuthoringContext } from '@open-edu/packs';
import { fingerprintAuthoringContext } from '@open-edu/packs/fingerprint';
import type { ReproductionRecord } from '@open-edu/schemas';

export interface PackVersionDiff {
  id: string;
  recorded: string;
  current: string;
}

export interface AuthoringDrift {
  packDiffs: PackVersionDiff[];
  fingerprintChanged: boolean;
}

export function computeAuthoringDrift(
  record: ReproductionRecord,
  context: AuthoringContext,
): AuthoringDrift {
  const currentById = new Map(context.packs.map((p) => [p.id, p.version]));
  const recordedIds = new Set(record.packs.map((p) => p.id));
  const packDiffs: PackVersionDiff[] = [];
  for (const pack of record.packs) {
    const current = currentById.get(pack.id);
    if (current === undefined) {
      packDiffs.push({ id: pack.id, recorded: pack.version, current: '—' });
    } else if (current !== pack.version) {
      packDiffs.push({ id: pack.id, recorded: pack.version, current });
    }
  }
  for (const [id, version] of currentById) {
    if (!recordedIds.has(id)) {
      packDiffs.push({ id, recorded: '—', current: version });
    }
  }
  return {
    packDiffs,
    fingerprintChanged: record.contextFingerprint !== fingerprintAuthoringContext(context),
  };
}
