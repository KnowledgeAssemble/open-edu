import { ReproductionRecordSchema } from '@open-edu/schemas';
import type { ReproductionRecord } from '@open-edu/schemas';

/** Lenient on purpose: provenance is advisory (spec §20.2), so a malformed or unreadable
 *  provenance.json must NEVER fail a package load — unlike the strict workflow/rewards/cards
 *  parsers, this one returns null instead of throwing. */
export function parseProvenance(content: string): ReproductionRecord | null {
  try {
    return ReproductionRecordSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}
