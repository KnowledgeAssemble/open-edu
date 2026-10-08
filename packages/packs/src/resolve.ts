import type { LoadedPack, PackDiagnostic } from './types.js';
import type { AuthoringContext } from './context.js';
import type { ConceptRef } from './curriculum.js';
import type { Concept } from './concept.js';
import { resolveObjectiveCandidates } from './objectives.js';

export interface ResolveAuthoringContextOptions {
  maxChars?: number; // default 20000
  availableActivities?: AuthoringContext['availableActivities'];
  learner?: string;
  locale?: string;
}
export interface ResolveAuthoringContextResult {
  context: AuthoringContext;
  diagnostics: PackDiagnostic[];
}

export function resolveConcept(
  ref: ConceptRef,
  loaded: Map<string, LoadedPack>,
): Concept | undefined {
  const pack = loaded.get(ref.pack);
  if (!pack?.concepts) return undefined;
  return pack.concepts.find((c) => c.id === ref.concept);
}

function errDiag(
  code: PackDiagnostic['code'],
  message: string,
  severity: PackDiagnostic['severity'] = 'error',
): PackDiagnostic {
  return { code, severity, message };
}

const refKey = (ref: ConceptRef): string => `${ref.pack}/${ref.concept}`;

export function resolveAuthoringContext(
  packs: Map<string, LoadedPack>,
  scope: { curriculum: string; unit?: string },
  options?: ResolveAuthoringContextOptions,
): ResolveAuthoringContextResult {
  const maxChars = options?.maxChars ?? 20000;
  const diagnostics: PackDiagnostic[] = [];
  const emptyContext = (): AuthoringContext => ({
    packs: [],
    availableActivities: [],
    concepts: [],
    objectives: [],
    provenance: [],
    budget: { maxChars, usedChars: 0, truncated: [] },
  });

  // 1. Curriculum must exist.
  const curriculumPack = packs.get(scope.curriculum);
  if (!curriculumPack?.curriculum) {
    return {
      context: emptyContext(),
      diagnostics: [
        errDiag('PACK_REFERENCE_MISSING', `curriculum pack "${scope.curriculum}" not found`),
      ],
    };
  }

  // 2. Resolve requires transitively (BFS) into the selected set.
  const selected = new Map<string, LoadedPack>();
  selected.set(curriculumPack.manifest.id, curriculumPack);
  const queue = [...curriculumPack.manifest.requires];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (selected.has(id)) continue;
    const dependency = packs.get(id);
    if (!dependency) {
      diagnostics.push(
        errDiag(
          'PACK_DEPENDENCY_MISSING',
          `pack "${id}" required by "${scope.curriculum}" not found`,
        ),
      );
      continue;
    }
    selected.set(id, dependency);
    queue.push(...dependency.manifest.requires);
  }

  // 3. Resolve the unit (explicit or first).
  const curriculum = curriculumPack.curriculum;
  const unit = scope.unit ? curriculum.units.find((u) => u.id === scope.unit) : curriculum.units[0];
  if (scope.unit && !unit) {
    diagnostics.push(errDiag('PACK_REFERENCE_MISSING', `unit "${scope.unit}" not found`));
  }

  // 4. Resolve concepts (unit concepts ∪ its objectives' concepts), deduped.
  const contextConcepts: AuthoringContext['concepts'] = [];
  const resolvedConcepts = new Map<string, Concept>();
  if (unit) {
    const refs: ConceptRef[] = [...unit.concepts, ...unit.objectives.flatMap((o) => o.concepts)];
    for (const ref of refs) {
      const key = refKey(ref);
      if (resolvedConcepts.has(key)) continue;
      const concept = resolveConcept(ref, selected);
      if (!concept) {
        diagnostics.push(
          errDiag('PACK_REFERENCE_MISSING', `concept "${key}" referenced by the unit not found`),
        );
        continue;
      }
      resolvedConcepts.set(key, concept);
      contextConcepts.push({ ref, summary: concept.summary });
    }
  }

  // 5. Objectives from the unit.
  const contextObjectives: AuthoringContext['objectives'] = (unit?.objectives ?? []).map((o) => ({
    id: o.id,
    description: o.description,
    bloomLevel: o.bloomLevel,
    concepts: o.concepts,
    requiresIntents: o.requiresIntents,
  }));

  // 6. Pack refs + scalar fields.
  const packRefs: AuthoringContext['packs'] = [...selected.values()].map(({ manifest }) => ({
    id: manifest.id,
    version: manifest.version,
    type: manifest.type,
  }));

  // 7. Available activities — resolver owns the 25-cap.
  const inputActivities = options?.availableActivities ?? [];
  const availableActivities = inputActivities.slice(0, 25);

  // 8. Provenance — sorted unique source documentIds per selected pack.
  const provenance: AuthoringContext['provenance'] = [...selected.values()].map((pack) => {
    const documents = new Set<string>();
    for (const [key, concept] of resolvedConcepts) {
      const packId = key.slice(0, key.indexOf('/'));
      if (packId === pack.manifest.id && concept.source?.documentId) {
        documents.add(concept.source.documentId);
      }
    }
    return {
      pack: pack.manifest.id,
      version: pack.manifest.version,
      documents: [...documents].sort(),
    };
  });

  // 9. Warnings + capability-gap derivation.
  const conceptsByRef = (pack: string, concept: string): Concept | undefined =>
    resolvedConcepts.get(`${pack}/${concept}`);
  const candidates = resolveObjectiveCandidates(
    contextObjectives,
    conceptsByRef,
    availableActivities,
  );
  for (const objective of contextObjectives) {
    if (objective.concepts.length === 0) {
      diagnostics.push(
        errDiag('OBJECTIVE_NO_CONCEPTS', `objective "${objective.id}" has no concepts`, 'warning'),
      );
    }
    const matches = candidates.find((c) => c.id === objective.id)?.candidates.length ?? 0;
    if (matches === 0) {
      diagnostics.push(
        errDiag(
          'CAPABILITY_GAP',
          `objective-${objective.id}: no activity matched intents [${objective.requiresIntents.join(', ')}]`,
          'warning',
        ),
      );
    }
  }

  // 10. Budget.
  let concepts = contextConcepts;
  let objectives = contextObjectives;
  let usedChars = 0;
  const truncated: string[] = [];
  const sections: Array<[string, string[]]> = [
    ['objectives', objectives.map((o) => o.description)],
    ['concepts', concepts.map((c) => c.summary)],
    ['unitTitle', unit ? [unit.title] : []],
  ];
  for (const [name, items] of sections) {
    let kept = 0;
    for (const item of items) {
      if (usedChars + item.length > maxChars) break;
      usedChars += item.length;
      kept += 1;
    }
    if (kept < items.length) {
      truncated.push(name);
      if (name === 'objectives') objectives = objectives.slice(0, kept);
      if (name === 'concepts') concepts = concepts.slice(0, kept);
    }
  }
  if (inputActivities.length > 25) truncated.push('availableActivities');

  return {
    context: {
      packs: packRefs,
      curriculumUnit: unit?.id,
      learner: options?.learner,
      locale: options?.locale,
      availableActivities,
      concepts,
      objectives,
      budget: { maxChars, usedChars, truncated },
      provenance,
    },
    diagnostics,
  };
}
