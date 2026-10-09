# OpenEdu Pack System — Phase 0 Convergence (Agent Execution Plan)

> **For the implementing agent.** This is a turn-key, prescriptive plan for the Phase 0 deliverables
> (P0-1 … P0-7) of the Pack System spec. It resolves every ambiguity, pre-decides every file move,
> and lists each test and verification command. Follow the phases in order; do NOT improvise.
>
> - Spec: `docs/OPENEDU-PACK-SYSTEM.md` — read §6 (Phase 0), §6.1–§6.5, §13.2, §19.1. Everything
>   below encodes those sections.
> - Repo rules: `AGENTS.md` (read it). This plan already encodes the AGENTS.md constraints
>   (schemas-are-source-of-truth, i18n, no inline styles unless dynamic, conventional commits).
> - **Scope is Phase 0 only.** Do NOT create `@open-edu/packs`, do NOT touch `packages/companion`,
>   `packages/course-compiler`, or the Studio AI. Phase 1 (spec §27) is a later plan.
> - Every fact in §2 was verified against the code on this branch. Cite them; do not re-derive.

---

## 0. Environment & non-negotiables

### 0.1 What you will touch (only this)

| Area                   | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schemas (types)        | new `packages/schemas/src/widget-catalog.ts`, new `packages/schemas/src/widget-alias.ts`, `packages/schemas/src/index.ts`, new `packages/schemas/src/widget-alias.test.ts`                                                                                                                                                                                                                                                                                                                                                                        |
| Widgets (roster/types) | `packages/widgets/src/types.ts`, new `packages/widgets/src/builtin-roster.ts`, new `packages/widgets/src/catalog-gen.ts`, `packages/widgets/src/registry.ts`, `packages/widgets/src/domains.ts`, `packages/widgets/src/metadata/learning-intents.ts`, `packages/widgets/src/validate-metadata.ts`, `packages/widgets/src/widget-catalog-source.ts` (deleted), `packages/widgets/src/guide-markdown.ts`, `packages/widgets/src/index.ts`, `packages/widgets/src/metadata/index.ts`, `packages/widgets/package.json` (new `./guide` subpath export) |
| Widgets (scripts)      | `packages/widgets/scripts/generate-catalog.ts`, `packages/widgets/scripts/generate-widget-docs.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Temp scripts (deleted) | new `packages/widgets/scripts/migrate-guides.ts`, new `packages/widgets/scripts/_verify-guides.ts` — written, run, and **deleted in Phase 5**; never committed (§7.3, §0.2 rule 8)                                                                                                                                                                                                                                                                                                                                                                |
| Widgets (builtins)     | all `packages/widgets/src/builtins/**` files that define a `WidgetDefinitionV2` (28 non-deprecated builtins) — add a `guide` object; `MultipleChoice/MultipleChoice.tsx` unchanged except guide                                                                                                                                                                                                                                                                                                                                                   |
| Widgets (tests)        | `packages/widgets/src/__tests__/registry-search-filters.test.ts`, `validate-metadata.test.ts`, `registry-stubs.test.ts`, `metadata/__tests__/learning-intents.test.ts`, `domains.test.ts`, `guide-markdown.test.ts`, new `catalog-generation.test.ts`, new `builtin-roster.test.ts`                                                                                                                                                                                                                                                               |
| Core                   | `packages/core/src/widget-catalog.ts`, `packages/core/src/index.ts`, `packages/core/src/__tests__/widget-catalog.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dev-server (renderer)  | `apps/dev-server/src/studio/widgets/curatedCatalog.ts`, `apps/dev-server/src/studio/widgets/curatedCatalog.test.ts`, `apps/dev-server/src/editor/__tests__/widget-preview.test.tsx`                                                                                                                                                                                                                                                                                                                                                               |
| Docs (staleness fix)   | `apps/docs/docs/widgets/overview.md` (Phase 5 only — it names `widget-catalog-source.ts` as canonical)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Skill (consumer fix)   | `skills/openedu-course-authoring/scripts/summarize-quality.mjs` + `scripts/__tests__/summarize-quality.test.mjs` (**Phase 7 only**, two hardcoded literals — see §9.2)                                                                                                                                                                                                                                                                                                                                                                            |
| Generated data         | `packages/core/src/widget-catalog-data.json` (regenerated; do NOT hand-edit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Do NOT modify** (except where the table above explicitly whitelists a file):
`packages/runtime/**`, `packages/design-system/**`, `packages/i18n/locales/**`, `apps/learner/**`,
the Studio AI (`apps/dev-server/src/studio/ai/**`), the rest of the authoring skill
(`skills/openedu-course-authoring/**` outside the two Phase-7 files), any CLI command logic
(`packages/cli/src/commands/generate.ts` — verify-only), any spec/plan file.

If you believe a file outside this list must change, STOP and report instead of editing.

### 0.2 Hard rules

1. **No hand-editing generated data.** `packages/core/src/widget-catalog-data.json` is generated by
   `pnpm --filter @open-edu/widgets generate:catalog`. Change the source; regenerate; never edit the
   JSON directly.
2. **Types are data, not logic.** The shared `WidgetCatalogEntry` / `WidgetGuideData` /
   `WidgetGuideConfigField` types move to `@open-edu/schemas` (L1). No schema imports logic packages.
3. **No new dependencies.** No `pnpm add` of any kind.
4. **Tests first.** Every changed path and every new module gets a test (TDD: write failing test,
   watch it fail, implement, watch it pass). See §3–§9 step ordering.
5. **No emoji, no debug `console.log`, no dead code, no comments beyond what this plan shows.**
   (The `generate:catalog` script already has a `console.log` — keep it.)
6. **Conventional commits**, one per phase (see each phase header).
7. Run `pnpm format` at the end of each phase.
8. **One-off scripts leave no trace.** The Phase 5 temp scripts (`migrate-guides.ts`,
   `_verify-guides.ts`) are deleted inside the phase (§7.3 step 4), before the §0.3 loop runs.
   `git status packages/widgets/scripts` must show only `generate-catalog.ts` and
   `generate-widget-docs.ts`.

### 0.3 Verification loop (all green before the next phase)

```bash
pnpm --filter @open-edu/schemas test
pnpm --filter @open-edu/schemas typecheck
pnpm --filter @open-edu/widgets test
pnpm --filter @open-edu/widgets typecheck
pnpm --filter @open-edu/core test
pnpm --filter @open-edu/core typecheck
pnpm --filter @open-edu/dev-server test
pnpm lint
pnpm format:check
```

**Build first, and not only at the end.** Workspace packages resolve to `dist/`, so after any change
to a `packages/**` export surface (Phase 4's new `./guide` subpath, Phase 5's type moves) run
`pnpm --filter @open-edu/widgets build` (and `pnpm --filter @open-edu/schemas build` +
`pnpm --filter @open-edu/core build` in Phase 5) **before** the dev-server test in the loop.
Dev-server tests run through Vite and will happily resolve a stale or missing `dist/` subpath with a
confusing error.

After Phase 5 (the first phase that regenerates the catalog JSON) also add:

```bash
pnpm --filter @open-edu/widgets generate:catalog    # must be a no-op
git diff --stat packages/core/src/widget-catalog-data.json  # empty: rerun changed nothing
pnpm --filter @open-edu/widgets generate:widget-docs # must be a no-op (proves the 28 guides were migrated intact)
git status                                          # apps/docs/docs/widget-library/** must be clean
```

---

## 1. Locked decisions (do not revisit)

| #   | Question / ambiguity                                                   | Locked decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Where do the shared `WidgetCatalogEntry` + guide types live?           | **`@open-edu/schemas`** (new `packages/schemas/src/widget-catalog.ts`). Both `@open-edu/widgets` and `@open-edu/core` re-export them. `core` cannot import `@open-edu/widgets` (that pulls React/design-system into a Node package), so the drift fixed here must live in a shared dependency. `schemas/widget-catalog.ts` has **zero imports**.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| L2  | Where does `WIDGET_ALIAS_MAP` live?                                    | **`@open-edu/schemas`** (new `packages/schemas/src/widget-alias.ts`). `core` and `widgets` already depend on `schemas`; `dev-server` depends on both. `widgets/domains.ts` re-exports it and keeps `resolveWidgetId` / `migrateWidgetId` / `getDomainPrefix` / `WidgetDomain`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| L3  | Where does `renderWidgetGuideMarkdown` live?                           | **`@open-edu/widgets`** (`guide-markdown.ts`, already exported from the root). The dev-server private `renderGuideMarkdown` (`curatedCatalog.ts:27-81`) is **deleted** and replaced by an import. The two function bodies are byte-identical. **The dev-server must import it through a new `@open-edu/widgets/guide` subpath, never the package root** (L11). "imported by core and dev-server" in the spec refers to the two items collectively, not the renderer alone (§0.1).                                                                                                                                                                                                                                                                                      |
| L4  | What is the generated catalog's data shape?                            | `learningIntents` → lowercase enum values (the `LearningIntent` strings, already lowercase in `WidgetDefinitionV2`); `capabilities`/`accessibility`/`analytics` → **camelCase keys whose value is `true`** in the V2 boolean maps; `ai.subjectTags` emitted from V2 (currently 27 non-empty); `guide` emitted verbatim. This is the P0-2/P0-3 end-state realized directly by the generator.                                                                                                                                                                                                                                                                                                                                                                            |
| L5  | Does `open-edu.multiple-choice-practice` stay in the roster?           | **No.** P0-4 retires it from `BUILTIN_WIDGETS`, from the catalog, and from `WIDGET_LEARNING_INTENTS`. The `WIDGET_ALIAS_MAP` entry `open-edu.multiple-choice-practice → core.multiple-choice` **stays** (legacy content still resolves). The `LegacyChoiceWidget` const in `MultipleChoice.tsx` and its export in `builtins/index.ts` stay (its test still renders it).                                                                                                                                                                                                                                                                                                                                                                                                |
| L6  | How is `WIDGET_LEARNING_INTENTS` kept in sync?                         | **Derived.** New `packages/widgets/src/builtin-roster.ts` exports `BUILTIN_WIDGETS: WidgetDefinitionV2[]` and builds `WIDGET_LEARNING_INTENTS = Object.fromEntries(BUILTIN_WIDGETS.map(w => [w.id, w.learningIntents]))` plus `getLearningIntentsForWidget` / `getWidgetsByLearningIntent`. `registry.ts` imports `BUILTIN_WIDGETS` from it instead of declaring the array inline.                                                                                                                                                                                                                                                                                                                                                                                     |
| L7  | `intent` (singular) filter — keep or remove?                           | **Keep as deprecated alias.** `WidgetSearchFilters` gains `intents?: LearningIntent[]` (all-of) and `subjectTags?: string[]` (any-of); `intent?: LearningIntent` remains and, when set alone, is treated as `intents: [intent]`. No removal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| L8  | Can the catalog generator import the roster (which imports React)?     | **Yes.** Verified: `tsx -e "import('./src/registry.ts')"` loads the full registry (29 widgets) in Node without error. React/design-system/i18n are installed and side-effect-light at import. The generator maps V2 → plain JSON; `JSON.stringify` drops the `render`/`schema` functions automatically.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| L9  | "generate:catalog fails if any entry diverges" — how is that enforced? | A vitest test (`catalog-generation.test.ts`) generates in-memory and `toEqual`s the checked-in `widget-catalog-data.json`. Any hand-edited JSON that diverges from the roster fails the test. There is no separate runtime check; the test is the gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| L10 | `core` `generateWidgetCatalog` markdown — does it change?              | Intent labels stay title-case (it already does `charAt(0).toUpperCase()`). `capabilities`/`accessibility`/`analytics` now render camelCase keys (e.g. `supportsKeyboard`) instead of PascalCase (`Keyboard`). Cosmetic in core: `core/src/__tests__/widget-catalog.test.ts` uses local fixtures with lowercase intent strings and never reads the generated JSON's flag arrays, so it needs no change. **But one consumer does assert the old casing** — see L11/§9.2.                                                                                                                                                                                                                                                                                                 |
| L11 | How does dev-server import the renderer without breaking Node ESM?     | **New `./guide` subpath export.** `packages/widgets/package.json` gains `"./guide": { "types": "./dist/guide-markdown.d.ts", "import": "./dist/guide-markdown.js" }`, and `curatedCatalog.ts` imports `from '@open-edu/widgets/guide'`. The package root cannot be used: `node -e "import('@open-edu/widgets')"` → `ERR_MODULE_NOT_FOUND ... /dist/types` (extensionless internal dist imports — the exact AGENTS.md failure), and the chain `vite.config.ts → src/studio/ai/middleware.ts → src/studio/ai/itemGenerate.ts:17 → ../widgets/curatedCatalog.js` is live, so loading the root would break the Studio's `vite.config.ts` under Node. `dist/guide-markdown.js` is safe because its only import is `import type` (erased at compile → zero runtime imports). |

---

## 2. Pre-verified facts (cite these; do not re-grep)

| Fact                                                                                                                                                                                                                                                                             | Evidence                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WidgetDefinitionV2` has **no `guide` field** today; metadata fields are already enum/boolean (`learningIntents: LearningIntent[]`, `capabilities: WidgetCapabilities` with `supportsKeyboard` etc., `accessibility`, `analytics`, `ai.subjectTags`)                             | `packages/widgets/src/types.ts:32-52`, `metadata/capabilities.ts`, `metadata/accessibility.ts`, `metadata/analytics.ts`, `metadata/ai.ts:5-18`                                                                                                                                                     |
| The hand-authored catalog has 29 entries, 28 with `guide`, **1 with `subjectTags`**; the deprecated `open-edu.multiple-choice-practice` has no guide                                                                                                                             | `python3 -c "import json;d=json.load(open('packages/core/src/widget-catalog-data.json'));print(len(d), sum(1 for e in d if 'guide' in e), sum(1 for e in d if e.get('ai',{}).get('subjectTags')), [e['id'] for e in d if e.get('deprecated')])"` → `29 28 1 ['open-edu.multiple-choice-practice']` |
| 27 of 28 non-deprecated builtins declare `ai.subjectTags`; `core.process-explainer` is the sole one without                                                                                                                                                                      | grep `subjectTags` across `packages/widgets/src/builtins/**`; `ProcessExplainer.tsx:239-282` (ai has no `subjectTags`)                                                                                                                                                                             |
| `BUILTIN_WIDGETS` is a module-private `WidgetDefinition[]` of 29 in `registry.ts:146-176`; it is **not exported**; the deprecated practice widget is first in the list                                                                                                           | `packages/widgets/src/registry.ts:146-176`                                                                                                                                                                                                                                                         |
| `WIDGET_LEARNING_INTENTS` has 28 keys, missing `core.process-explainer`, and uses `core.multiple-choice-practice` instead of the catalog's `open-edu.` id                                                                                                                        | `packages/widgets/src/metadata/learning-intents.ts:16-49`                                                                                                                                                                                                                                          |
| `WIDGET_ALIAS_MAP` is duplicated: `widgets/src/domains.ts:9-25` and `core/src/widget-catalog.ts:48-64`                                                                                                                                                                           | both files                                                                                                                                                                                                                                                                                         |
| `WidgetCatalogEntry` is duplicated with drift: `widgets/widget-catalog-source.ts:20-48` has `ai.subjectTags`; `core/widget-catalog.ts:5-42` does **not**                                                                                                                         | both files; `subjectTags` absent from `core/widget-catalog.ts:20-30`                                                                                                                                                                                                                               |
| `renderGuideMarkdown` is duplicated: `widgets/src/guide-markdown.ts:3-57` (exported) vs private `dev-server/studio/widgets/curatedCatalog.ts:27-81` (byte-identical bodies)                                                                                                      | both files                                                                                                                                                                                                                                                                                         |
| `WidgetSearchFilters` has `intent?: LearningIntent` (singular), no `intents[]`, no `subjectTags[]`; `searchWithFilters` filters `intent` at `registry.ts:108`, `capability`/`accessibility` at `:112-116`                                                                        | `packages/widgets/src/types.ts:64-72`, `registry.ts:92-120`                                                                                                                                                                                                                                        |
| `validate-metadata.ts` skips the "stable → supportsObserveMode" check when `capabilities` is absent (`widget.capabilities &&` at `:69`), so a stable widget with no capabilities passes clean                                                                                    | `packages/widgets/src/validate-metadata.ts:67-73`                                                                                                                                                                                                                                                  |
| The catalog JSON is written by `widgets/scripts/generate-catalog.ts` (imports `WIDGET_CATALOG_ENTRIES`, `JSON.stringify`), output to `packages/core/src/widget-catalog-data.json`; core re-reads it via `readFileSync` at build/run                                              | `packages/widgets/scripts/generate-catalog.ts`, `packages/core/src/widget-catalog.ts:66-71`                                                                                                                                                                                                        |
| `core` build copies the JSON and emits a `.d.ts`/`.js` module for the `@open-edu/core/widget-catalog-data` subpath                                                                                                                                                               | `packages/core/package.json:28`, `packages/core/scripts/generate-catalog-data-module.mjs`                                                                                                                                                                                                          |
| `getDefaultWidgetCatalog()` (used by `packages/cli/src/commands/generate.ts`) and `listCuratedWidgets()` (dev-server) are the two downstream consumers of the catalog data                                                                                                       | `packages/core/src/widget-catalog.ts:73-75`, `apps/dev-server/src/studio/widgets/curatedCatalog.ts:179-189`                                                                                                                                                                                        |
| The full widgets registry (React included) loads under `tsx` in Node without error                                                                                                                                                                                               | `pnpm --filter @open-edu/widgets exec tsx -e "import('./src/registry.ts').then(m=>console.log(m.createDefaultRegistry().getAll().length))"` → `29`                                                                                                                                                 |
| `builtins/index.ts` exports all 29 builtins; `MultipleChoice.tsx` exports `multipleChoice` (V2) and `multipleChoicePractice` (deprecated `LegacyChoiceWidget`, id `open-edu.multiple-choice-practice`)                                                                           | `packages/widgets/src/builtins/index.ts`, `MultipleChoice.tsx:553-657`                                                                                                                                                                                                                             |
| The widgets **package root is unloadable under Node ESM**, but `/catalog` is fine; `guide-markdown.ts`'s only import is `import type` (erased at build)                                                                                                                          | `cd apps/dev-server && node -e "import('@open-edu/widgets')"` → `ERR_MODULE_NOT_FOUND ... /dist/types`; `import('@open-edu/widgets/catalog')` → `OK`                                                                                                                                               |
| `vite.config.ts` transitively imports `curatedCatalog.ts`, so importing the widgets root there would break the Studio dev config under Node                                                                                                                                      | `apps/dev-server/vite.config.ts` → `./src/studio/ai/middleware.js` → (`middleware.ts:18`) `./itemGenerate.js` → (`itemGenerate.ts:17`) `../widgets/curatedCatalog.js`                                                                                                                              |
| Retiring the practice entry changes two test counts that the plan must update: the widgets registry count (29→28) and a dev-server preview count (29→28)                                                                                                                         | `packages/widgets/src/__tests__/registry-stubs.test.ts:27` (`toHaveLength(29)`), `apps/dev-server/src/editor/__tests__/widget-preview.test.tsx:122` (`textContent).toBe('29')`)                                                                                                                    |
| Deriving `WIDGET_LEARNING_INTENTS` from the V2 definitions changes **only** the two known gaps — every other widget's hand-authored intents already equal its V2 `learningIntents`                                                                                               | tsx diff of `WIDGET_LEARNING_INTENTS` vs `createDefaultRegistry().getAll()` → 2 mismatches: `open-edu.multiple-choice-practice` (missing in WLI), `core.process-explainer` (missing in WLI); 0 value differences otherwise                                                                         |
| All 28 non-deprecated builtins already carry every top-level catalog key (`name`…`ai`) with non-empty `reward` and `ai`, so regeneration preserves the JSON's key shape; only `open-edu.multiple-choice-practice` (the sole `deprecated`/`replacement`-bearing entry) disappears | tsx sweep over `getAll()` → `entries with gaps: 0`, `empty reward: []`, `empty ai: []`                                                                                                                                                                                                             |
| Two skill scripts read the **real** catalog JSON with hardcoded PascalCase flag literals; the skill's own tests use PascalCase _fixtures_, so they would still pass after P0-3 and would **not** catch the regression                                                            | `skills/openedu-course-authoring/scripts/summarize-quality.mjs:459` (`accessibility.includes('KeyboardOnly')`), `:478` (`capabilities.includes('Animation')`); tests: `scripts/__tests__/summarize-quality.test.mjs:605-653`                                                                       |
| All other skill assertions about the retired `open-edu.multiple-choice-practice` entry are fixture-based, so removing it from the real JSON breaks nothing there; the only real-JSON skill test asserts `length > 0`                                                             | `skills/.../__tests__/widget-catalog.test.mjs:102-110` (real file: generic only); `:113-210` (uses `makeFixtureCatalog()`)                                                                                                                                                                         |
| `apps/docs/docs/widgets/overview.md` names `widget-catalog-source.ts` / `WIDGET_CATALOG_ENTRIES` as "the single source of truth" and must be updated when Phase 5 deletes that file                                                                                              | `apps/docs/docs/widgets/overview.md:201,215,219,225`                                                                                                                                                                                                                                               |
| `generate-widget-docs.ts` consumes `WIDGET_CATALOG_ENTRIES` and writes committed markdown under `apps/docs/docs/widget-library/` — regenerating it after the guide move is a byte-level check that all 28 guides migrated intact                                                 | `packages/widgets/scripts/generate-widget-docs.ts:15-17`; output dir committed (`git ls-files apps/docs/docs/widget-library`)                                                                                                                                                                      |

---

## 3. Phase 1 — P0-7: `WidgetSearchFilters` intents (all-of) + subjectTags (any-of)

**Commit:** `feat(widgets): add all-of intents and any-of subjectTags to search filters`

Smallest, fully independent, and a Phase 1 hard gate (spec §6.5). Do it first.

### 3.1 `packages/widgets/src/types.ts`

Replace the `WidgetSearchFilters` interface (lines 64-72) with:

```ts
export interface WidgetSearchFilters {
  query?: string;
  domain?: string;
  /** @deprecated use `intents` (all-of). Treated as `intents: [intent]`. */
  intent?: LearningIntent;
  /** All-of: a widget must declare every listed intent. */
  intents?: LearningIntent[];
  /** Any-of: a widget must declare at least one of the listed subjectTags. */
  subjectTags?: string[];
  difficulty?: DifficultyLevel;
  status?: WidgetDefinitionV2['status'];
  capability?: keyof WidgetCapabilities;
  accessibility?: keyof AccessibilityMetadata;
}
```

### 3.2 `packages/widgets/src/registry.ts` — `searchWithFilters`

Replace the single `intent` check (line 108) with all-of intents + any-of subjectTags:

```ts
const intents = filters.intents ?? (filters.intent ? [filters.intent] : undefined);
if (intents && intents.length > 0) {
  const declared = v2.learningIntents ?? [];
  if (!intents.every((i) => declared.includes(i))) return false;
}

if (filters.subjectTags && filters.subjectTags.length > 0) {
  const declared = v2.ai?.subjectTags ?? [];
  if (!filters.subjectTags.some((t) => declared.includes(t))) return false;
}
```

Leave `domain`, `difficulty`, `status`, `capability`, `accessibility` checks unchanged.

### 3.3 TDD — `packages/widgets/src/__tests__/registry-search-filters.test.ts`

Add these tests (write them first, watch them fail because `intents`/`subjectTags` are ignored):

- all-of intents: register `a` with `learningIntents: [Practice, Compare]`, `b` with `[Practice]`;
  `searchWithFilters({ intents: [Practice, Compare] })` returns only `a`.
- all-of with single intent behaves like the old `intent`: `{ intents: [Assess] }` returns the assess widget.
- `intent` singular still works (deprecated alias): `{ intent: Practice }` returns the practice widget.
- any-of subjectTags: register `a` with `ai: { subjectTags: ['math','fractions'] }`, `b` with `ai: { subjectTags: ['science'] }`; `{ subjectTags: ['fractions'] }` returns only `a`; `{ subjectTags: ['math','science'] }` returns both (any-of).
- subjectTags empty array matches nothing beyond other filters: `{ subjectTags: [] }` returns all (treated as no constraint).
- combined: `{ intents: [Practice], subjectTags: ['math'] }` requires both.

The `v2(id, overrides)` helper in that file already defaults `ai: {}` — no helper change needed.

**Phase exit:** §0.3 loop green.

---

## 4. Phase 2 — P0-6: warn on stable widget with no declared capabilities

**Commit:** `feat(widgets): warn when a stable widget declares no capabilities`

### 4.1 `packages/widgets/src/validate-metadata.ts`

Replace the guarded check (lines 67-73) with an explicit absent-capabilities warning:

```ts
if (
  widget.status === 'stable' &&
  (!widget.capabilities || Object.keys(widget.capabilities).length === 0)
) {
  warnings.push('Stable widgets should declare capabilities');
}

if (widget.status === 'stable' && widget.capabilities && !widget.capabilities.supportsObserveMode) {
  warnings.push('Stable widgets should declare supportsObserveMode capability');
}
```

Keep the existing `supportsHints`/`trackHints` and `supportsRetry`/`trackRetries` checks untouched (they still guard on `?.` / `&&` — that is correct because they are cross-field, not absent-field).

### 4.2 TDD — `packages/widgets/src/__tests__/validate-metadata.test.ts`

Add tests (write first, watch fail):

- `v2({ status: 'stable', capabilities: {} })` produces a warning containing `capabilities`.
- `v2({ status: 'stable', capabilities: undefined })` produces a warning containing `capabilities`.
- `v2({ status: 'experimental', capabilities: undefined })` produces **no** `capabilities` warning.
- Existing test "does not warn about supportsObserveMode on experimental widgets" still passes; the existing "no warnings for fully-populated" test still passes.

**Phase exit:** §0.3 loop green.

---

## 5. Phase 3 — P0-4: single exported roster, retire the deprecated practice entry

**Commits:** `refactor(widgets): export a single builtin roster` and `feat(widgets): retire the deprecated multiple-choice-practice entry`

This phase creates the roster that Phases 5-7 generate the catalog from. It does **not** touch the
catalog JSON yet (that happens in Phase 5). Consequence: between Phase 3 and Phase 5 the three rosters
are 28 / 28 / 29 (`BUILTIN_WIDGETS` / `WIDGET_LEARNING_INTENTS` / catalog JSON) — the spec's 28/28/28
set-equality acceptance (§6.5 P0-4) only lands at the end of Phase 5, which is why the gate test that
compares all three lives in `catalog-generation.test.ts` (§7.8), not here. No test observes the JSON
in between: dev-server's `listCuratedWidgets()` reads the JSON independently of the registry.

### 5.1 New `packages/widgets/src/builtin-roster.ts`

```ts
import type { WidgetDefinitionV2 } from './types';
import type { LearningIntent } from './metadata/learning-intents';
import {
  visualCounting,
  multipleChoice,
  matching,
  dragDrop,
  sequencing,
  fillBlank,
  storyQuestion,
  realWorld,
  fractionVisual,
  placeValueChart,
  gridArea,
  chartReader,
  clockTime,
  measurementScale,
  callout,
  imageCompare,
  hotspot,
  timeline,
  labelDiagram,
  imageLabel,
  audioPlayer,
  videoPlayer,
  flashcard,
  processDiagram,
  numberLine,
  socialMap,
  processExplainer,
  timer,
} from './builtins';

/** The single source of truth for the built-in widget roster (28 entries; the deprecated practice widget is retired). */
export const BUILTIN_WIDGETS: WidgetDefinitionV2[] = [
  visualCounting,
  multipleChoice,
  matching,
  dragDrop,
  sequencing,
  fillBlank,
  storyQuestion,
  realWorld,
  fractionVisual,
  placeValueChart,
  gridArea,
  chartReader,
  clockTime,
  measurementScale,
  callout,
  imageCompare,
  hotspot,
  timeline,
  labelDiagram,
  imageLabel,
  audioPlayer,
  videoPlayer,
  flashcard,
  processDiagram,
  numberLine,
  socialMap,
  processExplainer,
  timer,
];

export const WIDGET_LEARNING_INTENTS: Record<string, LearningIntent[]> = Object.fromEntries(
  BUILTIN_WIDGETS.map((w) => [w.id, w.learningIntents]),
);

export function getLearningIntentsForWidget(widgetId: string): LearningIntent[] {
  return WIDGET_LEARNING_INTENTS[widgetId] ?? [];
}

export function getWidgetsByLearningIntent(intent: LearningIntent): string[] {
  return Object.entries(WIDGET_LEARNING_INTENTS)
    .filter(([, intents]) => intents.includes(intent))
    .map(([id]) => id);
}
```

Note: `multipleChoicePractice` is intentionally absent. The export stays in `builtins/index.ts` so its
`multipleChoicePractice.test.tsx` still compiles, but it is no longer part of the roster.

### 5.2 `packages/widgets/src/registry.ts`

- Delete the inline `BUILTIN_WIDGETS` array (lines 146-176) and the 29 builtin imports (lines 11-41).
- Import `BUILTIN_WIDGETS` from `./builtin-roster`.
- `registerAllBuiltins` (line 178) keeps iterating `BUILTIN_WIDGETS` + aliases — no logic change.

### 5.3 `packages/widgets/src/metadata/learning-intents.ts`

Remove `WIDGET_LEARNING_INTENTS`, `getLearningIntentsForWidget`, `getWidgetsByLearningIntent`
(lines 16-59). Keep only the `LearningIntent` enum (lines 1-14).

### 5.4 Re-export plumbing

- `packages/widgets/src/metadata/index.ts`: replace the `learning-intents` re-export of the removed symbols; re-export `WIDGET_LEARNING_INTENTS` / helpers from `../builtin-roster` instead.
- `packages/widgets/src/index.ts`: update the `learning-intents` block (lines 103-108) to import `LearningIntent` from `./metadata/learning-intents` and `WIDGET_LEARNING_INTENTS` / `getLearningIntentsForWidget` / `getWidgetsByLearningIntent` from `./builtin-roster`; also `export { BUILTIN_WIDGETS } from './builtin-roster.js'`.

### 5.5 TDD — new `packages/widgets/src/__tests__/builtin-roster.test.ts`

- `BUILTIN_WIDGETS` has length 28.
- IDs are unique and every id is kebab-case with a domain prefix.
- No id is `open-edu.multiple-choice-practice` or `core.multiple-choice-practice`.
- `core.process-explainer` is present with `learningIntents` containing `observe` and `understand`.
- `WIDGET_LEARNING_INTENTS` has exactly the same key set as `BUILTIN_WIDGETS` ids (set equality, enforced by the spec §6.5 P0-4 / §28).
- `getLearningIntentsForWidget('core.multiple-choice')` contains `assess`; `getLearningIntentsForWidget('unknown.widget')` is `[]`.

Update `packages/widgets/src/metadata/__tests__/learning-intents.test.ts`:

- Drop the now-removed `getLearningIntentsForWidget`/`getWidgetsByLearningIntent` imports; keep the enum tests. (The behavioral tests now live in `builtin-roster.test.ts`.) None of its assertions reference `core.multiple-choice-practice`, so no expectation changes.

**Two existing count assertions must change (29 → 28):**

- `packages/widgets/src/__tests__/registry-stubs.test.ts:24-31` — retitle `"registers all 29 builtins"`
  to `28` and `expect(all).toHaveLength(29)` → `28`. The `stable.length >= 20` assertion is unaffected.
- `apps/dev-server/src/editor/__tests__/widget-preview.test.tsx:122` —
  `expect(...textContent).toBe('29')` → `'28'`.

**Assertions that must still pass unchanged (do not "fix" them):**

- `packages/widgets/src/index.test.ts:33` — `multipleChoicePractice.id === 'open-edu.multiple-choice-practice'` (the export survives, only the roster entry is retired).
- `packages/widgets/src/index.test.ts:37` — `registry.has('open-edu.multiple-choice-practice')` is `true`
  because `has()` resolves through `WIDGET_ALIAS_MAP` (`registry.ts:49-53`), whose entry stays (L5).

`packages/widgets/src/__tests__/registry-alias.test.ts` registers its own aliases manually and does not
assert default-registry contents today; add one new assertion rather than editing existing ones:
`createDefaultRegistry().get('open-edu.multiple-choice-practice')` resolves to an entry whose id is
`core.multiple-choice`, and `createDefaultRegistry().getAll()` does not contain
`open-edu.multiple-choice-practice`.

**Phase exit:** §0.3 loop green. `createDefaultRegistry().getAll()` now returns 28.

---

## 6. Phase 4 — P0-5: single declaration of `WIDGET_ALIAS_MAP` and the guide renderer

**Commits:** `refactor(schemas): own the widget alias map` and `feat(widgets): export guide renderer via subpath for dev-server`

### 6.1 New `packages/schemas/src/widget-alias.ts`

```ts
export const WIDGET_ALIAS_MAP: Record<string, string> = {
  'open-edu.matching': 'core.matching',
  'open-edu.multiple-choice': 'core.multiple-choice',
  'open-edu.multiple-choice-practice': 'core.multiple-choice',
  'open-edu.visual-counting': 'core.visual-counting',
  'open-edu.drag-drop': 'core.drag-drop',
  'open-edu.sequencing': 'core.sequencing',
  'open-edu.fill-blank': 'core.fill-blank',
  'open-edu.story-question': 'core.story-question',
  'open-edu.real-world': 'core.real-world',
  'open-edu.fraction-visual': 'math.fraction-visual',
  'open-edu.place-value-chart': 'math.place-value-chart',
  'open-edu.grid-area': 'math.grid-area',
  'open-edu.chart-reader': 'core.chart-reader',
  'open-edu.clock-time': 'math.clock-time',
  'open-edu.measurement-scale': 'math.measurement-scale',
};
```

Export it from `packages/schemas/src/index.ts`.

### 6.2 `packages/widgets/src/domains.ts`

- Delete the local `WIDGET_ALIAS_MAP` (lines 9-25).
- `import { WIDGET_ALIAS_MAP } from '@open-edu/schemas';` and re-export it so existing imports
  (`registry.ts`, `domains.test.ts`, `widgets/index.ts`) are unchanged.

### 6.3 `packages/core/src/widget-catalog.ts`

- Delete the local `WIDGET_ALIAS_MAP` (lines 48-64).
- `import { WIDGET_ALIAS_MAP } from '@open-edu/schemas';` and re-export it (so `core/src/index.ts:65`
  keeps working).

### 6.4 Add the `./guide` subpath export — `packages/widgets/package.json`

Under `"exports"`, alongside `"."`, `"./install"`, `"./catalog"`:

```json
"./guide": {
  "types": "./dist/guide-markdown.d.ts",
  "import": "./dist/guide-markdown.js"
}
```

Do **not** import the package root from dev-server (L11): the root is unloadable under Node ESM and
`curatedCatalog.ts` sits inside `vite.config.ts`'s import graph.

### 6.5 `apps/dev-server/src/studio/widgets/curatedCatalog.ts`

- Delete the private `renderGuideMarkdown` function (lines 27-81).
- Add `import { renderWidgetGuideMarkdown } from '@open-edu/widgets/guide';` (keep the existing
  `@open-edu/widgets/catalog` import on line 3 — do not consolidate them onto the root).
- Replace the call site (line 100) with `renderWidgetGuideMarkdown(entry)`.

### 6.6 Build + verify the subpath **before** running the loop

```bash
pnpm --filter @open-edu/widgets build
cd apps/dev-server && node -e "import('@open-edu/widgets/guide').then(m=>console.log(typeof m.renderWidgetGuideMarkdown))"
# expect: function
```

### 6.7 TDD

- `packages/widgets/src/__tests__/domains.test.ts` already pins the alias map contents — it must
  still pass after the move (no change needed; it now exercises the schemas copy).
- New `packages/schemas/src/widget-alias.test.ts`: assert `WIDGET_ALIAS_MAP['open-edu.multiple-choice-practice'] === 'core.multiple-choice'` and the map has 15 entries.
- `apps/dev-server/src/studio/widgets/curatedCatalog.test.ts`: the existing "exposes a guideMarkdown
  string" test (line 41) still passes; add an assertion that `getCuratedWidget('core.multiple-choice').guideMarkdown`
  equals `renderWidgetGuideMarkdown(<the catalog entry>)` (i.e., dev-server no longer diverges).
  Import the renderer in the test from `@open-edu/widgets/guide` too.

**Phase exit:** §0.3 loop green (with the build from §6.6 completed first).
`rg "function renderGuideMarkdown"` shows zero; `rg "from '@open-edu/widgets';"` in
`apps/dev-server/src` shows zero root imports (only `/catalog` and `/guide` subpaths).
`node -e "import('@open-edu/widgets')"` from `apps/dev-server` must still be allowed to fail — that
is the pre-existing AGENTS.md condition, not a regression.

---

## 7. Phase 5 — P0-1: `guide` on `WidgetDefinitionV2` + generated catalog

**Commits:** `feat(schemas): add widget catalog entry types`, `feat(widgets): add guide to V2 definitions`, `feat(widgets): generate the catalog from the builtin roster`

The largest phase. It unifies the `WidgetCatalogEntry` type (L1), adds `guide` to every non-deprecated
builtin, and rewrites the generator to derive the catalog from `BUILTIN_WIDGETS`.

### 7.1 New `packages/schemas/src/widget-catalog.ts`

Move the interfaces from `packages/widgets/src/widget-catalog-source.ts` here, unmodified except the
`ai` shape gains `subjectTags` (already present in the widgets copy). Export all three:

```ts
export interface WidgetGuideConfigField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface WidgetGuideData {
  oneLiner: string;
  whatItDoes: string;
  whenToUse: string[];
  setupSteps: string[];
  configFields: WidgetGuideConfigField[];
  exampleJson: string;
  tips: string[];
  sidebarPosition: number;
  relatedWidgets?: Array<{ id: string; name: string; domain: string; slug: string }>;
}

export interface WidgetCatalogEntry {
  id: string;
  name?: string;
  description?: string;
  domain?: string;
  status?: string;
  deprecated?: boolean;
  replacement?: string;
  keywords?: string[];
  learningIntents?: string[];
  legacyId?: string;
  capabilities?: string[];
  accessibility?: string[];
  analytics?: string[];
  reward?: { completionXP?: number; positiveMessage?: string; achievement?: string };
  ai?: {
    difficulty?: string;
    estimatedMinutes?: number;
    bloomsLevel?: string;
    cognitiveLoad?: string;
    recommendedAge?: [number, number];
    readingLevel?: string;
    subjectTags?: string[];
    learningObjectives?: string[];
    commonMisconceptions?: string[];
    generationHints?: string[];
  };
  guide?: WidgetGuideData;
}
```

Export the three types from `packages/schemas/src/index.ts`.

### 7.2 `packages/widgets/src/types.ts`

- Import `WidgetGuideData` from `@open-edu/schemas` (type-only).
- Add `guide?: WidgetGuideData;` to `WidgetDefinitionV2` (after `replacement?: string;`).

### 7.3 Move `guide` data into the builtins (one-off script, 28 files)

Each non-deprecated builtin file that exports a `WidgetDefinitionV2` gains the `guide: { ... }` object
that currently lives in `packages/widgets/src/widget-catalog-source.ts` for the same `id`. Do **not**
hand-copy 28 objects — author two temporary scripts, run them, then delete them (§0.2 rule 8; never
committed). This exact pair was validated while authoring the plan: dry-run 28/28, migration 28/28,
deep-equality **0 mismatches**, prettier clean, `tsc --noEmit` clean, and 22 tests green
(`index.test.ts`, `registry-stubs.test.ts`, `registry.test.ts`, `guide-markdown.test.ts`) — then the
run was reverted so you execute it for real.

The mapping is 1:1 by `id` (the `id` string in the V2 const is the authoritative key):

- `core.matching` → `Matching/Matching.tsx`
- `core.multiple-choice` → `MultipleChoice/MultipleChoice.tsx` (the `MultipleChoiceWidget` const only — NOT `LegacyChoiceWidget`)
- `core.visual-counting` → `VisualCounting/VisualCounting.tsx`
- `core.drag-drop` → `DragDrop/DragDrop.tsx`
- `core.sequencing` → `Sequencing/Sequencing.tsx`
- `core.fill-blank` → `FillBlank/FillBlank.tsx`
- `core.story-question` → `StoryQuestion/StoryQuestion.tsx`
- `core.real-world` → `RealWorld/RealWorld.tsx`
- `core.chart-reader` → `ChartReader/ChartReader.tsx`
- `math.fraction-visual` → `FractionVisual/FractionVisual.tsx`
- `math.place-value-chart` → `PlaceValueChart/PlaceValueChart.tsx`
- `math.grid-area` → `GridArea/GridArea.tsx`
- `math.clock-time` → `ClockTime/ClockTime.tsx`
- `math.measurement-scale` → `MeasurementScale/MeasurementScale.tsx`
- `math.number-line` → `NumberLine/NumberLine.tsx`
- `core.callout` → `Callout/Callout.tsx`
- `core.image-compare` → `ImageCompare/ImageCompare.tsx`
- `core.hotspot` → `Hotspot/Hotspot.tsx`
- `core.timeline` → `Timeline/Timeline.tsx`
- `core.process-explainer` → `ProcessExplainer/ProcessExplainer.tsx`
- `science.label-diagram` → `LabelDiagram/LabelDiagram.tsx`
- `science.image-label` → `ImageLabel/ImageLabel.tsx`
- `core.audio-player` → `AudioPlayer/AudioPlayer.tsx`
- `core.video-player` → `VideoPlayer/VideoPlayer.tsx`
- `language.flashcard` → `Flashcard/Flashcard.tsx`
- `science.process-diagram` → `ProcessDiagram/ProcessDiagram.tsx`
- `social.map` → `SocialMap/SocialMap.tsx`
- `core.timer` → `Timer/Timer.tsx`

**Step 1 — write `packages/widgets/scripts/migrate-guides.ts`:**

```ts
#!/usr/bin/env node
/**
 * ONE-OFF migration (Phase 0 plan, Phase 5 / P0-1): copies the `guide` object of each
 * catalog entry from src/widget-catalog-source.ts into the matching WidgetDefinitionV2
 * const of its builtin source file.
 *
 * Run:    pnpm --filter @open-edu/widgets exec tsx scripts/migrate-guides.ts --dry-run
 *         pnpm --filter @open-edu/widgets exec tsx scripts/migrate-guides.ts
 * Then:   pnpm exec prettier --write packages/widgets/src/builtins
 * Then:   DELETE this file — it must never be committed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILTINS_DIR = resolve(__dirname, '../src/builtins');
const dryRun = process.argv.includes('--dry-run');

const { WIDGET_CATALOG_ENTRIES } = await import('../src/widget-catalog-source.ts');

const guideById = new Map(
  WIDGET_CATALOG_ENTRIES.filter((entry) => entry.guide !== undefined).map(
    (entry) => [entry.id, entry.guide] as const,
  ),
);

const TARGETS: ReadonlyArray<{ id: string; file: string }> = [
  { id: 'core.matching', file: 'Matching/Matching.tsx' },
  { id: 'core.multiple-choice', file: 'MultipleChoice/MultipleChoice.tsx' },
  { id: 'core.visual-counting', file: 'VisualCounting/VisualCounting.tsx' },
  { id: 'core.drag-drop', file: 'DragDrop/DragDrop.tsx' },
  { id: 'core.sequencing', file: 'Sequencing/Sequencing.tsx' },
  { id: 'core.fill-blank', file: 'FillBlank/FillBlank.tsx' },
  { id: 'core.story-question', file: 'StoryQuestion/StoryQuestion.tsx' },
  { id: 'core.real-world', file: 'RealWorld/RealWorld.tsx' },
  { id: 'core.chart-reader', file: 'ChartReader/ChartReader.tsx' },
  { id: 'math.fraction-visual', file: 'FractionVisual/FractionVisual.tsx' },
  { id: 'math.place-value-chart', file: 'PlaceValueChart/PlaceValueChart.tsx' },
  { id: 'math.grid-area', file: 'GridArea/GridArea.tsx' },
  { id: 'math.clock-time', file: 'ClockTime/ClockTime.tsx' },
  { id: 'math.measurement-scale', file: 'MeasurementScale/MeasurementScale.tsx' },
  { id: 'math.number-line', file: 'NumberLine/NumberLine.tsx' },
  { id: 'core.callout', file: 'Callout/Callout.tsx' },
  { id: 'core.image-compare', file: 'ImageCompare/ImageCompare.tsx' },
  { id: 'core.hotspot', file: 'Hotspot/Hotspot.tsx' },
  { id: 'core.timeline', file: 'Timeline/Timeline.tsx' },
  { id: 'core.process-explainer', file: 'ProcessExplainer/ProcessExplainer.tsx' },
  { id: 'science.label-diagram', file: 'LabelDiagram/LabelDiagram.tsx' },
  { id: 'science.image-label', file: 'ImageLabel/ImageLabel.tsx' },
  { id: 'core.audio-player', file: 'AudioPlayer/AudioPlayer.tsx' },
  { id: 'core.video-player', file: 'VideoPlayer/VideoPlayer.tsx' },
  { id: 'language.flashcard', file: 'Flashcard/Flashcard.tsx' },
  { id: 'science.process-diagram', file: 'ProcessDiagram/ProcessDiagram.tsx' },
  { id: 'social.map', file: 'SocialMap/SocialMap.tsx' },
  { id: 'core.timer', file: 'Timer/Timer.tsx' },
];

if (guideById.size !== TARGETS.length) {
  throw new Error(`catalog has ${guideById.size} guides, expected ${TARGETS.length}`);
}

const CONST_RE = /const\s+([A-Za-z_$][\w$]*)\s*:\s*WidgetDefinitionV2\s*=\s*\{/g;

let patched = 0;

for (const { id, file } of TARGETS) {
  const guide = guideById.get(id);
  if (!guide) throw new Error(`no guide in widget-catalog-source.ts for ${id}`);

  const path = resolve(BUILTINS_DIR, file);
  let source = readFileSync(path, 'utf-8');

  if (/^\s+guide:/m.test(source)) throw new Error(`${file} already has a guide property`);

  let insertion = -1;
  for (const match of source.matchAll(CONST_RE)) {
    const head = source.slice(match.index, match.index + 2000);
    const idProp = head.match(/id:\s*(?:'([^']+)'|([A-Za-z_$][\w$]*))/);
    if (!idProp) continue;
    let value = idProp[1];
    if (value === undefined && idProp[2]) {
      value = source.match(new RegExp(`const\\s+${idProp[2]}\\s*=\\s*'([^']+)'`))?.[1];
    }
    if (value === id) {
      insertion = match.index + match[0].length;
      break;
    }
  }
  if (insertion === -1) {
    throw new Error(`no WidgetDefinitionV2 const with id '${id}' found in ${file}`);
  }

  const literal = JSON.stringify(guide, null, 2).replace(/\n/g, '\n  ');
  source = source.slice(0, insertion) + `\n  guide: ${literal},` + source.slice(insertion);

  if (!dryRun) writeFileSync(path, source, 'utf-8');
  patched += 1;
  console.log(`${dryRun ? '[dry-run] patched' : 'patched'} ${file}  (${id})`);
}

console.log(`${dryRun ? 'Would patch' : 'Patched'} ${patched}/${TARGETS.length} builtin files`);
if (patched !== TARGETS.length) process.exit(1);
```

The script finds each target const by its own `id` property, so
`MultipleChoice/MultipleChoice.tsx`'s `LegacyChoiceWidget` (id `open-edu.multiple-choice-practice`,
which has no guide) is skipped without a special case, and the `Timer/Timer.tsx` indirection
(`id: WIDGET_ID` on line 462, `const WIDGET_ID = 'core.timer'` on line 44) is resolved by the
identifier branch. It fails loudly (exit 1) if a guide is missing, a file already has a `guide`,
or the total is not 28. Note the comment block must not contain the character sequence `*/` — the
prettier command in the header is deliberately written without a glob for this reason.

**Step 2 — migrate:**

```bash
pnpm --filter @open-edu/widgets exec tsx scripts/migrate-guides.ts --dry-run
# expect: 28 × "[dry-run] patched <file>  (<id>)" then "Would patch 28/28 builtin files"
pnpm --filter @open-edu/widgets exec tsx scripts/migrate-guides.ts
# expect: 28 × "patched <file>  (<id>)" then "Patched 28/28 builtin files"
```

**Step 3 — verify the copy, then format.** Write `packages/widgets/scripts/_verify-guides.ts`:

```ts
#!/usr/bin/env node
/** TEMP verification: every guide literal inserted into builtins must deep-equal the catalog's. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILTINS = resolve(__dirname, '../src/builtins');
const { WIDGET_CATALOG_ENTRIES } = await import('../src/widget-catalog-source.ts');

const guideById = new Map(
  WIDGET_CATALOG_ENTRIES.filter((e) => e.guide !== undefined).map((e) => [e.id, e.guide] as const),
);

const CONST_RE = /const\s+([A-Za-z_$][\w$]*)\s*:\s*WidgetDefinitionV2\s*=\s*\{/g;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

let checked = 0;
let failed = 0;

for (const file of tsFiles(BUILTINS)) {
  const source = readFileSync(file, 'utf-8');
  if (!source.includes('guide: {')) continue;

  const matches = [...source.matchAll(CONST_RE)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const segment = source.slice(start, end);
    const guideAt = segment.indexOf('guide: {');
    if (guideAt === -1) continue;

    const idProp = segment.match(/id:\s*(?:'([^']+)'|([A-Za-z_$][\w$]*))/);
    let id = idProp?.[1];
    if (id === undefined && idProp?.[2]) {
      id = source.match(new RegExp(`const\\s+${idProp[2]}\\s*=\\s*'([^']+)'`))?.[1];
    }

    let depth = 0;
    let endIdx = -1;
    let inString = false;
    let escaped = false;
    for (let j = guideAt + 'guide: '.length; j < segment.length; j++) {
      const ch = segment[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = j + 1;
          break;
        }
      }
    }
    const literal = segment.slice(guideAt + 'guide: '.length, endIdx);
    const actual = JSON.stringify(JSON.parse(literal));
    const expected = JSON.stringify(guideById.get(id ?? ''));

    checked++;
    if (actual !== expected) {
      failed++;
      console.error(`MISMATCH ${id} in ${file}`);
    }
  }
}

console.log(`checked ${checked} inserted guides, ${failed} mismatches`);
if (checked !== 28 || failed !== 0) process.exit(1);
```

```bash
pnpm --filter @open-edu/widgets exec tsx scripts/_verify-guides.ts
# expect: "checked 28 inserted guides, 0 mismatches" — anything else is a failed step
pnpm exec prettier --write packages/widgets/src/builtins
pnpm --filter @open-edu/widgets typecheck
```

Verify runs **before** prettier: it `JSON.parse`s the inserted literal, which is only strict JSON
before prettier rewrites the double quotes. (Do not worry about `exampleJson` strings containing
braces — the scanner tracks string/escape state, so only braces outside strings are counted.)

**Step 4 — delete both scripts:**

```bash
rm packages/widgets/scripts/migrate-guides.ts packages/widgets/scripts/_verify-guides.ts
git status packages/widgets/scripts   # only generate-catalog.ts + generate-widget-docs.ts remain
```

Only then continue to §7.4. The `generate:widget-docs` no-op in §7.8 remains the independent,
end-to-end byte-level oracle for this move.

### 7.4 Rewrite `packages/widgets/scripts/generate-catalog.ts`

```ts
#!/usr/bin/env node
/**
 * Generates widget-catalog-data.json in @open-edu/core from the built-in
 * widget roster (single source of truth).
 *
 * Run: pnpm --filter @open-edu/widgets generate:catalog
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { BUILTIN_WIDGETS } = await import('../src/builtin-roster.ts');
const { toWidgetCatalogEntries } = await import('../src/catalog-gen.ts');

const entries = toWidgetCatalogEntries(BUILTIN_WIDGETS);
const outputPath = resolve(__dirname, '../../core/src/widget-catalog-data.json');

writeFileSync(outputPath, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
console.log(`Generated ${entries.length} widget entries → ${outputPath}`);
```

### 7.5 New `packages/widgets/src/catalog-gen.ts`

```ts
import type { WidgetCatalogEntry } from '@open-edu/schemas';
import type { WidgetDefinitionV2 } from './types';

// NOTE: the parameter type must be `object`, NOT `Record<string, unknown>` —
// WidgetCapabilities / AccessibilityMetadata / AnalyticsMetadata are interfaces
// without index signatures and are not assignable to Record<string, unknown>.
function trueKeys(obj: object | undefined): string[] {
  if (!obj) return [];
  return Object.entries(obj)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
}

/** Derive a JSON-safe catalog entry from a V2 definition (L4). */
export function toCatalogEntry(w: WidgetDefinitionV2): WidgetCatalogEntry {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    domain: w.domain,
    status: w.status,
    deprecated: w.deprecated,
    replacement: w.replacement,
    keywords: w.keywords,
    learningIntents: w.learningIntents,
    capabilities: trueKeys(w.capabilities),
    accessibility: trueKeys(w.accessibility),
    analytics: trueKeys(w.analytics),
    reward: w.reward
      ? {
          completionXP: w.reward.completionXP,
          positiveMessage: w.reward.positiveMessage,
          achievement: w.reward.achievement,
        }
      : undefined,
    ai: w.ai
      ? {
          difficulty: w.ai.difficulty,
          estimatedMinutes: w.ai.estimatedMinutes,
          bloomsLevel: w.ai.bloomsLevel,
          cognitiveLoad: w.ai.cognitiveLoad,
          recommendedAge: w.ai.recommendedAge,
          readingLevel: w.ai.readingLevel,
          subjectTags: w.ai.subjectTags,
          learningObjectives: w.ai.learningObjectives,
          commonMisconceptions: w.ai.commonMisconceptions,
          generationHints: w.ai.generationHints,
        }
      : undefined,
    guide: w.guide,
  };
}

export function toWidgetCatalogEntries(widgets: WidgetDefinitionV2[]): WidgetCatalogEntry[] {
  return widgets.map(toCatalogEntry);
}
```

`WidgetDefinitionV2`'s `render`/`schema` are typed as part of the interface, so no extra stripping is
needed — the mapped object simply omits them.

### 7.6 `packages/widgets/src/widget-catalog-source.ts`

This file is now obsolete. **Delete it.** Update all importers:

- `packages/widgets/src/guide-markdown.ts:1` → import `WidgetCatalogEntry` from `@open-edu/schemas`.
- `packages/widgets/src/index.ts:3-8` → remove the `WIDGET_CATALOG_ENTRIES` export and the
  `WidgetCatalogEntry` / `WidgetGuideData` / `WidgetGuideConfigField` type re-exports (they now come
  from `@open-edu/schemas`; re-export the types from schemas for convenience if desired, but do NOT
  re-export `WIDGET_CATALOG_ENTRIES` — nothing should import it anymore).
- `packages/widgets/scripts/generate-widget-docs.ts` → build the entries list from
  `toWidgetCatalogEntries(BUILTIN_WIDGETS)` instead of importing `WIDGET_CATALOG_ENTRIES`
  (the header comment on lines 2-6 also names `widget-catalog-source.ts` — update it).
- `packages/widgets/src/guide-markdown.test.ts` → import `WidgetCatalogEntry` from `@open-edu/schemas`.
- `apps/docs/docs/widgets/overview.md` → lines 201, 215, 219, 225 call
  `widget-catalog-source.ts` / `WIDGET_CATALOG_ENTRIES` "the single source of truth". Rewrite them to
  point at the V2 definitions + `builtin-roster.ts` + `catalog-gen.ts` (`generate:catalog` reads the
  roster). This is a docs-only prose edit; no other `apps/docs` file references the deleted module.

### 7.7 `packages/core/src/widget-catalog.ts`

- Replace the local `WidgetCatalogEntry` interface (lines 5-42) with
  `import type { WidgetCatalogEntry } from '@open-edu/schemas';` and `export type { WidgetCatalogEntry };`
- Keep `WidgetCatalogInput`, `generateWidgetCatalog`, `getDefaultWidgetCatalog` unchanged.
- The `DEFAULT_WIDGETS` parse (line 69-71) now satisfies the schemas type (which has `subjectTags`).

### 7.8 Regenerate + TDD

```bash
pnpm --filter @open-edu/schemas build
pnpm --filter @open-edu/widgets build
pnpm --filter @open-edu/widgets generate:catalog
git diff --stat packages/core/src/widget-catalog-data.json
pnpm --filter @open-edu/widgets generate:widget-docs
git status --short apps/docs/docs/widget-library    # MUST be clean
```

Expectations for the JSON diff:

- 28 entries (was 29 — the deprecated practice entry is gone, taking the only `deprecated` /
  `replacement` keys with it).
- Every non-deprecated entry has a `guide` with all 9 keys.
- `learningIntents` are lowercase; `capabilities`/`accessibility`/`analytics` are camelCase true-keys
  (`supportsKeyboard`, `keyboardOnly`, `trackAttempts`, …) instead of PascalCase (`Keyboard`,
  `HighContrast`).
- `ai.subjectTags` present on 27 entries (was 1); absent on `core.process-explainer`.
- No `open-edu.*` ids remain anywhere in the catalog (it was the only one, and it was also the only
  entry whose guide was missing — the artifact-contract prompt rule forbids `open-edu.*` ids).
- Top-level key set otherwise unchanged: `id,name,description,domain,status,keywords,learningIntents,capabilities,accessibility,analytics,reward,ai` (+ `guide`).

**The `generate:widget-docs` run is the end-to-end oracle for §7.3.** If any of the 28 `guide`
objects did not survive the move intact, the regenerated markdown under `apps/docs/docs/widget-library/`
will differ from the committed files and `git status` will show it. Treat any diff there as a failed
step: fix the builtin's `guide`, re-run, until clean.

New `packages/widgets/src/__tests__/catalog-generation.test.ts`:

- `toCatalogEntry` for a synthetic V2: `capabilities: { supportsKeyboard: true, supportsVoice: false }` → `capabilities: ['supportsKeyboard']`; absent capabilities → `[]`.
- `toWidgetCatalogEntries(BUILTIN_WIDGETS)` length 28; ids equal `BUILTIN_WIDGETS.map(w => w.id)`.
- **The gate (L9):** read `packages/core/src/widget-catalog-data.json`, `JSON.parse` it, and assert it
  `toEqual` `toWidgetCatalogEntries(BUILTIN_WIDGETS)` (vitest's deep equality — not `deepEquals`).
  This fails if the checked-in JSON diverges from the roster.
- **Three-way set equality (spec §6.5 P0-4):** `new Set(BUILTIN_WIDGETS.map(w => w.id))` ==
  `new Set(Object.keys(WIDGET_LEARNING_INTENTS))` == `new Set(parsedJson.map(e => e.id))`, each of
  size 28. (Phases 3 and 5 each cover two legs; this closes the third.)
- Every non-deprecated entry has a `guide` with all 9 keys
  (`oneLiner`, `whatItDoes`, `whenToUse`, `setupSteps`, `configFields`, `exampleJson`, `tips`,
  `sidebarPosition`, `relatedWidgets` — all 28 currently carry `relatedWidgets`, though the type
  leaves it optional, so assert presence rather than type-optional-ness).

Update `packages/core/src/__tests__/widget-catalog.test.ts` if any fixture now type-errors (it uses
lowercase/camelCase already — expect no change). Add one assertion that
`getDefaultWidgetCatalog()` no longer contains `open-edu.multiple-choice-practice` (deprecated entry
retired) — this requires importing `getDefaultWidgetCatalog`, which reads the JSON at module load.

**Phase exit:** §0.3 loop green (builds from §0.3 run first), `generate:catalog` and
`generate:widget-docs` both no-ops, and only the intended files are dirty.

---

## 8. Phase 6 — P0-2: catalog intents are `LearningIntent` values (verify + enforce)

**Commit:** `test(widgets): assert catalog intents are known LearningIntent values`

The generator already emits lowercase enum strings (Phase 5). This phase makes the acceptance
criterion explicit and guards against regression.

### 8.1 Extend `packages/widgets/src/__tests__/catalog-generation.test.ts`

- For every generated entry, every `learningIntents` value is a member of
  `Object.values(LearningIntent)`; **and** no value is `create` (it is reserved — spec §6.5 P0-2).
- Assert the union of all intents is a strict subset of the 11 enum values and excludes `create`.

No production code change is expected. If the assertion fails, the failure is in a builtin's
`learningIntents` array — fix the builtin, not the test.

**Phase exit:** §0.3 loop green.

---

## 9. Phase 7 — P0-3: capabilities/accessibility/analytics from boolean maps (verify + consumers)

**Commits:** `test(widgets): assert catalog flags derive from the boolean metadata maps` and
`fix(skill): match generated catalog flag casing in QC-ACC-02 and QC-ACC-07`

### 9.1 Extend `packages/widgets/src/__tests__/catalog-generation.test.ts`

- For every generated entry, `capabilities` ⊆ keys of `WidgetCapabilities`, `accessibility` ⊆ keys of
  `AccessibilityMetadata`, `analytics` ⊆ keys of `AnalyticsMetadata` (import the interfaces and use
  `keyof`), and there are **no unknown keys**.
- An absent flag is a true negative: `supportsVoice` appears only on widgets whose V2
  `capabilities.supportsVoice === true` (full representation is deliberately not a target — spec §6.5 P0-3).

No widgets/core production code change is expected in this phase — the generator already emits this
shape (L4). The one required code change is in the skill (§9.2).

### 9.2 Fix the two skill literals (whitelisted) + verify the rest

The skill's own tests use PascalCase **fixtures**, so after P0-3 they keep passing and would **not**
catch the regression — only the real-catalog path degrades, silently. Two lines read the real
`packages/core/src/widget-catalog-data.json` with hardcoded PascalCase flag literals and must be
updated (this is the only edit allowed inside `skills/`):

`skills/openedu-course-authoring/scripts/summarize-quality.mjs`

- line 459 (QC-ACC-02): `!widgetEntry.accessibility.includes('KeyboardOnly')`
  → `!widgetEntry.accessibility.includes('keyboardOnly')`
  (otherwise every widget activity starts emitting "does not declare keyboard-only support")
- line 478 (QC-ACC-07): `capabilities.includes('Animation')`
  → `capabilities.includes('supportsAnimation')`
  (otherwise the check silently never fires)

`skills/openedu-course-authoring/scripts/__tests__/summarize-quality.test.mjs` — update the fixtures so
the tests enforce the real casing instead of the old one:

- line 611 `capabilities: ['Animation']` → `['supportsAnimation']`
- line 629 `capabilities: ['Animation'], accessibility: ['ReducedMotion']`
  → `capabilities: ['supportsAnimation'], accessibility: ['reducedMotion']`
  (`AccessibilityMetadata.reducedMotion` is the real key — `packages/widgets/src/metadata/accessibility.ts:9`)

Everything else in `skills/` is verify-only and must stay untouched:

```bash
node --test skills/openedu-course-authoring/scripts/__tests__/widget-catalog.test.mjs
node --test skills/openedu-course-authoring/scripts/__tests__/summarize-quality.test.mjs
node --test skills/openedu-course-authoring/scripts/__tests__/openedu-adapter.test.mjs
node --test skills/openedu-course-authoring/scripts/__tests__/discover-openedu.test.mjs
node --test skills/openedu-course-authoring/evals/schema.test.mjs
```

These are safe because every assertion about the retired `open-edu.multiple-choice-practice` entry is
fixture-based, and the only real-JSON test asserts `length > 0` (`widget-catalog.test.mjs:102-110`).

Other consumers — verify only, no edits expected:

- `packages/cli/src/commands/generate.ts` consumes `getDefaultWidgetCatalog()` as a markdown **string**
  — run `pnpm --filter @open-edu/cli test`.
- `packages/core/src/widget-catalog.ts` `generateWidgetCatalog` renders the flag arrays by joining
  strings; camelCase is cosmetic there — covered by the §0.3 loop.
- `apps/dev-server/src/studio/ai/prompts/buildPrompt.ts` renders `listCuratedWidgets()`, whose
  `CuratedWidget` shape carries `id/name/source/trustTier/guide` but **not** `capabilities`/
  `accessibility`/`learningIntents` — unaffected.
- The skill helpers `isDeprecatedWidget` / `getCanonicalWidgetIds` / `resolveLegacyWidgetId` return
  `false` / filtered-sets / `null` for a missing entry rather than throwing.

**If any test outside the two whitelisted files fails, STOP and report — do not weaken it.**

### 9.3 Regenerate and verify

```bash
pnpm --filter @open-edu/widgets generate:catalog   # no-op: JSON already current from Phase 5
pnpm --filter @open-edu/core build                 # refreshes dist/widget-catalog-data.{js,d.ts} (untracked)
pnpm --filter @open-edu/cli test
```

**Phase exit:** full §0.3 loop green; the five `node --test` skill commands above all pass;
`git status` clean.

---

## 10. Final acceptance (spec §28, Phase 0)

After Phase 7, verify each Phase 0 acceptance criterion:

- [ ] `WIDGET_CATALOG_ENTRIES` is generated from widget definitions; hand-editing fails the build — the `catalog-generation.test.ts` gate (L9) enforces this.
- [ ] No unknown `LearningIntent` values in catalog data — Phase 6 test.
- [ ] `BUILTIN_WIDGETS`, catalog entries, and `WIDGET_LEARNING_INTENTS` keys are set-equal (28/28/28) — the three-way assertion in `catalog-generation.test.ts` (§7.8), plus `builtin-roster.test.ts` (§5.5).
- [ ] `WIDGET_ALIAS_MAP` and `renderWidgetGuideMarkdown` have one declaration each — Phase 4 (`rg` checks), and dev-server reaches the renderer through `@open-edu/widgets/guide`.
- [ ] `searchWithFilters({ intents, subjectTags })` works — Phase 1 tests.

Then run the complete verification:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm --filter @open-edu/widgets generate:catalog      # no-op
pnpm --filter @open-edu/widgets generate:widget-docs  # no-op
node --test skills/openedu-course-authoring/scripts/__tests__/widget-catalog.test.mjs
node --test skills/openedu-course-authoring/scripts/__tests__/summarize-quality.test.mjs
node --test skills/openedu-course-authoring/scripts/__tests__/openedu-adapter.test.mjs
node --test skills/openedu-course-authoring/scripts/__tests__/discover-openedu.test.mjs
node --test skills/openedu-course-authoring/evals/schema.test.mjs
cd apps/dev-server && node -e "import('@open-edu/widgets/guide').then(m=>console.log(typeof m.renderWidgetGuideMarkdown))"  # function
```

Sanity spot-checks worth eyeballing before you report:

- `rg "toHaveLength\(29\)|toBe\('29'\)" packages apps` → empty (both counts moved to 28).
- `rg "function renderGuideMarkdown"` → empty.
- `rg "from '@open-edu/widgets';" apps/dev-server/src` → empty (only `/catalog` and `/guide`).
- `python3 -c "import json;print(len(json.load(open('packages/core/src/widget-catalog-data.json'))))"` → `28`.
- `git status packages/widgets/scripts` → clean (no `migrate-guides.ts` / `_verify-guides.ts` leftovers).

Report: files changed, catalog entry count (29 → 28), the `searchWithFilters` new-field coverage, and
confirmation that both generators are no-ops.
