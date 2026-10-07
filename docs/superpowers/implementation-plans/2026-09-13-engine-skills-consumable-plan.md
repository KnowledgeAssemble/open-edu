# Consume `@knowledgeassemble/engine-skills` — Implementation Plan

**Date:** 2026-09-13
**Status:** Ready for implementation
**Scope:** OpenEdu consumption of the approved engine-skills artifact — external `openedu-course-authoring` skill, Studio companion (dev-server), and `@open-edu/domain-guidance` ADR-0009 block.
**Source design:** `openedu-interactive/docs/superpowers/specs/2026-09-12-engine-skills-consumable-design.md` (approved; req. explore + approve).

---

## 1. Goal

Make the six engine authoring skills (`visual`, `chart`, `geomap`, `timeline`, `diagram`, `composition`) consumable by OpenEdu **symmetrically** from the single canonical package `@knowledgeassemble/engine-skills`:

1. The external `openedu-course-authoring` skill discovers the manifest, loads an engine's `SKILL.md` + `skill-example.json` + `schema.json`, and routes "when to emit an `{type:"interactive"}` lesson node vs a legacy widget activity".
2. The Studio companion registers one `CompanionSkill` per engine from the manifest (data-driven, no hardcoded engine list), and its resolver injects the matching skill only when an interactive engine is detected in the authoring context (keeping prompt size bounded).
3. `@open-edu/domain-guidance` derives a structured engine-skills view from the published `manifest.json` and generates the skill reference files — never re-declaring engine knowledge (ADR-0009).

**Why this exists today (gap analysis):** OpenEdu has `InteractiveNodeSchema` in `packages/schemas/src/nodes.ts:207` (`{ type: 'interactive', engine, spec }`, engines `visual|chart|geomap|timeline|diagram` at `nodes.ts:32-38`) and an `@open-edu/interactive-runtime` bridge — but **no authoring guidance** for producing valid `spec` values. The six engine skills live as Markdown in the sibling `openedu-interactive` repo and are not loadable from OpenEdu. The engine-skills design closes that gap by publishing `SKILL.md` + `schema.json` + `skill-example.json` + `manifest.json` in one package; this plan consumes it.

---

## 2. Locked decisions

| Decision                                                                        | Choice                                                                                                                                                                                                                                                                                                                     | Rationale                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependency source**                                                           | `file:` override `"@knowledgeassemble/engine-skills": "file:../openedu-interactive/packages/engine-skills"` in root `pnpm.overrides`                                                                                                                                                                                       | Matches the existing override pattern for all five engine packages + `interactive-engine`/`interactive-react` (`package.json:80-89`). The package is not yet on the npm registry (E404 at plan time); the sibling package import chain is already `file:`-linked.                                                                                   |
| **Where the manifest is read**                                                  | Through the package's own exports (`MANIFEST`, `loadSkillDoc`, `loadSchema`, `loadSkillExample`, `validateSpec`, `validateSkillExample`)                                                                                                                                                                                   | Their dist uses explicit `.js` import specifiers (`dist/index.js` re-exports `./manifest.js`, `./validate-example.js`) — no extensionless-import hazard (AGENTS.md known-issue #1). Never read `manifest.json` by raw path except in the Node-only skill scripts that resolve it from the repo root (mirrors `widget-catalog-data.json` discovery). |
| **domain-guidance ingestion (open question #1)**                                | Structured derived view **and** a pointer to the manifest. `src/data/engine-skills.json` records the engine→kind matrix, schema/example refs, validation contracts, namespaced events; prose (SKILL.md) is loaded from the package, never re-derived.                                                                      | Spec §5.3: "derives a structured authoring view … never re-declares engine knowledge"; prose loaded, not re-derived.                                                                                                                                                                                                                                |
| **Companion registration (open question #2)**                                   | **Six** `CompanionSkill`s (`interactive-<type>`), built by iterating `MANIFEST.engines`. Resolver adds a rule that injects the matching engine skill when its engine type is detected in the activity/selection; a single small `interactive-authoring` router skill covers the "interactive but engine unspecified" case. | Keeps prompt injection bounded (convoy of the existing per-request `SkillResolver` design, `skills/resolveSkills.ts:13`); data-driven, no hardcoded engine list. Per-engine vs single-skill remains a product call, but both are wired and trivially switchable.                                                                                    |
| **`composition` handling**                                                      | Excluded from the `InteractiveEngineType` mapping (OpenEdu's enum has no `composition` — `nodes.ts:32-38`). Registered as a normal authoring skill whose `validationContract` is `engine-skills` `validateSpec('composition')`. Guarded by a test asserting manifest engines ⊇ OpenEdu enum + `composition`.               | Manifest has 6 engines; OpenEdu interactive nodes support 5. Composition is a composer vehicle, not an interactive-node engine today (spec §7).                                                                                                                                                                                                     |
| **Course-spec modeling (open question #3)**                                     | Out of scope (this plan). No changes to `course-compiler` activity schemas or to how lesson nodes are produced from course specs. The interactive authoring reference routes to **lesson nodes** (`{type:"interactive"}` in package content), which is orthogonal to the spec's `ActivityJSONSchema`.                      | Spec §7.3: depends on p7-acceptance item #2 (schema adoption), not on this package.                                                                                                                                                                                                                                                                 |
| **`interactive-lesson-node.schema.json` convenience export (open question #4)** | Out of scope for this slice. Consumers ajv-compile `skills/<engine>/schema.json` (full envelope + content) directly.                                                                                                                                                                                                       | Spec §7.4.                                                                                                                                                                                                                                                                                                                                          |

---

## 3. Work breakdown

### Task 0 — Dependency wiring (root repo)

**Prerequisite**

The sibling repo must have built the `@knowledgeassemble/engine-skills` package before this task can proceed. Verify:

```bash
ls ../openedu-interactive/packages/engine-skills/dist/index.js   # must exist
```

If absent, build it in the sibling repo first (`cd ../openedu-interactive && pnpm --filter @knowledgeassemble/engine-skills build`).

**Steps**

1. `pnpm.overrides` in root `package.json`: add
   ```json
   "@knowledgeassemble/engine-skills": "file:../openedu-interactive/packages/engine-skills"
   ```
   alongside the existing five engine overrides (`package.json:80-89`).
2. Add `"@knowledgeassemble/engine-skills": "^0.1.0"` to:
   - `packages/domain-guidance/package.json` `dependencies` (Node-only; the package root is already Node-only via `dataPath.ts`).
   - `apps/dev-server/package.json` `dependencies` (server-side AI code only).
   - root `package.json` **devDependencies** — this guarantees `node_modules/@knowledgeassemble/engine-skills` resolves at the repo root for the skill scripts (`skills/openedu-course-authoring/scripts/*.mjs`) without depending on pnpm's per-package virtual store layout.
3. `pnpm install` and confirm the symlink + dist build resolve:
   ```bash
   node --input-type=module -e "import { MANIFEST } from '@knowledgeassemble/engine-skills'; console.log(MANIFEST.engines.map(e=>e.type))"
   ```
   Expect `[ 'visual', 'chart', 'geomap', 'timeline', 'diagram', 'composition' ]`.

**Verification notes**

- `MANIFEST` parses `manifest.json` at module load (`dist/manifest.js`) — a broken/absent manifest fails loudly at import, which is the desired behavior for all three consumers.
- The package ships `files: ["manifest.json","skills/**","src","dist"]`; under a `file:` override the whole directory is linked, so `MANIFEST_PATH` (`resolve(PACKAGE_ROOT,'manifest.json')`) resolves through the symlink.
- **Browser-mode safety:** `engine-skills` is Node-only (`node:fs`), so it must never be imported from browser-facing dev-server modules. The browser bundle already excludes Node-only AI code (`vite.config.ts:1455-1457`), and the only browser-facing `domain-guidance` import is the `/profiles` subpath (`StudioApp.tsx:50`), which does not pull in engine-skills. The AI skill/resolver modules that do import it run server-side only.

### Task 1 — `@open-edu/domain-guidance`: manifest trust base + derived view

**Steps**

1. `packages/domain-guidance/src/engine-skills.ts` — new module:
   - `import { MANIFEST, loadSkillDoc, loadSchema, loadSkillExample, validateSkillExample, validateSpec } from '@knowledgeassemble/engine-skills';`
   - `export function getEngineSkillsData(): EngineSkillsData` — Zod-validates `MANIFEST` against a local `EngineSkillsDataSchema` (see step 2) and returns a derived view with no timestamps (freshness guard must be diff-stable).
   - `export function loadEngineSkillDoc(type)`, `loadEngineSchema(type)`, `loadEngineExample(type)` — thin delegators to the package loaders (keeps one import surface for consumers).
   - `export { validateSpec, validateSkillExample }` — re-exported convenience so consumers (and tests) round-trip examples/specs against the canonical schemas.
2. `packages/domain-guidance/src/types.ts` — add:
   - `EngineSkillEntrySchema` (type, skill, kinds `string[]`, skillDoc, schema, example, validationContract `{package, symbol, method}`, namespacedEvents).
   - `EngineSkillsDataSchema` (package, version, schemaVersion: `z.literal(1)`, engines `array`). Type `EngineSkillsData = z.infer<...>`, exported from `index.ts`.
3. `packages/domain-guidance/src/generate.ts` `generateAll()` — after the existing artifact-contract block:
   - Write `src/data/engine-skills.json` — the derived structured view (`getEngineSkillsData()`), committed.
   - Write `skills/openedu-course-authoring/references/engine-skills.md` — a **generated** reference (via `generatedHeader`, `generate.ts:119-125`). Mirrors the existing generated references (`profiles.md`, `quality-rubric.md`, `artifact-contract.md`, `generate.ts:156-265`) and provides:
     - package/version/schemaVersion provenance,
     - per-engine `### <type>` sections with skill name, kinds, `schema`/`example` refs, `validationContract` as code, and namespaced events,
     - an explicit note that per-engine prose lives in the installed package's `SKILL.md`, loaded — never re-derived.
       Prose stays in the package's SKILL.md; this reference only points at it.
       The **routing** reference (`interactive-authoring.md`) is authored prose and belongs to the skill (Task 3); `engine-skills.md` is its data-bearing companion.
4. `packages/domain-guidance/src/index.ts` — export `getEngineSkillsData`, `loadEngineSkillDoc/Schema/Example`, `validateSpec`, `validateSkillExample`, and the new types.
5. `scripts/copy-data.mjs` already copies all `src/data/*.json` → `dist/data` (glob, `copy-data.mjs:11`) — no change needed.

**Tests** — see §4 (domain-guidance).

### Task 2 — Studio companion: per-engine `CompanionSkill`s + resolver rule

**Steps**

1. New `apps/dev-server/src/studio/ai/skills/interactive-authoring.ts`:
   - `export function createInteractiveAuthoringSkills(): CompanionSkill[]` — iterate `getEngineSkillsData().engines` and map each entry to:
     ```ts
     {
       id: `interactive-${entry.type}`,
       description: `Author `{type:"interactive", engine:"${entry.type}"}` lesson nodes (skill: ${entry.skill}).`,
       instructions: buildInstruction(entry),
       tools: ['generate_item', 'edit_item'],
       permissions: ['item.generate', 'item.edit'],
     }
     ```
   - `buildInstruction(entry)` = `loadSkillDoc(entry.type)` **loaded verbatim** (spec §5.2) plus a short non-authoritative preamble (never edits the shared SKILL.md): "You are authoring OpenEdu interactive lesson-node specs. Server-side validation uses the manifest validationContract; do not run local ajv. Kinds: <kinds>. Reference example: <example path>." Include a compact schema summary derived at **runtime** from `loadSchema(entry.type)` — extract only the top-level `type`/`version`/`id` envelope keys and `content.kind` so the model captures the shape without holding the full JSON. The summary must be generated each time `buildInstruction` runs (not hardcoded), so it stays in sync with the upstream schema. Add a test asserting the summary keys are a true subset of the live schema's top-level keys.
   - `export const interactiveAuthoringRouterSkill: CompanionSkill` — small router: engines table + "identify the engine, then follow its `interactive-<type>` skill" + pointer to the reference rules.
   - Load manifest accessors from `@open-edu/domain-guidance` (already a dev-server dep), not directly from the package, so there is exactly one OpenEdu API for the manifest.
2. `apps/dev-server/src/studio/ai/skillRegistry.ts` — extend the default constructor arg to also register `createInteractiveAuthoringSkills()` + `interactiveAuthoringRouterSkill`:
   ```ts
   constructor(skills: CompanionSkill[] = [learnerAdaptationSkill, ...createInteractiveAuthoringSkills(), interactiveAuthoringRouterSkill])
   ```
   The array is built once at module load (server start), so per-request `new InMemorySkillRegistry()` in `chat/handler.ts:238` stays cheap.
3. `apps/dev-server/src/studio/ai/skills/resolveSkills.ts` `createSkillResolver` — add a second rule, composed with the existing learner-adaptation rule:
   - Define a `detectEngineType(content: string, engineTypes: string[]): string | null` helper that scans for `"engine"\s*:\s*"(<type>)"` in the content and returns the matching type (or `null`). It should: (a) extract the engine value via regex, (b) match against the known engine types from `getEngineSkillsData()`, (c) return exactly one match, or `null` on zero/multiple matches. Source text is the `StudioContextSnapshot` `activity.contentExcerpt` + `activity.selection.text`.
   - In the resolver: if the excerpt also contains an interactive signal (`"type":"interactive"` or bare token `interactive`), run `detectEngineType`.
   - If exactly one engine matches → resolve its `interactive-<type>` skill (merge with learner-adaptation instructions when a profile is present, same `map` pattern as today).
   - If interactive-authored content exists but no specific engine matches → resolve `interactiveAuthoringRouterSkill`.
   - Plain `view: 'outline'` / home snapshots resolve **no** engine skills (convoys the "whole library never injected" invariant, `skills.test.ts:50-52`). Detection is conservative; false-negatives are tolerated (router skill still resolves).
4. Keep the `resolve(context)` contract exactly as-is — no `@open-edu/companion` contract change (spec §5.2).

**Tests** — see §4 (dev-server).

### Task 3 — External `openedu-course-authoring` skill: catalog helper + adapter capability

**Steps**

1. New `skills/openedu-course-authoring/scripts/engine-skill-catalog.mjs` — mirrors the `widget-catalog.mjs` API shape (`loadEngineSkillsCatalog` returns `{ available, reason, engines }`, plus lookup helpers) and adds manifest-relative doc/schema/example loading:
   - `loadEngineSkillsCatalog(manifestPath)` — read + parse `manifest.json`; reason codes `catalog-not-found` | `catalog-parse-error` | `catalog-missing-engines`.
   - `getEngineEntry(engines, type)`.
   - `isKnownEngineType(engines, type)`; `getEngineKinds(engines, type)` (empty array for geomap/composition — matches manifest).
   - `loadEngineSkillDoc(manifestPath, type)`, `loadEngineSchema(manifestPath, type)`, `loadEngineSkillExample(manifestPath, type)` — resolve `entry.skillDoc/schema/example` relative to the manifest's directory.
   - CLI mode: print engine summary (`engine-skill-catalog.mjs <manifest.json>`), like `widget-catalog.mjs:126-145`.
2. `skills/openedu-course-authoring/scripts/openedu-adapter.mjs` `discoverRepository()`:
   - Add capability flag `engineSkillsCatalog: boolean` and path `paths.engineSkillsManifest`.
   - Resolution: `join(repoRoot, 'node_modules', '@knowledgeassemble', 'engine-skills', 'manifest.json')`; set `capabilities.engineSkillsCatalog` only when the file exists.
   - Add `engineSkillsCatalog` to `result.unavailable` when absent; when `mode === 'portable'` **or** the flag is false, expose a hint the skill's SKILL.md turns into an instruction: `pnpm add @knowledgeassemble/engine-skills` (and, in this repo, the `file:` override path note).
   - Extend `resolveOpenEduCommands` with a suggested `installEngineSkills` command (`['pnpm','add','@knowledgeassemble/engine-skills']`), suggested-only (never executed — convoys `commands.dev` precedent).
3. `skills/openedu-course-authoring/references/interactive-authoring.md` — authored routing reference (uses `engine-skill-catalog.mjs` + adapter discovery; in repository mode points at the repo-local manifest; in portable mode tells the agent to install the package first). Content:
   - **When to emit `{type:"interactive", engine, spec}` in a lesson node vs a legacy `widget` activity:** use a widget when a catalog widget covers the learning intent (existing `authoring-workflow.md:151-158` rules stay authoritative); use an interactive node when the content is representational/dynamic (number lines, charts, maps, timelines, diagrams) or composed of multiple engines — the widget catalog has no entry.
   - **How to author the spec:** load the engine's `SKILL.md` via `engine-skill-catalog.mjs`, follow its rules, round-trip the spec against its `schema.json` (ajv) or the manifest `validationContract`, then place the validated spec in the lesson node.
   - **Do not duplicate per-engine guidance** — route to `references/engine-skills.md` (generated matrix) and the engine's own `SKILL.md`.
4. `skills/openedu-course-authoring/SKILL.md`:
   - Add `references/interactive-authoring.md` to the References list.
   - Add `scripts/engine-skill-catalog.mjs` to Helper Scripts.
   - Add a new Critical Rule: "**Interactive lesson nodes must come from the engine skill catalog.** Load `engine-skill-catalog.mjs`, read the engine's `SKILL.md`, follow its authoring rules, round-trip the `spec` against its `schema.json`/validationContract, then emit `{type:"interactive", engine, spec}`. Never invent a spec shape or engine id." (Use the next available rule number in the existing SKILL.md — search for `## Critical Rules` and number sequentially.)
   - Note the `engineSkillsCatalog` capability on the deployment path (`~/.agents/skills/...` must be re-copied after changes — `cp -r skills/openedu-course-authoring ~/.agents/skills/`).
5. `skills/openedu-course-authoring/references/repository-adapter.md` — document the new `engineSkillsCatalog` capability, `paths.engineSkillsManifest`, the suggested `installEngineSkills` command, and the portable-mode "install the package first" guidance (extends the existing discovery JSON example at lines 21-52).

**Tests** — see §4 (skill scripts).

### Task 4 — CI freshness guard

**Steps**

1. New root script in `package.json`:
   ```json
   "check:freshness": "pnpm --filter @open-edu/domain-guidance generate && git diff --exit-code -- packages/domain-guidance/src/data/engine-skills.json skills/openedu-course-authoring/references/engine-skills.md"
   ```
2. Guard scope (spec §5.3 / §6): regeneration against the **installed** `engine-skills` version (pinned by the workspace dependency + override) produces no diff for the generated view and reference. The `&&` chain in `check:freshness` means a `generate` failure (non-zero exit) is fatal and stops CI before the diff step. The generator itself asserts the package-relative portability invariant (no `packages/` or `docs/` path fragments in loaded SKILL.md — spec §4); surface that assertion in `getEngineSkillsData()` validation too (a `z.string().regex` guard on `skillDoc/schema/example` refs) so a leak fails loudly in OpenEdu tests, not just in the sibling repo's generator.
3. Wire into CI along the existing "lint" verification path (document it in the verification block below; do not add to `pnpm lint` unless CI already gates it).

---

## 4. Tests

### `packages/domain-guidance/src/__tests__/engine-skills.test.ts` (new)

- **Manifest trust base:** `getEngineSkillsData()` parses, `schemaVersion === 1`, `engines.length === 6`, engine types match `['visual','chart','geomap','timeline','diagram','composition']`.
- **Engine enum alignment:** `engines[].type` ⊇ `INTERACTIVE_ENGINE_TYPES` from `@open-edu/schemas` (import the enum in the test); `composition` is present but NOT in the OpenEdu enum (guards the decision in §2).
- **Derived view committed & synced:** `getEngineSkillsData()` deep-equals `JSON.parse(readDataFile('engine-skills.json'))` (mirrors `domain-guidance.test.ts:30-34`).
- **Generated reference file:** `references/engine-skills.md` contains a section per engine and no `packages/` or `docs/` path fragment.
- **Portability of skill docs:** every `loadEngineSkillDoc(type)` (all six) is non-empty and contains no `packages/` or `docs/` path fragment (mirrors the package's own portability gate, spec §4; catches a leaked in-repo reference at test time).
- **Round-trip provenance (installed-package smoke, spec §6):** for each of the six engines, `validateSkillExample(type)` resolves `true` (shipped `skill-example.json` validates against shipped `schema.json`); `validateSpec('composition', ...)` round-trips the composition example.

### `apps/dev-server/src/studio/ai/interactive-authoring.test.ts` (new)

- `createInteractiveAuthoringSkills()` returns **six** skills with ids `interactive-visual` … `interactive-composition`; each has non-empty `instructions` (no `packages/`/`docs/` fragments), `tools` `['generate_item','edit_item']`, permissions `['item.generate','item.edit']`.
- `InMemorySkillRegistry([…engine, router])` lists `7` skills; duplicate registration still overwrites (existing contract).
- **Resolver:** `renderInteractiveContext` (`activity.contentExcerpt` containing `"type":"interactive","engine":"chart"`) → resolves `['interactive-chart']` (+ learner-adaptation when a profile is present). Interactive content with no engine token → resolves `['interactive-authoring']`. Plain `baseCtx` (outline) → resolves `[]` (additive rule preserved, `skills.test.ts:50-52`).

### `skills/openedu-course-authoring/scripts/__tests__/engine-skill-catalog.test.mjs` (new — mirrors `widget-catalog.test.mjs`)

- Loads a temp-dir fixture manifest → `available`, engines length, lookup helpers, kinds (empty for `geomap`/`composition`).
- Document/schema/example loading resolves relative paths from the fixture manifest dir.
- Missing / malformed / non-`engines` manifests → `available: false` with the right reason code.
- Real-manifest smoke: `node_modules/@knowledgeassemble/engine-skills/manifest.json` from `process.cwd()` when present (skip otherwise), asserting each entry's `SKILL.md`/`schema.json`/`skill-example.json` exist relative to the manifest.

### `skills/openedu-course-authoring/scripts/__tests__/openedu-adapter.test.mjs` (update)

- Fixture repo with `node_modules/@knowledgeassemble/engine-skills/manifest.json` → `capabilities.engineSkillsCatalog === true`, `paths.engineSkillsManifest` set.
- Fixture repo without it → flag `false`, `unavailable` includes `'engineSkillsCatalog'`.
- Portable mode → flag `false` and install hint exposed.

---

## 5. Verification (run in this order)

```bash
pnpm install                                        # wires the file: override + symlink
pnpm --filter @open-edu/domain-guidance generate    # produces engine-skills.json + engine-skills.md
pnpm --filter @open-edu/domain-guidance test        # incl. new engine-skills.test.ts
pnpm --filter @open-edu/dev-server test             # incl. interactive-authoring.test.ts
node --test skills/openedu-course-authoring/scripts/__tests__/engine-skill-catalog.test.mjs
node --test skills/openedu-course-authoring/scripts/__tests__/openedu-adapter.test.mjs
node --test skills/openedu-course-authoring/evals/schema.test.mjs   # skill eval-schema guard
pnpm typecheck
pnpm lint                                            # includes lint:hardcoded-strings
pnpm format:check                                    # run `pnpm format` first if it complains
pnpm check:freshness                                 # new CI freshness guard
```

Manual checks:

- `OPEN_EDU_STUDIO_ASSISTANT=1 pnpm --filter @open-edu/dev-server dev` → Studio chat "add an interactive number-line activity" → the assistant emits a `{type:'interactive', engine:'visual', spec:{...}}` node; verify the draft validates via the engine's schema.
- `node skills/openedu-course-authoring/scripts/engine-skill-catalog.mjs node_modules/@knowledgeassemble/engine-skills/manifest.json` → prints the 6-engine summary.

**Notes:**

- **No dev-server tailwind regeneration needed** — no runtime classes change (AI prompt/skill files only).
- **No i18n keys added** — the skills feed model context, not user-facing UI strings; the hardcoded-strings linter targets renderers/learner UI, not AI instructions.
- **`composition` and OpenEdu schemas:** the resolver never maps `engine:'composition'` to an `InteractiveNode` today; the composition skill is authoring-only until the OpenEdu interactive contract grows a composed form (already reserved in `InteractiveNodeConfigSchema` — `engines`/`bindings`/`id` composed form, `nodes.ts:113-114`).

---

## 6. AGENTS.md Compliance Checklist

- [ ] **Tests:** every touched module gets Vitest/node:test tests (§ 4), including the installed-package round-trip gate.
- [ ] **Schemas are the source of truth:** the `EngineSkillsDataSchema` in `domain-guidance` is only a _trust base_ for the external manifest; engine knowledge (kinds, contracts) is never re-declared — it comes from `MANIFEST` (ADR-0009 derivation discipline).
- [ ] **Self-contained packages:** `domain-guidance` and `dev-server` consume `@knowledgeassemble/engine-skills` through its published exports only; no cross-package imports into the sibling repo internals.
- [ ] **No `@open-edu/*` leak into the engine package:** all three consumers **read** the package; nothing in this repo mutates or re-generates `skills/<engine>/{SKILL.md,schema.json,skill-example.json}` (the sibling generator is the only writer).
- [ ] **Deterministic, gated:** `check:freshness` + committed generated view/reference; portability assertion (no `packages/`/`docs/` fragments) enforced in domain-guidance tests.
- [ ] **Accessibility / i18n / styling:** untouched (no UI surface in this plan).
- [ ] **Conventional commits** (one story per PR), e.g.:
  - `feat(domain-guidance): derive engine-skills view from @knowledgeassemble/engine-skills manifest`
  - `feat(dev-server): register interactive engine skills from the engine-skills manifest`
  - `feat(skills): add engine-skill-catalog.mjs and interactive-authoring reference to openedu-course-authoring`

---

## 7. Out of Scope / Open items carried to the product call

- **Course-spec interactive modeling** (`ActivityJSONSchema` `type:'interactive'` in course specs vs lesson nodes) — depends on p7-acceptance schema adoption (spec §7.3).
- **`interactive-lesson-node.schema.json` convenience export** from `engine-skills` — optional, deferred (spec §7.4).
- **domain-guidance ingestion measure** beyond the derived structured view + pointer (open question #1 is resolved for this slice; deeper prompt-layer integration is a follow-up).
- **Per-engine vs single companion skill** — both are implemented; the final product call just flips which skills the resolver emits (open question #2).
- **Learner-app runtime consumption of engine skills** — the learner app renders interactive nodes via `@open-edu/interactive-runtime` already; no authoring-skill changes there.
