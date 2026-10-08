# OpenEdu Pack System — Phase 1 Packs (Agent Execution Plan)

> **For the implementing agent (deepseek-4-flash).** This is a turn-key, prescriptive plan for
> Phase 1 (stories 1.1–1.13) of the Pack System spec, plus the three PR #622 follow-ups. It
> resolves every ambiguity, pre-decides every file, embeds every schema/skill/prompt string, and
> lists each test and verification command. Follow the phases in order; do NOT improvise.
>
> - Spec: `docs/OPENEDU-PACK-SYSTEM.md` (v0.3) — read §7, §8, §9, §10, §13, §14, §16, §17, §18,
>   §19, §20, §21, §22, §23, §25, §27, §28 before starting. Everything below encodes those sections.
> - Repo rules: `AGENTS.md` (read it). This plan already encodes the AGENTS.md constraints
>   (schemas-are-source-of-truth, i18n, no inline styles, subpath exports for Node ESM, one story
>   per commit, conventional commits).
> - **Scope is Phase 1 only.** Do NOT create `open-edu-pipeline` ingestion, NIOS/EVS reference
>   packs, profile→widget filtering, `.oep` pack archives, or pack authoring UI (§29).
> - Every fact in §2 was verified against the code on this branch. Cite them; do not re-derive.

---

## 0. Environment & non-negotiables

### 0.1 What you will touch (only this)

| Area                    | Files                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Follow-up 1 (skill doc) | `skills/openedu-course-authoring/references/repository-adapter.md`                                                                                                                                                                                                                                                                                                                   |
| Follow-up 2 (OpenWiki)  | `openwiki/quickstart.md`, `openwiki/architecture/overview.md`, `openwiki/domain/content-and-workflows.md`, `openwiki/operations/testing-and-changes.md`                                                                                                                                                                                                                              |
| Follow-up 3 (tailwind)  | `apps/dev-server/src/tailwind.css` (regenerated, not hand-edited)                                                                                                                                                                                                                                                                                                                    |
| i18n (subpath)          | `packages/i18n/package.json` (add `./locale`)                                                                                                                                                                                                                                                                                                                                        |
| Widgets (subpaths)      | `packages/widgets/package.json`, new `packages/widgets/src/search-filter.ts`, `packages/widgets/src/registry.ts`                                                                                                                                                                                                                                                                     |
| Packs (new package)     | `packages/packs/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `src/**` (incl. new `src/pack-info.ts` in Phase 3)                                                                                                                                                                                                                                        |
| Fixtures (new)          | `examples/packs/knowledge/openedu-fractions/**`, `examples/packs/curriculum/nios-math-level-a/**`                                                                                                                                                                                                                                                                                    |
| Companion               | `packages/companion/src/context.ts`, new `packages/companion/src/context.test.ts`, `packages/companion/src/types.ts` (add `'invalid-blueprint'` to `AiGenerateErrorCode`, Phase 10), `packages/companion/package.json`                                                                                                                                                               |
| Dev-server (API)        | `apps/dev-server/src/studio/studioApi.ts`, `localStudioApi.ts`, `browserStudioApi.ts`, `studioApi.contract.test.ts`, `browserStudioApi.test.ts`, new `apps/dev-server/src/studio/packs/**`                                                                                                                                                                                           |
| Dev-server (vite)       | `apps/dev-server/vite.config.ts`, `apps/dev-server/vitest.config.ts`, `apps/dev-server/src/env.d.ts`                                                                                                                                                                                                                                                                                 |
| Dev-server (UI)         | `apps/dev-server/src/studio/StudioApp.tsx`, `components/HomeView.tsx`, `components/OutlineWorkspace.tsx`, `components/StudioAssistantChat.tsx`, `apps/dev-server/src/studio/studioSession.ts` (`OutlineTab`), new `components/PackSelectionPanel.tsx`, new `components/PackBrowserPanel.tsx`, new tests                                                                              |
| Dev-server (AI)         | `ai/generateCourse.ts`, `ai/generateCoursePackage.ts`, `ai/commitCourseDraft.ts`, `ai/middleware.ts`, `ai/prompts/coursePrompt.ts`, new `ai/prompts/authoringContext.ts`, `ai/chat/policy.ts`, `ai/chat/tools.ts`, `ai/agentLoop.ts`, `ai/StudioContextBridge.tsx`, `ai/skills/resolveSkills.ts`, `ai/skillRegistry.ts`, new `ai/skills/objective-intent.ts`, new `ai/provenance.ts` |
| Schemas                 | new `packages/schemas/src/provenance.ts`, `packages/schemas/src/index.ts`                                                                                                                                                                                                                                                                                                            |
| Core                    | `packages/core/src/file-loader.ts`, `packages/core/src/types.ts`, new `packages/core/src/provenance.ts`, `packages/core/src/index.ts`                                                                                                                                                                                                                                                |
| CLI                     | new `packages/cli/src/commands/pack.ts`, `packages/cli/src/cli.ts`, `packages/cli/package.json`                                                                                                                                                                                                                                                                                      |
| Course-compiler         | `packages/course-compiler/src/parser/json-input.ts`                                                                                                                                                                                                                                                                                                                                  |
| Domain-guidance         | `packages/domain-guidance/src/generate.ts` (+ regenerate `artifact-contract.json` via `pnpm --filter @open-edu/domain-guidance generate`)                                                                                                                                                                                                                                            |
| i18n strings            | `packages/i18n/locales/en/studio.json` (new `packs.*` + `outline.tabPacks` keys)                                                                                                                                                                                                                                                                                                     |
| E2E                     | `playwright.config.ts`, new `tests/e2e/pack-selection.spec.ts`                                                                                                                                                                                                                                                                                                                       |

**Do NOT modify** (unless the table above whitelists it): `packages/runtime/**`, `packages/design-system/**`,
`apps/learner/**`, `apps/docs/**`, `packages/i18n/src/**` (except nothing — the `./locale` subpath is a
package.json-only change), the runtime theme system, `packages/widgets/src/builtins/**`, the spec
(`docs/OPENEDU-PACK-SYSTEM.md`), any other plan file, `.gitignore` (already staged for `/packs/` — see Phase 2).

If you believe a file outside this list must change, STOP and report instead of editing.

### 0.2 Hard rules

1. **`.js` extensions on every relative import in `@open-edu/packs`.** Companion and core already do
   this (house style for Node-loadable dist). Do it everywhere in the new package so its `dist` is
   Node-loadable. This is the AGENTS.md "subpath export" fix applied at source; do NOT instead add
   `.js` across other packages.
2. **Never import `@open-edu/widgets` root from `@open-edu/packs`, `packages/companion`, or any
   `vite.config.ts`-reachable Node chain.** Use only the `./intents` and `./search` subpaths. The
   widgets package root is unloadable under Node ESM (`ERR_MODULE_NOT_FOUND …/dist/types`).
3. **`@open-edu/packs` root is pure and browser-safe.** `node:fs` lives only in `src/loader.ts`
   (`./loader` subpath); `node:crypto` only in `src/fingerprint.ts` (`./fingerprint` subpath).
   Neither is re-exported from the root index.
4. **No new runtime dependencies** beyond linking `@open-edu/packs` into `companion`, `dev-server`,
   and `cli` `package.json` `dependencies`. No `pnpm add`; edit `package.json` + run `pnpm install`.
5. **Tests first (TDD).** Write the failing test, watch it fail, implement, watch it pass.
6. **No emoji, no debug `console.log`, no dead code, no comments beyond what this plan shows.**
7. **Conventional commits**, one per phase header (some phases have two — both are listed).
8. **Build first, and not only at the end.** After any change to a `packages/**` export surface
   (`./intents`, `./search`, `./locale`, `@open-edu/packs`, `@open-edu/schemas` provenance, `@open-edu/core`
   provenance), run the package build **before** the dependent test in the loop. Order that matters:
   `widgets`/`i18n` → `packs` → `schemas`/`core` → `companion` → `course-compiler`/`domain-guidance` →
   `dev-server`/`cli`.
9. **Regenerate dev-server Tailwind after UI phases** (Phase 7):
   `pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css`.
10. **Never hand-edit generated data.** `artifact-contract.json` regenerates via
    `pnpm --filter @open-edu/domain-guidance generate`. `apps/dev-server/src/tailwind.css` regenerates via rule 9.
11. **Client-side code imports `listProfiles`/`getProfile` from `@open-edu/domain-guidance/profiles` (subpath), NEVER the package root.** The root re-exports `generate.js` (`node:fs`); only server-side code (middleware, prompts, resolvers) may use the root. Precedent: `StudioApp.tsx:50`.

### 0.3 Verification loop (all green before the next phase)

```bash
pnpm --filter @open-edu/schemas test && pnpm --filter @open-edu/schemas typecheck
pnpm --filter @open-edu/widgets test && pnpm --filter @open-edu/widgets typecheck
pnpm --filter @open-edu/i18n test && pnpm --filter @open-edu/i18n typecheck
pnpm --filter @open-edu/packs test && pnpm --filter @open-edu/packs typecheck
pnpm --filter @open-edu/core test && pnpm --filter @open-edu/core typecheck
pnpm --filter @open-edu/companion test && pnpm --filter @open-edu/companion typecheck
pnpm --filter @open-edu/course-compiler test && pnpm --filter @open-edu/course-compiler typecheck
pnpm --filter @open-edu/domain-guidance test && pnpm --filter @open-edu/domain-guidance typecheck
pnpm --filter @open-edu/dev-server test && pnpm --filter @open-edu/dev-server typecheck
pnpm --filter @open-edu/cli test && pnpm --filter @open-edu/cli typecheck
pnpm lint
pnpm format:check
```

After Phase 2/3/4 (any packs/widgets build): `pnpm --filter @open-edu/widgets build`,
`pnpm --filter @open-edu/i18n build`, `pnpm --filter @open-edu/packs build` before the dependent tests.
After Phase 11: `pnpm --filter @open-edu/schemas build && pnpm --filter @open-edu/core build` before dev-server tests.

---

## 1. Locked decisions (do not revisit)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **`@open-edu/packs` uses explicit `.js` extensions on every relative import.** Produces Node-loadable dist; lets `companion` (and later `vite.config.ts`) import the root safely.                                                                                                                                                                                                                                                                                                               |
| L2  | **`LearningIntent` enum is imported via a new `@open-edu/widgets/intents` subpath** (`./dist/metadata/learning-intents.js`, a 14-line zero-import leaf after Phase 0 moved `WIDGET_LEARNING_INTENTS` into `builtin-roster.ts`). packs/companion never import the widgets root.                                                                                                                                                                                                                  |
| L3  | **Intent/tag matching is extracted to `packages/widgets/src/search-filter.ts`**, exported via a new `@open-edu/widgets/search` subpath. `registry.searchWithFilters` delegates the intents/subjectTags branch to it. packs uses the same predicate for objective matching. The predicate operates on a structural `{ intents, subjectTags }` shape so it works for both `WidgetDefinitionV2` and `AvailableActivity`.                                                                           |
| L4  | **`AuthoringContext` travels as an explicit param.** Stored on the `DraftEntry` at generation, read at commit for validation + provenance. No server session state. Identical across local and browser modes.                                                                                                                                                                                                                                                                                   |
| L5  | **`AuthoringContextSchema` (plus `PackRef`, `AvailableActivity`) lives in `@open-edu/packs`.** Companion story 1.4 only does `.extend({ authoring: AuthoringContextSchema.optional() })`. Dependency is companion → packs, never the reverse.                                                                                                                                                                                                                                                   |
| L6  | **Base branch = `origin/main` after PR #622 merges.** Gate: catalog has 28 entries (`open-edu.multiple-choice-practice` retired). If #622 is still open, branch from `feat/pack-system-phase-0-convergence` instead and note it in the first PR.                                                                                                                                                                                                                                                |
| L7  | **`resolveAuthoringContext(packs, { curriculum, unit }, options)` returns `{ context, diagnostics }`** where `diagnostics: PackDiagnostic[]` may be `error` OR `warning`. The Studio layer maps error-severity diagnostics → thrown `StudioApiError`; warning-severity → `AuthoringContextResult.warnings`. (`options = { maxChars=20000, availableActivities=[], learner?, locale? }`.)                                                                                                        |
| L8  | **Budget** counts chars over objective `description`s + concept `summary`s + unit `title` (sections, in that order); `availableActivities` is separately count-capped at 25. `budget.truncated` = section-name strings (`'objectives'` \| `'concepts'` \| `'unitTitle'` \| `'availableActivities'`). Exact algorithm in §6.2 step 10.                                                                                                                                                           |
| L9  | **Fingerprint = `sha256:<hex>`** over canonical (recursively key-sorted) JSON of the context with `budget` reduced to `{ maxChars }` (strip `usedChars` and `truncated`). Implemented in `@open-edu/packs/fingerprint`.                                                                                                                                                                                                                                                                         |
| L10 | **`AuthoringContextSchema.objectives[]` gains `concepts: z.array(ConceptRefSchema).default([])`** — a deliberate, documented extension of the §17.1 sketch (which omits it) so the reproduction record can map node → concept without re-reading packs at commit time. `resolveAuthoringContext` fills it from the curriculum pack's objective `concepts`.                                                                                                                                      |
| L11 | **Objective candidates are computed inside `resolveAuthoringContext`** (it alone has concept `domainTags`) using the L3 predicate, capped to the first 5 in catalog order, and used only to derive `CAPABILITY_GAP` warnings. They are **not** stored on the context (the AI does the matching itself per §21.2).                                                                                                                                                                               |
| L12 | **`CAPABILITY_GAP` message format:** `` `objective-${id}: no activity matched intents [${requiresIntents.join(', ')}]` `` (exact, per §20.2).                                                                                                                                                                                                                                                                                                                                                   |
| L13 | **`PackErrorCode` = §23.1's 15 codes plus 2 blueprint codes** (`BLUEPRINT_WIDGET_UNKNOWN`, `BLUEPRINT_AUDIENCE_MISMATCH`). `PackDiagnostic = { code, severity: 'error'                                                                                                                                                                                                                                                                                                                          | 'warning', message }`— structurally identical to`CompilerDiagnostic` but **not** imported from course-compiler (avoids a packs→course-compiler edge). |
| L14 | **packs `package.json` exports:** `.` (schemas/context/resolve/`pack-info` ONLY — all pure zod), `./loader` (`node:fs`), `./fingerprint` (`node:crypto`). `packages/packs/src/types.ts` is pure and re-exported from root so `./loader` types are importable without pulling `node:fs`. `pack-info.ts` (PackSummary/PackDetail, §5.4) is added to the root surface as part of "schemas".                                                                                                        |
| L15 | **Blueprint validation lives in packs (`src/blueprint.ts`), pure, over a structural `BlueprintFacts`** (no course-compiler import). dev-server parses the spec (json or md) into facts with the course-compiler, passes them in. Commit rejects with result code `invalid-blueprint` on any `error`-severity violation; capability gaps are warnings.                                                                                                                                           |
| L16 | **Blueprints are validated + `provenance.json` written at commit for local mode (`commitCourseDraft.ts`, the §23.2-cited gate), and at generate for browser mode** (when `includeFiles: true`, so the base64 `readDraftFiles` set carries `provenance.json` into OPFS). Local validation at commit is the spec gate; generate-time validation for browser covers the fact that browser commit never calls `commitCourseDraft`.                                                                  |
| L17 | **AI grounding split:** full `AUTHORING CONTEXT` block goes into `buildCourseSpecPrompt` (no size check; §21.1). `buildSystemPrompt` (chat) gets only a compact fixed-size summary so the 15000-char `MAX_CONTEXT_CHARS` guard cannot trip.                                                                                                                                                                                                                                                     |
| L18 | **Studio pack API is virtual-module backed in both modes.** `OPEN_EDU_PACKS_DIR` (default `<workspace>/packs`) is loaded at buildStart by a new `eduPacksLoader()` Vite plugin in **both** plugin arrays, serialized into `virtual:open-edu-packs` (`export const packData`). `listPacks`/`getPackDetail`/`setAuthoringSelection` are implemented once in `apps/dev-server/src/studio/packs/` shared by both Studio API factories; no new HTTP routes.                                          |
| L19 | **`OPEN_EDU_PACKS_DIR` relative paths resolve against the workspace root** (walk up for `pnpm-workspace.yaml`, same as `packages/domain-guidance/src/generate.ts`). e2e sets `OPEN_EDU_PACKS_DIR=examples/packs`.                                                                                                                                                                                                                                                                               |
| L20 | **Selection → generation UX:** `PackSelectionPanel` (in `HomeView`, above `AiStartPanel`) → `api.setAuthoringSelection(selection)` → store `authoring` in `StudioApp` state → `openWithPreset({ message: <built notes>, prefill: true })`. The built notes must match `parseIntentFromMessage`'s `course` patterns (start with "Create a course…").                                                                                                                                             |
| L21 | **`availableActivities` is built from `@open-edu/core/widget-catalog-data` entries** (post-P0-1 they carry `learningIntents` + `ai.subjectTags`), non-deprecated, in catalog order. **The resolver owns the 25-cap** (§6.2 step 7): it slices to the first 25 and records `'availableActivities'` in `budget.truncated` when the input exceeds 25 (the real catalog has 28 non-deprecated entries, so this fires in practice). `domain` from the entry's top-level `domain` field when present. |
| L22 | **`metadata.audience` matches the profile's `audience` field only when both are present and differ exactly** (spec §23.2 check 3, fail-closed). `metadata.language` propagation is story 1.12, independent of packs validation.                                                                                                                                                                                                                                                                 |
| L23 | **i18n additions are English-only** (`en/studio.json`), flat dotted keys matching the existing file. `i18n-keys.test.ts` validates `locales/en` only, so en-only additions are sufficient.                                                                                                                                                                                                                                                                                                      |
| L24 | **`.gitignore /packs/`** (already edited, uncommitted) is folded into the Phase 2 scaffold commit. Spec + this plan remain untracked.                                                                                                                                                                                                                                                                                                                                                           |

---

## 2. Pre-verified facts (cite these; do not re-grep)

| Fact                                                                                                                                                                                                                                                                                                                                                                                                              | Evidence                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------- | --------------- | ----------------------------- |
| `LearningIntent` enum (11 members) lives in a **14-line zero-import leaf** `packages/widgets/src/metadata/learning-intents.ts`; `WIDGET_LEARNING_INTENTS` moved to `builtin-roster.ts:66` post-P0                                                                                                                                                                                                                 | both files                                                            |
| `WidgetSearchFilters` (types.ts) already has `intents?: LearningIntent[]` (all-of) and `subjectTags?: string[]` (any-of) — **P0-7 already landed in PR #622**; `searchWithFilters` implements both at `registry.ts:78-89` (the deprecated singular `filters.intent` alias is normalized at `:78`)                                                                                                                 | `packages/widgets/src/registry.ts:62-99`                              |
| widgets package root is unloadable under Node ESM; `/catalog`, `/guide` subpaths are safe (leaf)                                                                                                                                                                                                                                                                                                                  | AGENTS.md + `packages/widgets/package.json` exports                   |
| `studioContextSnapshotSchema` = `z.object({view, locale, aiAvailable, learner?, course?, activity?, lastCourseDraftQuality?})` at `companion/src/context.ts:27-73`; `StudioChatRequestSchema.context = studioContextSnapshotSchema` at `chat.ts:12-23`; `MAX_CONTEXT_CHARS = 15000` at `chat.ts:25`                                                                                                               | files                                                                 |
| `buildSystemPrompt(ctx)` at `chat/policy.ts:52`; handler 400s if `systemPrompt.length > MAX_CONTEXT_CHARS` at `handler.ts:212-214`                                                                                                                                                                                                                                                                                | files                                                                 |
| `buildCourseSpecPrompt(notes)` at `prompts/coursePrompt.ts:6-17`; `COURSE_SPEC_CONTRACT` from `getArtifactContractPromptView()`; `renderWidgetCatalogSection()` from `buildPrompt.js`                                                                                                                                                                                                                             | file                                                                  |
| `resolveCourseSpec` (generateCoursePackage.ts) builds the notes prompt via `source.completeText(buildCourseSpecPrompt(source.notes), source.signal)` at `:43`                                                                                                                                                                                                                                                     | file                                                                  |
| `generateCourseDraft(options)` stores `DraftEntry { tempDir, outputDir, title?, createdAt }` in module `activeDrafts`; `scratchName = source.kind==='notes' ? 'course-spec.json' : \`course-spec${source.extension}\``; `specPath = join(tempDir, scratchName)` at `generateCourse.ts:168-171`; `generateDraftId()` = `draft-${Date.now()}-${rand}`                                                               | `generateCourse.ts:22-33,168-197`                                     |
| `commitCourseDraft` flow: `getDraftEntry` → `hasNodes` guard → `clearPackageContents` (force list `['workflow.json','package.json','rewards.json','cards.json']` at `:59`) → `cp(entry.outputDir, packageDir)` → `deleteDraft` → `loadPackage` title; result codes `'draft-not-found'                                                                                                                             | 'draft-expired'                                                       | 'has-content' | 'write'`at`:42` | `commitCourseDraft.ts:45-113` |
| `/api/studio/ai/generate-draft` body `{ notes?, spec?, specExt?, includeFiles? }` at `middleware.ts:120-155`; `includeFiles:true` → `readDraftFiles` base64 (browser)                                                                                                                                                                                                                                             | `middleware.ts`, `generateCourse.ts:56-90`                            |
| Browser commit = `commitLocalDraft` (client) via `aiClient.getDraft` + `applyChangeSet`; **never** calls server `commitCourseDraft`. Browser generate = `POST /api/studio/ai/generate-draft` with `includeFiles: true` (`browserAiGateway.ts:97-101`).                                                                                                                                                            | `browserStudioApi.ts:661-695`, `browserAiGateway.ts`                  |
| `runDeterministicTool` calls `generateCourseDraftTool({ notes: route.description, packageDir, completeText })` at `agentLoop.ts:297-303`; `GenerateCourseRequest = { notes?, spec?, specExt?, packageDir, completeText }` at `tools.ts:15-20`                                                                                                                                                                     | files                                                                 |
| `resolveSkills.ts` Rule 1 (learner→`learner-adaptation`) + Rule 2 (`interactive`→engine skill); `InMemorySkillRegistry` default array at `skillRegistry.ts:8-12`                                                                                                                                                                                                                                                  | files                                                                 |
| `StudioApi` interface has 34 methods (contract test lists 30 by name) at `studioApi.ts:59-118`; `StudioApiError = interface { code?: AiEndpointErrorCode                                                                                                                                                                                                                                                          | string }`                                                             | files         |
| `localStudioApi` uses `AI_BASE = '/api/studio/ai'`; `uploadSpecDraft`/`generateCourseDraft` POST `{ notes/spec, specExt }`                                                                                                                                                                                                                                                                                        | `localStudioApi.ts:24-26,133-151`                                     |
| `StudioApp` holds `targetLearnerKind` (localStorage `openedu.studio.targetLearnerKind`, default `neurotypical`) + `learner` useMemo (`getProfile(kind)`) at `StudioApp.tsx:80-96`; renders `StudioContextBridge` with `learner` at `:325-331`; `outlineTab` state via `readOutlineTab()`                                                                                                                          | files                                                                 |
| `StudioContextBridge` builds the snapshot from props and calls `setContext`; props currently `{ view, selectedPath, loadedPackage, aiAvailable, locale, learner, api }`                                                                                                                                                                                                                                           | `StudioContextBridge.tsx:1-90`                                        |
| `OutlineWorkspace` has a `Tabs` with `outline`                                                                                                                                                                                                                                                                                                                                                                    | `files` triggers (`studio.outline.tabOutline`/`tabFiles`) at `:66-74` | file          |
| `HomeView` renders `HomeTemplateGallery`, then `AiStartPanel`, then recent; `AiStartPanel` calls `openWithPreset({message: t('studio.assistant.courseDraft.presetNotes'), prefill:true})`                                                                                                                                                                                                                         | files                                                                 |
| `openWithPreset({message, prefill})` dispatches a custom event consumed to prefill the assistant; `parseIntentFromMessage` `course` regexes trigger `generate_course` for messages starting "create/generate/build/make a course"                                                                                                                                                                                 | `StudioAssistantProvider.tsx`, `intent.ts:26-57`                      |
| `listProfiles()` lives in `packages/domain-guidance/src/profiles.ts` and is exported **only** via the `@open-edu/domain-guidance/profiles` subpath (package.json exports `./profiles`); `getProfile(id)` also exists on the root (`index.ts:43`) but the root pulls `generate.js` → `node:fs` — client code must use the `/profiles` subpath (precedent `StudioApp.tsx:50`)                                       | `domain-guidance/src/profiles.ts:20`, `package.json` exports          |
| `StudioApiError` is an **interface** (`extends Error { code?: AiEndpointErrorCode \| string }`), not a class — construct via `const err = new Error(msg) as StudioApiError; err.code = …` (precedent `localStudioApi.ts:58`) or the `BrowserStudioApiError` class                                                                                                                                                 | `studioApi.ts:15-17`                                                  |
| `AiGenerateErrorCode` is defined in **`packages/companion/src/types.ts:14-22`** (`apps/dev-server/src/studio/ai/types.ts` is just `export * from '@open-edu/companion/types'`); adding a generate-time result code means editing companion `src/types.ts`                                                                                                                                                         | files                                                                 |
| CLI: `handleResult` is a **private function in `cli.ts:340`** (not exported); `CliResult = { success, data?, error?, code? }` — there is no `ok` field; commands in `src/commands/*.ts` export plain functions returning `CliResult` (e.g. `validatePackage`), and `cli.ts` actions call `handleResult(result, json)`                                                                                             | `cli.ts:42-54,340`, `commands/validate.ts`                            |
| The widget catalog has **28 non-deprecated entries** (matches the PR #622 gate in L6). Verified candidate matrix against the first 25 in catalog order, domainTags `[math, fractions]`: `practice+compare` → `math.number-line` (1); `observe` → 5 (`core.visual-counting`, `math.fraction-visual`, …); `practice` → 7; **`recall` → NONE** (only `language.flashcard` has recall, tags `[language, vocabulary]`) | `packages/core/src/widget-catalog-data.json`                          |
| `SUPPORTED_LOCALES = ['en','hi','or']` + `isValidLocale` in `packages/i18n/src/locale.ts` (React-free); i18n `exports` = `.` (source) + `./locales/*`                                                                                                                                                                                                                                                             | `locale.ts`, `i18n/package.json`                                      |
| `@open-edu/core/widget-catalog-data` is a self-contained ESM module (`export default WidgetCatalogEntry[]`) usable in browser + Node + Vitest                                                                                                                                                                                                                                                                     | `core/scripts/generate-catalog-data-module.mjs`                       |
| `CourseSpecJSONSchema.metadata` has **no** `language`; `parseCourseSpecJSON` hardcodes `language: 'en'` at `json-input.ts:188`; `CourseMetadata.language` default `'en'` at `course-model.ts:225`; md path reads `frontmatter.language` (semantic-parser.ts:111)                                                                                                                                                  | files                                                                 |
| `LessonJSONSchema` requires `id: z.string()` (`json-input.ts:36`); compiled lesson node = `nodes/${lesson.id}.md` (`package-generator.ts:63`); `mapLesson` keeps `jsonLesson.id` (`json-input.ts:139`)                                                                                                                                                                                                            | files                                                                 |
| `parseCourseSpecJSON(jsonStr)` → `{ model, diagnostics }` and `parseCourseSpec(markdown)` are both exported from `@open-edu/course-compiler` (parser/index.ts)                                                                                                                                                                                                                                                    | files                                                                 |
| `AUTHORED_PROMPT_RULES` array at `domain-guidance/src/generate.ts:29`; regenerate via `pnpm --filter @open-edu/domain-guidance generate` (scripts: `tsc && node scripts/copy-data.mjs && node dist/generate.js`)                                                                                                                                                                                                  | file                                                                  |
| core `file-loader.ts` has `parseOptional(source, filePath, parser)` and loads `workflow`/`rewards`/`cards` leniently; `LoadedPackage` type in `types.ts`                                                                                                                                                                                                                                                          | `file-loader.ts:40-48,60-64`                                          |
| CLI command pattern: one file + one test under `packages/cli/src/commands/` (`validate.ts` exists); `cli.ts` uses commander with `.command()` and `handleResult`                                                                                                                                                                                                                                                  | files                                                                 |
| dev-server deps already include `@open-edu/{companion,core,course-compiler,domain-guidance,i18n,schemas,widgets}`; needs `@open-edu/packs` added. cli deps include `core,course-compiler,schemas`; needs `packs`. companion deps `{@open-edu/storage,zod}`; needs `packs`.                                                                                                                                        | package.jsons                                                         |
| Studio e2e runs against the **browser-mode** server on `http://localhost:4002`; `playwright.config.ts` webServer env block at `:36-40` (add `OPEN_EDU_PACKS_DIR`).                                                                                                                                                                                                                                                | `playwright.config.ts`, `tests/e2e/studio-*.spec.ts`                  |
| Browser-mode vite plugins = `[react(), widgetRegistryPlugin(), virtualPackagePlugin(), localStudioAiPlugin()]`; local = `[react(), widgetRegistryPlugin(), eduPackageLoader()]`                                                                                                                                                                                                                                   | `vite.config.ts:1455-1460`                                            |

---

## 3. Phase 1 — PR #622 follow-ups (3 commits)

### 3.1 Follow-up 1 — stale skill reference

**Commit:** `docs(skill): refresh repository-adapter widget catalog reference`

`skills/openedu-course-authoring/references/repository-adapter.md:102` still describes the deleted
`widget-catalog-source.ts` as canonical. Rewrite that paragraph to describe the roster → generator flow:

- Canonical roster: `packages/widgets/src/builtin-roster.ts` (`BUILTIN_WIDGETS`, `WIDGET_LEARNING_INTENTS`).
- Catalog entry mapping: `packages/widgets/src/catalog-gen.ts` (`toCatalogEntry`).
- Regeneration: `pnpm --filter @open-edu/widgets generate:catalog` (script at `packages/widgets/package.json`).
- The generator script `packages/widgets/scripts/generate-catalog.ts` still exists and writes
  `packages/core/src/widget-catalog-data.json`.

Edit only that paragraph. No test changes.

### 3.2 Follow-up 2 — OpenWiki stale references

**Commit:** `docs(openwiki): refresh Phase 0 convergence references`

Update the 7 sites in 4 files that still name `widget-catalog-source.ts` / `WIDGET_CATALOG_ENTRIES` as
canonical, replacing with the roster/generator wording from §3.1:
`openwiki/quickstart.md:44,101`; `openwiki/architecture/overview.md:84,212`;
`openwiki/domain/content-and-workflows.md:180`; `openwiki/operations/testing-and-changes.md:26,88`.

These are explicitly-allowed hand-edits (no OpenWiki workflow in-repo).

### 3.3 Follow-up 3 — dev-server Tailwind regen

**Commit:** `chore(dev-server): regenerate tailwind.css`

The checked-in `apps/dev-server/src/tailwind.css` is stale (`open-edu-interactive`, `text-heading-sm`
from `packages/runtime/src/renderers/InteractiveRenderer.tsx` are missing). Regenerate (no source edit):

```bash
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
```

**Exit:** `git status` shows only: the three committed follow-ups, the still-modified `.gitignore` (folded into Phase 2 per L24), and the untracked spec/plan; `pnpm lint && pnpm format:check` green.

---

## 4. Phase 2 — Story 1.1: pack schemas (3 commits)

### 4.1 Commit 2a — widgets `./intents` subpath

**Commit:** `feat(widgets): expose learning intents subpath`

`packages/widgets/package.json` `exports` gains:

```json
"./intents": {
  "types": "./dist/metadata/learning-intents.d.ts",
  "import": "./dist/metadata/learning-intents.js"
}
```

No source change (`learning-intents.ts` is already a leaf). Verify with:
`pnpm --filter @open-edu/widgets build && cd apps/dev-server && node -e "import('@open-edu/widgets/intents').then(m=>console.log(m.LearningIntent.Practice))"` → `practice`.

### 4.2 Commit 2b — i18n `./locale` subpath

**Commit:** `feat(i18n): expose locale subpath`

`packages/i18n/package.json` `exports` gains (mirrors the source-shipped `.` entry):

```json
"./locale": {
  "types": "./src/locale.ts",
  "import": "./src/locale.ts"
}
```

### 4.3 Commit 2c — scaffold `@open-edu/packs` + schemas + `.gitignore`

**Commit:** `feat(packs): scaffold @open-edu/packs with manifest, concept, and curriculum schemas`

Fold the already-edited `.gitignore` (`/packs/`) into this commit.

`packages/packs/package.json`:

```json
{
  "name": "@open-edu/packs",
  "version": "0.0.0",
  "type": "module",
  "description": "OpenEdu Pack System: knowledge, curriculum, and authoring-context schemas and resolution.",
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./loader": { "types": "./dist/loader.d.ts", "import": "./dist/loader.js" },
    "./fingerprint": { "types": "./dist/fingerprint.d.ts", "import": "./dist/fingerprint.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "lint": "eslint 'src/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@open-edu/i18n": "workspace:*",
    "@open-edu/widgets": "workspace:*",
    "zod": "^3.22.0"
  }
}
```

`tsconfig.json` (extends base; mirror `packages/companion/tsconfig.json`), `tsconfig.build.json`
(tsc build emitting `dist`, like companion/logger), `vitest.config.ts` (extend base test config, no
special aliases).

`packages/packs/src/manifest.ts`:

```ts
import { z } from 'zod';
import { SUPPORTED_LOCALES, isValidLocale } from '@open-edu/i18n/locale';

export const PACK_FORMAT = 'openedu-pack' as const;
export const PACK_FORMAT_VERSION = 1 as const;

export const PackTypeSchema = z.enum(['knowledge', 'curriculum']);
export type PackType = z.infer<typeof PackTypeSchema>;

const PackLanguageSchema = z
  .string()
  .refine(isValidLocale, { message: `language must be one of ${SUPPORTED_LOCALES.join(', ')}` })
  .default('en');

export const PackIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'id must be kebab-case');

export const PackManifestSchema = z
  .object({
    format: z.literal(PACK_FORMAT),
    formatVersion: z.literal(PACK_FORMAT_VERSION),
    type: PackTypeSchema,
    id: PackIdSchema,
    version: z
      .string()
      .min(1)
      .max(64)
      .regex(/^\d+\.\d+\.\d+$/, 'version must be semver (e.g. 1.0.0)'),
    name: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    author: z.string().min(1).max(128),
    language: PackLanguageSchema,
    requires: z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]*$/)).default([]),
    derivedFrom: z.enum(['document']).optional(),
  })
  .strict();

export type PackManifest = z.infer<typeof PackManifestSchema>;
```

`packages/packs/src/concept.ts`:

```ts
import { z } from 'zod';
import { PackIdSchema } from './manifest.js';

export const ConceptSourceSchema = z.object({
  documentId: z.string().min(1).max(128),
  locator: z.string().min(1).max(256).optional(),
  section: z.string().max(256).optional(),
  page: z.number().int().positive().optional(),
  excerpt: z.string().max(2000).optional(),
});
export type ConceptSource = z.infer<typeof ConceptSourceSchema>;

export const ConceptSchema = z
  .object({
    id: PackIdSchema,
    title: z.string().min(1).max(256),
    summary: z.string().min(1).max(2000),
    domainTags: z.array(z.string().min(1).max(64)).min(1),
    examples: z.array(z.string().max(1000)).max(10).optional(),
    misconceptions: z.array(z.string().max(1000)).max(10).optional(),
    prerequisites: z.array(z.string().min(1).max(128)).max(20).optional(),
    source: ConceptSourceSchema.optional(),
  })
  .strict();

export type Concept = z.infer<typeof ConceptSchema>;
```

`packages/packs/src/curriculum.ts`:

```ts
import { z } from 'zod';
import { LearningIntent } from '@open-edu/widgets/intents';
import { PackIdSchema } from './manifest.js';

export const ConceptRefSchema = z.object({
  pack: PackIdSchema,
  concept: PackIdSchema,
});
export type ConceptRef = z.infer<typeof ConceptRefSchema>;

export const ObjectiveSchema = z
  .object({
    id: PackIdSchema,
    description: z.string().min(1).max(500),
    bloomLevel: z
      .enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
      .optional(),
    concepts: z.array(ConceptRefSchema).default([]),
    requiresIntents: z.array(z.nativeEnum(LearningIntent)).min(1),
  })
  .strict();

export const CurriculumUnitSchema = z
  .object({
    id: PackIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(2000).optional(),
    concepts: z.array(ConceptRefSchema).default([]),
    objectives: z.array(ObjectiveSchema).min(1),
    estimatedMinutes: z.number().int().positive().optional(),
    prerequisites: z.array(z.string()).default([]),
  })
  .strict();

export const CurriculumSchema = z
  .object({
    id: PackIdSchema,
    title: z.string().min(1).max(256),
    subject: z.string().min(1).max(128),
    level: z.string().max(64).optional(),
    units: z.array(CurriculumUnitSchema).min(1),
  })
  .strict();

export type Curriculum = z.infer<typeof CurriculumSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
```

`packages/packs/src/types.ts` (pure; see L14) — declare here in Phase 2, expand in later phases:

```ts
export type PackSeverity = 'error' | 'warning';
export type PackErrorCode =
  | 'PACK_MANIFEST_MISSING'
  | 'PACK_MANIFEST_INVALID'
  | 'PACK_VERSION_INVALID'
  | 'PACK_DEPENDENCY_MISSING'
  | 'KNOWLEDGE_CONCEPT_INVALID'
  | 'KNOWLEDGE_SOURCE_MISSING'
  | 'KNOWLEDGE_PREREQ_CYCLE'
  | 'KNOWLEDGE_PREREQ_UNKNOWN'
  | 'CURRICULUM_INVALID'
  | 'CURRICULUM_PREREQ_UNKNOWN'
  | 'CURRICULUM_PREREQ_CYCLE'
  | 'PACK_REFERENCE_MISSING'
  | 'OBJECTIVE_INTENT_UNKNOWN'
  | 'OBJECTIVE_NO_CONCEPTS'
  | 'CAPABILITY_GAP'
  | 'BLUEPRINT_WIDGET_UNKNOWN'
  | 'BLUEPRINT_AUDIENCE_MISMATCH';
export interface PackDiagnostic {
  code: PackErrorCode;
  severity: PackSeverity;
  message: string;
}
```

`packages/packs/src/index.ts` re-exports `manifest.js`, `concept.js`, `curriculum.js`, `types.js`.

Tests (TDD, `packages/packs/src/*.test.ts`):

- `manifest.test.ts`: valid manifest parses; kebab-case id/version regex reject; unknown key rejected (`.strict()`); `derivedFrom` accepted; language refine rejects `en-IN`, defaults `en`.
- `concept.test.ts`: `domainTags` non-empty required; `summary` ≤ 2000; `.strict()`; optional `source`.
- `curriculum.test.ts`: `requiresIntents` min 1; unknown intent value rejected by the zod enum (the **loader** maps that same failure to the `OBJECTIVE_INTENT_UNKNOWN` diagnostic — covered in §5.3); `concepts` default `[]`; `.strict()`.

**Exit:** build packs; run §0.3 subset (`schemas`, `widgets`, `i18n`, `packs`); `pnpm lint && pnpm format:check`.

---

## 5. Phase 3 — Story 1.2: pack loader + fixtures

**Commit:** `feat(packs): add pack loader and example pack fixtures`

### 5.1 Loader (`packages/packs/src/loader.ts`, subpath `./loader`)

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type ZodTypeAny } from 'zod';
import { PackManifestSchema, type PackManifest } from './manifest.js';
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
```

**Load semantics (exact):** every diagnostic the loader produces is `severity: 'error'`;
`loadPackDirectory` throws `PackValidationError` as soon as any exists — there is **no partial
load** (spec §28). `loadPacksDir` catches per-directory so one bad pack is skipped and reported,
never crashing `eduPacksLoader`'s `buildStart`.

Add `SourceDocumentSchema` + `LoadedPack`/`SourceDocument` types to `types.ts`:

```ts
import type { PackManifest } from './manifest.js';
import type { Concept } from './concept.js';
import type { Curriculum } from './curriculum.js';

export const SourceDocumentSchema = z.object({
  title: z.string().min(1).max(256),
  publisher: z.string().max(256).optional(),
  year: z.number().int().optional(),
  url: z.string().url().optional(),
  license: z.string().max(128).optional(),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export interface LoadedPack {
  dir: string;
  manifest: PackManifest;
  concepts?: Concept[];
  curriculum?: Curriculum;
  sources?: Record<string, SourceDocument>;
}
```

`zod` import required in `types.ts` (it is pure zod — fine). Prereq DFS mirrors
`packages/course-compiler/src/validators/semantic-validator.ts:160-185` (cycle detection).

### 5.2 Fixtures

`examples/packs/knowledge/openedu-fractions/manifest.json`:

```json
{
  "format": "openedu-pack",
  "formatVersion": 1,
  "type": "knowledge",
  "id": "openedu-fractions",
  "version": "0.1.0",
  "name": "OpenEdu Fractions",
  "description": "Fraction concepts for early mathematics.",
  "author": "OpenEdu",
  "language": "en",
  "requires": []
}
```

`examples/packs/knowledge/openedu-fractions/concepts.json` (5 concepts; 2 carry `source`):

```json
[
  {
    "id": "fraction",
    "title": "Fraction",
    "summary": "A fraction names equal parts of a whole, written numerator over denominator.",
    "domainTags": ["math", "fractions"],
    "prerequisites": [],
    "source": {
      "documentId": "nios-math-ch1",
      "section": "2.1",
      "excerpt": "Fractions represent parts of a whole."
    }
  },
  {
    "id": "numerator",
    "title": "Numerator",
    "summary": "The top number of a fraction counts the parts taken.",
    "domainTags": ["math", "fractions"],
    "prerequisites": ["fraction"]
  },
  {
    "id": "denominator",
    "title": "Denominator",
    "summary": "The bottom number of a fraction names the number of equal parts in the whole.",
    "domainTags": ["math", "fractions"],
    "prerequisites": ["fraction"]
  },
  {
    "id": "equivalent-fraction",
    "title": "Equivalent Fractions",
    "summary": "Fractions that name the same amount, such as 1/2 and 2/4.",
    "domainTags": ["math", "fractions"],
    "prerequisites": ["fraction", "numerator", "denominator"]
  },
  {
    "id": "compare-fractions",
    "title": "Comparing Fractions",
    "summary": "Deciding which of two fractions is greater using common denominators.",
    "domainTags": ["math", "fractions"],
    "prerequisites": ["equivalent-fraction"],
    "source": {
      "documentId": "nios-math-ch1",
      "section": "2.1",
      "excerpt": "Fractions represent parts of a whole."
    }
  }
]
```

Exactly 2 of 5 concepts carry `source` (`fraction`, `compare-fractions`), both pointing at
`nios-math-ch1`, so the scoped-unit provenance `documents` array is non-empty in tests.
The `measurement` unit's `measure-length` objective (`concepts: []`) intentionally triggers
`OBJECTIVE_NO_CONCEPTS`, and `name-parts` (`requiresIntents: ["recall"]`) intentionally has **zero**
catalog candidates under domainTags `[math, fractions]` — it is the fixture's built-in
`CAPABILITY_GAP` demonstration (spec §13.3: 0 matches → warning, AI falls back to reading/exercise).

`examples/packs/knowledge/openedu-fractions/sources.json`:

```json
{
  "nios-math-ch1": {
    "title": "NIOS Mathematics Chapter 1",
    "publisher": "NIOS",
    "year": 2023,
    "url": "https://nios.ac.in/math-ch1",
    "license": "CC-BY"
  },
  "nios-math-ch2": {
    "title": "NIOS Mathematics Chapter 2",
    "publisher": "NIOS",
    "year": 2023,
    "license": "CC-BY"
  }
}
```

`examples/packs/curriculum/nios-math-level-a/manifest.json`:

```json
{
  "format": "openedu-pack",
  "formatVersion": 1,
  "type": "curriculum",
  "id": "nios-math-level-a",
  "version": "0.1.0",
  "name": "NIOS Mathematics Level A",
  "description": "Foundational mathematics units.",
  "author": "OpenEdu",
  "language": "en",
  "requires": ["openedu-fractions"]
}
```

`examples/packs/curriculum/nios-math-level-a/curriculum.json` (units `fractions` + `measurement`):

```json
{
  "id": "nios-math-level-a",
  "title": "NIOS Mathematics Level A",
  "subject": "mathematics",
  "level": "A",
  "units": [
    {
      "id": "fractions",
      "title": "Fractions",
      "concepts": [
        { "pack": "openedu-fractions", "concept": "fraction" },
        { "pack": "openedu-fractions", "concept": "numerator" },
        { "pack": "openedu-fractions", "concept": "denominator" }
      ],
      "objectives": [
        {
          "id": "represent-fraction",
          "description": "Represent three-quarters as a shaded area and as a number line position.",
          "bloomLevel": "apply",
          "concepts": [{ "pack": "openedu-fractions", "concept": "fraction" }],
          "requiresIntents": ["practice", "compare"]
        },
        {
          "id": "name-parts",
          "description": "Name the numerator and denominator of a given fraction.",
          "bloomLevel": "understand",
          "concepts": [
            { "pack": "openedu-fractions", "concept": "numerator" },
            { "pack": "openedu-fractions", "concept": "denominator" }
          ],
          "requiresIntents": ["recall"]
        }
      ],
      "estimatedMinutes": 20
    },
    {
      "id": "measurement",
      "title": "Measurement",
      "objectives": [
        {
          "id": "measure-length",
          "description": "Measure length to the nearest centimeter.",
          "bloomLevel": "apply",
          "concepts": [],
          "requiresIntents": ["practice"]
        }
      ],
      "estimatedMinutes": 15
    }
  ]
}
```

### 5.3 Tests

`packages/packs/src/loader.test.ts`:

- loads `examples/packs/knowledge/openedu-fractions` → 5 concepts, manifest id/version; 2 concepts have `source`; sources.json parsed.
- loads `examples/packs/curriculum/nios-math-level-a` → 2 units, 3 objectives total.
- temp dir cases (write under `os.tmpdir()`): missing `manifest.json` → `PACK_MANIFEST_MISSING`; bad version → `PACK_VERSION_INVALID` (issue path `version`); unknown manifest key → `PACK_MANIFEST_INVALID`; knowledge missing `concepts.json` → `KNOWLEDGE_CONCEPT_INVALID`; `derivedFrom:'document'` with a sourceless concept → `KNOWLEDGE_SOURCE_MISSING`; concept prereq cycle → `KNOWLEDGE_PREREQ_CYCLE`; unit prereq unknown → `CURRICULUM_PREREQ_UNKNOWN`; unknown `requiresIntents` value → `OBJECTIVE_INTENT_UNKNOWN`; non-array concepts.json → `KNOWLEDGE_CONCEPT_INVALID`; every case throws `PackValidationError` (**no partial load**: the error result never contains a usable pack); `loadPacksDir` skips a bad pack and collects its diagnostics (including a dir whose `concepts.json` is corrupt JSON → `PACK_MANIFEST_INVALID`, not a crash).

**Exit:** §0.3 subset (`packs`); `pnpm --filter @open-edu/packs build`.

### 5.4 Pack summary & detail (`src/pack-info.ts`, root export)

Spec §18.1 references `PackSummary`/`PackDetail` in the Studio API signatures but never defines them.
Formalize them as Zod schemas (rules: schemas are the source of truth) so `studioApi.ts`, `packApi.ts`,
and the UI share one definition. Pure module — goes on the packs root export per L14.

`packages/packs/src/pack-info.ts`:

```ts
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
```

`packages/packs/src/index.ts` gains `pack-info.js` to its re-exports (Phase 2 base + this file).

Tests `packages/packs/src/pack-info.test.ts`: summary counts correct for both fixtures (knowledge:
`conceptCount: 5`, `unitCount/objectiveCount: 0`; curriculum: `unitCount: 2`, `objectiveCount: 3`,
`conceptCount: 3` unique refs); detail carries `requires: ['openedu-fractions']`, unit titles +
objective counts, concept titles/domainTags for knowledge; empty-detail arrays for the other type.

**Exit:** same as §5.3 (`packs` build + tests).

---

## 6. Phase 4 — Story 1.3: resolution + objective matching (2 commits)

### 6.1 Commit 4a — widgets `./search` subpath

**Commit:** `feat(widgets): extract intent and tag matching into search filter`

`packages/widgets/src/search-filter.ts`:

```ts
import type { LearningIntent } from './metadata/learning-intents.js';

export interface IntentTagEntry {
  intents?: readonly LearningIntent[];
  subjectTags?: readonly string[];
}

export interface IntentTagFilters {
  intents?: readonly LearningIntent[];
  subjectTags?: readonly string[];
}

/** All-of `intents` against `entry.intents`; any-of `subjectTags` against `entry.subjectTags`. */
export function matchesIntentTagFilters(entry: IntentTagEntry, filters: IntentTagFilters): boolean {
  if (filters.intents && filters.intents.length > 0) {
    const declared = entry.intents ?? [];
    if (!filters.intents.every((i) => declared.includes(i))) return false;
  }
  if (filters.subjectTags && filters.subjectTags.length > 0) {
    const declared = entry.subjectTags ?? [];
    if (!filters.subjectTags.some((t) => declared.includes(t))) return false;
  }
  return true;
}
```

`packages/widgets/package.json` `exports` gains:

```json
"./search": {
  "types": "./dist/search-filter.d.ts",
  "import": "./dist/search-filter.js"
}
```

Refactor `registry.ts:78-89` (the intents + subjectTags blocks) to:

```ts
// deprecated singular `filters.intent` alias MUST be retained (spec §13.2: `intent` treated as `intents: [intent]`)
const intents = filters.intents ?? (filters.intent ? [filters.intent] : undefined);
if (
  !matchesIntentTagFilters(
    { intents: v2.learningIntents, subjectTags: v2.ai?.subjectTags },
    { intents, subjectTags: filters.subjectTags },
  )
) {
  return false;
}
```

Keep `query`/`domain`/`difficulty`/`status`/`capability`/`accessibility` branches inline (unchanged);
do not touch `WidgetSearchFilters.intent` in `types.ts`.

Test `packages/widgets/src/__tests__/search-filter.test.ts` (all-of/any-of/empty/undefined) + extend
`registry-search-filters.test.ts` to assert delegation parity (existing filters behavior unchanged,
**including a case using the deprecated singular `filters.intent`**).

### 6.2 Commit 4b — packs resolution + fingerprint

**Commit:** `feat(packs): add concept resolution and authoring context resolution`

`packages/packs/src/context.ts` (root, pure):

```ts
import { z } from 'zod';
import { LearningIntent } from '@open-edu/widgets/intents';
import { ConceptRefSchema } from './curriculum.js';

export const PackRefSchema = z.object({
  id: z.string(),
  version: z.string(),
  type: z.enum(['knowledge', 'curriculum']),
});
export type PackRef = z.infer<typeof PackRefSchema>;

export const AvailableActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  intents: z.array(z.nativeEnum(LearningIntent)).default([]),
  subjectTags: z.array(z.string()).default([]),
});
export type AvailableActivity = z.infer<typeof AvailableActivitySchema>;

export const AuthoringContextSchema = z.object({
  packs: z.array(PackRefSchema).default([]),
  curriculumUnit: z.string().optional(),
  learner: z.string().optional(),
  locale: z.string().optional(),
  availableActivities: z.array(AvailableActivitySchema).default([]),
  concepts: z.array(z.object({ ref: ConceptRefSchema, summary: z.string() })).default([]),
  objectives: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        bloomLevel: z.string().optional(),
        concepts: z.array(ConceptRefSchema).default([]),
        requiresIntents: z.array(z.nativeEnum(LearningIntent)),
      }),
    )
    .default([]),
  budget: z.object({
    maxChars: z.number().int().positive(),
    usedChars: z.number().int().nonnegative(),
    truncated: z.array(z.string()).default([]),
  }),
  provenance: z
    .array(
      z.object({
        pack: z.string(),
        version: z.string(),
        documents: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export type AuthoringContext = z.infer<typeof AuthoringContextSchema>;
```

`packages/packs/src/objectives.ts` (root, pure):

```ts
import { matchesIntentTagFilters } from '@open-edu/widgets/search';
import type { AvailableActivity, AuthoringContext } from './context.js';
import type { Concept } from './concept.js';

export interface ObjectiveCandidates {
  id: string;
  candidates: AvailableActivity[];
}

export function resolveObjectiveCandidates(
  objectives: AuthoringContext['objectives'],
  conceptsByRef: (pack: string, concept: string) => Concept | undefined,
  availableActivities: AvailableActivity[],
  limit = 5,
): ObjectiveCandidates[] {
  return objectives.map((objective) => {
    const domainTags = objective.concepts.flatMap(
      (ref) => conceptsByRef(ref.pack, ref.concept)?.domainTags ?? [],
    );
    const candidates = availableActivities
      .filter((a) =>
        matchesIntentTagFilters(a, { intents: objective.requiresIntents, subjectTags: domainTags }),
      )
      .slice(0, limit);
    return { id: objective.id, candidates };
  });
}
```

`packages/packs/src/resolve.ts` (root, pure):

```ts
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

export function resolveAuthoringContext(
  packs: Map<string, LoadedPack>,
  scope: { curriculum: string; unit?: string },
  options?: ResolveAuthoringContextOptions,
): ResolveAuthoringContextResult;
```

`resolveAuthoringContext` algorithm (encode exactly):

1. `curriculumPack = packs.get(scope.curriculum)`; missing → return diagnostics `[PACK_REFERENCE_MISSING]` and an empty context.
2. Resolve `requires` transitively (BFS over `manifest.requires`) → knowledge packs; any missing id → `PACK_DEPENDENCY_MISSING` diagnostic (error). Build `selected: Map<string, LoadedPack>` = curriculum + its knowledge closure.
3. `unit = curriculum.units.find(u => u.id === scope.unit)`; if `scope.unit` set but missing → `PACK_REFERENCE_MISSING`. If `scope.unit` unset, use the **first** unit.
4. Build `concepts` (context): for each `ConceptRef` in the unit (unit.concepts ∪ its objectives' concepts), resolve via `resolveConcept`; missing → `PACK_REFERENCE_MISSING` diagnostic (error) and skip. Entry = `{ ref, summary: concept.summary }`, dedupe by `pack/concept`.
5. Build `objectives` (context): map unit.objectives → `{ id, description, bloomLevel, concepts, requiresIntents }`.
6. `packs` (context) = `[...selected.values()].map(({manifest}) => ({ id, version, type }))`. Then set the scalar fields: **`curriculumUnit` = the resolved unit id** (`scope.unit` after step 3's defaulting — always populated when a unit exists; without this the prompt would render `(none selected)` forever); **`learner` = `options.learner`**; **`locale` = `options.locale`** (stays `undefined` when unset — the companion/prompt layers fall back to the request locale, §10.3).
7. `step7InputAvailableActivities = options.availableActivities ?? []`, then **the resolver owns the 25-cap**: `availableActivities = step7InputAvailableActivities.slice(0, 25)`; if the input had more than 25, record `'availableActivities'` in `budget.truncated` (defer the record until step 10 finalizes `truncated`, so entries keep the section order below).
8. `provenance` (context) = for each selected pack: `{ pack: id, version, documents }` where `documents` = sorted unique `source.documentId` across that knowledge pack's scoped concepts (union of unit-concept `source`s); empty for curriculum.
9. Warnings: for each objective with `concepts.length === 0` → `OBJECTIVE_NO_CONCEPTS`; run `resolveObjectiveCandidates(objectives, conceptsByRefFrom(selected), availableActivities)`; any objective with 0 candidates → `CAPABILITY_GAP` warning with message per L12.
10. Budget — encode exactly (this is the whole algorithm; do not improvise variants):

    ```
    maxChars = options.maxChars ?? 20000
    sections = [
      ['objectives',      objectives.map(o => o.description)],   // kept/dropped as whole entries
      ['concepts',        concepts.map(c => c.summary)],
      ['unitTitle',       [unit.title]],                          // counts toward usedChars only
                                                                   // (the context has no unit-title field)
    ]
    usedChars = 0
    truncated: string[] = []
    for ([name, items] of sections) {
      let kept = 0
      for (item of items) {
        if (usedChars + item.length > maxChars) break   // stop at FIRST overflow; do not skip and keep trying
        usedChars += item.length
        kept++
      }
      if (kept < items.length) {
        truncated.push(name)
        if (name === 'objectives') objectives = objectives.slice(0, kept)          // dropped from the returned context
        if (name === 'concepts')   concepts   = concepts.slice(0, kept)
        // 'unitTitle' only stops counting; nothing to drop from the context
      }
    }
    if (step7InputAvailableActivities.length > 25) truncated.push('availableActivities') // appended LAST
    budget = { maxChars, usedChars, truncated }
    ```

    Section order in `truncated` is therefore `objectives?` → `concepts?` → `unitTitle?` →
    `availableActivities?` (matching L8). `usedChars` = Σ of the lengths that actually fit —
    matches the spec's "objective descriptions + concept summaries + unit title, ≤ maxChars".

`packages/packs/src/fingerprint.ts` (subpath `./fingerprint`):

```ts
import { createHash } from 'node:crypto';
import type { AuthoringContext } from './context.js';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalizeContext(ctx: AuthoringContext): string {
  const { budget, ...rest } = ctx;
  return stableStringify({ ...rest, budget: { maxChars: budget.maxChars } });
}

export function fingerprintAuthoringContext(ctx: AuthoringContext): string {
  return `sha256:${createHash('sha256').update(canonicalizeContext(ctx)).digest('hex')}`;
}
```

`index.ts` re-exports `context.js`, `objectives.js`, `resolve.js`, `pack-info.js` (NOT `loader.js`/`fingerprint.js`).

### 6.3 Tests

`packages/packs/src/resolve.test.ts`:

- `resolveConcept` resolves / returns `undefined` for missing.
- happy path over the two fixtures: packs/objectives/concepts/provenance/budget populated; curriculum requires pulls `openedu-fractions` transitively; `context.curriculumUnit`/`learner`/`locale` are set from scope + options (a missing `locale` option stays `undefined`, not `'en'`).
- `PACK_DEPENDENCY_MISSING` when a `requires` id is absent.
- `PACK_REFERENCE_MISSING` when a concept ref points at a non-selected pack.
- budget: construct small `maxChars` to force each section drop; assert exact `budget.truncated` order (`objectives` → `concepts` → `unitTitle` → `availableActivities`), that dropped entries are actually absent from the returned context, and that `usedChars` equals the Σ of lengths that fit.
- resolver 25-cap: pass 28 activities → `context.availableActivities.length === 25` + `'availableActivities'` recorded in `truncated` (the real catalog has 28 non-deprecated entries, so this also fires in Phase 6's `packApi`).
- **byte-identical determinism**: two calls with identical inputs produce deep-equal contexts (and identical fingerprints).
- fingerprint stability: same context → same `sha256:`; changing `budget.usedChars` does **not** change it; changing an objective does.

`packages/packs/src/objectives.test.ts`: candidate matching all-of/any-of/limit-5/catalog-order; 0-match → `CAPABILITY_GAP` derivation (via resolve).

**Exit:** §0.3 subset (`widgets`, `packs`); `pnpm --filter @open-edu/widgets build && pnpm --filter @open-edu/packs build`.

---

## 7. Phase 5 — Story 1.4: companion context extension

**Commit:** `feat(companion): extend studio context with optional authoring block`

`packages/companion/package.json` `dependencies` add `"@open-edu/packs": "workspace:*"`.

`packages/companion/src/context.ts`: import `AuthoringContextSchema` from `@open-edu/packs` and wrap the
existing `z.object({...})` in `.extend({ authoring: AuthoringContextSchema.optional() })`:

```ts
import { z } from 'zod';
import { AuthoringContextSchema } from '@open-edu/packs';

export const studioContextSnapshotSchema = z
  .object({
    view: StudioViewSchema,
    locale: z.string(),
    aiAvailable: z.boolean(),
    learner: learnerProfileSchema.optional(),
    course: /* …existing… */,
    activity: /* …existing… */,
    lastCourseDraftQuality: /* …existing… */,
  })
  .extend({ authoring: AuthoringContextSchema.optional() });
```

New `packages/companion/src/context.test.ts`:

- snapshot without `authoring` still parses (back-compat).
- snapshot with a minimal valid `authoring` block parses and round-trips `authoring.packs[0].id`.
- invalid `authoring` (e.g. `budget` missing) fails parse.

**Exit:** `pnpm --filter @open-edu/packs build && pnpm --filter @open-edu/companion build && pnpm --filter @open-edu/companion test`.

---

## 8. Phase 6 — Story 1.5: Studio API pack methods

**Commit:** `feat(studio): add pack discovery and authoring selection to StudioApi`

### 8.1 Vite plugin + virtual module

`apps/dev-server/vite.config.ts`:

- New `eduPacksLoader()` plugin added to **both** plugin arrays (local: after `eduPackageLoader()`; browser: after `virtualPackagePlugin()`).
- It mirrors `eduPackageLoader`'s lifecycle: in `configResolved` resolve `OPEN_EDU_PACKS_DIR` (default `join(findWorkspaceRoot(__dirname), 'packs')`, resolving relative paths against the workspace root per L19); in `buildStart` call `loadPacksDir(dir)` from `@open-edu/packs/loader`, serialize `Array.from(packs.values())` to `packData`; any error-severity diagnostics are printed via `config.logger.error` (never thrown — one bad pack must not fail the dev server).
- `findWorkspaceRoot` does **not** exist in `vite.config.ts` — define it inline next to the plugin (walk up from `startDir` until `pnpm-workspace.yaml` is found; mirror `resolveRepoRoot` in `packages/domain-guidance/src/generate.ts:18-27`):

  ```ts
  function findWorkspaceRoot(startDir: string): string {
    let dir = startDir;
    for (;;) {
      if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
      const parent = dirname(dir);
      if (parent === dir) return startDir;
      dir = parent;
    }
  }
  ```

- **One plugin, no fallback plugin.** `eduPacksLoader()` owns the module entirely: `resolveId` matches `PACKS_VIRTUAL_MODULE_ID = 'virtual:open-edu-packs'` (return `'\0' + id`); `load` returns `` `export const packData = ${JSON.stringify(packData ?? null)};` `` where `packData` starts as `null` and is set in `buildStart` (which runs before any module is loaded, both in dev and build — so no second `virtualPacksPlugin()` is needed or wanted: two plugins on the same id would shadow each other).

`apps/dev-server/src/env.d.ts` add:

```ts
declare module 'virtual:open-edu-packs' {
  import type { LoadedPack } from '@open-edu/packs';
  export const packData: LoadedPack[] | null;
}
```

`apps/dev-server/vitest.config.ts` (mirror the existing `resolve-virtual-module` plugin at `:6-15`) add a
resolve/load for `virtual:open-edu-packs` returning `export const packData = null;`.

### 8.2 Shared pack API

`apps/dev-server/src/studio/packs/packSource.ts`:

```ts
import { packData } from 'virtual:open-edu-packs';
import type { LoadedPack } from '@open-edu/packs';
export function getBundledPacks(): LoadedPack[] {
  return packData ?? [];
}
```

`apps/dev-server/src/studio/packs/packApi.ts` (pure, shared by both factories):

```ts
import widgetCatalogData from '@open-edu/core/widget-catalog-data';
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
      intents: (e.learningIntents ??
        []) as AuthoringContext['availableActivities'][number]['intents'],
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
```

Notes: `loadPacksDir` is NOT used in the browser-safe `packApi` (data arrives via the virtual module);
`listProfiles` is NOT needed here (the learner select in §9.2 imports it from the
`@open-edu/domain-guidance/profiles` subpath — never the package root, rule 11).

### 8.3 `StudioApi` methods

`apps/dev-server/src/studio/studioApi.ts` — add to the interface (and import `PackSummary`, `PackDetail`,
`AuthoringContext`, `PackDiagnostic` types from `@open-edu/packs`):

```ts
listPacks(): Promise<PackSummary[]>;
getPackDetail(id: string, version: string): Promise<PackDetail | null>;
setAuthoringSelection(selection: {
  curriculum: string;
  unit?: string;
  learner?: string;
  locale?: string;
}): Promise<{ context: AuthoringContext; warnings: PackDiagnostic[] }>;
```

Implement identically in `localStudioApi.ts` and `browserStudioApi.ts` by delegating to the shared
`packApi` helpers over `getBundledPacks()` (both are async → `Promise.resolve(...)` or `async`).

Update `studioApi.contract.test.ts` (add the 3 method names to the `methodNames` array) and add
`browserStudioApi.test.ts` coverage (methods present and `listPacks` returns `[]` under the vitest null
stub; `setAuthoringSelection` with a fixture `packs` array returns a context + warnings).

`apps/dev-server/package.json` `dependencies` add `"@open-edu/packs": "workspace:*"`.

### 8.4 Tests

`apps/dev-server/src/studio/packs/packApi.test.ts`: with a fixture `LoadedPack[]` (built from the example
packs via a tiny in-test helper importing the JSON files), assert:

- `summarizePacks` — counts match §5.4's expectations for both fixtures; `detailPack(id, version)` →
  unit list (`fractions`, `measurement`) + concept list for knowledge packs; unknown id → `undefined`.
- `resolveSelection` happy path, unit `fractions` (real 28-entry catalog): context populated
  (curriculumUnit `fractions`, concepts/objectives from the unit), `availableActivities.length === 25`
  with `'availableActivities'` in `budget.truncated` (resolver cap), **warnings = exactly one
  `CAPABILITY_GAP`** for `name-parts` (intents `[recall]` has no catalog candidate under
  `[math, fractions]` — verified matrix, §2 facts); `represent-fraction` has `math.number-line`.
- `resolveSelection`, unit `measurement`: **warnings = exactly one `OBJECTIVE_NO_CONCEPTS`** for
  `measure-length` (its `practice` intent DOES match, so no gap there).
- `resolveSelection` with an unknown curriculum id → throws with a `PackDiagnostic` code attached
  (cast-error pattern, not `new StudioApiError`).

The "catalog that lacks a capacity for an objective" scenario is covered in
`packages/packs/src/resolve.test.ts` instead (via `ResolveAuthoringContextOptions.availableActivities`,
which `resolveSelection` hardwires to the real catalog) — inject a reduced activity list and assert the
`CAPABILITY_GAP` warning.

**Exit:** §0.3 subset (`dev-server`); `pnpm --filter @open-edu/dev-server test`.

---

## 9. Phase 7 — Story 1.6: selection UI + concept/provenance panel

**Commit:** `feat(studio): add pack selection UI and concept and provenance browser panel`

### 9.1 i18n keys (`packages/i18n/locales/en/studio.json`)

Add flat dotted keys:

```json
"packs.selectionHeading": "Create from a curriculum pack",
"packs.selectionLede": "Pick a curriculum, unit, learner, and language to ground your course.",
"packs.curriculumLabel": "Curriculum",
"packs.curriculumPlaceholder": "Choose a curriculum…",
"packs.unitLabel": "Unit",
"packs.unitAll": "All units",
"packs.learnerLabel": "Learner",
"packs.languageLabel": "Language",
"packs.createButton": "Create Learning Experience",
"packs.noneFound": "No curriculum packs found. Set OPEN_EDU_PACKS_DIR to a packs directory.",
"packs.loadError": "Could not load the authoring context: {{code}}",
"packs.contextApplied": "Grounded on {{pack}} ({{unit}})",
"outline.tabPacks": "Packs",
"packs.panelTitle": "Pack context",
"packs.packsHeading": "Packs",
"packs.panelLede": "Concepts, provenance, and capability gaps for this course.",
"packs.conceptsHeading": "Concepts",
"packs.conceptsEmpty": "No concepts in scope.",
"packs.objectivesHeading": "Objectives",
"packs.provenanceHeading": "Provenance",
"packs.provenanceEmpty": "No pack provenance recorded yet.",
"packs.gapsHeading": "Capability gaps",
"packs.gapsEmpty": "No capability gaps.",
"packs.sourceDocument": "Source",
"packs.truncatedHeading": "Budget truncation",
"packs.truncatedNone": "The context fits the prompt budget.",
"packs.sectionObjectives": "Objectives",
"packs.sectionConcepts": "Concepts",
"packs.sectionUnitTitle": "Unit title",
"packs.sectionAvailableActivities": "Available activities",
"packs.assistantPreset": "Create a course based on the selected curriculum unit: {{unit}} ({{curriculum}}). Ground every lesson in the provided concepts and satisfy each objective's required learning intents using only the available activities."
```

### 9.2 `PackSelectionPanel.tsx`

New `apps/dev-server/src/studio/components/PackSelectionPanel.tsx`. Props: `{ api, onError, onAuthoring }`
where `onAuthoring: (context: AuthoringContext, warnings: PackDiagnostic[]) => void`.

- On mount, `api.listPacks()` → filter `type === 'curriculum'` → populate curriculum `Select`
  (design-system `Select*` primitives, `t('studio.packs.curriculumPlaceholder')` default). Show
  `EmptyState` with `t('studio.packs.noneFound')` when empty.
- `api.getPackDetail(curriculumId, version)` → unit `Select` (options = unit ids + `t('studio.packs.unitAll')`).
- Learner `Select` from `listProfiles()` (`id` value, `name` label), default `'neurotypical'` — **import from `@open-edu/domain-guidance/profiles` (subpath, rule 11), never the package root.**
- Language `Select` from `SUPPORTED_LOCALES` (import `@open-edu/i18n/locale`), default `'en'`.
- `[Create Learning Experience]` button: `await api.setAuthoringSelection({curriculum, unit, learner, locale})`
  → `onAuthoring(context, warnings)` → `openWithPreset({ message: t('studio.packs.assistantPreset', {unit, curriculum}), prefill: true })` (the assistant provider is obtained via `useStudioAssistant()`).
- Errors → `onError(error.message)`; wrap `setAuthoringSelection` errors (message includes code via L13 StudioApiError).

Render in `HomeView.tsx` immediately above the existing AI `section` (`AiStartPanel`).

### 9.3 `PackBrowserPanel.tsx`

New `apps/dev-server/src/studio/components/PackBrowserPanel.tsx` — read-only panel, props
`{ authoring: AuthoringContext | null; warnings: PackDiagnostic[]; capabilityGaps: string[] }`:

- Pack list (`authoring.packs`) — `type/id@version` under `t('studio.packs.packsHeading')` (this is where the §28 "manifest ID/version displayed" check is satisfied).
- Concepts list (`authoring.concepts`) — `ref.pack/ref.concept` + `summary`.
- Objectives list (`authoring.objectives`) — id, description, `requiresIntents`, bloom level.
- Provenance (`authoring.provenance`) — pack/version/documents.
- **Budget truncation** (`authoring.budget.truncated`): heading `t('studio.packs.truncatedHeading')`;
  map each section name through `packs.sectionObjectives`/`sectionConcepts`/`sectionUnitTitle`/
  `sectionAvailableActivities` (unknown name → raw string); empty → `t('studio.packs.truncatedNone')`.
- Warnings + `capabilityGaps` under `t('studio.packs.gapsHeading')`.
- All empty states use the keys above. axe-clean semantic lists.

Add as a **third tab** in `OutlineWorkspace.tsx`: extend `OutlineTab` (in `studioSession.ts`) with
`'packs'`, add a `<TabsTrigger value="packs">` (`t('studio.outline.tabPacks')`) and a
`<TabsContent value="packs">` rendering `PackBrowserPanel`.

### 9.4 StudioApp wiring

`StudioApp.tsx`:

- New state `const [authoring, setAuthoring] = useState<AuthoringContext | null>(null)`,
  `const [authoringWarnings, setAuthoringWarnings] = useState<PackDiagnostic[]>([])`,
  `const [capabilityGaps, setCapabilityGaps] = useState<string[]>([])`.
- Pass `onAuthoring={(ctx, warns) => { setAuthoring(ctx); setAuthoringWarnings(warns); }}` to `PackSelectionPanel`.
- Pass `authoring={authoring}` to `StudioContextBridge` (new optional prop, see Phase 8).
- Pass `authoring`, `authoringWarnings`, `capabilityGaps` into `OutlineWorkspace` → `PackBrowserPanel`.
- **In this phase**, extend `CommitCourseDraftResult` (`apps/dev-server/src/studio/ai/commitCourseDraft.ts:38-43`)
  with `capabilityGaps?: string[]` (optional — no producer yet; Phase 10 fills it). The `'invalid-blueprint'`
  `code` union member is added later, in Phase 10 §12.3.
- After `commitCourseDraft` resolves (existing call site in `StudioAssistantChat.tsx`), if result has
  `capabilityGaps`, call `setCapabilityGaps`. Since the commit happens inside the chat component, thread a
  callback down or lift commit handling; choose the least invasive: add an optional
  `onCapabilityGaps?: (gaps: string[]) => void` prop to the assistant chat surface wired from StudioApp.

### 9.5 Tests

- `PackSelectionPanel.test.tsx`: renders; empty state when `listPacks` returns `[]`; selects render; clicking
  Create calls `setAuthoringSelection` then `onAuthoring`; error path calls `onError`. a11y (axe) via the
  existing `studio-a11y.test.tsx` pattern.
- `PackBrowserPanel.test.tsx`: renders concepts/provenance/gaps; truncation section renders
  `budget.truncated` (both the notice and the `truncatedNone` empty state); empty states; a11y.
- `OutlineWorkspace.test.tsx`: third tab present.

**Exit:** regenerate tailwind (rule 9); §0.3 subset (`dev-server`); `pnpm --filter @open-edu/dev-server test`.

---

## 10. Phase 8 — Story 1.7: AI grounding

**Commit:** `feat(studio): ground course generation prompts with the authoring context`

### 10.1 Prompt renderer

`apps/dev-server/src/studio/ai/prompts/authoringContext.ts`:

```ts
import type { AuthoringContext } from '@open-edu/packs';

export function renderAuthoringContextBlock(ctx: AuthoringContext): string {
  const packs = ctx.packs.map((p) => `- ${p.type}/${p.id}@${p.version}`).join('\n');
  const concepts = ctx.concepts
    .map((c) => `- ${c.ref.pack}/${c.ref.concept}: ${c.summary}`)
    .join('\n');
  const objectives = ctx.objectives
    .map(
      (o) =>
        `- ${o.id} (${o.bloomLevel ?? 'n/a'}): ${o.description} — requiresIntents: [${o.requiresIntents.join(', ')}]`,
    )
    .join('\n');
  const activities = ctx.availableActivities
    .map((a) => `- ${a.id}${a.domain ? ` (${a.domain})` : ''}: intents [${a.intents.join(', ')}]`)
    .join('\n');
  return [
    'AUTHORING CONTEXT:',
    'Packs:',
    packs || '- (none)',
    '',
    `Curriculum unit: ${ctx.curriculumUnit ?? '(none selected)'}`,
    `Learner profile: ${ctx.learner ?? '(none)'}`,
    `Locale: ${ctx.locale ?? 'en'}`,
    '',
    'Objectives — satisfy each objective with an activity whose learning intents cover requiresIntents, using ONLY the available activities below:',
    objectives || '- (none)',
    '',
    'Concepts:',
    concepts || '- (none)',
    '',
    'Available activities — use ONLY these widget ids in this course:',
    activities || '- (none)',
    '',
    'Provenance (packs and source documents this course is derived from):',
    ctx.provenance
      .map((p) => `- ${p.pack}@${p.version}: ${p.documents.join(', ') || '(no documents)'}`)
      .join('\n') || '- (none)',
  ].join('\n');
}
```

### 10.2 `buildCourseSpecPrompt` signature

`prompts/coursePrompt.ts`:

```ts
import type { AuthoringContext } from '@open-edu/packs';
import { renderAuthoringContextBlock } from './authoringContext.js';

export function buildCourseSpecPrompt(
  notes: string,
  options?: { locale?: string; authoring?: AuthoringContext },
): string {
  const sections = [
    "You are an expert curriculum designer. Turn the teacher's notes below into a short, high-quality OpenEdu course.",
    '',
    'TEACHER NOTES:',
    notes.trim(),
    '',
    COURSE_SPEC_CONTRACT,
    '',
    renderWidgetCatalogSection(),
  ];
  if (options?.authoring) {
    sections.push('', renderAuthoringContextBlock(options.authoring));
  }
  if (options?.locale) {
    sections.push(
      '',
      `The author has requested locale "${options.locale}". Set metadata.language to "${options.locale}".`,
    );
  }
  return sections.join('\n');
}
```

### 10.3 Thread `authoring`/`locale` through generation

- `generateCoursePackage.ts`: notes source variant gains `locale?: string; authoring?: AuthoringContext`;
  `resolveCourseSpec` calls `buildCourseSpecPrompt(source.notes, { locale: source.locale, authoring: source.authoring })`.
- `generateCourse.ts`: `GenerateCourseOptions` gains `authoring?: AuthoringContext; locale?: string`.
  `DraftEntry` gains `specPath: string; authoring?: AuthoringContext;`. Set `specPath` from the existing
  `specPath` local (already computed), and store `authoring` (Phase 10/11 use it).
- `middleware.ts` `/api/studio/ai/generate-draft`: body type gains `authoring?: unknown; locale?: string`;
  validate `authoring` with `AuthoringContextSchema.safeParse` (reject 400 `spec-invalid` on failure);
  pass `{ source: {...source, authoring, locale}, packageDir }` to `generateCourseDraft`.
- `chat/tools.ts` `GenerateCourseRequest` gains `authoring?: AuthoringContext; locale?: string`; pass through
  to `generateCourseDraft({ source: {...source, authoring, locale}, packageDir })`.
- `agentLoop.ts` `runDeterministicTool` `generate_course` branch: pass
  `authoring: request.context.authoring` and
  `locale: request.context.authoring?.locale ?? request.context.locale` into `generateCourseDraftTool`
  (authoring's locale wins when set; the snapshot's top-level `locale` is the fallback).
- `localStudioApi.ts` `generateCourseDraft`/`uploadSpecDraft`/`generateFromNotes`/`uploadSpec`: add optional
  trailing `options?: { authoring?: AuthoringContext; locale?: string }` included in the POST body. (Chat
  path is the primary consumer; these keep parity for the spec-attach flow.)

### 10.4 `StudioContextBridge` + compact chat section

`StudioContextBridge.tsx`: add `authoring?: AuthoringContext` prop; set `snapshot.authoring = authoring` when present.

`chat/policy.ts` `buildSystemPrompt`: append a compact section (fixed size, no summaries) when `ctx.authoring`:

```ts
if (ctx.authoring) {
  const a = ctx.authoring;
  prompt += `\n\nAUTHORING CONTEXT (compact):
Packs: ${a.packs.map((p) => `${p.type}/${p.id}@${p.version}`).join(', ') || '(none)'}
Curriculum unit: ${a.curriculumUnit ?? '(none)'}
Learner: ${a.learner ?? '(none)'} | Locale: ${a.locale ?? 'en'}
Objectives: ${a.objectives.length} | Concepts: ${a.concepts.length} | Available activities: ${a.availableActivities.length}
Objective ids: ${a.objectives.map((o) => o.id).join(', ') || '(none)'}
`;
}
```

### 10.5 Tests

- `prompts/__tests__/authoringContext.test.ts`: block includes objectives/activities/concepts; empty context renders `- (none)`.
- `prompts/__tests__/coursePrompt.test.ts`: `buildCourseSpecPrompt('notes', { authoring })` contains the block and the locale line.
- `chat/policy.test.ts`: system prompt with a large `authoring` stays under `MAX_CONTEXT_CHARS` (compact section bounded).
- `generateCourse.test.ts`: `generateCourseDraft` stores `specPath` + `authoring` on the `DraftEntry` (assert via `getDraftEntry`).

**Exit:** §0.3 subset (`dev-server`); `pnpm --filter @open-edu/dev-server test`.

---

## 11. Phase 9 — Story 1.8: `objective-intent` skill

**Commit:** `feat(studio): add objective-intent skill and resolveSkills rule`

`apps/dev-server/src/studio/ai/skills/objective-intent.ts`:

```ts
import type { CompanionSkill } from '@open-edu/companion';

export const objectiveIntentSkill: CompanionSkill = {
  id: 'objective-intent',
  description:
    'Satisfy each curriculum objective with an activity whose learning intents cover its requiresIntents.',
  instructions:
    "For every objective in AUTHORING CONTEXT, emit an activity whose learning intents (from the AVAILABLE ACTIVITIES table) cover ALL of the objective's requiresIntents. Use only activity ids listed under AVAILABLE ACTIVITIES. When no listed activity covers an objective's intents, fall back to a reading, exercise, or reflection activity rather than inventing a widget id.",
  tools: ['generate_course'],
};
```

`skillRegistry.ts`: add `objectiveIntentSkill` to the default `skills` array.

`skills/resolveSkills.ts`: add Rule 3 after Rule 2:

```ts
// Rule 3: objective-intent skill
if (ctx?.authoring?.objectives && ctx.authoring.objectives.length > 0) {
  const skill = allSkills.find((s) => s.id === 'objective-intent');
  if (skill) resolved.push(skill);
}
```

Test: extend `apps/dev-server/src/studio/ai/skills.test.ts` (or the equivalent existing resolver test) —
context with `authoring.objectives` resolves `objective-intent`; context without it does not.

**Exit:** `pnpm --filter @open-edu/dev-server test`.

---

## 12. Phase 10 — Story 1.9: blueprint validation

**Commit:** `feat(studio): validate drafts against the authoring context at commit`

### 12.1 packs `src/blueprint.ts` (pure)

```ts
import type { AuthoringContext } from './context.js';
import type { PackDiagnostic } from './types.js';

export interface BlueprintFacts {
  audience?: string;
  expectedAudience?: string; // set by the caller from getProfile(learner).audience
  lessons: Array<{ id: string; objectives: string[]; widgetIds: string[] }>;
}
export interface BlueprintValidation {
  violations: PackDiagnostic[];
  capabilityGaps: string[];
}

export function validateBlueprint(
  authoring: AuthoringContext,
  facts: BlueprintFacts,
): BlueprintValidation {
  const available = new Map(authoring.availableActivities.map((a) => [a.id, a]));
  const violations: PackDiagnostic[] = [];
  const gaps: string[] = [];

  // Check 1 — every emitted widgetId must be an available activity.
  for (const lesson of facts.lessons) {
    for (const widgetId of lesson.widgetIds) {
      if (!available.has(widgetId)) {
        violations.push({
          code: 'BLUEPRINT_WIDGET_UNKNOWN',
          severity: 'error',
          message: `lesson "${lesson.id}" references unavailable widget "${widgetId}"`,
        });
      }
    }
  }

  // Check 3 — audience must match the selected profile when both are present.
  if (facts.expectedAudience && facts.audience && facts.audience !== facts.expectedAudience) {
    violations.push({
      code: 'BLUEPRINT_AUDIENCE_MISMATCH',
      severity: 'error',
      message: `metadata.audience "${facts.audience}" does not match the selected profile audience "${facts.expectedAudience}"`,
    });
  }

  // Check 2 — every objective's requiresIntents is satisfied by an emitted activity, else CAPABILITY_GAP.
  const emittedWidgetIds = new Set(facts.lessons.flatMap((l) => l.widgetIds));
  for (const objective of authoring.objectives) {
    const satisfied = [...emittedWidgetIds].some((id) => {
      const activity = available.get(id);
      return activity && objective.requiresIntents.every((i) => activity.intents.includes(i));
    });
    if (!satisfied) {
      gaps.push(
        `objective-${objective.id}: no activity matched intents [${objective.requiresIntents.join(', ')}]`,
      );
    }
  }

  return { violations, capabilityGaps: gaps };
}
```

Export from packs `index.ts` (pure).

### 12.2 dev-server `ai/provenance.ts` + commit gate

New `apps/dev-server/src/studio/ai/provenance.ts`:

```ts
import type { CourseModel } from '@open-edu/course-compiler';
import { getProfile } from '@open-edu/domain-guidance';
import { validateBlueprint, type AuthoringContext, type BlueprintFacts } from '@open-edu/packs';
import { fingerprintAuthoringContext } from '@open-edu/packs/fingerprint';
import type { ReproductionRecord } from '@open-edu/schemas';

export function factsFromModel(model: CourseModel): BlueprintFacts {
  return {
    audience: model.metadata.audience,
    lessons: model.lessons.map((l) => ({
      id: l.id,
      objectives: l.objectives.map((o) => o.description),
      widgetIds: (l.activities ?? []).filter((a) => a.type === 'widget').map((a) => a.widgetId),
    })),
  };
}

export function buildProvenance(
  authoring: AuthoringContext,
  model: CourseModel,
  generatedAt: string,
): { record: ReproductionRecord; capabilityGaps: string[] } {
  const facts = factsFromModel(model);
  facts.expectedAudience = authoring.learner ? getProfile(authoring.learner)?.audience : undefined;
  const { capabilityGaps } = validateBlueprint(authoring, facts);

  const nodes = model.lessons.map((lesson) => {
    const matchedObjectiveIds = lesson.objectives
      .map(
        (o, i) =>
          authoring.objectives.find((ctx) => ctx.description === o.description)?.id ??
          authoring.objectives[i]?.id,
      )
      .filter((id): id is string => Boolean(id));
    const objectives = authoring.objectives.filter((o) => matchedObjectiveIds.includes(o.id));
    return {
      path: `nodes/${lesson.id}.md`,
      objectives: matchedObjectiveIds,
      concepts: objectives.flatMap((o) => o.concepts),
      widgets: (lesson.activities ?? []).filter((a) => a.type === 'widget').map((a) => a.widgetId),
      capabilityGaps: capabilityGaps.filter((g) =>
        matchedObjectiveIds.some((id) => g.startsWith(`objective-${id}:`)),
      ),
    };
  });

  return {
    capabilityGaps,
    record: {
      schemaVersion: 1,
      packs: authoring.packs,
      generatedAt,
      contextFingerprint: fingerprintAuthoringContext(authoring),
      nodes,
    },
  };
}
```

### 12.3 Wire into commit (local, §23.2 gate)

`commitCourseDraft.ts`:

- Import `parseCourseSpec` / `parseCourseSpecJSON` from `@open-edu/course-compiler`, `buildProvenance`,
  `validateBlueprint`.
- After `getDraftEntry` and before `cp`, when `entry.authoring` present:
  1. Read `entry.specPath` text. If extension `.json` → `parseCourseSpecJSON(text).model`; else
     `parseCourseSpec(text).model`. If `model` is null, fail with
     `{ success: false, code: 'invalid-blueprint', error: <first diagnostic's .message> ?? 'course spec failed to parse' }`
     (keep draft; `error` is a **string** — `CommitCourseDraftResult.error?: string` at `:41`).
  2. Build facts + `expectedAudience`; run `validateBlueprint`; if `violations.length > 0`, return
     `{ success: false, code: 'invalid-blueprint', error: violations[0].message }` WITHOUT `deleteDraft` and WITHOUT `cp`.
  3. On success: after `cp` (and before `deleteDraft`), write `provenance.json` (Phase 11).
- Extend `CommitCourseDraftResult`: `code` union gains `'invalid-blueprint'` here
  (`capabilityGaps?: string[]` was already added in Phase 7 §9.4; populate it from
  `buildProvenance(...).capabilityGaps` on the success path).
- Add `'provenance.json'` to the force-clear list at `:59`.

### 12.4 Browser generate-time gate (L16)

`generateCourse.ts` `generateCourseDraft`: add option `finalize?: boolean` (default false). When
`finalize` is true AND `options.authoring` is present, after compile: parse `specPath` (json/md) →
model; run `validateBlueprint`; on violation return `errorResult('invalid-blueprint', …)` (no draft
stored); otherwise `buildProvenance` and write `provenance.json` into `outputDir` so `readDraftFiles`
carries it. `middleware.ts` sets `finalize: body.includeFiles === true`.

**Touch note:** `errorResult('invalid-blueprint', …)` requires adding `'invalid-blueprint'` to
`AiGenerateErrorCode` in **`packages/companion/src/types.ts:14-22`** (the dev-server `ai/types.ts` only
re-exports it) — the Companion row of §0.1 covers this; without it `pnpm typecheck` fails.

### 12.5 Tests

- `packages/packs/src/blueprint.test.ts`: unknown widgetId → violation; audience mismatch → violation;
  satisfied intents → no gap; unsatisfied → gap string format (L12); no widget activities at all → every objective gapped.
- `apps/dev-server/src/studio/ai/provenance.test.ts`: `factsFromModel`/`buildProvenance` node mapping (description-match + order fallback), `capabilityGaps` per node, `contextFingerprint` prefixed `sha256:`.
- `commitCourseDraft.test.ts`: draft with authoring + unknown widget spec → `{ success:false, code:'invalid-blueprint' }` and draft still present; valid → success + `provenance.json` written + `capabilityGaps` returned; force path removes a stale `provenance.json`.

**Exit:** `pnpm --filter @open-edu/packs build`; §0.3 subset (`packs`, `dev-server`).

---

## 13. Phase 11 — Story 1.10: `provenance.json` write + lenient read

**Commit:** `feat(provenance): record pack lineage in provenance.json`

### 13.1 schemas

`packages/schemas/src/provenance.ts`:

```ts
import { z } from 'zod';

export const ReproductionNodeSchema = z.object({
  path: z.string(),
  objectives: z.array(z.string()).default([]),
  concepts: z.array(z.object({ pack: z.string(), concept: z.string() })).default([]),
  widgets: z.array(z.string()).default([]),
  capabilityGaps: z.array(z.string()).default([]),
});

export const ReproductionRecordSchema = z.object({
  schemaVersion: z.literal(1),
  packs: z.array(
    z.object({ id: z.string(), version: z.string(), type: z.enum(['knowledge', 'curriculum']) }),
  ),
  generatedAt: z.string(),
  contextFingerprint: z.string(),
  nodes: z.array(ReproductionNodeSchema),
});

export type ReproductionRecord = z.infer<typeof ReproductionRecordSchema>;
```

Re-export from `packages/schemas/src/index.ts`.

### 13.2 core

`packages/core/src/provenance.ts`:

```ts
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
```

`packages/core/src/file-loader.ts`: load `provenance` leniently alongside workflow/rewards/cards:

```ts
const [workflow, rewards, cards, provenance] = await Promise.all([
  parseOptional(source, 'workflow.json', parseWorkflow) as Promise<Workflow | null>,
  parseOptional(source, 'rewards.json', parseRewards) as Promise<Rewards | null>,
  parseOptional(source, 'cards.json', parseCards) as Promise<CardDefinitions | null>,
  parseOptional(source, 'provenance.json', parseProvenance) as Promise<ReproductionRecord | null>,
]);
```

Add `provenance?: ReproductionRecord` to `LoadedPackage` (`packages/core/src/types.ts`) and attach it as
`provenance: provenance ?? undefined` (mirror `rewards`/`cards`). Re-export the type where relevant.

### 13.3 dev-server commit write

`commitCourseDraft.ts` success path (after `cp`, before `deleteDraft`) — when `entry.authoring`:

```ts
const record = buildProvenance(entry.authoring, model, new Date().toISOString()).record;
await writeFile(join(packageDir, 'provenance.json'), JSON.stringify(record, null, 2), 'utf-8');
```

(Add `writeFile` to the existing `node:fs/promises` import.) Store `capabilityGaps` in the result.

### 13.4 Tests

- `packages/schemas/src/provenance.test.ts`: parse valid; reject bad `schemaVersion`.
- `packages/core/src/__tests__/provenance.test.ts` (or extend the file-loader test): a package with a valid
  `provenance.json` loads with `loadedPackage.provenance` populated; **invalid JSON / bad schema / missing →
  lenient (`loadedPackage.provenance === undefined`, no throw)** — this is the deliberate divergence from the
  strict workflow/rewards/cards parsers (§13.2).
- `commitCourseDraft.test.ts` (extended from Phase 10): provenance file contents match the fixture context.

**Exit:** `pnpm --filter @open-edu/schemas build && pnpm --filter @open-edu/core build`; §0.3 subset (`schemas`, `core`, `dev-server`).

---

## 14. Phase 12 — Story 1.11: `edu pack validate`

**Commit:** `feat(cli): add pack validate command`

`packages/cli/package.json` `dependencies` add `"@open-edu/packs": "workspace:*"`.

`packages/cli/src/commands/pack.ts` — a **plain function returning `CliResult`**, exactly like
`commands/validate.ts` (no commander `Command` here, no `handleResult` import — `handleResult` is
private to `cli.ts:340`, and `CliResult` uses `success`, not `ok`):

```ts
import { resolve } from 'node:path';
import { loadPackDirectory, PackValidationError } from '@open-edu/packs/loader';
import type { CliResult } from '../utils/json-output.js';

export async function validatePack(
  packDir: string,
  options?: { json?: boolean },
): Promise<CliResult> {
  try {
    const loaded = loadPackDirectory(resolve(packDir));
    return {
      success: true,
      data: {
        valid: true,
        id: loaded.manifest.id,
        type: loaded.manifest.type,
        version: loaded.manifest.version,
        concepts: loaded.concepts?.length ?? 0,
        units: loaded.curriculum?.units.length ?? 0,
      },
    };
  } catch (error) {
    const diagnostics =
      error instanceof PackValidationError
        ? error.diagnostics
        : [{ code: 'PACK_MANIFEST_INVALID', severity: 'error', message: String(error) }];
    return {
      success: false,
      error: diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'),
      code: 1,
    };
  }
}
```

(`CliResult` is `{ success, data?, error?, code? }` — verify the field names against
`packages/cli/src/utils/json-output.ts` while writing; there is no `ok`.) Non-JSON human output may use
`formatValidationError`/`printMessages` from `../utils/format.js` if a nicer rendering is wanted — optional.

`packages/cli/src/cli.ts`: register inline, mirroring the existing `validate` command at `:42-54`
(it owns `--json` via `program.optsWithGlobals()` and calls the private `handleResult`):

```ts
program
  .command('pack')
  .description('Validate and inspect OpenEdu packs.')
  .command('validate <dir>')
  .description('Validate a pack directory (manifest, concepts, curriculum, prerequisites).')
  .action(async (dir: string) => {
    const json = program.optsWithGlobals().json;
    const result = await validatePack(dir, { json });
    handleResult(result, json);
  });
```

Test `packages/cli/src/commands/pack.test.ts`: valid fixture → `success: true` + `data.id === 'openedu-fractions'`;
invalid temp dir → `success: false`, `code: 1`, diagnostic code present in `error`
(mirror `validate.test.ts` assertions; exercise the function directly, not the CLI process).

**Exit:** `pnpm --filter @open-edu/cli build && pnpm --filter @open-edu/cli test`; manual:
`node packages/cli/dist/cli.js pack validate examples/packs/knowledge/openedu-fractions`.

---

## 15. Phase 13 — Story 1.12: locale propagation

**Commit:** `feat(course-compiler): propagate metadata.language from the authoring locale`

`packages/course-compiler/src/parser/json-input.ts`:

- `CourseSpecJSONSchema.metadata` gains `language: z.string().optional()`.
- `parseCourseSpecJSON` at `:188` change `language: 'en'` → `language: parsed.metadata.language ?? 'en'`.

`packages/domain-guidance/src/generate.ts` `AUTHORED_PROMPT_RULES` add:

```ts
'"metadata.language" must be one of the supported locales ("en", "hi", "or"); use the locale requested by the author, defaulting to "en".',
```

Regenerate: `pnpm --filter @open-edu/domain-guidance generate` (updates `artifact-contract.json`; commit it).

Tests: `packages/course-compiler/src/parser/__tests__/json-input.test.ts` — spec with `metadata.language: 'hi'`
→ model `metadata.language === 'hi'`; absent → `'en'`. domain-guidance: extend the existing rule test (or
`generate.test.ts`) to assert the new rule string is in `AUTHORED_PROMPT_RULES` and that the regenerated
`artifact-contract.json` **now includes `language` in `metadataFields`** — the contract is generated by live
introspection of `CourseSpecJSONSchema.shape.metadata` (`schema-facts.ts:102,116`; asserted against the live
schema in `domain-guidance.test.ts:44`), so the field addition **does** change it — commit the regenerated
file; do not expect it to be unchanged.

**Exit:** `pnpm --filter @open-edu/course-compiler test && pnpm --filter @open-edu/domain-guidance test`.

---

## 16. Phase 14 — Story 1.13: coverage + e2e + acceptance

**Commit 14a:** `test(pack-system): cover Phase 1 acceptance criteria`
**Commit 14b:** `test(e2e): add pack selection studio flow`

### 16.1 Coverage sweep

Confirm every story has at least one vitest file (the lists in §4–§15). Add any missing pure-function
coverage (notably `resolveSelection` error→throw path, `loadPacksDir` skip-on-invalid, fingerprint
byte-determinism).

### 16.2 e2e

`playwright.config.ts` webServer env block (`:36-40`, the 4002 browser-mode entry) add
`OPEN_EDU_PACKS_DIR: 'examples/packs'`.

`tests/e2e/pack-selection.spec.ts` (browser mode `STUDIO_URL = http://localhost:4002`):

- Load home; assert the pack selection section is visible.
- Select `nios-math-level-a` curriculum + `fractions` unit; click Create; assert the assistant panel
  opens with a prefill message mentioning the unit.
- Open the Packs tab in the outline; assert concepts (`fraction`, `numerator`, `denominator`) render.

### 16.3 §28 acceptance checklist (run and record)

| Check                                                                           | Verified by                                                          |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A pack directory loads and validates                                            | `packages/packs/src/loader.test.ts`                                  |
| Manifest ID/version displayed in Studio                                         | `PackBrowserPanel.test.tsx` + e2e                                    |
| Invalid pack → `PACK_*`/`KNOWLEDGE_*`/`CURRICULUM_*` code, no partial load      | `loader.test.ts`, `pack.test.ts` (CLI)                               |
| Concepts browsable, qualified by pack                                           | `PackBrowserPanel.test.tsx`                                          |
| `{ pack, concept }` resolves or `PACK_REFERENCE_MISSING`                        | `resolve.test.ts`                                                    |
| Provenance displayable for a sourced concept                                    | `resolve.test.ts` (provenance.docs) + panel                          |
| Prerequisite cycles rejected                                                    | `loader.test.ts`                                                     |
| Objectives resolve to candidates via `searchWithFilters`                        | `objectives.test.ts`, `search-filter.test.ts`                        |
| No match → `CAPABILITY_GAP` warning, not failure                                | `resolve.test.ts`, `blueprint.test.ts`                               |
| No pack file contains a widget id or engine name                                | fixture review (none present)                                        |
| Packs + unit + profile compose into `AuthoringContext`                          | `resolve.test.ts`, `packApi.test.ts`                                 |
| Context serializable + under budget                                             | `resolve.test.ts` (budget), `context.ts` schema                      |
| `budget.truncated` populated + displayed                                        | `resolve.test.ts`, `PackBrowserPanel.test.tsx`                       |
| Identical pack versions → byte-identical context                                | `resolve.test.ts` (determinism)                                      |
| AI receives the context                                                         | `coursePrompt.test.ts`, `authoringContext.test.ts`, `policy.test.ts` |
| Spec referencing an unavailable widget is rejected                              | `blueprint.test.ts`, `commitCourseDraft.test.ts`                     |
| Every `requiresIntents` satisfied or `CAPABILITY_GAP`                           | `blueprint.test.ts`                                                  |
| `provenance.json` records versions + node→concept                               | `provenance.test.ts`, `commitCourseDraft.test.ts`, core loader test  |
| `capabilityGaps` surfaced in Studio                                             | `PackBrowserPanel.test.tsx` (gaps section)                           |
| Record pins packs/versions/activities/`contextFingerprint` (lineage not replay) | `provenance.test.ts`, `fingerprint` test                             |

### 16.4 Final gate

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css  # no-op (already regenerated)
git status  # only intended files; spec + plan remain untracked
```

---

## 17. Open items to flag in the PR description (do not resolve silently)

- L10 extends `AuthoringContextSchema.objectives[]` with `concepts` (not in the §17.1 sketch) to make
  node→concept provenance computable at commit without re-reading packs. Called out as a deliberate deviation.
- L16 dual-gates blueprint validation (commit for local, generate for browser) because browser commit never
  reaches `commitCourseDraft` — a documented consequence of the OPFS changeset path.
- Open Question 4 (spec §30) answered: provenance is written on AI commit only; manual edits make the
  record advisory. State this in the PR body.
- `resolveAuthoringContext` returns `{ context, diagnostics }` (L7) whereas spec §18.3 sketches a bare-context
  return; the wrapper exists so error vs warning severity can be split by the Studio layer without exceptions
  inside the pure resolver. Deviation from the sketch, not from §28's no-partial-load rule (errors still throw
  at the Studio boundary via `resolveSelection`).
- `PackDiagnostic` is a local structural `{ code, severity, message }` (L13), intentionally **not** the
  course-compiler `CompilerDiagnostic` type the spec's §23.1 wording alludes to — same shape, no new
  packs→course-compiler dependency edge.
