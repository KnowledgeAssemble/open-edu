---
sidebar_position: 22
---

# Packs

The **packs** package (`@open-edu/packs`) implements the OpenEdu Pack System: knowledge and curriculum packs, a filesystem loader, bounded authoring-context resolution, and blueprint validation. Packs ground Course Creator Studio AI drafts in declared objectives, concepts, and intents — they are declarative inputs to authoring, not learning packages the runtime renders.

## Quick Start

```ts
import { loadPacksDir } from '@open-edu/packs/loader';
import { resolveAuthoringContext, validateBlueprint } from '@open-edu/packs';

const { packs, diagnostics } = loadPacksDir('./examples/packs');

const { context, diagnostics: ctxDiags } = resolveAuthoringContext(
  packs,
  { curriculum: 'nios-math-level-a', unit: 'fractions' },
  { maxChars: 20000, learner: 'neurotypical', locale: 'en' },
);

const { violations, capabilityGaps } = validateBlueprint(context, courseModel);
```

Validate a pack from the command line:

```bash
edu pack validate ./examples/packs/knowledge/openedu-fractions
```

## Pack Layout

```text
packs/
  knowledge/<pack-id>/
    manifest.json      # required: format, type, id, version, name, language, requires
    concepts.json      # concept graph with prerequisites
    sources.json       # optional: derivedFrom document lineage
  curriculum/<pack-id>/
    manifest.json
    curriculum.json    # units → objectives (description, bloomLevel, concepts, requiresIntents)
    sources.json
```

Pack IDs are kebab-case; the pack type lives in the manifest, not the ID. The workspace `packs/` directory is gitignored — the committed fixture lives at `examples/packs/` and is loaded by setting `OPEN_EDU_PACKS_DIR=examples/packs`.

## Responsibilities

### Manifest & schemas

- `PackManifestSchema` — pack identity, semver version, `requires` dependencies
- `ConceptSchema` — concept definitions, qualified `{ pack, concept }` references, prerequisite edges with cycle checks
- `CurriculumSchema` — units, objectives, `requiresIntents` (validated against the `LearningIntent` enum)

### Loading

- `loadPacksDir(rootDir)` — loads every pack under a directory root, returns `{ packs: Map<string, LoadedPack>, diagnostics }`
- `loadPackDirectory(dir)` — loads one pack; throws `PackValidationError` with structured diagnostics
- Diagnostic codes: `PACK_MANIFEST_MISSING`, `PACK_MANIFEST_INVALID`, `PACK_REFERENCE_MISSING`, `KNOWLEDGE_PREREQ_CYCLE`, `CURRICULUM_INVALID`, `OBJECTIVE_INTENT_UNKNOWN`, and more (`packages/packs/src/types.ts`)

> **ESM note:** the loader is a Node/filesystem subpath export (`@open-edu/packs/loader`). When a `vite.config.ts` needs pack data, read it through this subpath rather than the package index — see the "ESM Extensionless Imports" pattern in `AGENTS.md`.

### Authoring context

- `AuthoringContextSchema` — the bounded context handed to the AI pipeline: `packs`, `availableActivities`, `concepts`, `objectives`, `provenance`, and `budget` (`maxChars` / `usedChars` / `truncated`). Every array and field has a `.max()` cap, so an oversized selection fails validation instead of overflowing the system prompt.
- `resolveAuthoringContext(packs, { curriculum, unit? }, options)` — scopes the selection (retrieval, not loading): resolves concept refs, orders objectives, and fills the budget under `maxChars` (default 20 000).

### Blueprint validation

- `validateBlueprint(authoringContext, courseModel)` — post-compile checks on the generated course:
  1. every emitted `widgetId` must exist in `context.availableActivities` — a violation **rejects the draft** (`invalid-blueprint`)
  2. every objective's `requiresIntents` must be covered by the union of intents across the emitted activities — uncovered intents are reported as `capabilityGaps[]` (split coverage across activities counts)
  3. audience matches the selected learner profile, if any

### Discovery helpers

- `pack-info.ts` — `PackSummary` / `PackDetail` summaries for the Studio pickers
- `fingerprint.ts` — content fingerprints for pack identity

## Studio Integration

The Create Course flow in the Course Creator Studio starts with pack selection (curriculum → unit → learner → language), exposed on the `StudioAPI` as `listPacks()`, `getPackDetail(id, version)`, and `setAuthoringSelection(...)`. The resolved context drives the Author Assistant prompts (`apps/dev-server/src/studio/ai/chat/policy.ts` compacts it under `MAX_CONTEXT_CHARS`), and `capabilityGaps[]` from generate/commit surface in the pack browser panel. In browser mode, packs are bundled at build time by the `eduPacksLoader` Vite plugin (`virtual:open-edu-packs`).

See [Course Creator Studio](./course-creator-studio.md) for the product surface and `docs/OPENEDU-PACK-SYSTEM.md` for the full design document.

## Dependencies

- `@open-edu/i18n` — locale types for pack/context fields
- `@open-edu/widgets` — `LearningIntent` enum (`requiresIntents` validation)
- `zod` — schema definitions

Consumed by `@open-edu/dev-server` (Studio), `@open-edu/companion` (`CourseDraftResult.capabilityGaps`), and `@open-edu/cli` (`edu pack validate`).

## Tests

```bash
pnpm --filter @open-edu/packs test
```

Covers loader/manifest/concept/curriculum validation, prerequisite cycles, authoring-context bounds, resolution budgets, and blueprint validation (including split intent coverage).
