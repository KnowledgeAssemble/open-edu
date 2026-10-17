# OpenEdu Pack System — Phase 3: Studio Lifecycle Grounding (Agent Execution Plan)

> **For the implementing agent.** This is a turn-key, prescriptive plan for Phase 3 (stories
> 3.1–3.9) of the Pack System spec. It resolves every ambiguity, pre-decides every file, embeds
> every schema/prompt/UI string, and lists each test and verification command. Follow the phases
> in order; do NOT improvise.
>
> - Spec: `docs/OPENEDU-PACK-SYSTEM.md` (v0.4) — read §0.2, §17, §20.2, §21, §21.4, §22, §22.4,
>   §22.5, §23.2, §27 (Phase 3 table), §28 (Phase 3), §30 (OQ4) before starting. Everything below
>   encodes those sections.
> - Repo rules: `AGENTS.md` (read it). This plan encodes the AGENTS.md constraints (schemas are
>   source of truth, i18n, no new deps, TDD, conventional commits, subpath exports for Node ESM).
> - Prior plans: `docs/superpowers/plans/2026-10-07-pack-system-phase-0-convergence.md` and
>   `docs/superpowers/plans/2026-10-08-pack-system-phase-1-packs.md`. Phase 0 and Phase 1 are
>   merged (PRs #622, #623). This plan builds only on landed code.
> - **Scope is Phase 3 only** (user-approved scope A–D: item grounding, model-loop parity,
>   restore via provenance, live coverage + remediation). Do NOT build unit re-scoping, standalone
>   drift detection, pack installation in browser mode, or anything in spec §29.
> - Every fact in §2 was verified against the code on this branch on 2026-10-16. Cite them; do not
>   re-derive.

---

## 0. Environment & non-negotiables

### 0.1 What you will touch (only this)

| Area                        | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schemas                     | `packages/schemas/src/provenance.ts`, `packages/schemas/src/provenance.test.ts`, `packages/schemas/src/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Packs                       | `packages/packs/src/fingerprint.ts` (+ new `fingerprint.test.ts` KATs if absent), new `packages/packs/src/coverage.ts` + `coverage.test.ts`, `packages/packs/src/index.ts`                                                                                                                                                                                                                                                                                                                                                                                      |
| Dev-server (AI)             | `apps/dev-server/src/studio/ai/itemGenerate.ts` + `.test.ts`, `ai/prompts/itemAddPrompts.ts`, `ai/prompts/itemEditPrompts.ts`, `ai/prompts/authoringContext.ts`, `ai/middleware.ts`, `ai/agentLoop.ts` + `.test.ts`, `ai/chat/toolCatalog.ts` + `.test.ts`, `ai/chat/tools.ts` + `.test.ts`, new `ai/objectiveMatch.ts` + `.test.ts`, new `ai/provenanceRefresh.ts` + `.test.ts`, `ai/provenance.ts` + `.test.ts`, `ai/applyDraft.ts` + `.test.ts`, `ai/skills/objective-intent.ts`, `ai/skills.test.ts`                                                        |
| Dev-server (API/client)     | `studio/studioApi.ts`, `studio/localStudioApi.ts` + `.test.ts`, `studio/browserStudioApi.ts` + `.test.ts`, new `studio/packs/authoringRestore.ts` + `.test.ts`, new `studio/packs/coverageFromPackage.ts` + `.test.ts`                                                                                                                                                                                                                                                                                                                                          |
| Dev-server (UI)             | `studio/StudioApp.tsx` + `.test.ts`, `ai/StudioChatProvider.tsx`, `components/StudioAssistantChat.tsx` + `.test.ts`, `components/OutlineWorkspace.tsx` + `.test.ts`, `components/OutlineView.tsx` + `.test.ts`, `components/PackBrowserPanel.tsx` + `.test.ts`, `components/PackSelectionPanel.tsx` (unchanged — pattern reference only), `components/AiAddDialog.tsx` + `.test.ts`, `components/ActivityEditorRouter.tsx`, `components/LessonActivityEditor.tsx`, `components/QuizActivityEditor.tsx`, `components/PracticeActivityEditor.tsx` (+ their tests) |
| i18n                        | `packages/i18n/locales/en/studio.json` (new `packs.*` keys, §Phase 7/8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Generated (never hand-edit) | `apps/dev-server/src/tailwind.css` (regenerated in the coverage commit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Do NOT modify** (unless the table above whitelists it): `packages/runtime/**`,
`packages/design-system/**`, `apps/learner/**`, `apps/docs/**`, `packages/widgets/**`,
`packages/companion/**` (already carries `authoring` on the snapshot — verified), the spec
(`docs/OPENEDU-PACK-SYSTEM.md` — already updated as part of this work; do not touch again),
other plan files, `openwiki/**` (regenerates automatically).

If you believe a file outside this list must change, STOP and report instead of editing.

### 0.2 Hard rules

1. **No new runtime dependencies.** The isomorphic SHA-256 (Phase 2) is inline code, not a
   package. No `pnpm add`.
2. **Tests first (TDD).** Write the failing test, watch it fail, implement, watch it pass.
3. **No emoji, no debug `console.log`, no dead code, no comments beyond what this plan shows.**
4. **Conventional commits**, one per phase header (some phases list two).
5. **Build before dependent tests** whenever a `packages/**` export surface changes. Order:
   `schemas` → `packs` → `dev-server`. Concretely:
   - After Phase 1: `pnpm --filter @open-edu/schemas build` before dev-server tests.
   - After Phase 2 and Phase 8a: `pnpm --filter @open-edu/packs build` before dev-server tests.
6. **Back-compat invariant (repeated per phase for a reason):** every new parameter is optional.
   With no `authoring` anywhere, prompts, request bodies, validation results, tool outputs, and
   provenance files are byte-identical to the landed Phase 1 behavior. Every phase has a test
   asserting this.
7. **Client-safe imports.** UI components may import `@open-edu/packs` (root) and
   `@open-edu/packs/fingerprint` (subpath — isomorphic after Phase 2). NEVER
   `@open-edu/packs/loader` (node:fs) in client code. `ai/provenance.ts` imports
   `@open-edu/domain-guidance` root (node:fs) — that is why the shared objective matcher lives in
   a NEW pure module (`ai/objectiveMatch.ts` — its only import is a type-only `AuthoringContext`,
   erased at build; no runtime imports), why the merge helper
   lives in a NEW file (`ai/provenanceRefresh.ts` that imports only types + `objectiveMatch.ts`)
   — NEVER `ai/provenance.ts` from browser-safe code — and why the restore/drift helper lives in
   `studio/packs/authoringRestore.ts`. `provenance.ts` itself may import `objectiveMatch.ts`
   freely (it already pulls node:fs).
8. **i18n.** Every new user-facing string uses `t()` with keys added to
   `packages/i18n/locales/en/studio.json`. `pnpm lint:hardcoded-strings` (part of `pnpm lint`)
   enforces this.
9. **Tailwind.** After UI phases (7 and 8):
   `pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css`.
   Fold the regenerated file into the phase's UI commit.

### 0.3 Verification loop (all green before the next phase)

```bash
pnpm --filter @open-edu/schemas test && pnpm --filter @open-edu/schemas typecheck
pnpm --filter @open-edu/packs test && pnpm --filter @open-edu/packs typecheck
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
pnpm lint
pnpm format:check
```

Full-repo close-out after Phase 9:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
```

---

## 1. Locked decisions (do not revisit)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **Scope = A+B+C+D only.** Item grounding, chat/model-loop parity, restore-from-provenance (incl. drift display), live coverage + remediation chips. No unit re-scoping, no standalone drift-detection command.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| L2  | **`authoringScope` = the `setAuthoringSelection` input shape:** `{ curriculum: string; unit?: string; learner?: string; locale?: string }`. Optional on `ReproductionRecordSchema`; `schemaVersion` stays `1` (additive optional field; lenient loader already tolerant — `core/src/provenance.ts`). Round-trips: `resolve.ts:202` sets `curriculumUnit = unit?.id`, so the context-derived scope uses unit **id**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| L3  | **Scope derivation in `buildProvenance`:** `curriculum` = first `packs[]` entry with `type === 'curriculum'`; `unit` = `authoring.curriculumUnit`; `learner`/`locale` = `authoring.learner`/`authoring.locale`. If no curriculum pack, `authoringScope` is omitted (record still written).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| L4  | **Provenance refresh policy (OQ4 resolved):** AI course commit (existing) + AI item apply via path-keyed merge/upsert (new). Manual `writeFile` never touches the record. Refresh is **advisory**: it never fails the apply (try/catch, silent).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| L5  | **Merge helper is browser-safe:** new `apps/dev-server/src/studio/ai/provenanceRefresh.ts` importing only `@open-edu/schemas` types, `@open-edu/packs` types, `@open-edu/packs/fingerprint` (isomorphic after Phase 2), the shared pure matcher `ai/objectiveMatch.ts` (type-only import; no runtime imports), and the `StudioApi` type. NEVER import `ai/provenance.ts` (pulls `domain-guidance` root → `node:fs`) or `itemGenerate.ts` (pulls the curated catalog server path). Widget extraction from a practice draft is a plain `JSON.parse(content).widget` in try/catch.                                                                                                                                                                                                                                                                                                                                                                              |
| L6  | **Merge semantics:** `mergeAppliedItem(record, entry, generatedAt)` upserts by `node.path` (replace matched, else append); preserves `packs`, `authoringScope`, `contextFingerprint`; rewrites `generatedAt`. If no record exists and `authoring` is present at apply time, CREATE a fresh record (`packs = authoring.packs`, fingerprint = `fingerprintAuthoringContext(authoring)`, `authoringScope` per L3-derivation helper, `nodes = [entry]`). If no record and no authoring → no-op.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| L7  | **Objective attribution is best-effort and wire-stable.** New public `matchAuthoringObjectives(authoring, text)` in a NEW pure module `ai/objectiveMatch.ts` (reuse the private `normalizeDescription` from `provenance.ts:28-33`; a match is exact-equality OR bidirectional substring; **no index fallback** for free text). Return ALL matches (exact AND substring), **deduped by objective id**, in `authoring.objectives` order — when an exact match exists, substring matches are still included, not replaced. Applied item text = draft `title` + `content`. `ai/provenance.ts` imports `normalizeDescription` from `objectiveMatch.ts` for its own course-path matcher (unchanged semantics; keeps its index fallback). No schema/wire change for attribution.                                                                                                                                                                                    |
| L8  | **Item grounding carrier:** `authoring?: AuthoringContext` added to `ItemAddRequest`, `ItemEditRequest`, `ToolCallRequest`, and parsed in `assertItemAddBody`/`assertItemEditBody` via `AuthoringContextSchema.safeParse` — the exact pattern of `middleware.ts:130-139`; invalid → `invalidRequest('Invalid authoring context')` (surfaces as 400 `invalid-request` via the existing `ItemRequestError` catch at `middleware.ts:296-300`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| L9  | **Item prompt extension:** new `renderItemAuthoringSection(ctx)` in `ai/prompts/authoringContext.ts` (compact block: unit/learner/locale, objectives with requiresIntents, available activity ids — NOT the full course block). All six prompt builders (`buildLessonAddPrompt`, `buildQuizAddPrompt`, `buildPracticeAddPrompt`, `buildLessonEditPrompt`, `buildQuizEditPrompt`, `buildPracticeEditPrompt`) gain a trailing optional `authoringSection?: string` inserted as `[authoringSection, '']` immediately before the final `context` line. `generateQuizBatch` (`itemGenerate.ts:295-332`, invoked by the add-questions short-circuit at `:346-348`) gains the same optional param and threads it to `buildQuizEditPrompt` at `:302` — the add-questions path must not lose grounding. Existing two-arg/three-arg calls unchanged → byte-identical prompts without authoring.                                                                        |
| L10 | **Practice whitelist:** `validateItemDraft` opts gain `availableActivityIds?: ReadonlySet<string>`. Checked only in the practice branch, AFTER the curated-catalog check (`itemGenerate.ts:170-172`). Failure message: `` `Widget "${node.widget}" is not in the selected pack's available activities` `` — fed through the existing retry loop (`appendValidationFeedback`, 2 attempts, then `item-retry-failed`). The set is built ONLY when `authoring.availableActivities.length > 0`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| L11 | **Model-loop parity is server-owned injection** (same principle as `packageDir`/`completeText` — `toolCatalog.ts:5-12`): `GenerationToolContext` gains `authoring?: AuthoringContext`; `agentLoop.ts:220-227` adds `authoring: request.context.authoring` to the execute context; the deterministic branches (`agentLoop.ts:321-351` generate_item, `354-383` edit_item) pass `authoring: request.context.authoring` into `draftActivity`; `toolCatalog.ts` generate_course adds `authoring: ctx.authoring, locale: ctx.authoring?.locale` (parity with the deterministic branch at `agentLoop.ts:297-304`). The model NEVER supplies `authoring` in tool input schemas.                                                                                                                                                                                                                                                                                     |
| L12 | **`objective-intent` skill:** `tools: ['generate_course', 'generate_item', 'edit_item']` (was `['generate_course']`). Tool filtering stays union-semantics (`agentLoop.ts:140-144`: `skills.some(...)`) — no tool is ever locked out when the skill is absent; extend instructions (exact text in Phase 4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| L13 | **Client API:** `StudioApi.generateItemAdd(kind, description, options?: { authoring?: AuthoringContext })` and `generateItemEdit(kind, intent, currentContent, params?, options?: { authoring?: AuthoringContext })`. Both impls spread `...(options?.authoring ? { authoring: options.authoring } : {})` into the POST body / gateway body. `browserAiGateway.generateItem(body: unknown)` is already pass-through — no gateway change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| L14 | **Fingerprint becomes isomorphic** by replacing `node:crypto` with an inline pure-TS SHA-256 in `packages/packs/src/fingerprint.ts`. Output format stays `sha256:<hex>` with **byte-identical values** (same canonicalizeContext, same digest). The `./fingerprint` subpath export stays (importers unchanged: `ai/provenance.ts:4`). Known-answer tests pin the vectors below. This is what makes fingerprint drift comparable in browser mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| L15 | **Restore trigger:** new single-shot effect in `StudioApp` keyed by `courseKey`, using an `authoringRef` (kept in sync each render) as the null-guard inside the async continuation, and a `restoredCourseKeyRef` for single-shot semantics. Source = the `loadedPackage` PROP that `StudioApp` already receives (`DevApp.tsx:87`; browser: `browserPreview.tsx:45-97` refreshes it via `onPackageChanged → reloadPreview`; local: `vite.config.ts:405-421` watches the package dir and sends `full-reload`) — read `loadedPackage?.provenance` (already lenient-parsed and attached — `core/src/file-loader.ts:61-65,138`, `core/src/types.ts:29`). Do NOT use `api.getPreviewPackage()` — the local impl is a `null` stub (`localStudioApi.ts:129`). Precedence: a pending/stored pack selection (`readStoredPackAuthoring()`) skips restore; any non-null current authoring skips restore; resolve failure or missing scope is silent (stays unselected). |
| L16 | **Drift is computed client-side, pure:** new `studio/packs/authoringRestore.ts` with `computeAuthoringDrift(record, context)` → `{ packDiffs: Array<{ id, recorded, current }>, fingerprintChanged: boolean }`. `packDiffs` = join `record.packs` and `context.packs` on `id`, compare `version` (a pack present on one side only yields `current`/`recorded` = `'—'`). `fingerprintChanged` = `record.contextFingerprint !== fingerprintAuthoringContext(context)`. Drift NEVER mutates course, record, or context.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| L17 | **Coverage = blueprint check-2 semantics, exactly** (`blueprint.ts:44-61`): UNION of the intents of all emitted (emitted = present in the course) available activities; an objective is covered when every `requiresIntents` member is in that union. Implemented once in pure `packages/packs/src/coverage.ts` (`computeObjectiveCoverage`), exported from the packs root. The live-course half runs in dev-server: `studio/packs/coverageFromPackage.ts` extracts practice widget ids from the `loadedPackage` PROP's `nodes` using `parseExerciseNode(n.content)?.widget` (`studio/widgets/exerciseNode.ts:8` — the same helper `itemGenerate.ts` uses).                                                                                                                                                                                                                                                                                                  |
| L18 | **Coverage UI** lives in `PackBrowserPanel` (Packs tab — spec §22.1 "Concept and provenance browsing moves into a read-only panel"): one row per objective (description + covered/uncovered status + `satisfiedBy` ids as subtle text). Uncovered rows get a "Generate activity" chip that calls `openWithPreset({ message, prefill: true })` — the exact precedent of `PackSelectionPanel.tsx:102-108`. Chip message is a preset only; generation stays in the assistant (skill + §21.4 grounding do the satisfying).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| L19 | **Coverage recompute trigger:** computed synchronously in `StudioApp` from the `loadedPackage` PROP (NOT `api.getPreviewPackage()` — local stub, `localStudioApi.ts:129`) via `coverageFromPackage(loadedPackage, authoring)`; effect deps `[loadedPackage, authoring]`. Every mutation refreshes the prop in both modes (local: package-dir watcher `full-reload` — `vite.config.ts:405-421`; browser: `onPackageChanged → reloadPreview` — `browserPreview.tsx:92`), so a new prop identity recomputes coverage after AI applies, manual edits, reorders, and course switches. `outlineRevision` is NOT a coverage dep. Empty states: no authoring → panel shows a "select a curriculum pack" hint; authoring with zero objectives → section hidden.                                                                                                                                                                                                       |
| L20 | **Prop threading for authoring** (needed by merge-on-apply and item grounding): `StudioApp` → `StudioChatProvider` (new optional `authoring` prop) → `StudioAssistantChat` → `applyDraft`/`applyDraftBatch` options; `StudioApp` → `ActivityEditorRouter` → the three activity editors (optional `authoring` prop each); `OutlineWorkspace` already receives `authoring` (`StudioApp.tsx:295`) → thread to `OutlineView` → `AiAddDialog` (grounding only; merge happens in `OutlineView.addAiDraft`). All props optional, default `null` → no-ops.                                                                                                                                                                                                                                                                                                                                                                                                           |
| L21 | **`applyDraft` / `applyDraftBatch` signature:** options gain `authoring?: AuthoringContext                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | null`. After a successful file apply + `appendToOutline`, call `refreshProvenanceAfterApply(api, [{ path, content }], authoring)`. Batch applies one merged refresh with all paths. `mode: 'buffer'` skips refresh (no file written). |
| L22 | **Editor AI-accept refresh:** after a successful AI-edit `writeFile` in `LessonActivityEditor.tsx:101`, `QuizActivityEditor.tsx:154`, `PracticeActivityEditor.tsx:211`, call the same helper with the edited path + content. `OutlineView.addAiDraft` (`OutlineView.tsx:210`) does the same for the AiAddDialog accept path. Refresh is fire-and-forget (`void`), never surfaces errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| L23 | **i18n keys** (all in `packages/i18n/locales/en/studio.json`, exact strings in the phases): `packs.restoredFromProvenance`, `packs.driftPackVersion`, `packs.driftFingerprint`, `packs.coverageHeading`, `packs.coverageCovered`, `packs.coverageUncovered`, `packs.generateActivityChip`, `packs.coveragePreset`, `packs.coverageNone`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| L24 | **No new E2E specs.** Unit + component tests cover the phases; a manual smoke (`edu dev ./examples/hello-world` with `OPEN_EDU_PACKS_DIR=examples/packs`) is the close-out. Keep the PR reviewable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

---

## 2. Pre-verified facts (file:line — trust, do not re-derive)

### Landed Phase 1 state

| Fact                                                                                                                                                 | Citation                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ReproductionRecordSchema` = `schemaVersion: z.literal(1)`, `packs[]`, `generatedAt`, `contextFingerprint`, `nodes[]` — NO scope field               | `packages/schemas/src/provenance.ts:11-19`                                                    |
| `ReproductionNodeSchema` = `path`, `objectives[]`, `concepts[]`, `widgets[]`, `capabilityGaps[]`                                                     | `packages/schemas/src/provenance.ts:3-9`                                                      |
| `buildProvenance(authoring, model, generatedAt)` writes record + returns capabilityGaps                                                              | `apps/dev-server/src/studio/ai/provenance.ts:54-101`                                          |
| Private `matchLessonObjective` = exact-normalized → substring → index fallback; `normalizeDescription` at `:28-33`                                   | `apps/dev-server/src/studio/ai/provenance.ts:35-52`                                           |
| `provenance.ts` imports `@open-edu/domain-guidance` root, which imports `dataPath.ts` → `node:fs` — importing it from browser code breaks the bundle | `ai/provenance.ts:2`; `packages/domain-guidance/src/index.ts:10`; `dataPath.ts:1-4`           |
| `buildProvenance` called from commit path + draft-to-disk path; writes `provenance.json`                                                             | `ai/commitCourseDraft.ts:157,169`; `ai/generateCourse.ts:221-224`                             |
| Provenance is lenient-optional on load; `LoadedPackage.provenance?` attached                                                                         | `packages/core/src/file-loader.ts:61-65,138`; `packages/core/src/types.ts:29`                 |
| Fingerprint = `node:crypto` sha256 over `canonicalizeContext` (budget reduced to `{maxChars}`)                                                       | `packages/packs/src/fingerprint.ts:1-23` (subpath `./fingerprint`)                            |
| `resolveAuthoringContext(packs, {curriculum, unit}, options)` → `{context, diagnostics}`; `curriculumUnit = unit?.id`                                | `packages/packs/src/resolve.ts:37-41,202`                                                     |
| `setAuthoringSelection` implemented CLIENT-side in both APIs via `resolveSelection(getBundledPacks(), …)`                                            | `localStudioApi.ts:232`; `browserStudioApi.ts:800`; `packs/packApi.ts:51-74`                  |
| `AuthoringContextSchema` fields incl. `curriculumUnit?`, `learner?`, `locale?`, `availableActivities[]`, `budget` required                           | `packages/packs/src/context.ts:21-63`                                                         |
| Blueprint check-2 = UNION of emitted widget intents, all-of per objective, gap message format                                                        | `packages/packs/src/blueprint.ts:44-61`                                                       |
| `validateBlueprint` check-1 widget allowlist + check-3 audience                                                                                      | `packages/packs/src/blueprint.ts:22-42`                                                       |
| Session persistence: `StoredPackAuthoring { courseKey, pending, context, warnings }` via sessionStorage                                              | `studio/studioSession.ts:100-116`; restore/scope logic `authoringScope.ts:12-39`              |
| StudioApp holds `authoring`/`authoringWarnings`/`capabilityGaps`; courseKey effect clears on switch                                                  | `StudioApp.tsx:89-118`                                                                        |
| `authoring` already threaded to OutlineWorkspace + StudioContextBridge; NOT to StudioChatProvider, ActivityEditorRouter, OutlineView                 | `StudioApp.tsx:295,374`; bridge attaches `snapshot.authoring` `StudioContextBridge.tsx:71-72` |
| `studioContextSnapshotSchema` extends with `authoring: AuthoringContextSchema.optional()`                                                            | `packages/companion/src/context.ts:76-78`                                                     |
| Skill resolver rule 3: `ctx?.authoring?.objectives.length > 0` → objective-intent                                                                    | `ai/skills/resolveSkills.ts:69-73`                                                            |
| `objectiveIntentSkill.tools = ['generate_course']`                                                                                                   | `ai/skills/objective-intent.ts:9`                                                             |
| Tool filter = UNION semantics (`skills.some(...)`); empty skills ⇒ all tools                                                                         | `ai/agentLoop.ts:137-144`                                                                     |

### Item-generation path (the grounding target)

| Fact                                                                                                                         | Citation                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `generate-draft` endpoint parses `authoring` via `AuthoringContextSchema.safeParse`, 400 on invalid                          | `ai/middleware.ts:121-139`                    |
| `/item/add` handler: `assertItemAddBody` → `generateItemAdd({kind, description, packageDir, existingTitles})` — NO authoring | `ai/middleware.ts:236-252`                    |
| `/item/edit` handler: `assertItemEditBody` → `generateItemEdit(...)` — NO authoring                                          | `ai/middleware.ts:256-279`                    |
| `assertItemAddBody` returns `{kind, description, existingTitles?}`; throws `invalidRequest`                                  | `ai/itemGenerate.ts:400-422`                  |
| `assertItemEditBody` returns `{kind, intent, currentContent, params?, existingTitles?}`; intent allowlist per kind           | `ai/itemGenerate.ts:424-502`                  |
| `ItemAddRequest`/`ItemEditRequest` shapes; `generateItemAdd` builds prompt via `renderCourseContext(existingTitles)`         | `ai/itemGenerate.ts:34-54,256-269`            |
| `generateItemEdit` prompt dispatch (lesson/quiz/practice edit builders)                                                      | `ai/itemGenerate.ts:334-398`                  |
| `validateItemDraft(item, opts)`; practice branch: `parseExerciseNode` → `getCuratedWidget` check → schema check              | `ai/itemGenerate.ts` practice branch ~166-185 |
| Retry loop: 2 attempts, `appendValidationFeedback`, then `{ok:false, code:'item-retry-failed'}`                              | `ai/itemGenerate.ts:237-250,380-397`          |
| Prompt builders: `buildLessonAddPrompt(description, context)` etc. — `context` is last array element                         | `ai/prompts/itemAddPrompts.ts:6,28,55`        |
| Edit builders: `buildQuizEditPrompt(intent, currentContent, sourceOptionCount, context, params?)` etc.                       | `ai/prompts/itemEditPrompts.ts:65,122,152`    |
| `renderAuthoringContextBlock(ctx)` = full block (packs/concepts/objectives/activities/provenance) — course prompts only      | `ai/prompts/authoringContext.ts:3-40`         |
| `parseExerciseNode(content)` / `serializeExerciseNode` live in `studio/widgets/exerciseNode.ts:8,23`                         | cited above                                   |
| Client: `localStudioApi` posts `{kind, description}` / `{kind,intent,currentContent,params}`                                 | `localStudioApi.ts:182-196`                   |
| Client: `browserStudioApi` reads titles + `aiClient.generateItem({...})`                                                     | `browserStudioApi.ts:767-794`                 |
| Gateway `generateItem(body: unknown)` is pass-through                                                                        | `browserAiGateway.ts:34,129`                  |
| `StudioApi.generateItemAdd/Edit` signatures                                                                                  | `studioApi.ts:119-128`                        |
| UI callers: `AiAddDialog.tsx:76` (generateItemAdd), three activity editors (generateItemEdit), chat tools                    | see §1 L20/L22                                |
| AiAddDialog accept → parent `OutlineView.addAiDraft` → `api.writeFile(path, item.content)`                                   | `OutlineView.tsx:210,358`                     |

### Chat / agent-loop path (the parity target)

| Fact                                                                                                                               | Citation                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Deterministic `generate_course` branch ALREADY passes `authoring` + `locale` from `request.context.authoring`                      | `ai/agentLoop.ts:290-318` (esp. 302-303)                   |
| Deterministic `generate_item` / `edit_item` branches call `draftActivity` WITHOUT authoring                                        | `ai/agentLoop.ts:321-351,354-383`                          |
| Model-loop tool execute injects only `{signal, packageDir, completeText}`                                                          | `ai/agentLoop.ts:220-227`                                  |
| `GenerationToolContext extends ToolContext { packageDir?, completeText? }`                                                         | `ai/chat/toolCatalog.ts:29-32`                             |
| `generateCourseTool.execute` calls `generateCourseDraftTool` WITHOUT authoring/locale (parity bug vs deterministic branch)         | `ai/chat/toolCatalog.ts:44-57`                             |
| `generate_item` / `edit_item` catalog execute call `draftActivity` WITHOUT authoring                                               | `ai/chat/toolCatalog.ts:64-103`                            |
| `InMemoryToolRegistry()` default constructor seeds `companionToolCatalog` (handler uses `new InMemoryToolRegistry()`)              | `ai/toolRegistry.ts:8`; `chat/handler.ts:236`              |
| `draftActivity(request)` forwards kind/description/content/intent/params/packageDir only; `GenerateCourseRequest` HAS `authoring?` | `ai/chat/tools.ts:6-24,36-72,78-122`                       |
| `ToolCallRequest` has no authoring                                                                                                 | `ai/chat/tools.ts:6-14`                                    |
| `CompanionRequest.context` is a validated `StudioContextSnapshot` (carries `authoring?`)                                           | `packages/companion/src/request.ts:14`; `context.ts:76-78` |
| `RoutedTool` for items = `{kind, description}` / `{kind, intent, currentContent, params?}`                                         | `ai/chat/route.ts:5-15`                                    |

### Coverage / UI

| Fact                                                                                                                                                                                          | Citation                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `getPreviewPackage(): Promise<LoadedPackage \| null>` on the interface; browser impl loads OPFS, but the LOCAL impl is a `null` stub — DO NOT source package data from it                     | `studioApi.ts:91`; `browserStudioApi.ts:593`; `localStudioApi.ts:129`                 |
| Package data reaches `StudioApp` via the `loadedPackage` prop (fresh in both modes)                                                                                                           | `DevApp.tsx:16,87`; `browserPreview.tsx:45-97`; `vite.config.ts:405-421`              |
| `LoadedPackage { nodes: LoadedNode[]; provenance? }`; `LoadedNode { path, relativePath, content, node: ContentNode }`                                                                         | `packages/core/src/types.ts:11-33`                                                    |
| `PackBrowserPanel` props today: `{authoring, warnings, capabilityGaps}`; renders packs/concepts/objectives/provenance/truncation sections                                                     | `components/PackBrowserPanel.tsx:21-136`                                              |
| `openWithPreset({ message, prefill: true })` precedent for assistant presets                                                                                                                  | `PackSelectionPanel.tsx:102-108`                                                      |
| `outlineRevision` bumps ONLY via `onOutlineMutated → PackageSourcePane.onTreeChanged` (`OutlineWorkspace.tsx:112`); `OutlineView` never calls it                                              | `StudioApp.tsx:82,286`                                                                |
| i18n packs keys are FLAT dot-notation siblings (`"packs.selectionHeading"`), NOT a nested object; `t('studio.packs.X')` → namespace `studio`, dictKey `packs.X`; interpolation uses `{{var}}` | `packages/i18n/locales/en/studio.json:503`; `packages/i18n/src/engine.ts:26-28,52-62` |

---

## Phase 1 — Story 3.1: `authoringScope` on the reproduction record

**Commit:** `feat(schemas): add authoringScope to reproduction record`

**Files:** `packages/schemas/src/provenance.ts`, `provenance.test.ts`, `packages/schemas/src/index.ts`,
`apps/dev-server/src/studio/ai/provenance.ts`, `ai/provenance.test.ts`.

### 1.1 Test first — schemas

Add to `provenance.test.ts`:

```ts
import { AuthoringScopeSchema } from './provenance';

describe('AuthoringScopeSchema', () => {
  it('accepts a full scope', () => {
    const result = AuthoringScopeSchema.safeParse({
      curriculum: 'nios-math-level-a',
      unit: 'fractions',
      learner: 'neurotypical',
      locale: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('accepts curriculum only', () => {
    expect(AuthoringScopeSchema.safeParse({ curriculum: 'x' }).success).toBe(true);
  });

  it('rejects an empty curriculum', () => {
    expect(AuthoringScopeSchema.safeParse({ curriculum: '' }).success).toBe(false);
  });
});

describe('ReproductionRecordSchema authoringScope', () => {
  const valid = {
    schemaVersion: 1,
    packs: [],
    generatedAt: 'now',
    contextFingerprint: 'sha256:x',
    nodes: [],
  };

  it('accepts a record without authoringScope (back-compat)', () => {
    const result = ReproductionRecordSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.authoringScope).toBeUndefined();
  });

  it('round-trips a record with authoringScope', () => {
    const result = ReproductionRecordSchema.safeParse({
      ...valid,
      authoringScope: { curriculum: 'nios-math-level-a', unit: 'fractions' },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.authoringScope?.curriculum).toBe('nios-math-level-a');
  });
});
```

Run: `pnpm --filter @open-edu/schemas test` → fails (no `AuthoringScopeSchema`).

### 1.2 Implement — schemas

`packages/schemas/src/provenance.ts` — insert after `ReproductionNodeSchema`:

```ts
export const AuthoringScopeSchema = z.object({
  curriculum: z.string().min(1).max(300),
  unit: z.string().max(300).optional(),
  learner: z.string().max(100).optional(),
  locale: z.string().max(16).optional(),
});

export type AuthoringScope = z.infer<typeof AuthoringScopeSchema>;
```

Extend `ReproductionRecordSchema` (insert `authoringScope` between `contextFingerprint` and `nodes`):

```ts
export const ReproductionRecordSchema = z.object({
  schemaVersion: z.literal(1),
  packs: z.array(
    z.object({ id: z.string(), version: z.string(), type: z.enum(['knowledge', 'curriculum']) }),
  ),
  generatedAt: z.string(),
  contextFingerprint: z.string(),
  authoringScope: AuthoringScopeSchema.optional(),
  nodes: z.array(ReproductionNodeSchema),
});
```

`packages/schemas/src/index.ts` — extend the existing provenance export line:

```ts
export {
  ReproductionNodeSchema,
  ReproductionRecordSchema,
  AuthoringScopeSchema,
} from './provenance.js';
export type { ReproductionRecord, AuthoringScope } from './provenance.js';
```

(The existing line 90 `export type { ReproductionRecord }` merges into the above.)

Run schemas tests → green. Then `pnpm --filter @open-edu/schemas build`.

### 1.3 Test first — buildProvenance writes scope

Add to `ai/provenance.test.ts` (fixtures follow the existing `custom`/`model()` helpers in that file):

```ts
it('records authoringScope derived from the authoring context', () => {
  const { record } = buildProvenance(custom, model(), 'now');
  expect(record.authoringScope).toEqual({
    curriculum: 'nios-math-level-a',
    unit: 'fractions',
    learner: custom.learner,
    locale: custom.locale,
  });
});

it('omits authoringScope when no curriculum pack is selected', () => {
  const noCurriculum = {
    ...custom,
    packs: custom.packs.filter((p) => p.type !== 'curriculum'),
  };
  const { record } = buildProvenance(noCurriculum, model(), 'now');
  expect(record.authoringScope).toBeUndefined();
});
```

(`custom` in the existing test file already carries a curriculum pack named `nios-math-level-a`
and a `curriculumUnit: 'fractions'` — adjust the expectation to the fixture's actual
`learner`/`locale` values if they differ; the assertion shape stays.)

### 1.4 Implement — buildProvenance

`apps/dev-server/src/studio/ai/provenance.ts` — add the derivation helper and use it (no signature
change; L3):

```ts
import type { AuthoringScope } from '@open-edu/schemas';

function scopeFromContext(authoring: AuthoringContext): AuthoringScope | undefined {
  const curriculum = authoring.packs.find((p) => p.type === 'curriculum');
  if (!curriculum) return undefined;
  return {
    curriculum: curriculum.id,
    ...(authoring.curriculumUnit ? { unit: authoring.curriculumUnit } : {}),
    ...(authoring.learner ? { learner: authoring.learner } : {}),
    ...(authoring.locale ? { locale: authoring.locale } : {}),
  };
}
```

In the `record` literal inside `buildProvenance` (after `contextFingerprint`, before `nodes`):

```ts
...(scopeFromContext(authoring) ? { authoringScope: scopeFromContext(authoring) } : {}),
```

### 1.5 Verify

```bash
pnpm --filter @open-edu/schemas test && pnpm --filter @open-edu/schemas typecheck
pnpm --filter @open-edu/schemas build
pnpm --filter @open-edu/core test   # core parses provenance via the schema — must stay green
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
```

---

## Phase 2 — Story 3.2: isomorphic fingerprint

**Commit:** `feat(packs): make fingerprint isomorphic`

**Files:** `packages/packs/src/fingerprint.ts`, `packages/packs/src/fingerprint.test.ts` (extend;
create if the Phase 1 tests live elsewhere — find with
`rg -l fingerprintAuthoringContext packages/packs`).

### 2.1 Test first — known-answer vectors + stability

Add to the fingerprint tests:

```ts
import { createHash } from 'node:crypto';

describe('fingerprint isomorphism', () => {
  it('matches node:crypto sha256 for known vectors', async () => {
    const { sha256Hex } = await import('./fingerprint.js');
    for (const input of [
      '',
      'abc',
      'The quick brown fox jumps over the lazy dog',
      'x'.repeat(1000),
    ]) {
      const expected = createHash('sha256').update(input, 'utf8').digest('hex');
      expect(sha256Hex(input)).toBe(expected);
    }
  });

  it('produces the same fingerprint values as the pre-change implementation', () => {
    const ctx = {
      /* existing fingerprint test fixture */
    };
    // Recompute with the canonicalization + node:crypto directly:
    const expected = `sha256:${createHash('sha256')
      .update(canonicalizeContext(ctx as never), 'utf8')
      .digest('hex')}`;
    expect(fingerprintAuthoringContext(ctx as never)).toBe(expected);
  });
});
```

(`node:crypto` is fine in this test file — packs tests run under Vitest/Node. The production
module becomes pure.)

Run → fails (`sha256Hex` not exported / implementation still uses `node:crypto` — the KAT passes
by accident today; the explicit stability test pins the contract).

### 2.2 Implement

Replace the body of `packages/packs/src/fingerprint.ts`. Keep `stableStringify` and
`canonicalizeContext` EXACTLY as they are (`fingerprint.ts:3-19`). Replace the `node:crypto`
import and `fingerprintAuthoringContext` with:

```ts
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Pure-TS SHA-256 (FIPS 180-4). Identical digests to `node:crypto`, browser-safe (L14). */
export function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 8) >> 6) << 6) + 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join('');
}

export function fingerprintAuthoringContext(ctx: AuthoringContext): string {
  return `sha256:${sha256Hex(canonicalizeContext(ctx))}`;
}
```

Delete the `node:crypto` import. Do NOT change `package.json` (the `./fingerprint` subpath stays;
it is now pure, which is what lets Phase 7 import it from UI code — L14/L19).

### 2.3 Verify

```bash
pnpm --filter @open-edu/packs test && pnpm --filter @open-edu/packs typecheck
pnpm --filter @open-edu/packs build
pnpm --filter @open-edu/dev-server test   # provenance tests pin fingerprint values
```

---

## Phase 3 — Story 3.3: item grounding (server)

**Commit:** `feat(studio): ground item generation in authoring context`

**Files:** `ai/prompts/authoringContext.ts`, `ai/prompts/itemAddPrompts.ts`,
`ai/prompts/itemEditPrompts.ts`, `ai/itemGenerate.ts`, `ai/itemGenerate.test.ts`, `ai/middleware.ts`.

### 3.1 Test first — renderItemAuthoringSection

Add to a new or existing prompts test (create `ai/prompts/authoringContext.test.ts` if absent;
mirror the fixture style of `ai/provenance.test.ts`):

```ts
import { renderItemAuthoringSection } from './authoringContext.js';

it('renders a compact block with objectives and available activities', () => {
  const section = renderItemAuthoringSection(ctx); // ctx = test AuthoringContext fixture
  expect(section).toContain('AUTHORING CONTEXT');
  expect(section).toContain('requiresIntents');
  expect(section).toContain(ctx.availableActivities[0]!.id);
  expect(section).not.toContain('Provenance (packs'); // compact, not the full course block
});
```

### 3.2 Test first — prompts accept an optional section

In the prompts tests (extend `itemAddPrompts`/`itemEditPrompts` tests or create them):

```ts
it('inserts the authoring section above the course context when provided', () => {
  const prompt = buildLessonAddPrompt('Explain fractions', 'COURSE CONTEXT', 'AUTHORING CONTEXT…');
  const authIdx = prompt.indexOf('AUTHORING CONTEXT…');
  const ctxIdx = prompt.indexOf('COURSE CONTEXT');
  expect(authIdx).toBeGreaterThan(-1);
  expect(authIdx).toBeLessThan(ctxIdx);
});

it('produces the legacy prompt when no section is provided', () => {
  expect(buildLessonAddPrompt('Explain fractions', 'COURSE CONTEXT')).toBe(
    buildLessonAddPrompt('Explain fractions', 'COURSE CONTEXT', undefined),
  );
});
```

### 3.3 Test first — generateItemAdd/Edit grounding + whitelist

Extend `ai/itemGenerate.test.ts` (existing `vi.mock` harness for `studioLlm` + curated catalog):

```ts
describe('item grounding', () => {
  it('includes the authoring section in the prompt when authoring is provided', async () => {
    const completeText = vi.fn().mockResolvedValue('{"title":"T","markdown":"# T\\n\\nbody"}');
    vi.mocked(studioLlm.completeWithLlm).mockImplementation(completeText); // follow the file's existing mock wiring
    await generateItemAdd({
      kind: 'lesson',
      description: 'Explain fractions',
      packageDir,
      authoring: authoringFixture,
    });
    const prompt = completeText.mock.calls[0]![0] as string;
    expect(prompt).toContain('AUTHORING CONTEXT');
  });

  it('rejects a practice draft whose widget is outside availableActivities and retries', async () => {
    // completeWithLlm returns a practice draft with widget 'math.not-in-packs' on attempt 1
    // and a valid widget on attempt 2 → succeeds; assert attempt 2 prompt contains the
    // validation message. Then a permanently-bad mock → { ok: false, code: 'item-retry-failed' }.
  });

  it('does not apply the pack whitelist when availableActivities is empty', async () => {
    // authoring with availableActivities: [] — a widget in the curated catalog but not in
    // any pack list must still validate (back-compat, L10).
  });

  it('produces byte-identical prompts without authoring (back-compat)', async () => {
    // snapshot/compare the completeWithLlm prompt for a no-authoring request against the
    // pre-change expectation (or simply assert it does NOT contain 'AUTHORING CONTEXT').
  });
});
```

### 3.4 Test first — middleware passes authoring through

Extend `ai/middleware` tests (locate the existing item/add endpoint test with
`rg -n "item/add" apps/dev-server/src/studio`):

```ts
it('forwards a valid authoring body field to generateItemAdd', async () => {
  /* … */
});
it('400s on an invalid authoring body field', async () => {
  // POST /item/add with authoring: { packs: 'nope' } → 400 invalid-request
});
```

### 3.5 Implement — prompts

`ai/prompts/authoringContext.ts` — append:

```ts
export function renderItemAuthoringSection(ctx: AuthoringContext): string {
  const objectives = ctx.objectives
    .map((o) => `- ${o.id}: ${o.description} — requiresIntents: [${o.requiresIntents.join(', ')}]`)
    .join('\n');
  const activities = ctx.availableActivities
    .map((a) => `- ${a.id}${a.domain ? ` (${a.domain})` : ''}`)
    .join('\n');
  return [
    'AUTHORING CONTEXT (apply while drafting this item):',
    `Curriculum unit: ${ctx.curriculumUnit ?? '(none selected)'}`,
    `Learner profile: ${ctx.learner ?? '(none)'}`,
    `Locale: ${ctx.locale ?? 'en'}`,
    '',
    'Objectives:',
    objectives || '- (none)',
    '',
    'Available activities — practice widgets MUST use ONLY these ids:',
    activities || '- (none)',
  ].join('\n');
}
```

`ai/prompts/itemAddPrompts.ts` — each builder gains a trailing `authoringSection?: string` and
spreads it before the final `context` line. Example for `buildLessonAddPrompt` (same shape for
quiz and practice):

```ts
export function buildLessonAddPrompt(
  description: string,
  context: string,
  authoringSection?: string,
): string {
  return [
    // …existing lines unchanged…
    '- Write a complete, ready-to-learn lesson; keep it focused on the description.',
    '',
    ...(authoringSection ? [authoringSection, ''] : []),
    context,
  ].join('\n');
}
```

`ai/prompts/itemEditPrompts.ts` — same trailing-param treatment on all three builders, inserting
`...(authoringSection ? [authoringSection, ''] : [])` immediately before the final `context,` in
each returned array (both the add-questions and standard branches of `buildQuizEditPrompt`).

### 3.6 Implement — itemGenerate

`ai/itemGenerate.ts`:

1. Imports: `import { AuthoringContextSchema, type AuthoringContext } from '@open-edu/packs';`
   and `import { renderItemAuthoringSection } from './prompts/authoringContext.js';`
2. `ItemAddRequest` / `ItemEditRequest` gain `authoring?: AuthoringContext`.
3. `assertItemAddBody` return type + body gain authoring, parsed exactly as:

```ts
function parseAuthoring(value: unknown): AuthoringContext | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = AuthoringContextSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest('Invalid authoring context');
  return parsed.data;
}
```

`assertItemAddBody` has ONE return path — compute `const authoring = parseAuthoring(candidate.authoring);`
once, then add `...(authoring ? { authoring } : {})` to the returned object.

4. `assertItemEditBody` has **THREE** return paths — the translate branch
   (`itemGenerate.ts:462-470`), the difficulty branch (`:480-488`), and the generic branch
   (`:493-501`). Compute `const authoring = parseAuthoring(candidate.authoring);` once at the top
   of the function body (after the `kind`/`intent` validation), then add
   `...(authoring ? { authoring } : {})` to the object returned by **each of the three** paths.
   Extend both `candidate` casts with `authoring?: unknown` and both return types with
   `authoring?: AuthoringContext`.

5. In `generateItemAdd` and `generateItemEdit`:

```ts
const authoringSection = request.authoring
  ? renderItemAuthoringSection(request.authoring)
  : undefined;
const availableActivityIds =
  request.authoring && request.authoring.availableActivities.length > 0
    ? new Set(request.authoring.availableActivities.map((a) => a.id))
    : undefined;
```

Pass `authoringSection` as the new trailing argument to every prompt builder call. **`generateItemEdit`
also threads it through the add-questions short-circuit:** `generateQuizBatch` (`itemGenerate.ts:295-332`)
gains `authoringSection?: string` immediately after its `context` parameter and forwards it to
`buildQuizEditPrompt` at `:302`; the call at `:346-348` becomes
`generateQuizBatch(currentContent, context, authoringSection, params, signal)`. Extend
`validateItemDraft(item, { expectedOptionCount, availableActivityIds })` opts type with
`availableActivityIds?: ReadonlySet<string>`, and in the practice branch after the curated-catalog
check (`itemGenerate.ts:170-172`) insert:

```ts
if (opts.availableActivityIds && !opts.availableActivityIds.has(node.widget)) {
  return `Widget "${node.widget}" is not in the selected pack's available activities`;
}
```

### 3.7 Implement — middleware

`ai/middleware.ts` `/item/add` (line 249): destructure `authoring` from `assertItemAddBody` and
pass `...(authoring ? { authoring } : {})` into `generateItemAdd`. Same for `/item/edit` (line 269) with `generateItemEdit`. (The 400-on-invalid path is already handled: `invalidRequest`
throws `ItemRequestError`, caught at `middleware.ts:296-300`.)

### 3.8 Verify

```bash
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
pnpm lint:hardcoded-strings
```

---

## Phase 4 — Story 3.4: chat parity + objective-intent skill

**Commit:** `feat(studio): thread authoring through chat tools and objective-intent skill`

**Files:** `ai/chat/tools.ts` (+test), `ai/chat/toolCatalog.ts` (+test), `ai/agentLoop.ts` (+test),
`ai/skills/objective-intent.ts`, `ai/skills.test.ts`.

### 4.1 Test first

`ai/chat/tools.test.ts` (extend — existing mocks at lines 5-6):

```ts
it('forwards authoring from ToolCallRequest to generateItemAdd', async () => {
  const { draftActivity } = await import('./tools.js');
  const { generateItemAdd } = await import('../itemGenerate.js');
  await draftActivity({
    type: 'draft_new',
    kind: 'lesson',
    description: 'x',
    packageDir: '/pkg',
    authoring: authoringFixture,
  });
  expect(generateItemAdd).toHaveBeenCalledWith(
    expect.objectContaining({ authoring: authoringFixture }),
  );
});
```

`ai/chat/toolCatalog.test.ts` (extend):

```ts
it('generate_course forwards ctx.authoring and locale into generateCourseDraftTool', async () => {
  // execute the catalog tool with { completeText, authoring } ctx; assert the mocked
  // generateCourseDraftTool received authoring + locale: authoring.locale.
});
it('generate_item forwards ctx.authoring into draftActivity', async () => {
  /* … */
});
it('edit_item forwards ctx.authoring into draftActivity', async () => {
  /* … */
});
```

`ai/agentLoop.test.ts` (extend — recording tool harness already exists at lines 129+):

```ts
it('injects request.context.authoring into model-loop tool execution', async () => {
  // runAgentLoop with route = explain, a recording tool, request.context.authoring set;
  // assert tool.execute's ctx argument contains authoring.
});

it('passes request.context.authoring to draftActivity on the deterministic generate_item path', async () => {
  // mock chat/tools draftActivity; request.context.authoring set; assert called with authoring.
});
```

`ai/skills.test.ts` (extend):

```ts
it('objective-intent declares item tools', () => {
  const skill = objectiveIntentSkill;
  expect(skill.tools).toEqual(['generate_course', 'generate_item', 'edit_item']);
});
```

### 4.2 Implement

`ai/chat/tools.ts`:

- `ToolCallRequest` gains `authoring?: AuthoringContext` (type already imported at line 4).
- `draftActivity` forwards: `...(request.authoring ? { authoring: request.authoring } : {})`
  into both `generateItemAdd` and `generateItemEdit` calls.

`ai/chat/toolCatalog.ts`:

- `GenerationToolContext` gains `authoring?: AuthoringContext` (import type from `@open-edu/packs`).
- `generateCourseTool.execute` request literal (lines 49-53) becomes:

```ts
const result = await generateCourseDraftTool({
  notes: req.notes,
  packageDir: packageDirFrom(ctx),
  completeText: ctx.completeText,
  ...(ctx.authoring ? { authoring: ctx.authoring, locale: ctx.authoring.locale } : {}),
} satisfies GenerateCourseRequest);
```

- `generate_item` execute (lines 69-74) and `edit_item` execute (lines 92-99): add
  `...(ctx.authoring ? { authoring: ctx.authoring } : {})` to the `draftActivity` request literal.

`ai/agentLoop.ts`:

- Model-loop execute context (lines 220-227): add `authoring: request.context.authoring`.
- Deterministic `generate_item` (lines 328-333): add
  `...(request.context.authoring ? { authoring: request.context.authoring } : {})`.
- Deterministic `edit_item` (lines 361-368): same.

`ai/skills/objective-intent.ts`:

```ts
export const objectiveIntentSkill: CompanionSkill = {
  id: 'objective-intent',
  description:
    'Satisfy each curriculum objective with an activity whose learning intents cover its requiresIntents.',
  instructions:
    "For every objective in AUTHORING CONTEXT, emit activities whose learning intents (from the AVAILABLE ACTIVITIES table) cover ALL of the objective's requiresIntents — in one activity or together across the activities you emit. Use only activity ids listed under AVAILABLE ACTIVITIES. When drafting or editing a single activity (generate_item / edit_item), apply the same rule to that one activity: pick a widget or format whose learning intents cover the target objective's requiresIntents when the AUTHORING CONTEXT is present. When no combination of listed activities can cover an objective's intents, fall back to the closest listed reading, exercise, or reflection activity rather than inventing an id; the uncovered intents will be reported as a capability gap.",
  tools: ['generate_course', 'generate_item', 'edit_item'],
};
```

### 4.3 Verify

```bash
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
```

---

## Phase 5 — Story 3.5: client API + UI prop threading

**Commit:** `feat(studio): pass authoring into item generation from the UI`

**Files:** `studio/studioApi.ts`, `studio/localStudioApi.ts` (+test), `studio/browserStudioApi.ts`
(+test), `ai/StudioChatProvider.tsx`, `components/StudioAssistantChat.tsx` (+test),
`components/OutlineWorkspace.tsx`, `components/OutlineView.tsx` (+test),
`components/AiAddDialog.tsx` (+test), `components/ActivityEditorRouter.tsx`,
`components/LessonActivityEditor.tsx`, `components/QuizActivityEditor.tsx`,
`components/PracticeActivityEditor.tsx` (+tests), `studio/StudioApp.tsx`.

### 5.1 Test first

`localStudioApi.test.ts` (extend the existing body assertions at lines 95-145):

```ts
it('generateItemAdd includes authoring in the body when provided', async () => {
  await api.generateItemAdd('lesson', 'Explain fractions', { authoring: authoringFixture });
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/studio/ai/item/add',
    expect.objectContaining({
      body: JSON.stringify({
        kind: 'lesson',
        description: 'Explain fractions',
        authoring: authoringFixture,
      }),
    }),
  );
});

it('generateItemAdd omits authoring when absent (back-compat)', async () => {
  await api.generateItemAdd('lesson', 'Explain fractions');
  // body === JSON.stringify({ kind: 'lesson', description: 'Explain fractions' })
});
```

`browserStudioApi.test.ts` (extend the existing `aiClient.generateItem` assertions at lines
393-490): same two cases against the gateway body.

`StudioAssistantChat.test.tsx` / activity editor tests: assert the new optional `authoring` prop
is accepted and (where the test exercises a generate call) forwarded to
`api.generateItemAdd`/`generateItemEdit` options.

### 5.2 Implement — API

`studio/studioApi.ts` (lines 119-128):

```ts
generateItemAdd(
  kind: 'lesson' | 'quiz' | 'practice',
  description: string,
  options?: { authoring?: AuthoringContext },
): Promise<AiItemAddResult>;
generateItemEdit(
  kind: 'lesson' | 'quiz' | 'practice',
  intent: ItemIntent,
  currentContent: string,
  params?: ItemIntentParams,
  options?: { authoring?: AuthoringContext },
): Promise<AiItemEditResult>;
```

(`AuthoringContext` is already imported at `studioApi.ts:14`.)

`localStudioApi.ts` (lines 182-196):

```ts
generateItemAdd: (kind, description, options) =>
  aiRequest<AiItemAddResult>('/item/add', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      description,
      ...(options?.authoring ? { authoring: options.authoring } : {}),
    }),
  }),
generateItemEdit: (kind, intent, currentContent, params, options) =>
  aiRequest<AiItemEditResult>('/item/edit', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      intent,
      currentContent,
      params,
      ...(options?.authoring ? { authoring: options.authoring } : {}),
    }),
  }),
```

`browserStudioApi.ts` (lines 767-794): add the third/fifth `options` parameter; spread
`...(options?.authoring ? { authoring: options.authoring } : {})` into both `aiClient.generateItem`
bodies. (`browserAiGateway.generateItem(body: unknown)` needs no change.)

### 5.3 Implement — UI threading (L20)

1. `studio/StudioApp.tsx`:
   - `<StudioChatProvider … authoring={authoring}>` (line ~356 block).
   - `<ActivityEditorRouter … authoring={authoring}>` (line ~303 block).
2. `ai/StudioChatProvider.tsx`: new optional prop `authoring?: AuthoringContext | null`; pass it
   through to the chat component it renders (locate with
   `rg -n "StudioAssistantChat" apps/dev-server/src/studio/ai/StudioChatProvider.tsx`).
3. `components/StudioAssistantChat.tsx`: new optional prop `authoring`. In THIS phase thread it
   ONLY into already-typed call sites (any in-chat item generation —
   `rg -n "generateItem" components/StudioAssistantChat.tsx ai/StudioChatProvider.tsx`). Do NOT
   touch the `handleUseDraft` (lines 141-168) `applyDraft`/`applyDraftBatch` calls: those options
   do not exist yet and are wired in Phase 6 (§6.6) once `ApplyDraftOptions` gains `authoring`.
   This keeps the Phase 5 commit green.
   - Pass `authoring` to any in-chat item generation the provider invokes via
     `api.generateItemAdd`/`generateItemEdit` (search: `rg -n "generateItem" components/StudioAssistantChat.tsx ai/StudioChatProvider.tsx`).
4. `components/OutlineWorkspace.tsx`: accepts `authoring` already (line 32-48) — pass it to
   `OutlineView` and to the `PackBrowserPanel` it renders (line 118).
5. `components/OutlineView.tsx`: new optional `authoring` prop; pass to `AiAddDialog`
   (line 358) and to any `generateItemAdd`/`generateItemEdit` calls it makes (line ~168-210 area).
6. `components/AiAddDialog.tsx`: new optional `authoring` prop; line 76 becomes
   `api.generateItemAdd(kind, description.trim(), authoring ? { authoring } : undefined)`.
7. `components/ActivityEditorRouter.tsx` → `LessonActivityEditor` / `QuizActivityEditor` /
   `PracticeActivityEditor`: new optional `authoring` prop on the router and each editor; each
   editor's `generateItemEdit` call passes
   `params, authoring ? { authoring } : undefined`.

### 5.4 Verify

```bash
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
pnpm lint:hardcoded-strings
```

---

## Phase 6 — Story 3.6: provenance merge on AI item apply

**Commit:** `feat(studio): refresh provenance on AI item apply`

**Files:** new `ai/objectiveMatch.ts` + `ai/objectiveMatch.test.ts`, new `ai/provenanceRefresh.ts` +
`ai/provenanceRefresh.test.ts`, `ai/provenance.ts` (import the shared normalizer; keep the course
matcher), `ai/applyDraft.ts` (+test), `components/OutlineView.tsx`, three activity editors
(+tests).

### 6.1 Test first — matchAuthoringObjectives

New `ai/objectiveMatch.test.ts` (define a local `custom` authoring fixture with two objectives,
ids `represent-fraction` / `compare-fractions`):

```ts
import { matchAuthoringObjectives } from './objectiveMatch.js';

it('matches an objective by substring of the normalized text', () => {
  const matches = matchAuthoringObjectives(custom, 'Let us practice Represent fractions visually');
  expect(matches.map((m) => m.id)).toContain('represent-fraction');
});

it('returns ALL matches deduped by id (substring matches are not dropped when an exact exists)', () => {
  const matches = matchAuthoringObjectives(
    custom,
    'Represent fractions visually and compare fractions',
  );
  const ids = matches.map((m) => m.id);
  expect(ids).toContain('represent-fraction');
  expect(ids).toContain('compare-fractions');
  expect(new Set(ids).size).toBe(ids.length);
});

it('returns [] for text matching no objective (no index fallback)', () => {
  expect(matchAuthoringObjectives(custom, 'unrelated text with no objective words')).toEqual([]);
});
```

### 6.2 Test first — merge helper

`ai/provenanceRefresh.test.ts` (pure tests + a mock `StudioApi` for the refresh wrapper). Define
the fixtures up front:

```ts
import { mergeAppliedItem, refreshProvenanceAfterApply } from './provenanceRefresh.js';

const entry = {
  path: 'nodes/p1.json',
  objectives: ['represent-fraction'],
  concepts: [],
  widgets: ['core.multiple-choice'],
  capabilityGaps: [],
};
const applied = [
  {
    path: 'nodes/p1.json',
    title: 'Represent fractions',
    content: '{"widget":"core.multiple-choice"}',
  },
];
const mockApi = (overrides: Partial<StudioApi> = {}): StudioApi =>
  ({
    readFile: async () => ({ content: JSON.stringify(VALID_RECORD) }),
    writeFile: async () => ({ success: true }),
    ...overrides,
  }) as never;

describe('mergeAppliedItem', () => {
  it('upserts by path and preserves packs/scope/fingerprint', () => {
    /* VALID_RECORD + entry for an existing path → replaced, other nodes intact */
  });
  it('appends a new node when the path is unknown', () => {
    /* VALID_RECORD + entry for a new path → appended */
  });
  it('creates a fresh record when record is null and authoring is provided', () => {
    // assert packs/fingerprint/authoringScope derived per L3/L6
  });
  it('returns null when record is null and authoring is null (no-op)', () => {
    expect(mergeAppliedItem(null, entry, 'now', null)).toBeNull();
  });
});

describe('refreshProvenanceAfterApply', () => {
  it('reads the current record via api.readFile and writes the merged record', async () => {
    // mockApi: readFile('provenance.json') → { content: JSON.stringify(VALID_RECORD) }; writeFile spy
    // authoring fixture with an objective whose description matches the applied draft title
    // assert writeFile called with 'provenance.json' and the upserted node (objectives inferred)
  });
  it('treats a missing provenance.json as no record', async () => {
    // readFile rejects → with authoring a fresh record is written; without authoring, no write
  });
  it('never throws when writeFile rejects (advisory)', async () => {
    await expect(refreshProvenanceAfterApply(mockApi(), applied, null)).resolves.toBeUndefined();
  });
  it('no-ops without a record and without authoring', async () => {
    // readFile rejects; assert writeFile NOT called
  });
});
```

### 6.3 Test first — applyDraft call sites

Extend `ai/applyDraft.test.ts`:

```ts
it('refreshes provenance after a successful file apply', async () => {
  // spy on provenanceRefresh.refreshProvenanceAfterApply (vi.mock the module);
  // applyDraft(api, draft, { mode: 'file', authoring }) → called with [{ path, content }], authoring
});

it('skips the refresh for buffer applies', async () => {
  /* mode: 'buffer' */
});

it('batch applies one refresh with all paths', async () => {
  /* applyDraftBatch */
});
```

### 6.4 Implement — the shared pure matcher

New `ai/objectiveMatch.ts` (browser-safe: one **type-only** import, erased at build — no runtime
dependency on `@open-edu/packs`):

```ts
import type { AuthoringContext } from '@open-edu/packs';

export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function matchAuthoringObjectives(
  authoring: AuthoringContext,
  text: string,
): AuthoringContext['objectives'] {
  const norm = normalizeDescription(text);
  if (!norm) return [];
  const seen = new Set<string>();
  const out: AuthoringContext['objectives'] = [];
  for (const objective of authoring.objectives) {
    const objectiveNorm = normalizeDescription(objective.description);
    if (!objectiveNorm) continue;
    if (
      !seen.has(objective.id) &&
      (norm === objectiveNorm || norm.includes(objectiveNorm) || objectiveNorm.includes(norm))
    ) {
      seen.add(objective.id);
      out.push(objective);
    }
  }
  return out;
}
```

`ai/provenance.ts` — **move** `normalizeDescription` (`:28-33`) out: delete the local copy and add
`import { normalizeDescription } from './objectiveMatch.js';`. Keep `matchLessonObjective`
(`:35-52`) and its index fallback unchanged (course path semantics must not shift). Do NOT export
`matchAuthoringObjectives` from `provenance.ts`.

### 6.5 Implement — merge + refresh

New `ai/provenanceRefresh.ts` (browser-safe, L5):

```ts
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
    // Advisory (L4): provenance refresh never fails the apply.
  }
}
```

The record is read fresh from `provenance.json` via `api.readFile` (works in both modes — local
reads disk, browser reads OPFS) — NOT from `api.getPreviewPackage()`, which is a `null` stub in
local mode (`localStudioApi.ts:129`).

### 6.6 Implement — call sites (L21/L22)

`ai/applyDraft.ts`:

- `ApplyDraftOptions` gains `authoring?: AuthoringContext | null`.
- `applyDraftBatch(api, drafts, options?: { authoring?: AuthoringContext | null })` — add the
  optional third parameter.
- In `applyDraftToFile` (after `appendToOutline`, line ~69) and `applyDraftBatch` (after
  `appendToOutline`, line ~51):

```ts
void refreshProvenanceAfterApply(
  api,
  drafts.map((d) => ({ path: /* the applied path(s) */, title: d.title, content: d.content })),
  options.authoring ?? null,
);
```

(Batch: map over `changeSet.changes` paths paired with draft contents.)

`components/OutlineView.tsx` — in `addAiDraft` after the successful `writeFile` (line ~210):

```ts
void refreshProvenanceAfterApply(
  api,
  [{ path, title: item.title, content: item.content }],
  authoring ?? null,
);
```

`components/LessonActivityEditor.tsx` (after line ~101), `QuizActivityEditor.tsx` (after ~154),
`PracticeActivityEditor.tsx` (after ~211): same one-liner with the editor's `path`/saved content
and the editor's `authoring` prop (from Phase 5).

### 6.7 Verify

```bash
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
```

---

## Phase 7 — Story 3.7: restore via provenance + drift display

**Commit:** `feat(studio): restore authoring context from provenance`

**Files:** new `studio/packs/authoringRestore.ts` + `.test.ts`, `studio/StudioApp.tsx` (+test),
`components/OutlineWorkspace.tsx`, `components/PackBrowserPanel.tsx` (+test),
`packages/i18n/locales/en/studio.json`.

### 7.1 i18n keys (add first — lint enforces)

`packages/i18n/locales/en/studio.json` — add THREE FLAT sibling keys (the file is flat
dot-notation; do NOT create a nested `packs` object — the existing `"packs.selectionHeading"` at
line 503 is the pattern):

```json
"packs.restoredFromProvenance": "Authoring context restored from course provenance",
"packs.driftPackVersion": "{{pack}}: recorded {{recorded}}, current {{current}}",
"packs.driftFingerprint": "Pack content has changed since this course was generated (context fingerprint differs)"
```

Interpolation uses DOUBLE braces (`{{var}}`) — see `packages/i18n/src/engine.ts` `interpolate`.

### 7.2 Test first — drift helper

`studio/packs/authoringRestore.test.ts`:

```ts
import { computeAuthoringDrift } from './authoringRestore.js';

it('reports version diffs for packs that changed version', () => {
  const record = {
    schemaVersion: 1,
    packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
    generatedAt: 'now',
    contextFingerprint: 'sha256:a',
    authoringScope: { curriculum: 'nios-math-level-a' },
    nodes: [],
  };
  const context = {
    ...authoringFixture,
    packs: [{ id: 'nios-math-level-a', version: '0.2.0', type: 'curriculum' }],
  };
  const drift = computeAuthoringDrift(record as never, context);
  expect(drift.packDiffs).toEqual([
    { id: 'nios-math-level-a', recorded: '0.1.0', current: '0.2.0' },
  ]);
  expect(drift.fingerprintChanged).toBe(true); // versions differ ⇒ canonical form differs
});

it('reports no drift for identical packs and fingerprint', () => {
  /* … */
});
```

### 7.3 Test first — StudioApp restore

`studio/StudioApp.test.tsx` (extend the existing mocked-api harness):

```ts
it('restores authoring from provenance on course open when no selection is stored', async () => {
  // render StudioApp with loadedPackage={{ provenance: RECORD_WITH_SCOPE }};
  // api.setAuthoringSelection → { context, warnings: [] };
  // assert setAuthoringSelection called with the scope; Packs panel shows the restored banner.
});

it('skips restore when a stored pack selection exists', async () => {
  /* writeStoredPackAuthoring first */
});

it('surfaces pack version drift in the Packs panel', async () => {
  /* version-mismatched record */
});
```

### 7.4 Implement — drift helper

New `studio/packs/authoringRestore.ts`:

```ts
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
```

### 7.5 Implement — StudioApp restore effect (L15)

In `studio/StudioApp.tsx`, alongside the existing state (line ~93):

```ts
const [authoringDrift, setAuthoringDrift] = useState<AuthoringDrift | null>(null);
const [restoredFromProvenance, setRestoredFromProvenance] = useState(false);
const authoringRef = useRef<AuthoringContext | null>(authoring);
authoringRef.current = authoring;
const restoredCourseKeyRef = useRef<string | null>(null);
```

New effect, declared AFTER the existing `nextAuthoringScope` effect (line ~118). It reads the
record from the `loadedPackage` PROP (NOT `api.getPreviewPackage()`):

```ts
useEffect(() => {
  if (courseKey === null) return;
  if (restoredCourseKeyRef.current === courseKey) return;
  restoredCourseKeyRef.current = courseKey;
  if (readStoredPackAuthoring()) return; // explicit selection wins (L15)
  const record = loadedPackage?.provenance;
  const scope = record?.authoringScope;
  if (!record || !scope) return;
  let cancelled = false;
  void (async () => {
    try {
      const { context, warnings } = await api.setAuthoringSelection({
        curriculum: scope.curriculum,
        unit: scope.unit,
        learner: scope.learner,
        locale: scope.locale,
      });
      if (cancelled || authoringRef.current !== null) return;
      setAuthoring(context);
      setAuthoringWarnings(warnings);
      setAuthoringDrift(computeAuthoringDrift(record, context));
      setRestoredFromProvenance(true);
    } catch {
      // Advisory: an unresolvable scope leaves the context unselected.
    }
  })();
  return () => {
    cancelled = true;
  };
}, [courseKey, api, loadedPackage]);
```

Also: in the existing course-switch clear path (lines 114-117), add
`setAuthoringDrift(null); setRestoredFromProvenance(false);` so switching courses resets drift.

### 7.6 Implement — Packs tab banner

`components/PackBrowserPanel.tsx` — new optional props:

```ts
restored?: boolean;
drift?: AuthoringDrift | null;
```

Render at the top of the panel (before the packs section), only when `restored`:

```tsx
{
  restored ? (
    <div role="status" className="...">
      <p>{t('studio.packs.restoredFromProvenance')}</p>
      {drift?.packDiffs.map((d) => (
        <p key={d.id}>
          {t('studio.packs.driftPackVersion', {
            pack: d.id,
            recorded: d.recorded,
            current: d.current,
          })}
        </p>
      ))}
      {drift?.fingerprintChanged ? <p>{t('studio.packs.driftFingerprint')}</p> : null}
    </div>
  ) : null;
}
```

Styling: Tailwind utilities + tokens only, e.g.
`className="border-outline-variant bg-surface-container-high text-on-surface rounded-lg border px-4 py-3 text-sm"`
(mirror the storage-notice pattern at `StudioApp.tsx:389-396`). No inline styles.

`components/OutlineWorkspace.tsx` — accept `authoringDrift` + `restoredFromProvenance` props from
StudioApp and forward to `PackBrowserPanel` (line ~118). `studio/StudioApp.tsx` — pass both on the
`<OutlineWorkspace>` at line ~295.

### 7.7 Verify

```bash
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
pnpm lint:hardcoded-strings
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
```

(Fold the regenerated `tailwind.css` into this commit.)

---

## Phase 8 — Story 3.8: live coverage + remediation chips

**Commit 8a:** `feat(packs): add computeObjectiveCoverage`
**Commit 8b:** `feat(studio): live objective coverage with remediation chips`

**Files:** new `packages/packs/src/coverage.ts` + `coverage.test.ts`, `packages/packs/src/index.ts`,
new `studio/packs/coverageFromPackage.ts` + `.test.ts`, `studio/StudioApp.tsx` (+test),
`components/OutlineWorkspace.tsx`, `components/PackBrowserPanel.tsx` (+test),
`packages/i18n/locales/en/studio.json`, regenerated `apps/dev-server/src/tailwind.css`.

### 8.1 (8a) Test first — coverage

`packages/packs/src/coverage.test.ts`:

```ts
import { computeObjectiveCoverage } from './coverage.js';

const authoring = {
  ...baseAuthoringFixture, // packs/availableActivities/objectives fixtures — reuse resolve.test.ts style
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent fractions visually',
      concepts: [],
      requiresIntents: ['understand', 'analyze'],
    },
    {
      id: 'compare-fraction',
      description: 'Compare fractions',
      concepts: [],
      requiresIntents: ['evaluate'],
    },
  ],
  availableActivities: [
    {
      id: 'a.visual',
      name: 'Visual',
      domain: '',
      intents: ['understand', 'analyze'],
      subjectTags: [],
    },
    { id: 'b.compare', name: 'Compare', domain: '', intents: ['evaluate'], subjectTags: [] },
  ],
};

it('marks an objective covered when the UNION of emitted intents covers requiresIntents', () => {
  // lessons emit a.visual and b.compare together → BOTH objectives covered
  // (union semantics — per-activity all-of is NOT required; this pins check-2 parity)
});

it('marks an objective uncovered with an empty satisfiedBy when no emitted widget contributes', () => {
  const result = computeObjectiveCoverage(authoring, [{ id: 'l1', widgetIds: ['a.visual'] }]);
  expect(result.find((r) => r.id === 'compare-fraction')).toEqual({
    id: 'compare-fraction',
    description: 'Compare fractions',
    requiresIntents: ['evaluate'],
    covered: false,
    satisfiedBy: [],
  });
});

it('ignores emitted widgets that are not in availableActivities', () => {
  /* … */
});

it('returns an entry per objective in context order', () => {
  /* … */
});
```

### 8.2 (8a) Implement

New `packages/packs/src/coverage.ts`:

```ts
import type { AuthoringContext } from './context.js';

export interface ObjectiveCoverage {
  id: string;
  description: string;
  requiresIntents: string[];
  covered: boolean;
  satisfiedBy: string[];
}

export function computeObjectiveCoverage(
  authoring: AuthoringContext,
  lessons: Array<{ id: string; widgetIds: string[] }>,
): ObjectiveCoverage[] {
  const available = new Map(authoring.availableActivities.map((a) => [a.id, a]));
  const contributing = new Map<string, Set<string>>();
  for (const lesson of lessons) {
    for (const widgetId of lesson.widgetIds) {
      const activity = available.get(widgetId);
      if (!activity) continue;
      for (const intent of activity.intents) {
        if (!contributing.has(intent)) contributing.set(intent, new Set());
        contributing.get(intent)!.add(widgetId);
      }
    }
  }
  return authoring.objectives.map((objective) => {
    const satisfiedBy = new Set<string>();
    let covered = true;
    for (const intent of objective.requiresIntents) {
      const ids = contributing.get(intent);
      if (!ids || ids.size === 0) {
        covered = false;
        continue;
      }
      for (const id of ids) satisfiedBy.add(id);
    }
    return {
      id: objective.id,
      description: objective.description,
      requiresIntents: [...objective.requiresIntents],
      covered,
      satisfiedBy: [...satisfiedBy],
    };
  });
}
```

`packages/packs/src/index.ts` — add `export * from './coverage.js';` after the blueprint export.

Verify 8a:

```bash
pnpm --filter @open-edu/packs test && pnpm --filter @open-edu/packs typecheck
pnpm --filter @open-edu/packs build
```

### 8.3 (8b) Test first — dev-server extraction + UI

`studio/packs/coverageFromPackage.test.ts`:

```ts
import { coverageFromPackage } from './coverageFromPackage.js';

it('extracts practice widget ids via parseExerciseNode and computes coverage', () => {
  const pkg = {
    nodes: [
      {
        relativePath: 'nodes/p1.json',
        content: JSON.stringify({ type: 'exercise', widget: 'a.visual', config: {} }),
        node: { type: 'exercise' },
      },
      { relativePath: 'nodes/l1.md', content: '# Lesson', node: { type: 'lesson' } },
    ],
  };
  const result = coverageFromPackage(pkg as never, authoringFixture);
  expect(result.find((r) => r.id === 'represent-fraction')?.covered).toBe(true);
});

it('returns [] without authoring or with zero objectives', () => {
  /* … */
});
```

`components/PackBrowserPanel.test.tsx` (extend):

```ts
it('renders one row per objective with covered status', () => {
  render(wrap(<PackBrowserPanel authoring={authoring} warnings={[]} capabilityGaps={[]} coverage={coverageFixture} />));
  expect(screen.getByText('Represent fractions visually')).toBeInTheDocument();
  expect(screen.getByText('studio.packs.coverageCovered' as never)).toBeInTheDocument(); // or the translated string
});

it('offers a generate chip for uncovered objectives and presets the assistant', () => {
  // uncovered fixture → chip clicked → openWithPreset mocked with prefill: true and the
  // objective description in the message
});

it('shows the empty-state hint without authoring', () => { /* coverageNone */ });
```

### 8.4 (8b) i18n keys

`packages/i18n/locales/en/studio.json` — add SIX FLAT sibling keys (flat dot-notation, same as
§7.1; NOT nested):

```json
"packs.coverageHeading": "Objective coverage",
"packs.coverageCovered": "Covered",
"packs.coverageUncovered": "Not yet covered",
"packs.generateActivityChip": "Generate activity",
"packs.coveragePreset": "Draft an activity that satisfies this objective: {{description}}. Required intents: {{intents}}.",
"packs.coverageNone": "Select a curriculum pack to see objective coverage."
```

Interpolation uses DOUBLE braces (`{{var}}`).

### 8.5 (8b) Implement — extraction helper

New `studio/packs/coverageFromPackage.ts`:

```ts
import type { LoadedPackage } from '@open-edu/core';
import { computeObjectiveCoverage, type ObjectiveCoverage } from '@open-edu/packs';
import type { AuthoringContext } from '@open-edu/packs';
import { parseExerciseNode } from '../widgets/exerciseNode.js';

export function coverageFromPackage(
  pkg: LoadedPackage | null,
  authoring: AuthoringContext | null,
): ObjectiveCoverage[] {
  if (!authoring || authoring.objectives.length === 0) return [];
  const lessons = (pkg?.nodes ?? []).map((n) => {
    const exercise = parseExerciseNode(n.content);
    return { id: n.relativePath, widgetIds: exercise?.widget ? [exercise.widget] : [] };
  });
  return computeObjectiveCoverage(authoring, lessons);
}
```

### 8.6 (8b) Implement — StudioApp coverage state

In `studio/StudioApp.tsx` (add `useMemo` to the React import if absent) — derive coverage
synchronously from the `loadedPackage` PROP (NOT `api.getPreviewPackage()`, a `null` stub in local
mode). No state/effect needed:

```ts
const coverage = useMemo(
  () => coverageFromPackage(loadedPackage, authoring),
  [loadedPackage, authoring],
);
```

`coverageFromPackage` is pure/sync (§8.5). Recompute triggers = `loadedPackage` identity or
`authoring` identity changes. The prop is refreshed after every mutation in both modes (local:
package-dir watcher `full-reload` — `vite.config.ts:405-421`; browser: `onPackageChanged →
reloadPreview` — `browserPreview.tsx:92`), so coverage updates after AI applies, manual edits,
reorders, and course switches. `outlineRevision`/`capabilityGaps` are NOT dependencies.

Pass `coverage={coverage}` to `OutlineWorkspace` (line ~295); thread through to
`PackBrowserPanel`.

### 8.7 (8b) Implement — Packs tab section + chips

`components/PackBrowserPanel.tsx` — new optional prop `coverage?: ObjectiveCoverage[]`. Render a
section after the objectives section (line ~80-104 area), only when `authoring?.objectives.length`:

```tsx
<section aria-label={t('studio.packs.coverageHeading')}>
  <h3 className="text-on-surface text-sm font-semibold">{t('studio.packs.coverageHeading')}</h3>
  {coverage.map((row) => (
    <div key={row.id} className="flex items-center justify-between gap-2">
      <div>
        <p className="text-on-surface text-sm">{row.description}</p>
        <p role="status" className="text-on-surface-variant text-xs">
          {row.covered ? t('studio.packs.coverageCovered') : t('studio.packs.coverageUncovered')}
        </p>
        {row.satisfiedBy.length > 0 ? (
          <p className="text-on-surface-variant text-xs">{row.satisfiedBy.join(', ')}</p>
        ) : null}
      </div>
      {!row.covered ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openWithPreset({
              message: t('studio.packs.coveragePreset', {
                description: row.description,
                intents: row.requiresIntents.join(', '),
              }),
              prefill: true,
            })
          }
        >
          {t('studio.packs.generateActivityChip')}
        </Button>
      ) : null}
    </div>
  ))}
</section>
```

`openWithPreset` comes from `useStudioAssistant()` — the exact precedent of
`PackSelectionPanel.tsx:32,102-108`. When `coverage` is empty AND authoring is null, render the
`coverageNone` hint instead of the section.

### 8.8 Verify

```bash
pnpm --filter @open-edu/packs test && pnpm --filter @open-edu/packs build
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
pnpm lint:hardcoded-strings
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
```

(Fold regenerated `tailwind.css` into commit 8b.)

---

## Phase 9 — Story 3.9: close-out verification

**Commit (if any residual changes):** none expected; verification only.

### 9.1 Full loop

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
```

All must be green. If `pnpm format:check` fails, run `pnpm format` and amend nothing — make a
follow-up `style:` commit only if needed (prefer fixing the authored files directly before the
first push).

### 9.2 Manual smoke (Studio)

```bash
pnpm --filter @open-edu/cli build
OPEN_EDU_PACKS_DIR=examples/packs node packages/cli/dist/cli.js dev ./examples/hello-world
```

Check, in order:

1. Packs tab lists the fixture packs; selecting `nios-math-level-a` / a unit applies the context
   (existing Phase 1 behavior).
2. Generate a course draft from the assistant with the selection active → commit →
   `provenance.json` exists and contains `authoringScope` + `packs` + `nodes`.
3. Ask the assistant to "add a lesson about …" → Use Draft → reopen `provenance.json`: the new
   node path is present (merge worked); `packs`/`authoringScope`/`contextFingerprint` unchanged.
4. Close and reopen the course from the library → Packs tab shows the restored banner; coverage
   rows render; an uncovered objective shows the Generate activity chip; clicking it presets the
   assistant.
5. With no packs selected anywhere (fresh course, no provenance), run the same item flows →
   behavior identical to Phase 1 (no authoring section in prompts, no provenance writes).

### 9.3 PR checklist (AGENTS.md)

- [ ] `pnpm build && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` all green
- [ ] Conventional commits, one per phase (10 commits total across Phases 1–8)
- [ ] No new dependencies; no hand-edits to generated files
- [ ] Every new user-facing string has an i18n key in `packages/i18n/locales/en/studio.json`
- [ ] axe-relevant additions: banner uses `role="status"`; coverage section has `aria-label`;
      chips are real `<Button>`s (keyboard-reachable)
- [ ] Back-compat tests present in Phases 1, 2, 3, 4, 5 (no-authoring byte-identical behavior)
- [ ] Spec §27/§28 Phase 3 rows match what shipped; OQ4 answer accurate

---

## Exit criteria

Phase 3 is done when:

1. All Phase 3 acceptance criteria in spec §28 are satisfied by tests in this repo.
2. The manual smoke (§9.2) passes end-to-end in creator mode.
3. The full verification loop (§9.1) is green.
4. No behavior change is observable for courses/requests without packs (the byte-identical
   back-compat tests are the enforcement mechanism, not a review convention).
