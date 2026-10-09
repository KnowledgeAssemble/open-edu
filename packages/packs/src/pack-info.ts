import { z } from 'zod';
import type { LoadedPack } from './types.js';

export const PackSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  type: z.enum(['knowledge', 'curriculum']),
  language: z.string(),
  description: z.string().optional(),
  conceptCount: z.number().int().nonnegative(),
  unitCount: z.number().int().nonnegative(),
  objectiveCount: z.number().int().nonnegative(),
});
export type PackSummary = z.infer<typeof PackSummarySchema>;

export const PackDetailSchema = PackSummarySchema.extend({
  requires: z.array(z.string()),
  units: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        objectiveCount: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  concepts: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        domainTags: z.array(z.string()),
      }),
    )
    .default([]),
});
export type PackDetail = z.infer<typeof PackDetailSchema>;

export function summarizePack(pack: LoadedPack): PackSummary {
  const { manifest } = pack;
  const base = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    language: manifest.language,
    description: manifest.description,
  };
  if (manifest.type === 'knowledge') {
    return {
      ...base,
      conceptCount: pack.concepts?.length ?? 0,
      unitCount: 0,
      objectiveCount: 0,
    };
  }
  const units = pack.curriculum?.units ?? [];
  return {
    ...base,
    conceptCount: new Set(units.flatMap((u) => u.concepts.map((c) => `${c.pack}/${c.concept}`)))
      .size,
    unitCount: units.length,
    objectiveCount: units.reduce((n, u) => n + u.objectives.length, 0),
  };
}

export function packDetailFrom(pack: LoadedPack): PackDetail {
  const summary = summarizePack(pack);
  if (summary.type === 'knowledge') {
    return {
      ...summary,
      requires: pack.manifest.requires,
      units: [],
      concepts: (pack.concepts ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        domainTags: c.domainTags,
      })),
    };
  }
  return {
    ...summary,
    requires: pack.manifest.requires,
    units: (pack.curriculum?.units ?? []).map((u) => ({
      id: u.id,
      title: u.title,
      objectiveCount: u.objectives.length,
    })),
    concepts: [],
  };
}
