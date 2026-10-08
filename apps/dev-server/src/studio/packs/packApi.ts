import widgetCatalogData from '@open-edu/core/widget-catalog-data';
import { LearningIntent } from '@open-edu/widgets/intents';
import {
  resolveAuthoringContext,
  summarizePack,
  packDetailFrom,
  type AuthoringContext,
  type PackDiagnostic,
  type PackDetail,
  type PackSummary,
} from '@open-edu/packs';
import type { LoadedPack } from '@open-edu/packs';
import type { StudioApiError } from '../studioApi';

const VALID_INTENTS = new Set<string>(Object.values(LearningIntent));

export function buildAvailableActivities(): AuthoringContext['availableActivities'] {
  return (
    widgetCatalogData as Array<{
      id: string;
      name: string;
      domain?: string;
      learningIntents?: string[];
      ai?: { subjectTags?: string[] };
      deprecated?: boolean;
    }>
  )
    .filter((e) => !e.deprecated) // no slice here — the resolver owns the 25-cap (L21, §6.2 step 7)
    .map((e) => ({
      id: e.id,
      name: e.name,
      domain: e.domain,
      intents: (e.learningIntents ?? []).filter((i): i is LearningIntent => VALID_INTENTS.has(i)),
      subjectTags: e.ai?.subjectTags ?? [],
    }));
}

export function summarizePacks(packs: LoadedPack[]): PackSummary[] {
  return packs.map(summarizePack);
}

export function detailPack(
  packs: LoadedPack[],
  id: string,
  version: string,
): PackDetail | undefined {
  const pack = packs.find((p) => p.manifest.id === id && p.manifest.version === version);
  return pack ? packDetailFrom(pack) : undefined;
}

export function resolveSelection(
  packs: LoadedPack[],
  selection: { curriculum: string; unit?: string; learner?: string; locale?: string },
): { context: AuthoringContext; warnings: PackDiagnostic[] } {
  const map = new Map(packs.map((p) => [p.manifest.id, p]));
  const { context, diagnostics } = resolveAuthoringContext(
    map,
    { curriculum: selection.curriculum, unit: selection.unit },
    {
      maxChars: 20000,
      availableActivities: buildAvailableActivities(),
      learner: selection.learner,
      locale: selection.locale,
    },
  );
  const errors = diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    // StudioApiError is an INTERFACE, not a class (§2 facts) — cast, do not `new` it.
    const err = new Error(errors[0]!.message) as StudioApiError;
    err.code = errors[0]!.code;
    throw err;
  }
  return { context, warnings: diagnostics.filter((d) => d.severity === 'warning') };
}
