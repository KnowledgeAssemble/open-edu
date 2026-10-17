import { ReproductionRecordSchema, type ReproductionRecord } from '@open-edu/schemas';
import type { AuthoringContext } from '@open-edu/packs';
import { fingerprintAuthoringContext } from '@open-edu/packs/fingerprint';
import { matchAuthoringObjectives } from './objectiveMatch.js';
import type { StudioApi } from '../studioApi.js';

interface AppliedEntry {
  path: string;
  title?: string;
  content: string;
}

interface NodeEntry {
  path: string;
  objectives: string[];
  concepts: Array<{ pack: string; concept: string }>;
  widgets: string[];
  capabilityGaps: string[];
}

function widgetsFromContent(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as { widget?: unknown };
    return typeof parsed.widget === 'string' && parsed.widget ? [parsed.widget] : [];
  } catch {
    return [];
  }
}

function entryFor(authoring: AuthoringContext | null, applied: AppliedEntry): NodeEntry {
  const matched = authoring
    ? matchAuthoringObjectives(authoring, `${applied.title ?? ''} ${applied.content}`)
    : [];
  const concepts: NodeEntry['concepts'] = [];
  for (const objective of matched) {
    for (const ref of objective.concepts) {
      const key = `${ref.pack}/${ref.concept}`;
      if (!concepts.some((c) => `${c.pack}/${c.concept}` === key)) {
        concepts.push({ pack: ref.pack, concept: ref.concept });
      }
    }
  }
  return {
    path: applied.path,
    objectives: matched.map((o) => o.id),
    concepts,
    widgets: widgetsFromContent(applied.content),
    capabilityGaps: [],
  };
}

export function mergeAppliedItem(
  record: ReproductionRecord | null,
  entry: NodeEntry,
  generatedAt: string,
  authoring: AuthoringContext | null,
): ReproductionRecord | null {
  if (!record) {
    if (!authoring) return null;
    const curriculum = authoring.packs.find((p) => p.type === 'curriculum');
    return {
      schemaVersion: 1,
      packs: authoring.packs.map((p) => ({ id: p.id, version: p.version, type: p.type })),
      generatedAt,
      contextFingerprint: fingerprintAuthoringContext(authoring),
      ...(curriculum
        ? {
            authoringScope: {
              curriculum: curriculum.id,
              ...(authoring.curriculumUnit ? { unit: authoring.curriculumUnit } : {}),
              ...(authoring.learner ? { learner: authoring.learner } : {}),
              ...(authoring.locale ? { locale: authoring.locale } : {}),
            },
          }
        : {}),
      nodes: [entry],
    };
  }
  const existing = record.nodes.findIndex((n) => n.path === entry.path);
  const nodes =
    existing >= 0
      ? record.nodes.map((n, i) => (i === existing ? entry : n))
      : [...record.nodes, entry];
  return { ...record, generatedAt, nodes };
}

async function readRecord(api: StudioApi): Promise<ReproductionRecord | null> {
  try {
    const { content } = await api.readFile('provenance.json');
    const parsed = ReproductionRecordSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function refreshProvenanceAfterApply(
  api: StudioApi,
  applied: AppliedEntry[],
  authoring: AuthoringContext | null,
): Promise<void> {
  try {
    if (applied.length === 0) return;
    const record = await readRecord(api);
    if (!record && !authoring) return;
    let next = record;
    for (const item of applied) {
      next = mergeAppliedItem(next, entryFor(authoring, item), new Date().toISOString(), authoring);
    }
    if (!next) return;
    await api.writeFile('provenance.json', JSON.stringify(next, null, 2));
  } catch {
    // Advisory: provenance refresh never fails the apply.
  }
}
