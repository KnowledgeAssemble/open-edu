---
type: Domain Guide
title: Packs
description: Canonical guide to the OpenEdu Pack System — knowledge and curriculum packs, the @open-edu/packs loader and authoring-context resolution, blueprint validation with capability gaps, and the Course Creator Studio pack-selection and AI-draft surfaces.
tags: [openwiki, domain, packs, curriculum, authoring, studio]
---

# Packs

Packs are declarative, read-only curriculum and knowledge inputs that ground Course Creator Studio AI drafting. They are **not** learning packages: packages are the portable course format the runtime renders, while packs supply the objectives, concepts, and intents an AI draft must trace back to. The design rule is "extend, never parallel" — packs reuse the existing package vocabulary (intents, concepts, profiles) instead of inventing a second one. The full design document is `docs/OPENEDU-PACK-SYSTEM.md`.

## Pack types

- **Knowledge pack** — a concept graph: `manifest.json` + `concepts.json` (+ optional `sources.json`).
- **Curriculum pack** — units with learning objectives: `manifest.json` + `curriculum.json` (+ optional `sources.json`). Objectives carry `description`, `bloomLevel`, `concepts` (qualified `{ pack, concept }` refs), and `requiresIntents` (`LearningIntent` values from `@open-edu/widgets`).

The registry slot is the directory, not the ID; pack type is never encoded in the identifier. `manifest.json` is required (`format: "openedu-pack"`, `formatVersion`, `type`, kebab-case `id`, semver `version`, `name`, `language`, optional `requires` dependencies).

## Layout and location

```text
packs/
  knowledge/<pack-id>/manifest.json + concepts.json + sources.json
  curriculum/<pack-id>/manifest.json + curriculum.json + sources.json
```

- The workspace `packs/` directory is gitignored (root-anchored `/packs/`).
- The committed validation fixture is `examples/packs/` (knowledge pack `openedu-fractions`, curriculum pack `nios-math-level-a` with `requires: ["openedu-fractions"]`). Anything loading it sets `OPEN_EDU_PACKS_DIR=examples/packs`.
- `OPEN_EDU_PACKS_DIR` selects the pack directory everywhere (Studio loader, `edu pack validate` inputs are explicit paths).

## Package map: `@open-edu/packs`

- `packages/packs/src/manifest.ts` — `PackManifestSchema` and manifest validation.
- `packages/packs/src/concept.ts`, `curriculum.ts` — `ConceptSchema` / `CurriculumSchema`, qualified concept refs, prerequisite/cycle checks.
- `packages/packs/src/loader.ts` — `loadPacksDir` / `loadPackDirectory`, `PackValidationError` with structured diagnostics (codes such as `PACK_MANIFEST_MISSING`, `PACK_REFERENCE_MISSING`, `KNOWLEDGE_PREREQ_CYCLE`, `CURRICULUM_INVALID`, `OBJECTIVE_INTENT_UNKNOWN`). Exposed via the **`@open-edu/packs/loader` subpath** (Node/filesystem only — never import the package index from `vite.config.ts`; see the ESM subpath pattern in `AGENTS.md`).
- `packages/packs/src/context.ts` — `AuthoringContextSchema`: bounded context (`packs`, `availableActivities`, `concepts`, `objectives`, `provenance`, `budget`) with `.max()` caps on every array and field length so oversized selections fail validation instead of blowing the prompt budget.
- `packages/packs/src/resolve.ts` — `resolveAuthoringContext(loadedPacks, { curriculum, unit }, options)` scopes the selection to one curriculum (optionally one unit), resolves concept refs, orders objectives, and fills `budget` (`maxChars`, default 20 000; `usedChars`; `truncated[]`) — retrieval, not loading.
- `packages/packs/src/blueprint.ts` — `validateBlueprint(authoringContext, courseModel)` post-compile blueprint checks: (1) every emitted `widgetId` must exist in `availableActivities` (a violation **rejects the draft** with `invalid-blueprint`), (2) every objective's `requiresIntents` must be covered by the union of intents across emitted activities — uncovered intents become `capabilityGaps[]`, (3) audience/profile match.
- `packages/packs/src/pack-info.ts`, `fingerprint.ts` — pack summaries for discovery and content fingerprints.

Subpath exports: `.`, `./loader`, `./fingerprint`.

## Studio integration

Selection is part of the existing Create Course flow (no new top-level surface):

- `apps/dev-server/src/studio/components/PackSelectionPanel.tsx` — pick Curriculum → Unit → Learner → Language, then **Create Learning Experience**; calls `setAuthoringSelection` and reports diagnostics (`studio.packs.*` i18n keys; empty states, load errors, and a "Grounded on …" confirmation).
- `apps/dev-server/src/studio/components/PackBrowserPanel.tsx` — read-only view of the selected context: concepts, provenance documents, pack diagnostics, and **capability gaps**.
- `apps/dev-server/src/studio/packs/packApi.ts` — discovery/context logic shared by the adapters; filters `learningIntents` to valid `LearningIntent` values.
- `apps/dev-server/src/studio/studioApi.ts` — three methods: `listPacks()`, `getPackDetail(id, version)`, `setAuthoringSelection({ curriculum, unit?, learner?, locale? })`. Read-only with respect to the open package — switching packs changes only the context.
- `apps/dev-server/src/studio/StudioApp.tsx` — holds the authoring context, warnings, and `capabilityGaps` state; all three reset when the open course changes (`courseKey` effect) so context never leaks between courses.

## AI grounding and draft flow

- **Context into prompts** — `apps/dev-server/src/studio/ai/chat/policy.ts` compacts the authoring context into the system prompt under `MAX_CONTEXT_CHARS` (15 000): packs, objectives (with intents), concepts, provenance; the packs and objective-id lines are capped with an ellipsis marker so a large curriculum cannot push the server into a 400 `contextTooLarge`.
- **Skills** — `apps/dev-server/src/studio/ai/skills/objective-intent.ts` tells the model intents may be covered in one activity or together across activities, with uncovered intents reported as capability gaps; `resolveSkills.ts` dedupes skill references.
- **Generate** — `apps/dev-server/src/studio/ai/generateCourse.ts` compiles the draft, runs `validateBlueprint`, and returns `capabilityGaps[]` on `CourseDraftResult` (`@open-edu/companion` types). Spec-parse failures return `spec-invalid` (distinct from blueprint failures).
- **Commit** — `apps/dev-server/src/studio/ai/commitCourseDraft.ts` re-reads and re-validates the spec at commit time: `spec-invalid` for unreadable/unparseable specs, `invalid-blueprint` for blueprint violations; a failed commit on a newly created course removes the orphan directory (`middleware.ts`).
- **Provenance** — `apps/dev-server/src/studio/ai/provenance.ts` writes `provenance.json`: pack lineage (`pack@version`), concept refs, and lesson-objective matches per node. Matching is exact description → normalized containment → objective order (deliberately more forgiving than the documented index-only fallback so paraphrased lesson objectives still trace back).
- **Browser mode** — packs are bundled at build time by the `eduPacksLoader` Vite plugin (`apps/dev-server/vite.config.ts`) into a `virtual:open-edu-packs` module read from `OPEN_EDU_PACKS_DIR`; it re-reads the directory on module load, registers `addWatchFile` for each pack JSON, and serializes pack dirs relative to the workspace root (no absolute paths in the bundle). No OPFS writes — installing a new pack in browser mode requires a rebuild.

## CLI

`edu pack validate <dir>` (`packages/cli/src/commands/pack.ts`) validates one pack directory — manifest, concepts/curriculum schemas, prerequisites, references — and prints `{ valid, id, type, version, concepts, units }` or `CODE: message` diagnostics (supports `--json`). It loads through `@open-edu/packs/loader`.

## Tests

- `packages/packs/src/*.test.ts` — loader, manifest, concept, curriculum, objectives, resolve, blueprint, context-schema bounds.
- `apps/dev-server/src/studio/` — `components/PackSelectionPanel.test.tsx`, `components/PackBrowserPanel.test.tsx`, `packs/packApi.test.ts`, `ai/provenance.test.ts`, `ai/commitCourseDraft.test.ts`, `ai/chat/policy.test.ts` (prompt bounds), `browserStudioApi.test.ts` (draft codes + capability gaps).
- `tests/e2e/pack-selection.spec.ts` — Studio pack-selection flow (sets `OPEN_EDU_PACKS_DIR=examples/packs`).

## Where to start when changing packs

- Pack format, schemas, or resolution: `packages/packs/src/` (`loader.ts`, `context.ts`, `resolve.ts`, `blueprint.ts`).
- Selection UX or pack browsing: `apps/dev-server/src/studio/components/PackSelectionPanel.tsx`, `PackBrowserPanel.tsx`, and the `studio.packs.*` keys in `packages/i18n/locales/en/studio.json`.
- Studio API surface: `apps/dev-server/src/studio/studioApi.ts` + the local (`localStudioApi.ts`) and browser (`browserStudioApi.ts`) adapters.
- Prompt budget or grounding instructions: `apps/dev-server/src/studio/ai/chat/policy.ts`, `ai/skills/`.
- Draft validation codes or provenance: `apps/dev-server/src/studio/ai/generateCourse.ts`, `ai/commitCourseDraft.ts`, `ai/provenance.ts`.
- What gets bundled into the browser Studio: `apps/dev-server/vite.config.ts` (`eduPacksLoader`).
