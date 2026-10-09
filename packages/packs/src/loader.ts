import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type ZodTypeAny } from 'zod';
import { PackManifestSchema } from './manifest.js';
import { ConceptSchema, type Concept } from './concept.js';
import { CurriculumSchema, type Curriculum } from './curriculum.js';
import type { PackDiagnostic, PackErrorCode, SourceDocument, LoadedPack } from './types.js';
import { SourceDocumentSchema } from './types.js';

export class PackValidationError extends Error {
  constructor(readonly diagnostics: PackDiagnostic[]) {
    super(diagnostics[0]?.message ?? 'Pack validation failed');
    this.name = 'PackValidationError';
  }
}

function errDiag(code: PackErrorCode, message: string): PackDiagnostic {
  return { code, severity: 'error', message };
}

function readJson(dir: string, file: string): unknown | undefined {
  const p = join(dir, file);
  if (!existsSync(p)) return undefined;
  return JSON.parse(readFileSync(p, 'utf-8')); // SyntaxError propagates; loadPacksDir maps it to PACK_MANIFEST_INVALID
}

/** Parse an array of items, one diagnostic per invalid item. */
function parseArray<T>(
  raw: unknown,
  what: string,
  schema: ZodTypeAny,
  code: PackErrorCode,
  diagnostics: PackDiagnostic[],
): T[] {
  if (!Array.isArray(raw)) {
    diagnostics.push(errDiag(code, `${what} must be an array`));
    return [];
  }
  const out: T[] = [];
  raw.forEach((item, i) => {
    const r = schema.safeParse(item);
    if (r.success) {
      out.push(r.data as T);
    } else {
      diagnostics.push(
        errDiag(
          code,
          `${what}[${i}]: ${r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`,
        ),
      );
    }
  });
  return out;
}

/** Pack-local or unit prerequisite graph: unknown refs + cycle detection (DFS, mirrors
 *  packages/course-compiler/src/validators/semantic-validator.ts:160-185). */
function validatePrereqGraph(
  nodes: Array<{ id: string; prerequisites: string[] }>,
  known: Set<string>,
  codes: { unknown: PackErrorCode; cycle: PackErrorCode },
  owner: string,
  diagnostics: PackDiagnostic[],
): void {
  for (const n of nodes) {
    for (const p of n.prerequisites) {
      if (!known.has(p)) {
        diagnostics.push(
          errDiag(codes.unknown, `${owner} "${n.id}" prerequisites "${p}" not found`),
        );
      }
    }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, stack: string[]): boolean => {
    const s = state.get(id);
    if (s === 'done') return false;
    if (s === 'visiting') {
      diagnostics.push(
        errDiag(codes.cycle, `${owner} prerequisite cycle: ${[...stack, id].join(' → ')}`),
      );
      return true;
    }
    state.set(id, 'visiting');
    const node = nodes.find((n) => n.id === id);
    for (const p of node?.prerequisites ?? []) visit(p, [...stack, id]);
    state.set(id, 'done');
    return false;
  };
  for (const n of nodes) visit(n.id, []);
}

function assertNoErrors(diagnostics: PackDiagnostic[]): void {
  if (diagnostics.length > 0) throw new PackValidationError(diagnostics);
}

export function loadPackDirectory(dir: string): LoadedPack {
  const diagnostics: PackDiagnostic[] = [];

  const manifestRaw = readJson(dir, 'manifest.json');
  if (manifestRaw === undefined)
    throw new PackValidationError([errDiag('PACK_MANIFEST_MISSING', 'manifest.json not found')]);
  const manifestResult = PackManifestSchema.safeParse(manifestRaw);
  if (!manifestResult.success) {
    // Spec §23.1: a `version` shape failure is PACK_VERSION_INVALID; everything else is PACK_MANIFEST_INVALID.
    for (const issue of manifestResult.error.issues) {
      const isVersion = issue.path.length === 1 && issue.path[0] === 'version';
      diagnostics.push(
        errDiag(
          isVersion ? 'PACK_VERSION_INVALID' : 'PACK_MANIFEST_INVALID',
          `manifest.json ${issue.path.join('.') || '(root)'}: ${issue.message}`,
        ),
      );
    }
    throw new PackValidationError(diagnostics);
  }
  const manifest = manifestResult.data;

  if (manifest.type === 'knowledge') {
    const conceptsRaw = readJson(dir, 'concepts.json');
    if (conceptsRaw === undefined) {
      throw new PackValidationError([
        errDiag('KNOWLEDGE_CONCEPT_INVALID', 'concepts.json not found'),
      ]);
    }
    const concepts = parseArray<Concept>(
      conceptsRaw,
      'concepts.json',
      ConceptSchema,
      'KNOWLEDGE_CONCEPT_INVALID',
      diagnostics,
    );
    if (manifest.derivedFrom === 'document') {
      for (const c of concepts) {
        if (!c.source) {
          diagnostics.push(
            errDiag(
              'KNOWLEDGE_SOURCE_MISSING',
              `concept "${c.id}" has no source but the pack is derivedFrom "document"`,
            ),
          );
        }
      }
    }
    assertNoErrors(diagnostics); // structural issues before graph checks (never graph-check a partial set)
    validatePrereqGraph(
      concepts.map((c) => ({ id: c.id, prerequisites: c.prerequisites ?? [] })),
      new Set(concepts.map((c) => c.id)),
      { unknown: 'KNOWLEDGE_PREREQ_UNKNOWN', cycle: 'KNOWLEDGE_PREREQ_CYCLE' },
      'concept',
      diagnostics,
    );
    const sources = parseSources(dir, diagnostics);
    assertNoErrors(diagnostics); // no partial load (spec §28)
    return { dir, manifest, concepts, sources };
  }

  const curriculumRaw = readJson(dir, 'curriculum.json');
  if (curriculumRaw === undefined) {
    throw new PackValidationError([errDiag('CURRICULUM_INVALID', 'curriculum.json not found')]);
  }
  const curriculum = parseCurriculum(curriculumRaw, diagnostics);
  assertNoErrors(diagnostics); // parseCurriculum returns an unusable stub when it pushed diagnostics
  const unitIds = new Set(curriculum.units.map((u) => u.id));
  validatePrereqGraph(
    curriculum.units.map((u) => ({ id: u.id, prerequisites: u.prerequisites })),
    unitIds,
    { unknown: 'CURRICULUM_PREREQ_UNKNOWN', cycle: 'CURRICULUM_PREREQ_CYCLE' },
    'unit',
    diagnostics,
  );
  assertNoErrors(diagnostics); // no partial load (spec §28)
  return { dir, manifest, curriculum };
}

/** Spec §23.1: a `z.nativeEnum(LearningIntent)` failure on requiresIntents maps to
 *  OBJECTIVE_INTENT_UNKNOWN (mapped diagnostic, not a separate pass); any other issue
 *  is CURRICULUM_INVALID. */
function parseCurriculum(raw: unknown, diagnostics: PackDiagnostic[]): Curriculum {
  const r = CurriculumSchema.safeParse(raw);
  if (r.success) return r.data;
  for (const issue of r.error.issues) {
    const isIntent = issue.path.includes('requiresIntents');
    diagnostics.push(
      errDiag(
        isIntent ? 'OBJECTIVE_INTENT_UNKNOWN' : 'CURRICULUM_INVALID',
        `curriculum.json ${issue.path.join('.')}: ${issue.message}`,
      ),
    );
  }
  // Caller (`loadPackDirectory`) runs assertNoErrors immediately after this returns, so the
  // stub below is never read — it only satisfies the return type.
  return undefined as unknown as Curriculum;
}

/** sources.json is optional; invalid JSON / non-object / invalid entry ⇒ KNOWLEDGE_SOURCE_MISSING
 *  (the source record is unusable — spec §20.1 has no separate code for it). */
function parseSources(
  dir: string,
  diagnostics: PackDiagnostic[],
): Record<string, SourceDocument> | undefined {
  const raw = readJson(dir, 'sources.json');
  if (raw === undefined) return undefined;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    diagnostics.push(
      errDiag('KNOWLEDGE_SOURCE_MISSING', 'sources.json must be an object keyed by documentId'),
    );
    return undefined;
  }
  const out: Record<string, SourceDocument> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const r = SourceDocumentSchema.safeParse(value);
    if (r.success) out[key] = r.data;
    else
      diagnostics.push(
        errDiag(
          'KNOWLEDGE_SOURCE_MISSING',
          `sources.json entry "${key}" invalid: ${r.error.issues.map((x) => x.message).join('; ')}`,
        ),
      );
  }
  return out;
}

export function loadPacksDir(rootDir: string): {
  packs: Map<string, LoadedPack>;
  diagnostics: PackDiagnostic[];
} {
  const packs = new Map<string, LoadedPack>();
  const diagnostics: PackDiagnostic[] = [];
  if (!existsSync(rootDir)) return { packs, diagnostics };
  for (const type of ['knowledge', 'curriculum']) {
    const typeDir = join(rootDir, type);
    if (!existsSync(typeDir)) continue;
    for (const entry of readdirSync(typeDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(typeDir, entry.name);
      try {
        const p = loadPackDirectory(dir);
        if (packs.has(p.manifest.id)) {
          diagnostics.push(
            errDiag(
              'PACK_MANIFEST_INVALID',
              `duplicate pack id "${p.manifest.id}" (${type}/${entry.name})`,
            ),
          );
          continue;
        }
        packs.set(p.manifest.id, p);
      } catch (err) {
        // Broad catch: PackValidationError → its diagnostics; anything else (e.g. JSON.parse
        // SyntaxError) → PACK_MANIFEST_INVALID. One bad pack must never crash the vite buildStart.
        if (err instanceof PackValidationError) diagnostics.push(...err.diagnostics);
        else {
          diagnostics.push(
            errDiag(
              'PACK_MANIFEST_INVALID',
              `${type}/${entry.name}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      }
    }
  }
  return { packs, diagnostics };
}
