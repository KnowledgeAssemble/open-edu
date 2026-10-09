# OpenEdu Pack System

**Status:** Proposed (revised, source-verified)
**Version:** 0.3
**Supersedes:** 0.2 (revisions 0.1 and 0.2 were earlier drafts of this same file)
**Audience:** OpenEdu Studio, AI agents, curriculum designers, content authors, engine/plugin developers
**Scope:** Knowledge, curriculum, activity capabilities, learner profiles, authoring context, course-generation integration

Load-bearing claims are cited to a file and line range and were re-verified against the repository on 2026-10-07. That pass corrected several claims carried over from 0.2 and several citation and consistency errors in the 0.3 draft itself (see §0.1), including three counts, one dependency cycle, one mechanism that had been asserted without reading the code, and one claim whose subject and object were reversed.

---

## 0. What revision 0.2 changed from 0.1

Version 0.1 was written as if the OpenEdu repository were empty. It is not. Roughly 70% of the systems it proposed already exist in some form, and in several cases the proposed shapes **conflict** with what ships today.

This revision is a rewrite around a different premise:

> **The Pack System extends the existing OpenEdu architecture. It does not replace any part of it, and it introduces no parallel concept where one already exists.**

Concretely, revision 0.2:

| Change                                                                                                                          | Reason                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Adds §2 "What Already Exists" as the first architectural section                                                                | Every subsequent decision is now a traceable reference to an existing module or an explicit gap                         |
| Splits the delivery into **Phase 0 (convergence)** and **Phase 1 (packs)**                                                      | Phase 1 is unbuildable until the existing widget metadata drift is fixed. See §6.                                       |
| Replaces the invented capability vocabulary with the existing `LearningIntent` + `WidgetCapabilities` + `ai.subjectTags` triple | The old spec added a _fifth_ incompatible capability system. See §6.                                                    |
| Pack IDs are **kebab-case**, matching the five existing ID regexes                                                              | The old `<org>.<domain>.<name>` convention was rejected by every validator in the repo. See §8.2                        |
| "Course Blueprint" is eliminated as a separate artifact                                                                         | `CourseSpecJSONSchema` already _is_ the blueprint. See §19                                                              |
| `AuthoringContext` **extends** `studioContextSnapshotSchema`                                                                    | A second context object would be a fourth competing contract. See §17                                                   |
| `LearnerProfile` reuses `LearnerProfileSchema`                                                                                  | The old spec invented a parallel profile taxonomy. See §15                                                              |
| Adds §18 "Context Scoping & Budget"                                                                                             | The old lifecycle had `Load → Compose → Expose` with no truncation step, so §44's first end-to-end test could not pass. |
| Adds §20 "Provenance & Reproduction Record"                                                                                     | Provenance was a stated principle in 0.1 but had no field anywhere, including on the object handed to the AI            |
| Cuts §30, §39, §46, §49 of 0.1                                                                                                  | Four diagrams of the same boxes, all marked "not MVP"                                                                   |
| Resolves the §43/§41 contradiction                                                                                              | 0.1 required PDF-derived reference packs while excluding source-document ingestion. See §26.3                           |

1911 lines → this document. The reduction is deliberate; the cut material was duplication, not content.

### 0.1 Corrections in this revision (0.3)

The first column is the claim as previously written. Rows tagged **0.3** were found by the 2026-10-07 re-verification pass; the rest correct the 0.2 draft.

| Previous claim                                                         | Correction                                                                                                                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WIDGET_LEARNING_INTENTS` has 31 keys; all three rosters differ        | 28 keys; builtins and catalog agree 29/29 and `WIDGET_LEARNING_INTENTS` is the sole outlier, in two specific ways (§6.2)                                          |
| Validation skips affect "every built-in widget"                        | All 28 built-in definition files are `WidgetDefinitionV2`; only the `registry.ts:146` annotation is loose (§6.4)                                                  |
| `LearningIntent` has 12 members                                        | 11 members, one of which (`create`) is reserved (§6.1)                                                                                                            |
| Pack schemas in `packages/schemas`; `LearningIntentSchema`             | Pack schemas live in a new `@open-edu/packs`; `@open-edu/widgets` already depends on `@open-edu/schemas`, so the original placement was a cycle (§8.1, §10.2)     |
| `derivedFrom` read from a non-strict manifest                          | `PackManifestSchema` now declares `derivedFrom` and is `.strict()`; previously Zod would strip the key and the §20.1 gate could never fire (§8.1)                 |
| 0.1 acceptance criteria demand 12/12, 16/16, 11/11, 8/8 representation | Replaced with "no unknown values"; `create` is reserved and absent flags are true negatives (§6.5, §28)                                                           |
| `activities[].step` is "dropped" by `mapLesson`                        | It is consumed into the activity `id` via `slugify`; the compiled `Activity` has no `step` field, so the mapping row is not implementable as written (§19, §19.1) |
| "Same packs in, same course out"                                       | Lineage, not replay — the AI picks among up to 5 activities and generation is not deterministic (§18.4, §20.2, §28)                                               |
| Locale propagation lands in Phase 1                                    | No Phase 1 story touched `packages/course-compiler`; story 1.12 now does (§19.1, §27)                                                                             |
| `vite.config.ts` would hit the workspace ESM trap                      | Withdrawn — `eduPackageLoader` is a local function in `vite.config.ts:347`, not a package import (§22.3)                                                          |
| `top 5 by sidebarPosition`                                             | Deterministic truncation in catalog order; `sidebarPosition` is a `guide` documentation field (§13.3)                                                             |
| "Every objective string traces to a context objective"                 | Replaced with a mechanical intent-satisfaction check (§23.2, §28)                                                                                                 |
| **0.3** `core` copy declares `ai.subjectTags`, `widgets` copy does not | Reversed — `widget-catalog-source.ts:42` declares `ai.subjectTags`; `core/widget-catalog.ts` has no such field (§6.3)                                             |
| **0.3** Cycle detection mirrors `bundle.ts:43-71`                      | That block validates duplicate IDs and paths; the DFS cycle precedent is `semantic-validator.ts:160-185` (§9.3)                                                   |
| **0.3** `StudioApi` has 40 existing methods                            | 34 (§22.2)                                                                                                                                                        |
| **0.3** `loadPackage` / `loadBundle` live in `file-loader.ts`          | They live in `loader.ts` and `bundle-loader.ts`; `file-loader.ts:44` exports `loadPackageFromFiles` (§2)                                                          |
| **0.3** `hi/learner.json` 144 keys vs `en` 265                         | 142 vs 262 (§25)                                                                                                                                                  |
| **0.3** `validateWidgetMetadata` — 1 error, 15 warnings                | 1 error rule, 16 warning rules (§2)                                                                                                                               |
| **0.3** P0-4 acceptance is "29/29 builtins↔catalog"                    | Retiring the deprecated practice entry makes the rosters 28/28/28 post-P0-4 (§6.5, §19.1)                                                                         |
| **0.3** "0.7 is the only Phase 1 gate"                                 | Phase 1 is gated on P0-1 **and** P0-7 (§6.5, §13.2)                                                                                                               |
| **0.3** "Every field except `packs` is optional"                       | Inverted — `packs` is defaulted, `budget` is required (§17.1)                                                                                                     |
| **0.3** One name for the duplicated guide renderer                     | The private duplicate is `renderGuideMarkdown`, not `renderWidgetGuideMarkdown` (§6.3)                                                                            |

---

# 1. Purpose

The OpenEdu Pack System makes **knowledge, curriculum, and learner constraints pluggable into OpenEdu Studio**.

The goal: a tutor or course author selects a curriculum, a set of concepts, a learner context, and available activities, then creates a course without starting from a blank authoring environment.

Instead of:

```text
Tutor
  ↓
Blank Studio
  ↓
"Create a lesson on fractions."
  ↓
Course
```

OpenEdu should support:

```text
Curriculum Pack          packs/curriculum/nios-math-level-a/
    + Knowledge Pack     packs/knowledge/openedu-fractions/
    + Learner Profile    @open-edu/domain-guidance  (profiles.json)
    + Activity Registry  @open-edu/widgets           (29 builtins + resolver)
    ↓
Authoring Context       extends studioContextSnapshotSchema
    ↓
OpenEdu Studio          apps/dev-server
    ↓
AI Companion            grounded on the context
    ↓
Course Spec             CourseSpecJSONSchema  (format: openedu-course-spec)
    ↓
OpenEdu Course          edu compile → package / bundle
```

The Pack System is a **content and capability composition layer** in front of the existing authoring pipeline. It does not replace the course format, the compiler, or the runtime.

---

# 2. What Already Exists

This is the map the rest of this document reasons from. Every row is a real module in this repository.

| Concern                              | Existing implementation                                                                                                                                                      | Status                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Pack/knowledge/curriculum data model | —                                                                                                                                                                            | **Does not exist.** This is the new work.                                 |
| Activity registry (runtime)          | `packages/widgets/src/registry.ts` — `createWidgetRegistry`, 29-entry private `BUILTIN_WIDGETS`, `search`, `searchWithFilters`                                               | Exists, adequate                                                          |
| Activity registry (Studio)           | `apps/dev-server/src/studio/widgets/curatedCatalog.ts` — `listCuratedWidgets`, `getCuratedWidget`, `CuratedWidget`                                                           | Exists, adequate                                                          |
| Activity registry (remote/trust)     | `packages/widgets/src/resolver/catalog.ts` — `loadStaticCatalog`, `CatalogWidgetMeta` with `trustTier` / `integrity` / `status`                                              | Exists                                                                    |
| Activity catalog data                | `packages/core/src/widget-catalog-data.json` — 29 entries, generated from `widget-catalog-source.ts` via `pnpm --filter @open-edu/widgets generate:catalog`                  | Exists, **hand-duplicated and drifting from the widget definitions** (§6) |
| Learning-intent taxonomy             | `LearningIntent` enum, 11 members, lowercase (`packages/widgets/src/metadata/learning-intents.ts:1-14`)                                                                      | Exists, canonical                                                         |
| Activity capability flags            | `WidgetCapabilities`, 16 camelCase booleans                                                                                                                                  | Exists, canonical                                                         |
| Activity accessibility flags         | `AccessibilityMetadata`, 11 fields                                                                                                                                           | Exists, canonical                                                         |
| Content-domain tags                  | `AIMetadata.subjectTags`                                                                                                                                                     | Exists, **underused**                                                     |
| Interactive engines                  | `INTERACTIVE_ENGINE_TYPES` = `visual \| chart \| geomap \| timeline \| diagram` (`packages/schemas/src/nodes.ts:32-40`)                                                      | Exists, **closed set**                                                    |
| Course blueprint / IR                | `CourseSpecJSONSchema` (`packages/course-compiler/src/parser/json-input.ts:46-65`), `format: 'openedu-course-spec'` v1                                                       | Exists                                                                    |
| Compiled internal model              | `CourseModelSchema` (`packages/course-compiler/src/schemas/course-model.ts:238-245`), all `.strict()`                                                                        | Exists                                                                    |
| Learning objectives                  | `LearningObjectiveSchema` — `id`, `description`, `bloomLevel` (6 Bloom verbs), `skills`                                                                                      | Exists                                                                    |
| Gradual-release activity steps       | `ActivityJSONSchema.step` — `observe \| guided_practice \| independent_practice \| mastery_check \| positive_completion`                                                     | Exists, **dropped during mapping**                                        |
| Learner profiles                     | `LearnerProfileSchema` (`packages/domain-guidance/src/types.ts:13-36`) + `profiles.json` (4 profiles: `neurotypical`, `autism`, `school`, `college`)                         | Exists                                                                    |
| Studio AI context                    | `studioContextSnapshotSchema` (`packages/companion/src/context.ts:27-73`)                                                                                                    | Exists, **has no curriculum/knowledge**                                   |
| Context truncation precedent         | `truncateExcerpt(text, 4000)`, `buildOutlineSummary(activities, 30)` (`context.ts:77-94`)                                                                                    | Exists                                                                    |
| LLM-facing course contract           | `packages/domain-guidance/src/data/artifact-contract.json` — **generated** by runtime Zod introspection                                                                      | Exists, regenerate on schema change                                       |
| Quality rubric                       | `packages/domain-guidance/src/data/quality-rubric.json` — 4 dimensions (`objectives`, `assessment`, `duration`, `completeness`)                                              | Exists                                                                    |
| AI skill resolution                  | `apps/dev-server/src/studio/ai/skills/resolveSkills.ts:15-72` — learner profile → `learner-adaptation` skill; `"interactive"` in text → `interactive-<engine>` skill         | Exists                                                                    |
| AI agent loop                        | `apps/dev-server/src/studio/ai/agentLoop.ts` — deterministic for `generate_course` / `generate_item` / `edit_item`; bounded model loop for `explain`                         | Exists                                                                    |
| Package validation                   | `edu validate` → `loadPackage` (`packages/core/src/loader.ts`) / `loadBundle` (`packages/core/src/bundle-loader.ts`), both over `loadPackageFromFiles` (`file-loader.ts:44`) | Exists                                                                    |
| Archive format                       | `.oep` — `OepWriter` / `OepReader`, ZIP, `manifest.json` + `course/` root, SHA-256 path-list checksum, zip-bomb + traversal guards                                           | Exists                                                                    |
| Install / update                     | `InstallCoordinator.install` / `.update` with `VERSION_SAME` / `VERSION_DOWNGRADE` gating, 20-code `InstallErrorCode`                                                        | Exists                                                                    |
| Version comparison                   | `parseSemver` / `semverGreaterThan` / `semverEquals` (`packages/oep-distribution/src/version-compare.ts`) — exact `X.Y.Z` only                                               | Exists                                                                    |
| Distribution catalog                 | `CatalogSchema` / `CatalogPackageEntrySchema` (`packages/schemas/src/catalog.ts`), `buildCatalog`, `open-edu-registry` CLI                                                   | Exists, GitHub-native                                                     |
| Localization                         | `@open-edu/i18n` — `SUPPORTED_LOCALES = ['en','hi','or']`, 6 namespaces, `locales/{lang}/{namespace}.json`, `t('namespace.key')`, `{{param}}`                                | Exists, **English-only for packs**                                        |
| i18n tooling                         | `edu i18n extract` / `validate` / `missing`                                                                                                                                  | Exists                                                                    |
| Widget metadata validation           | `validateWidgetMetadata` (`packages/widgets/src/validate-metadata.ts`) — 1 error rule, 16 warning rules                                                                      | Exists                                                                    |

### 2.1 The four gaps this system fills

1. **Curriculum and knowledge have no representation anywhere.** `packages/schemas` models files on disk; there is no `ConceptSchema`, no `CurriculumSchema`, no prerequisite graph over knowledge. `CardTypeSchema` includes `'knowledge'` but as a rewards-surface category, not a knowledge model.
2. **The Studio AI receives no pedagogical ground truth.** `studioContextSnapshotSchema` carries view, locale, activity excerpt, and a thin learner profile. The quality rubric injected into the system prompt is four hardcoded English sentences (`apps/dev-server/src/studio/ai/chat/policy.ts:106-110`).
3. **Content is dropped at every compiler boundary.** `ActivityJSONSchema.step` (gradual release) and `LessonJSONSchema.misconceptions` are parsed and then discarded by `mapLesson` (`json-input.ts:78-151`). `LearningObjectiveSchema.bloomLevel` never reaches the generated package. `generateSingleModule` writes only `{ id, title, version, author, entry }` (`package-generator.ts:121-128`).
4. **Nothing records where authored content came from.** There is no provenance field in `PackageManifestSchema`, `DistributionManifestSchema`, `RegistryMetadataSchema`, or `StudioContextSnapshot`.

---

# 3. Design Principles

### 3.1 Extend, never parallel

If a concept exists, the Pack System references it. It does not define a second version of it. A design that requires a tutor to learn both `<existing concept>` and `<pack concept>` is wrong by default.

Concretely: the Pack System defines **three** new schemas (`PackManifestSchema`, `ConceptSchema`, `CurriculumSchema`) in a new `@open-edu/packs` package, **zero** new taxonomies, and **zero** new registries.

### 3.2 Packs are declarative

A pack contains knowledge, concepts, curriculum sequencing, objectives, and source references. It contains **no executable code**.

A pack never declares a capability an activity provides. See §12.2 — this is where 0.1 leaked across the pack/engine boundary.

### 3.3 Knowledge and curriculum stay separate

Knowledge answers _what can be taught_. Curriculum answers _what should be taught, in what order, at what depth_. They are two pack types with different schemas, not one merged subject schema. A knowledge pack is reusable across curricula; a curriculum pack references knowledge by qualified ID.

### 3.4 Curriculum depends on intents, not implementations

A curriculum never names a widget or an engine. It declares:

- which **learning intents** an objective requires (`LearningIntent` — existing enum), and
- which **concepts** it covers (pack-qualified concept IDs).

Resolution to a concrete activity is a registry query (§13), not a reference.

### 3.5 Source fidelity is non-negotiable

Any concept derived from an external document carries provenance (§20.1). Any course generated from packs records which packs, at which versions, produced which nodes (§20.2).

> Generated educational content must not silently lose its source relationship.

This is a validation error, not a warning.

### 3.6 AI designs, runtime enforces

| Decides                                                                                                    | Component                           |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Which learning approach fits, which activity _might_ help, how to sequence a lesson                        | AI Companion                        |
| Does the activity exist, does it support the required intent, is the config valid, does the course execute | Registry + `edu validate` + runtime |

This boundary is already implemented in `agentLoop.ts:125-128`, where `generate_course` / `generate_item` / `edit_item` intents are routed deterministically _before_ any model call. The Pack System must not route around it.

### 3.7 No premature infrastructure

Out of scope for Phase 1: remote pack hosting, semver ranges, dependency solving, signing, ratings, payments, a marketplace, pack embeddings.

---

# 4. Terminology

Terms map to existing types where one exists. "New" marks types this document proposes to add.

| Term                | Meaning                                                          | Maps to                                                  |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| Pack                | Declarative collection of educational knowledge or configuration | **new**                                                  |
| Knowledge Pack      | Concepts, definitions, examples, misconceptions, prerequisites   | **new** (`ConceptSchema`)                                |
| Curriculum Pack     | Levels, units, objective sequence, source references             | **new** (`CurriculumSchema`)                             |
| Concept             | An addressable unit of subject knowledge                         | **new**                                                  |
| Learning Intent     | What learning move an activity supports                          | `LearningIntent` enum — **existing**                     |
| Domain Tag          | What subject content an activity covers                          | `AIMetadata.subjectTags` — **existing**                  |
| Activity            | An executable learning interaction                               | `WidgetDefinitionV2` — **existing**                      |
| Activity Registry   | Resolves (intents, tags) to activities                           | `createWidgetRegistry` + `curatedCatalog` — **existing** |
| Interactive Engine  | A host for a rich interaction (visual, geomap, …)                | `INTERACTIVE_ENGINE_TYPES` — **existing, closed set**    |
| Learner Profile     | Declarative learner constraints and guidance                     | `LearnerProfileSchema` — **existing**                    |
| Authoring Context   | Composed context handed to Studio and the AI                     | **extends** `StudioContextSnapshot`                      |
| Course Spec         | The authoring artifact produced from context                     | `CourseSpecJSONSchema` — **existing**                    |
| Provenance          | Source traceability for a concept                                | **new**                                                  |
| Reproduction Record | Pack-to-node mapping stored in a generated course                | **new**                                                  |

There is no "Course Blueprint" type. See §19.

---

# 5. Pack Types

Phase 1 defines **two** pack types. The other two concepts in 0.1 already exist and are reused, not packed.

```text
NEW in Phase 1
  Knowledge Pack     packs/knowledge/<id>/
  Curriculum Pack    packs/curriculum/<id>/

REUSED, not a pack
  Learner Profile    @open-edu/domain-guidance/profiles  (§15)
  Activity           @open-edu/widgets                    (§12, §13)

DEFERRED
  Activity Pack      — a pack that declares an activity's
                      capabilities duplicates WidgetDefinitionV2
                      and is authored by the same party.
                      See §12.2.
  Asset Pack         — assets are already referenced by
                      AssetSchema { id, path, type, description }
                      and resolved by the course compiler.
                      See §24.
  Assessment Pack    — assessment is already expressed by
                      LearningIntent.Assess + QuestionSchema.
                      See §12.2.
```

This is a reduction from 0.1's four types, and it is the single largest simplification in this revision. Three of the four proposed pack types were re-describing something the repository already has.

---

# 6. Phase 0 — Converge Existing Metadata

**This is a prerequisite. Phase 1 cannot start until the gated deliverables land (§6.5).**

Precisely: Phase 1 is gated on **P0-1** and **P0-7** (§6.5). P0-7 changes a type Phase 1 reads; P0-1 generates the catalog data that §13.2's `subjectTags` join runs against — without it the filter returns almost nothing. The rest of Phase 0 is tracked as correctness debt that should land in the same cycle.

0.1 assumed there was one capability vocabulary. There are four, plus three widget rosters that disagree with each other. A capability-matching registry (§13) built on top of that cannot work.

### 6.1 The four capability representations

| #   | Representation                    | Shape                                                                                                                                                                                                 | Location                                                 |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | `WidgetCapabilities`              | 16 camelCase booleans: `supportsKeyboard`, `supportsScoring`, `supportsVoice`, `supportsPrinting`, …                                                                                                  | `packages/widgets/src/metadata/capabilities.ts`          |
| 2   | `LearningIntent`                  | 11 lowercase strings: `assess`, `practice`, `observe`, `compare`, `explore`, `create`, `reflect`, `apply`, `listen`, `recall`, `understand`                                                           | `packages/widgets/src/metadata/learning-intents.ts:1-14` |
| 3   | `WidgetCatalogEntry.capabilities` | flat **PascalCase** `string[]` — 13 values: `Keyboard`, `ScreenReader`, `Hints`, `Retry`, `Scoring`, `Touch`, `Mouse`, `Analytics`, `Rewards`, `Accessibility`, `Offline`, `ObserveMode`, `Animation` | `widget-catalog-source.ts:20-48`                         |
| 4   | `WidgetCapabilitySchema`          | kebab-case sandbox permissions for community widgets                                                                                                                                                  | `packages/schemas/src/community-widget-manifest.ts`      |

Representation 3 is **not derived from 1 or 2** — it is independently authored string data, and the two are not type-compatible.

Concrete drift, all verified against `packages/core/src/widget-catalog-data.json` (29 entries):

| Field             | Enum/interface members | Values present in catalog data | Missing                                                     |
| ----------------- | ---------------------- | ------------------------------ | ----------------------------------------------------------- |
| `learningIntents` | 11                     | 10 (PascalCase)                | `create` — reserved, no widget declares it                  |
| `capabilities`    | 16                     | 13                             | `supportsVoice`, `supportsPrinting`, `supportsLocalization` |
| `accessibility`   | 11                     | 9                              | `signLanguageReady`, `audioDescription`                     |
| `analytics`       | 8                      | 7                              | `trackConfidence`                                           |

`searchWithFilters` (`registry.ts:92-120`) already filters on representation 1 (`filters.capability` is `keyof WidgetCapabilities`, a boolean key) and representation 2 (`filters.intent`), but the catalog JSON — which is what the Studio and the AI prompt actually read — uses representation 3. **The two are never cross-checked.**

### 6.2 Three widget rosters

| Roster                         | Count | Source                                               |
| ------------------------------ | ----- | ---------------------------------------------------- |
| `BUILTIN_WIDGETS`              | 29    | `registry.ts:146-176` (module-private, not exported) |
| `WIDGET_CATALOG_ENTRIES`       | 29    | `widget-catalog-source.ts:50`                        |
| `WIDGET_LEARNING_INTENTS` keys | 28    | `learning-intents.ts:16-49`                          |

`BUILTIN_WIDGETS` and `WIDGET_CATALOG_ENTRIES` agree at 29/29, verified by set comparison of widget IDs. `WIDGET_LEARNING_INTENTS` is the **sole outlier** at 28 keys, and it diverges in two distinct ways:

- **ID divergence** — the deprecated practice widget is `core.multiple-choice-practice` here, but `open-edu.multiple-choice-practice` in the catalog.
- **Omission** — `core.process-explainer` is a stable built-in _and_ a catalog entry, but has no `WIDGET_LEARNING_INTENTS` entry. It is also the only one of the 29 widget definitions with no `ai.subjectTags`.

`science.process-diagram`, by contrast, is present in all three rosters and is **not** an example of drift.

### 6.3 Duplicate declarations

- `WIDGET_ALIAS_MAP` is declared in `packages/widgets/src/domains.ts:9-25` **and** `packages/core/src/widget-catalog.ts:48-64`.
- `WidgetCatalogEntry` is declared in `packages/widgets/src/widget-catalog-source.ts:20-48` **and** `packages/core/src/widget-catalog.ts:5-46`; the `widgets` copy declares `ai.subjectTags` (`widget-catalog-source.ts:42`), which the `core` copy omits — the two interfaces have already drifted.
- The guide renderer is implemented as `renderWidgetGuideMarkdown` (`packages/widgets/src/guide-markdown.ts:3`) and again as a private `renderGuideMarkdown` (`apps/dev-server/src/studio/widgets/curatedCatalog.ts:27-81`).

### 6.4 Silent validation skips

`validate-metadata.ts:69,77,85` guard the cross-field consistency checks with `widget.capabilities &&` / `widget.capabilities?.…` and `widget.analytics &&`. When the object is absent the check is **skipped without a warning**, so a widget with `status: 'stable'` and no capability declaration at all passes clean. The `if (widget.ai)` block at `validate-metadata.ts:49` is skipped identically when `ai` is undefined.

That guard does **not** fire for the built-ins today. All 28 built-in definition files declare `WidgetDefinitionV2`, whose `learningIntents`, `capabilities`, `accessibility`, `analytics`, `reward`, and `ai` fields are all required, and `BUILTIN_WIDGETS` holds those objects. The exposure is narrower than it looks: the loose annotation at `registry.ts:146` (`WidgetDefinition[]`) is what _permits_ a metadata-less registration, and no built-in takes advantage of it. The residual risk is a hand-registered or community widget, which is exactly what P0-4 and P0-6 close.

### 6.5 Phase 0 deliverables

| #    | Deliverable                                                                                                                                                  | Acceptance                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | `WidgetDefinitionV2` gains a `guide` field, and `WidgetCatalogEntry` becomes **generated** from it rather than hand-authored                                 | `generate:catalog` fails if any entry diverges from its widget definition; all 9 `guide` keys are emitted                                                                                                |
| P0-2 | Catalog `learningIntents` become `LearningIntent` values (lowercase), not PascalCase strings                                                                 | No unknown values: every catalog intent is one of the 11 enum members. `create` is reserved and legitimately absent                                                                                      |
| P0-3 | Catalog `capabilities` / `accessibility` / `analytics` are emitted from the boolean maps                                                                     | No unknown keys. An absent flag is a true negative, not drift — full representation is deliberately **not** a target                                                                                     |
| P0-4 | One `BUILTIN_WIDGETS` roster, exported, consumed by `WIDGET_CATALOG_ENTRIES` and `WIDGET_LEARNING_INTENTS`; the deprecated practice entry is retired (§19.1) | Set equality across all three rosters **after retirement** (28/28/28): the `core.`/`open-edu.` ID divergence and the missing `core.process-explainer` entry are both closed; a test asserts set equality |
| P0-5 | `WIDGET_ALIAS_MAP` and `renderWidgetGuideMarkdown` are declared once each                                                                                    | Single declaration, imported by `core` and `dev-server`                                                                                                                                                  |
| P0-6 | `validate-metadata.ts` emits a warning for a stable widget with no declared capabilities                                                                     | Warning, not error                                                                                                                                                                                       |
| P0-7 | `WidgetSearchFilters` gains all-of intents and any-of subject tags                                                                                           | See §13.2                                                                                                                                                                                                |

**P0-1 is a schema change, not a script change.** `WidgetDefinitionV2` has no `guide` field today, yet 28 of the 29 catalog entries carry a nine-key `guide` object (`oneLiner`, `whatItDoes`, `whenToUse`, `setupSteps`, `configFields`, `exampleJson`, `tips`, `sidebarPosition`, `relatedWidgets`). Generating the catalog from `WidgetDefinitionV2` therefore cannot reproduce it until V2 gains that field. Keeping the guides hand-authored instead would preserve the exact duplication §6 exists to remove, so P0-1 is specified as extending V2.

**P0-1 and P0-7 are the hard gates.** P0-7 changes `WidgetSearchFilters` (§13.2); P0-1 generates the catalog data that §13.2's `subjectTags` join runs against — without it the filter returns almost nothing. P0-2 through P0-6 are correctness fixes that make the capability data trustworthy once Phase 1 starts depending on it. They are small, isolated, and independently valuable, and they should land in the same cycle, but Phase 1 does not block on them.

---

# 7. Pack Layout

```text
packs/
  knowledge/
    openedu-fractions/
      manifest.json
      concepts.json
      sources.json
  curriculum/
    nios-math-level-a/
      manifest.json
      curriculum.json
      sources.json
```

The registry slot is the **directory**, not the ID. A pack's type is not encoded in its identifier; this is what allows pack IDs to satisfy the existing kebab-case validators (§8.2).

Not every directory is required. `sources.json` is optional. `manifest.json` is not.

**Location and version control.** `packs/` is content, not code. The workspace `packs/` directory is gitignored (root-anchored `/packs/`, so `examples/packs/` stays tracked), and `OPEN_EDU_PACKS_DIR` normally points **outside the repository** — at `open-edu-pipeline` output (§26.3) or a separate content checkout. The single committed pack is the Phase 1 validation fixture: hand-authored `openedu-fractions` lives at `examples/packs/knowledge/openedu-fractions/`, and anything that loads it (tests, `edu dev` demos) sets `OPEN_EDU_PACKS_DIR=examples/packs` explicitly.

### 7.1 Why no `examples/`, `glossary/`, `relationships/` files

0.1 §5.2 proposed five files per knowledge pack. Three of them have no consumer:

- `examples.json` — examples are generated per-leasure by the AI from concept descriptions. Storing them centrally duplicates the `LessonJSONSchema.examples` field.
- `glossary.json` — `CourseModelSchema.globalGlossary` and `LessonSchema.glossary` already exist. A pack-level glossary would need a merge rule that nothing currently implements.
- `relationships.json` — prerequisite edges belong on the concept (§9.3), not in a side table that can drift.

Concepts carry examples, glossary terms, and prerequisites inline. If a concept grows too large for that, it splits into two concepts.

---

# 8. Pack Identity & Manifest

### 8.1 Manifest

`PackManifestSchema`, new, in a new `@open-edu/packs` package (`packages/packs/src/manifest.ts`) — **not** in `@open-edu/schemas`, for the dependency reason given in §10.2:

```ts
export const PACK_FORMAT = 'openedu-pack' as const;
export const PACK_FORMAT_VERSION = 1 as const;

export const PackTypeSchema = z.enum(['knowledge', 'curriculum']);
export type PackType = z.infer<typeof PackTypeSchema>;

export const PackManifestSchema = z
  .object({
    format: z.literal(PACK_FORMAT),
    formatVersion: z.literal(PACK_FORMAT_VERSION),
    type: PackTypeSchema,
    id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, 'id must be kebab-case'),
    version: z
      .string()
      .min(1)
      .max(64)
      .regex(/^\d+\.\d+\.\d+$/, 'version must be semver (e.g. 1.0.0)'),
    name: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    author: z.string().min(1).max(128),
    language: z.enum(SUPPORTED_LOCALES).default('en'),
    requires: z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]*$/)).default([]),
    derivedFrom: z.enum(['document']).optional(),
  })
  .strict();
```

`id`, `version`, and the ID regex are **identical** to `PackageManifestSchema` and `DistributionManifestSchema` (`packages/schemas/src/manifest.ts:3-23`, `distribution-manifest.ts:25-42`) so that pack IDs and course IDs live in the same identifier space and share the existing `resolveWidgetId`-style resolution and catalog machinery.

`PackManifestSchema` is **`.strict()`**, like the concept and curriculum schemas. An undeclared key in a pack is a validation error, not a silent pass. `derivedFrom` is therefore declared explicitly here rather than being read opportunistically: with `.strict()`, an undeclared `derivedFrom` is rejected outright, and without it, a non-strict `z.object` would strip the key on parse and the `KNOWLEDGE_SOURCE_MISSING` gate in §20.1 could never fire.

`language` is constrained to `SUPPORTED_LOCALES` by importing it from `@open-edu/i18n`, which is dependency-free and therefore safe to import from `@open-edu/packs`. `SUPPORTED_LOCALES` is an `as const` tuple, so depending on the Zod version this may need `z.enum([...SUPPORTED_LOCALES] as [Locale, ...Locale[]])`; `isSupportedLocale` is available if a `superRefine` is preferred.

### 8.2 Why kebab-case, not dotted

0.1 §19 proposed `<organization>.<domain>.<name>` — `nios.math.level-a`. Every ID regex in the repository forbids dots:

- `PackageManifestSchema` — `manifest.ts:5-9`
- `BundleManifestSchema` — `bundle.ts:22-27`
- `DistributionManifestSchema` — `distribution-manifest.ts:30-33`
- `CatalogPackageEntrySchema` — `catalog.ts:15-19`
- `RegistryMetadataSchema` — `registry.ts:8-12`

All five use `/^[a-z0-9][a-z0-9_-]*$/`. Adopting dots would require relaxing all five plus the `open-edu.*` → `core.*` alias convention in `WIDGET_ALIAS_MAP`. The namespace information is preserved by the directory layout (§7) and the `author` field instead.

`openedu-fractions`, `nios-math-level-a`, `nios-evs-level-a`.

### 8.3 Versioning

Exact semver only, matching the existing `parseSemver` / `semverGreaterThan` implementation. No ranges, no prerelease suffixes, no `^`.

`RegistryMetadataSchema.version` is `.describe('Informational only; catalog versions always come from GitHub Releases')`. Pack versions are authoritative in `PackManifestSchema.version` and are recorded in the course's Reproduction Record (§20.2), so no catalog involvement is needed for Phase 1.

### 8.4 Dependencies

```json
{ "requires": ["openedu-fractions"] }
```

Explicit references only, exact IDs, no version ranges. An unresolvable `requires` is a **hard install failure** — not a warning, not a best-effort skip. This mirrors the existing fail-closed behavior in `validate-release.ts:32-90`.

---

# 9. Knowledge Pack

### 9.1 Purpose

Reusable subject knowledge that one or more curriculum packs can reference. A knowledge pack must be usable by more than one curriculum; if it is not, it belongs in the curriculum pack.

### 9.2 `ConceptSchema`

```ts
export const ConceptSourceSchema = z.object({
  documentId: z.string().min(1).max(128),
  locator: z.string().min(1).max(256).optional(),
  section: z.string().max(256).optional(),
  page: z.number().int().positive().optional(),
  excerpt: z.string().max(2000).optional(),
});

export const ConceptSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    title: z.string().min(1).max(256),
    summary: z.string().min(1).max(2000),
    domainTags: z.array(z.string().min(1).max(64)).min(1),
    examples: z.array(z.string().max(1000)).max(10).optional(),
    misconceptions: z.array(z.string().max(1000)).max(10).optional(),
    prerequisites: z.array(z.string().min(1).max(128)).max(20).optional(),
    source: ConceptSourceSchema.optional(),
  })
  .strict();
```

Design notes:

- **`.strict()`**, matching every schema in `packages/course-compiler/src/schemas/course-model.ts`. An unknown key in a pack is a validation error, not a silent pass.
- `id` is **pack-local**. Cross-pack references are always `{ pack, concept }` (§16.1), so two packs may both define `fraction` without collision.
- `summary` is capped at 2000 characters and is the _only_ concept text injected into the authoring context by default (§18.3). The cap is the budget, not a documentation nicety.
- `domainTags` is required and non-empty. It is the join key to `AIMetadata.subjectTags` (§13). A concept with no domain tag cannot be matched to an activity, which makes it useless to the registry.
- `source` is optional but, when a pack declares `"derivedFrom": "document"` in its manifest, becomes **required**. See §20.1.
- 0.1's `relationships.json` and 4-level `Subject → Topic → Concept → Sub-concept` hierarchy (0.1 §25) are not adopted. Hierarchy is expressed by `prerequisites` plus `domainTags`; a deeper tree is a presentation concern for the Studio UI, not a data model.

### 9.3 Prerequisites

`prerequisites: string[]` references concept IDs **within the same pack**. A cross-pack prerequisite is a curriculum concern (§10.2) and is expressed in `CurriculumSchema.units[].prerequisites`, which takes pack-qualified references.

Validation: no self-reference, no cycles within a pack, all referenced IDs present. Cycle detection mirrors the existing DFS in `packages/course-compiler/src/validators/semantic-validator.ts:160-185` (module-prerequisite `CYCLE_DETECTED`).

---

# 10. Curriculum Pack

### 10.1 Purpose

How knowledge is organized for a specific educational context: levels, units, a recommended sequence, objectives, and source references. It references knowledge packs; it does not embed concepts.

### 10.2 `CurriculumSchema`

```ts
export const ConceptRefSchema = z.object({
  pack: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  concept: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
});

const ObjectiveSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
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
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
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
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
    title: z.string().min(1).max(256),
    subject: z.string().min(1).max(128),
    level: z.string().max(64).optional(),
    units: z.array(CurriculumUnitSchema).min(1),
  })
  .strict();
```

Design notes:

- `ObjectiveSchema.bloomLevel` is the **same six-value enum** as `LearningObjectiveSchema.bloomLevel` (`course-model.ts:15-24`). A pack objective maps 1:1 onto a Course Spec objective string.
- `requiresIntents` uses the **existing** `LearningIntent` enum, imported from `@open-edu/widgets` and wrapped with `z.nativeEnum`. This is the field that replaces 0.1's invented 14-string capability list. The import direction is the reason pack schemas live in `@open-edu/packs`: `@open-edu/widgets` already depends on `@open-edu/schemas`, so a `CurriculumSchema` in `@open-edu/schemas` would create a cycle. `@open-edu/packs` depends on both and is depended on by neither.
- `concepts` uses qualified `{ pack, concept }` refs, closing the cross-pack ID collision that 0.1 §26 assumed away.
- `prerequisites` on a unit references **sibling unit IDs** within the curriculum, mirroring `CourseModuleSchema.prerequisites` (`course-model.ts:212`).

### 10.3 Example

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
        }
      ],
      "estimatedMinutes": 20
    }
  ]
}
```

---

# 11. Learning Objectives

Objectives are the bridge from curriculum to activity. They are declared once, in the curriculum pack (§10.2), and consumed by the registry (§13).

An objective declares two things and nothing else:

1. **What it covers** — `concepts: ConceptRef[]`
2. **What kind of learning it needs** — `requiresIntents: LearningIntent[]`

It never names a widget or an engine.

```text
DO NOT:
  activity: FractionBuilderV2
  engine: visual

REQUIRE:
  concepts: [openedu-fractions/fraction]
  intents: [practice, compare]
```

0.1's `evidence: { type: 'representation' }` is not adopted. `representation` is not a member of `LearningIntent`; inventing a parallel evidence vocabulary would reintroduce exactly the drift §6 exists to remove. Bloom level plus intents is sufficient for Phase 1, and Bloom level already exists.

---

# 12. Activity Capabilities

### 12.1 The three-tier model

0.1 collapsed three unrelated things into one flat `string[]`. They are separated by tier:

| Tier           | Question it answers                   | Existing source                                         | Used for                                                      |
| -------------- | ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| **Intent**     | What learning move does this support? | `LearningIntent` (11)                                   | Objective → activity matching                                 |
| **Domain tag** | What subject content does it cover?   | `AIMetadata.subjectTags`                                | Concept → activity matching                                   |
| **Capability** | Can the implementation do X?          | `WidgetCapabilities` (16), `AccessibilityMetadata` (11) | Learner-profile compatibility filtering, runtime requirements |

Matching uses tiers 1 and 2. Filtering uses tier 3. Tiers are never mixed in one query — which is what makes `"fraction"` (a domain tag) and `"visual"` (0.1's invention, tier 3) stop competing for the same slot.

### 12.2 Packs declare requirements, never capabilities

An activity's capabilities are declared by the activity's author, in `WidgetDefinitionV2`, and are already validated by `validate-metadata.ts`.

0.1 §8.2 proposed an "Activity Capability Pack" containing `{"id": "fraction-builder", "engine": "visual", "capabilities": [...]}` and captioned it "a capability declaration, not the React implementation." That is the pack describing an implementation — the exact boundary 0.1 §10 said packs must not cross, and the same party (the engine author) would author both. There is no third party whose claim needs an independent declaration, so there is nothing for a pack to add.

**An activity pack is not part of Phase 1.** See §5.

### 12.3 What a curriculum objective looks like to the registry

```json
{
  "id": "represent-fraction",
  "concepts": [{ "pack": "openedu-fractions", "concept": "fraction" }],
  "requiresIntents": ["practice", "compare"]
}
```

Registry resolution (§13.2): all-of `requiresIntents` against `learningIntents`, any-of concept `domainTags` against `ai.subjectTags`.

---

# 13. Activity Registry

### 13.1 What already exists

The registry is not new. There are three layers, all shipped:

| Layer   | API                                                                                                                             | Consumer                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Runtime | `createWidgetRegistry()` — `get`, `getAll`, `getByDomain`, `search`, `searchWithFilters`                                        | `@open-edu/runtime` renderers   |
| Studio  | `listCuratedWidgets()`, `getCuratedWidget(id)` — filters deprecated, merges builtin + registry sources, exposes `CuratedWidget` | Studio widget picker, AI prompt |
| Remote  | `loadStaticCatalog(json)` → `ResolverCatalog` with `trustTier`, `integrity`, `status`                                           | community / remote widgets      |

`createWidgetRegistry` throws `WidgetRegistrationError` on duplicate IDs, and `listCuratedWidgets` excludes deprecated entries, so the registry already enforces the "does this activity exist and is it usable" half of §3.6.

### 13.2 The one addition Phase 1 needs

`WidgetSearchFilters` (`packages/widgets/src/types.ts:64-72`) currently supports `intent: LearningIntent` (single) and `capability: keyof WidgetCapabilities` (boolean key). Objective matching needs all-of intents and any-of domain tags:

```ts
export interface WidgetSearchFilters {
  query?: string;
  domain?: string;
  intents?: LearningIntent[]; // all-of
  subjectTags?: string[]; // any-of against AIMetadata.subjectTags
  difficulty?: DifficultyLevel;
  status?: WidgetDefinitionV2['status'];
  capability?: keyof WidgetCapabilities;
  accessibility?: keyof AccessibilityMetadata;
}
```

The `intent` (singular) field is retained as a deprecated alias for `intents` for one minor version, so existing callers do not break.

**`subjectTags` is a join key, and today it is barely populated.** Verified state: 27 of the 28 built-in definition files declare `ai.subjectTags`, with real but uncontrolled values (`math`, `fractions`, `place-value`, `science`, `biology`, `geography`, `wellness`, `reading`, plus `general` as a placeholder) — but the hand-authored catalog declares `subjectTags` on **1 of 29** entries, and `generate:catalog` is a verbatim `JSON.stringify`, so the generated catalog the Studio and AI prompt actually read carries the same single value. `core.process-explainer`, the one builtin missing from `WIDGET_LEARNING_INTENTS` (§6.2), is also the one builtin with no `subjectTags` at all.

So any-of `subjectTags` matching against the current catalog returns almost nothing, and `ConceptSchema.domainTags` would be joining two uncontrolled vocabularies by string luck. P0-1 resolves this by generating the catalog from the widget definitions, which makes the widget-level `subjectTags` the vocabulary `domainTags` joins against; P0-7 adds the all-of/any-of filter fields that query it. Without P0-1 the join returns almost nothing; without P0-7 there is no filter to run.

### 13.3 Resolution is partial, and that is fine

`searchWithFilters` is a filter, not a scorer. When no activity satisfies all requirements, it returns an empty array. Phase 1 behavior:

- **0 matches** — the objective is still emitted into the Course Spec with no `widget` activity. The AI composes `reading` / `exercise` / `reflection` instead. This is recorded as a `CAPABILITY_GAP` warning in the reproduction record (§20.2), visible in the Studio.
- **1 match** — auto-selected.
- **N matches** — the first 5 in catalog order are offered to the AI, which picks one. This is **deterministic truncation, not relevance ranking**: the catalog already has a stable order, and `guide.sidebarPosition` is a documentation-layout field, not a pedagogical signal. Sorting on it would also be undefined for the deprecated `open-edu.multiple-choice-practice`, the one entry with no `guide` at all. The AI's choice is validated against the registry afterward (§3.6).

Ranking, scoring, fuzzy matching, and pedagogical weighting are explicitly deferred. They should not be built until real authoring sessions show the empty-result case is a real problem rather than a correct answer.

### 13.4 Engines are a closed set

`INTERACTIVE_ENGINE_TYPES` (`packages/schemas/src/nodes.ts:32-40`) is `visual | chart | geomap | timeline | diagram`, resolved inside `@knowledgeassemble/interactive-react` and mounted by `@open-edu/interactive-runtime`. It is a **Zod enum, not a discovery mechanism**.

0.1 §2.2 promised that "the Studio can discover an appropriate registered activity" for engines. That is not true today and is not in Phase 1 scope. A curriculum pack never names one. When an engine interaction is needed, the **author or the compiler** adds the `InteractiveNodeConfigSchema` node at authoring time, exactly as authored content does today — the same division of labour as a widget activity, which the pack requests by intent and the registry resolves (§3.4). Engine discoverability is a separate future proposal.

---

# 14. Composition

### 14.1 What composes

```text
Curriculum Pack          packs/curriculum/<id>/
  + Knowledge Packs      packs/knowledge/<id>/
  + Learner Profile      getProfile(id)  — @open-edu/domain-guidance
  + Activity Registry    listCuratedWidgets() — @open-edu/widgets
    ↓
Authoring Context        §17
```

A tutor selects one curriculum pack, zero or more knowledge packs, at most one learner profile, and an activity source set. The activity source set is _not_ a user choice in Phase 1 — it is whatever `listCuratedWidgets()` returns. 0.1 §14 proposed a checkbox list of activity capabilities; since capabilities are no longer pack data (§12.2), there is nothing to check.

### 14.2 Conflict rules

| Situation                                                             | Resolution                                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Two knowledge packs define concept `fraction`                         | Not a conflict. References are `{ pack, concept }` (§10.2). Both resolve independently.  |
| A curriculum unit references a concept in a pack that is not selected | **Validation error** at compose time (`PACK_REFERENCE_MISSING`). Not a runtime fallback. |
| A curriculum unit has no matching knowledge pack selected             | **Validation error**, same code.                                                         |
| Two learner profiles selected                                         | Not permitted. One profile per context.                                                  |
| A unit's `prerequisites` reference an unknown unit id                 | **Validation error** (`CURRICULUM_PREREQ_UNKNOWN`).                                      |
| Unit prerequisite cycle                                               | **Validation error** (`CURRICULUM_PREREQ_CYCLE`).                                        |
| A concept's `prerequisites` cycle within a pack                       | **Validation error** (`KNOWLEDGE_PREREQ_CYCLE`).                                         |

0.1 asserted packs would be freely composable without specifying a single conflict rule. These are the minimum.

---

# 15. Learner Profiles

Reused unchanged. `LearnerProfileSchema` (`packages/domain-guidance/src/types.ts:13-36`) already models everything 0.1 §11 asked for:

| 0.1 §11 requirement     | Existing field                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| activity selection      | `outputDeltas` (`widget selection restrict ...`)                  |
| content density         | `pacingRangeMinutes`, `gradeBands`                                |
| instruction length      | `guidanceDeltas` (autism: "target sentence length of 5-12 words") |
| feedback style          | `guidanceDeltas` (autism: "use specific, calm, literal praise")   |
| visual stimulation      | `accessibility: ['sensory-friendly', ...]`                        |
| assessment presentation | `outputDeltas` (`quiz question style ...`)                        |

`profiles.json` ships 4 profiles: `neurotypical` (default), `autism`, `school`, `college`. The `autism` profile is the reference implementation — 13 `guidanceDeltas`, 9 `outputDeltas`, `difficultyBias: 'beginner'`, `pacingRangeMinutes: [10, 30]`.

### 15.1 No new profile vocabulary

0.1 §11 proposed `early-learner`, `adult-learner`, `low-stimulation`, `visual-first`, `language-support`. **None of these are adopted as new kinds.** `low-stimulation` in particular duplicates the existing `autism` profile's `sensory-friendly` accessibility flag with a different name, and adding it would create a second taxonomy alongside `LearnerProfileKindSchema`.

If a genuinely new profile is needed, it is added to `profiles.json` under the existing schema. `Adult` and `Family` are already valid `LearnerProfileKind` values with no backing profile — those are the two to fill first.

### 15.2 Profile → activity filtering

Profile compatibility uses tier 3 (`WidgetCapabilities`, `AccessibilityMetadata`), not intents. A profile constrains _how_ an activity is delivered, not _what_ it teaches. Concretely, from the `autism` profile's `outputDeltas`:

```text
"widget selection restrict away from high-sensory-load,
 autoplay-media, or flashing widgets; prefer calm, predictable
 visual layouts with large touch targets"
```

This maps onto `capabilities.supportsAnimation`, `capabilities.supportsVoice` (autoplay audio), and `accessibility.reducedMotion`. This mapping is authored in the profile's `outputDeltas` DSL, not inferred by the pack system.

**Phase 1 scope limit:** profile → activity filtering is currently advisory. The only code path that reads a profile today is `resolveSkills.ts:23-36`, which injects `promptInstructions` into the AI prompt. Deterministic widget exclusion is deferred to Phase 2 — it requires the §6.1 convergence to be trustworthy first.

### 15.3 The `learnerProfileSchema` drift

`packages/companion/src/context.ts:19-23` defines its own profile shape with a 6-value `kind` enum including `adult` and `family`, which have no profile in `profiles.json`. `LearnerProfileKindSchema` in `domain-guidance` also has 6 values with the same two gaps.

Phase 1 does not fix this, but §17 must not widen it. The authoring context carries the **profile id**, resolved by `getProfile(id)`, and the snapshot's thin `{ id, label, kind }` stays as-is for UI display.

---

# 16. Locating Knowledge

### 16.1 Qualified references

Every cross-pack reference is `{ pack, concept }`. Pack-local references (`ConceptSchema.prerequisites`) are bare IDs.

This is what makes §14.2's "two packs define `fraction`" a non-issue, and it is what 0.1 §26 assumed without specifying.

### 16.2 Resolution

```ts
resolveConcept(ref: ConceptRef, loaded: Map<string, KnowledgePack>): Concept | undefined
```

Pure function, no I/O, trivially testable. Resolution failures are validation errors (§14.2), not `undefined` returns in production paths.

---

# 17. Authoring Context

### 17.1 Extends, does not replace

`AuthoringContext` is an **optional block on `studioContextSnapshotSchema`**, not a new top-level object. A second context type would become a fourth competing contract alongside `StudioContextSnapshot`, `studioContextSnapshotSchema`, and the generated `artifact-contract.json`.

```ts
export const PackRefSchema = z.object({
  id: z.string(),
  version: z.string(),
  type: z.enum(['knowledge', 'curriculum']),
});

export const AvailableActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  intents: z.array(z.nativeEnum(LearningIntent)).default([]),
  subjectTags: z.array(z.string()).default([]),
});

export const AuthoringContextSchema = z.object({
  packs: z.array(PackRefSchema).default([]),
  curriculumUnit: z.string().optional(),
  learner: z.string().optional(), // profile id, resolved via getProfile()
  locale: z.string().optional(),
  availableActivities: z.array(AvailableActivitySchema).default([]),
  concepts: z
    .array(
      z.object({
        ref: ConceptRefSchema,
        summary: z.string(),
      }),
    )
    .default([]),
  objectives: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        bloomLevel: z.string().optional(),
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

export const studioContextSnapshotSchema = z
  .object({
    /* ...existing fields unchanged... */
  })
  .extend({ authoring: AuthoringContextSchema.optional() });
```

`packs` defaults to `[]`, and every field other than `budget` is optional or defaulted. `budget` is required — it is the truncation contract (§18.2), and `resolveAuthoringContext` always populates it. A context with no packs selected is valid and behaves exactly as today.

### 17.2 What was fixed

| 0.1 defect                                                                                            | Fix                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `KnowledgeSource` / `CurriculumSource` / `AssetCapability` used but never defined                     | Replaced with `PackRef` / `ConceptRef` / `AvailableActivity`, all defined                                  |
| Example listed the same pack twice with inconsistent IDs (`nios.math.level-a` vs `nios.level-a.math`) | `PackRef` is `{ id, version, type }`; the same ID cannot appear under two types without a validation error |
| No provenance field, despite §2.6 making provenance a principle                                       | `provenance` is a required field of the context (may be empty, but is present)                             |
| No way to express what activities are available                                                       | `availableActivities`, which the validator checks AI output against                                        |
| No way to scope a large pack                                                                          | `curriculumUnit` — see §18                                                                                 |
| No budget                                                                                             | `budget` — see §18                                                                                         |

### 17.3 What is deliberately not here

- `assessments` and `assets` (0.1 §12). Assessment is `LearningIntent.Assess`; assets are `AssetSchema` and the compiler's placeholder generator. Neither is a context-level concern.
- The full widget catalog. `coursePrompt.ts` already injects the live curated catalog into the system prompt server-side. Duplicating it into the context snapshot would be a second copy of a 3853-line file.
- Full concept text beyond `summary`. See §18.3.

---

# 18. Context Scoping & Budget

**This section exists because 0.1's lifecycle could not work.** 0.1 §13 specified `Discover → Select → Load → Compose → Validate → Expose`. `Load` was undefined and nothing anywhere truncated. `studioContextSnapshotSchema` already truncates — `truncateExcerpt(text, 4000)` and `buildOutlineSummary(activities, 30)` (`context.ts:77-94`) — which is the precedent and the reason these limits are not arbitrary.

A whole NIOS Mathematics curriculum does not fit in a prompt. Neither does a 29-entry widget catalog with guides, though the current code injects it anyway via `coursePrompt.ts` (a known cost, out of scope here).

### 18.1 Scoping

The tutor's selection is a **unit**, not a pack:

```text
packs/curriculum/nios-math-level-a
  └─ unit: fractions          ← the scope
       └─ concepts: [fraction, numerator, denominator]
            └─ objectives: [represent-fraction]
```

`resolveAuthoringContext(packRefs, { unit }, budget)` loads manifests, then loads **only** the scoped unit and the concepts it references. Concepts outside the unit are not read from disk.

### 18.2 Budget

| Limit                         | Value                                                 | Precedent                         |
| ----------------------------- | ----------------------------------------------------- | --------------------------------- |
| Total pack-derived characters | 20,000                                                | —                                 |
| Per concept                   | 2,000                                                 | `ConceptSchema.summary` cap       |
| Available activities listed   | 25                                                    | `buildOutlineSummary` limit of 30 |
| Truncation order              | objectives → concept summaries → available activities | —                                 |

`budget.truncated` records what was dropped, by section. The Studio displays it. A silently truncated context is a debugging nightmare; a _reported_ truncation is information.

### 18.3 Retrieval, not loading

`resolveAuthoringContext` is a pure function over already-loaded pack data:

```ts
resolveAuthoringContext(
  packs: Map<string, LoadedPack>,
  scope: { unit?: string },
  budget: { maxChars: number },
): AuthoringContext
```

No I/O, no network, no embeddings. Embeddings, if ever added, are a **derived index**, not part of the pack contract — same principle as `widget-catalog-data.json` being generated from the canonical source rather than being the source.

### 18.4 Determinism

Given identical pack versions **and a pinned activity roster**, the resolved context is byte-identical. §18.3 makes `resolveAuthoringContext` a pure function over already-loaded data, and §18.2's budget is a fixed character count rather than a heuristic. Pinning matters because `availableActivities` is drawn from the widget catalog, not from pack data.

What the reproduction record (§20.2) buys is **lineage, not replay**. The same packs and the same context will still yield a different course, because the AI chooses among up to 5 candidate activities (§13.3) and generation is not deterministic. The record pins what was _offered_ — packs, versions, documents, activities, budget — so a divergence can be explained rather than replayed.

---

# 19. The Course Spec Is the Blueprint

0.1 §28 defined a `CourseBlueprint` type and said "the concrete schema belongs to the Course Blueprint/Course Spec workstream." That workstream already shipped: `CourseSpecJSONSchema`, `format: 'openedu-course-spec'`, version 1.

**There is no blueprint stage.** The flow is:

```text
AuthoringContext
    ↓  (AI Companion, grounded on the context)
CourseSpecJSONSchema          ← already exists
    ↓  parseCourseSpecJSON / parseCourseSpec
CourseModelSchema             ← already exists
    ↓  generatePackage
OpenEdu package or bundle     ← already exists
```

Adding a blueprint type between `AuthoringContext` and `CourseSpecJSONSchema` would add a fourth representation of the same content. The repo already has three (`CourseSpecJSONSchema`, `CourseModelSchema`, the on-disk `package.json`), and they drift — `mapLesson` (`json-input.ts:78-151`) never reads `misconceptions`, and folds `step` into the generated activity `id` via `slugify(`${a.step}-${a.description}`)` rather than preserving it as a field; `generateSingleModule` writes only `{ id, title, version, author, entry }`.

### 19.1 Pack → Course Spec mapping

| Context field                   | Course Spec field                               | Notes                                                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `objectives[].description`      | `lessons[].objectives[]`                        | Already a `string[]` — direct                                                                                                                                                                                                         |
| `objectives[].bloomLevel`       | —                                               | **Dropped.** `LessonJSONSchema.objectives` is `string[]`; `mapLesson` regenerates `obj-N` ids. Phase 2 candidate.                                                                                                                     |
| `concepts[]`                    | `lessons[].misconceptions[]` (partial)          | `misconceptions` from concepts                                                                                                                                                                                                        |
| `concepts[].summary`            | `lessons[].coreIdea`                            | 0.1 had no equivalent                                                                                                                                                                                                                 |
| `concepts[].examples`           | `lessons[].examples[]`                          | Direct                                                                                                                                                                                                                                |
| `availableActivities[]`         | `activities[].widgetId`                         | Already validated by the AI prompt rule "Widget ids must be chosen from the AVAILABLE WIDGETS table" (`artifact-contract.json:197`)                                                                                                   |
| `availableActivities[].intents` | `activities[].step` — **not preservable today** | `ActivityJSONSchema.step` exists in the spec layer, but the compiled `Activity` has no `step` field: `mapLesson` consumes it to build the activity `id`. Wiring intent → step requires `CourseModelSchema.Activity` to gain the field |
| learner profile                 | `metadata.audience`, `metadata.accessibility`   | Already implemented by `outputDeltas`                                                                                                                                                                                                 |
| learner `pacingRangeMinutes`    | `lessons[].estimatedMinutes`                    | Already implemented by `outputDeltas`                                                                                                                                                                                                 |
| locale                          | —                                               | **Lost.** `parseCourseSpecJSON` hardcodes `language: 'en'` (`json-input.ts:188`). Story 1.12 fixes this by reading it from the snapshot's `locale`                                                                                    |

Two further notes on the widget-id row. The artifact-contract rule is a **prompt** rule, not a schema check, and it also forbids `open-edu.*` ids — yet the catalog still ships an `open-edu.multiple-choice-practice` entry. That deprecated widget currently has three identities across three files: `core.multiple-choice-practice` in `WIDGET_LEARNING_INTENTS`, `open-edu.multiple-choice-practice` in the catalog, and a rule instructing the AI never to emit `open-edu.*`. P0-4 retires the entry and resolves all three.

### 19.2 Two known losses are out of Phase 1 scope

`step` and `misconceptions` are parsed and discarded today. Packs make the loss more visible, not more tolerable, but fixing `mapLesson` is a compiler change with its own regression surface. Tracked separately, not silently carried.

---

# 20. Provenance & Reproduction Record

### 20.1 Concept-level provenance

`ConceptSchema.source` (§9.2). A knowledge pack derived from external documents declares so in its manifest:

```json
{
  "format": "openedu-pack",
  "formatVersion": 1,
  "type": "knowledge",
  "id": "openedu-fractions",
  "version": "0.1.0",
  "name": "OpenEdu Fractions",
  "author": "OpenEdu",
  "language": "en",
  "requires": [],
  "derivedFrom": "document"
}
```

When `derivedFrom: 'document'`, `ConceptSchema.source` becomes required and a concept without one fails validation with `KNOWLEDGE_SOURCE_MISSING`. This is the §3.5 invariant expressed as a schema constraint rather than a guideline.

`sources.json` (optional) maps `documentId` to a human-readable record: title, publisher, year, URL, license.

### 20.2 Course-level reproduction record

**The highest-value deliverable in this document, and the cheapest.**

A course generated from packs records which pack content produced which node:

```json
{
  "schemaVersion": 1,
  "packs": [
    { "id": "nios-math-level-a", "version": "0.1.0", "type": "curriculum" },
    { "id": "openedu-fractions", "version": "0.1.0", "type": "knowledge" }
  ],
  "generatedAt": "2026-01-15T10:22:00.000Z",
  "contextFingerprint": "sha256:9f2c…",
  "nodes": [
    {
      "path": "nodes/lesson-1.md",
      "objectives": ["represent-fraction"],
      "concepts": [{ "pack": "openedu-fractions", "concept": "fraction" }],
      "widgets": ["math.fraction-visual"],
      "capabilityGaps": ["objective-represent-fraction: no activity matched intents [compare]"]
    }
  ]
}
```

Written to `provenance.json` at the course root, following the lenient-optional pattern of `workflow.json` / `rewards.json` / `cards.json` in `file-loader.ts:60-64`.

This answers, with no new infrastructure:

- **"What changed when I bumped the pack?"** — diff two `provenance.json` files.
- **"Why does this lesson mention this?"** — follow `concepts[]` back to a `ConceptSchema` with a `source`.
- **"Did any objective fail to find an activity?"** — `capabilityGaps[]`, from §13.3.
- **"Were the inputs to this course identical?"** — same pack versions + same `contextFingerprint` means same inputs; any output difference is generation variance, not content drift (§18.4).

None of this is possible today. `DistributionManifestSchema` has a `checksum` (SHA-256 of the sorted content path list, not of file bytes) and a `signature.status` that is recorded but never verified — neither carries authoring lineage.

`contextFingerprint` = SHA-256 of the canonical JSON serialization of the resolved `AuthoringContext`, excluding `budget.usedChars` and `budget.truncated` (which are properties of the consumer, not the context).

---

# 21. AI Grounding

### 21.1 Layered context

```text
SYSTEM RULES                     policy.ts
    ↓
COURSE SPEC CONTRACT             artifact-contract.json  (generated)
    ↓
QUALITY RUBRIC                   quality-rubric.json
    ↓
AVAILABLE ACTIVITIES             curatedCatalog + widget-catalog-data.json
    ↓
LEARNER PROFILE                  getProfile(id).promptInstructions
    ↓
AUTHORING CONTEXT                §17   ← packs, concepts, objectives
    ↓
AUTHOR REQUEST
```

This extends the existing prompt assembly in `coursePrompt.ts:1-17`, which already injects the artifact contract and the live curated widget catalog. The `AuthoringContext` block is added below them.

The ordering is deliberate: the _rules_ win over the _content_, and the _available activities_ win over the _request_, so the model cannot recommend a widget that `listCuratedWidgets()` does not return.

### 21.2 Skill routing extends

`resolveSkills.ts:15-72` currently has two rules: learner profile present → `learner-adaptation` skill; `"interactive"` in the excerpt → `interactive-<engine>` skill. Phase 1 adds a third:

```text
authoring.objectives present  →  objective-intent skill
```

The skill teaches the model to satisfy each objective with an activity whose `learningIntents` cover `requiresIntents`, using only ids from `availableActivities`. It does not perform the matching — the registry does (§3.6).

### 21.3 Grounding is not invention prevention

The model can still produce a blueprint that references a concept not in the context. §23.2 validates the output; the prompt reduces the error rate, the validator catches it. Do not treat prompt wording as a correctness mechanism.

---

# 22. Studio Integration

### 22.1 Selection UX

Added to the existing `Create Course` flow. The Studio is a single unified shell (Outline | Files, Preview + DevTools, AI Author Assistant) — no new top-level surface.

```text
Create Course

Curriculum
  ▸ nios-math-level-a

Unit
  ▸ fractions
  ▸ measurement
  ▸ geometry

Learner
  ▸ Neurotypical (default)
  ▸ Autism Spectrum
  ▸ School (K-12)
  ▸ College / Adult

Language
  ▸ English   ▸ हिन्दी   ▸ ଓଡ଼ିଆ

[ Create Learning Experience ]
```

Activity selection is **not** offered, because capabilities are not pack data (§12.2) and the available set is whatever the registry returns (§14.1). 0.1 §14's activity checkbox list has nothing to check.

Concept and provenance browsing moves into a read-only panel alongside the existing Outline tab.

### 22.2 Studio API

Two new methods on `StudioApi` (`apps/dev-server/src/studio/studioApi.ts:59-118`), following the existing package/library/AI grouping:

```ts
// Discovery
listPacks: () => Promise<PackSummary[]>;
getPackDetail: (id: string, version: string) => Promise<PackDetail>;

// Authoring context
setAuthoringSelection: (selection: {
  curriculum: string;
  unit?: string;
  learner?: string;
  locale?: string;
}) => Promise<AuthoringContextResult>;
```

Both are read-only with respect to the course. They do not add to the 34 existing methods' semantics and do not touch `packageDir` — switching packs must not mutate the loaded package, only the context.

### 22.3 Browser mode

Studio has two modes today: local filesystem (`localStudioApi.ts`, routes `/api/package`) and browser/OPFS (`browserStudioApi.ts`, `virtualPackagePlugin`). Both mount the same AI middleware.

Packs are **read-only inputs**, so browser mode reads them from the bundle or fetches them. The Phase 1 decision: **bundle packs into the Studio build.** `OPEN_EDU_PACKS_DIR` (defaulting to the workspace's `packs/`) is resolved by the same `eduPackageLoader` that already injects `virtual:open-edu-package` (`apps/dev-server/vite.config.ts:347-1399`), producing `virtual:open-edu-packs`. No OPFS writes, no new storage adapter, no sync semantics.

This is a deliberate limitation: in browser mode a user cannot install a new pack without rebuilding Studio. That matches how `widget-catalog-data.json` is already handled (generated at build time, not fetched). For the committed Phase 1 fixture, the bundler input is `OPEN_EDU_PACKS_DIR=examples/packs` (§7).

One constraint on the implementation: `eduPackageLoader` must keep reading pack data through the filesystem and serializing it into the virtual module. If it is later refactored to import a loader from `@open-edu/packs`, that import must use a **subpath export** rather than the package index — `vite.config.ts` is exactly the import chain that causes `ERR_MODULE_NOT_FOUND` for workspace packages whose `dist` files carry extensionless relative imports (see `AGENTS.md`, "ESM Extensionless Imports in Vite Config Loading"; the `@open-edu/widgets/catalog` pattern is the precedent).

---

# 23. Validation

### 23.1 Error model

0.1 §34 said "invalid packs should fail clearly" and listed checks. No codes, no severity, no partial-valid path. The repo already has the right shape: `InstallErrorCode` (`packages/oep-distribution/src/types.ts:47-67`), 20 string codes with a discriminated union.

Pack errors follow the same pattern:

| Code                        | Severity | Condition                                                                                                                                                 |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PACK_MANIFEST_MISSING`     | error    | No `manifest.json`                                                                                                                                        |
| `PACK_MANIFEST_INVALID`     | error    | Fails `PackManifestSchema`                                                                                                                                |
| `PACK_VERSION_INVALID`      | error    | Not `X.Y.Z`                                                                                                                                               |
| `PACK_DEPENDENCY_MISSING`   | error    | `requires` entry not resolvable                                                                                                                           |
| `KNOWLEDGE_CONCEPT_INVALID` | error    | Fails `ConceptSchema`                                                                                                                                     |
| `KNOWLEDGE_SOURCE_MISSING`  | error    | Pack is `derivedFrom: 'document'` and a concept has no `source`                                                                                           |
| `KNOWLEDGE_PREREQ_CYCLE`    | error    | Cycle in pack-local prerequisites                                                                                                                         |
| `KNOWLEDGE_PREREQ_UNKNOWN`  | error    | Prerequisite ID not in pack                                                                                                                               |
| `CURRICULUM_INVALID`        | error    | Fails `CurriculumSchema`                                                                                                                                  |
| `CURRICULUM_PREREQ_UNKNOWN` | error    | Unit prerequisite ID not found                                                                                                                            |
| `CURRICULUM_PREREQ_CYCLE`   | error    | Cycle in unit prerequisites                                                                                                                               |
| `PACK_REFERENCE_MISSING`    | error    | `{ pack, concept }` resolves to nothing in the selected set                                                                                               |
| `OBJECTIVE_INTENT_UNKNOWN`  | error    | `requiresIntents` contains a non-`LearningIntent` value — the mapped diagnostic for a `z.nativeEnum(LearningIntent)` failure, not a separate pass (§23.2) |
| `OBJECTIVE_NO_CONCEPTS`     | warning  | Objective has no `concepts` and no matchable domain                                                                                                       |
| `CAPABILITY_GAP`            | warning  | No activity satisfied an objective's intents (§13.3)                                                                                                      |

Diagnostics use the existing `CompilerDiagnostic` shape (`{ severity, message, code }`) from `packages/course-compiler`, so pack diagnostics and compile diagnostics render through one path.

### 23.2 Blueprint validation

Beyond pack validation, the generated Course Spec is checked for:

1. Every `widgetId` in `activities[]` appears in `AuthoringContext.availableActivities`.
2. Every `requiresIntents` value in the context is either satisfied by at least one emitted activity, or recorded as a `CAPABILITY_GAP` in the reproduction record. 0.1's phrasing for this check — "every objective string traces to a context objective or a concept summary" — was cut: the Course Spec's `lessons[].objectives[]` is a `string[]`, so "traces to" has no mechanical definition and would reject every legitimate paraphrase. Intent satisfaction is checkable; prose provenance is a Phase 2 question.
3. `metadata.audience` matches the selected profile, if any.

Check 1 is the enforcement half of §3.6. A violation is a **draft rejection** surfaced through the existing `/api/studio/ai/commit` flow (`commitCourseDraft.ts:67-114`), not a silent rewrite.

### 23.3 No silent repair

Matching `InstallCoordinator`'s fail-closed behavior (`validate-release.ts:32-90`). Invalid packs fail at install. Invalid blueprints fail at commit. Neither is auto-corrected.

The one exception is the widget alias map, which is an explicit, tested, documented migration path (`WIDGET_ALIAS_MAP`, `migrateWidgetId`) rather than a repair.

---

# 24. Assets

0.1 §24 proposed an Asset Registry and asset capability requirements. Neither is adopted.

Assets are already modeled: `AssetSchema` (`course-model.ts:3-11`) with `id`, `path`, `type` (`image | video | audio | pdf | embed`), `description`, `placeholderGenerated`. The compiler already generates placeholder SVGs for missing assets and emits a `PLACEHOLDER_GENERATED` diagnostic (`package-generator.ts:133-148`). `distribution-manifest` and the `.oep` writer already handle arbitrary binary content.

Packs **reference** assets by id where a curriculum concept needs an illustration; they never embed binaries (§3.2). If an asset cannot be resolved, the existing placeholder path applies.

---

# 25. Localization

Reuse `@open-edu/i18n` as-is. No pack-specific localization mechanism.

| 0.1 §36 proposal                                                | Decision                                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"language": "en-IN"`                                           | **Rejected.** `SUPPORTED_LOCALES` is `['en','hi','or']` and `isValidLocale` is exact-match on two-letter codes (`locale.ts:1-9`). `en-IN` fails. |
| `concepts.en-IN.json` / `concepts.hi-IN.json` filename suffixes | **Rejected.** Conflicts with `i18n:extract`, which parses `locales/{lang}/{namespace}.json`.                                                     |
| `locales/en-IN.json` sidecars inside the pack                   | **Rejected.** A third localization mechanism alongside `@open-edu/i18n` namespaces and the CLI tooling.                                          |
| "For MVP, English-only packs are acceptable"                    | **Adopted.** `PackManifestSchema.language` defaults to `'en'` and is constrained to `SUPPORTED_LOCALES`.                                         |

Pack user-facing strings — concept titles, summaries, examples, misconception text — are authored in `PackManifestSchema.language`. A localized pack is a second pack with a different `id` suffix or language tag; it is not a translation overlay. This is consistent with how every existing package handles language (`CourseMetadataSchema.language`, `RegistryMetadataSchema.languages`).

Known gap, unchanged by this design: `hi/learner.json` has 142 keys against `en/learner.json`'s 262. Translation completeness is a pre-existing problem that pack localization would multiply, which is a reason to keep packs English-only in Phase 1 rather than a reason to build a new mechanism.

Separately worth fixing, unrelated to packs: `getDirection` (`direction.ts:5`) matches RTL locales exactly against `['ur','ar','fa','he']`, so `ar-EG` resolves to `ltr`. If region subtags are ever adopted, this must change first.

---

# 26. Distribution & Installation

### 26.1 Reuse `.oep`

Packs are installed from a local directory in Phase 1. If archive support is needed, the `.oep` machinery is reused rather than duplicated — it already provides ZIP writing/reading, `DistributionManifestSchema`, SHA-256 checksums, path-traversal guards, decompression-bomb limits (100 MiB archive / 500 MiB decompressed), and an `InstallErrorCode` union.

A pack archive would use `contentRoot: 'pack/'` in the same way bundles use `contentRoot: 'bundle/'` (`oep-writer.ts:64-69`). That is a small, precedented extension.

### 26.2 Reuse `@open-edu/registry`

`@open-edu/registry` is GitHub-native course-registry tooling with `buildCatalog`, `validateMetadata`, `validateRelease`, and `generateSchemas`. Phase 1 does not extend it — packs are not published in Phase 1.

When distribution arrives, `RegistryMetadataSchema.type` (`'course' | 'bundle'`) is the natural extension point for `'knowledge' | 'curriculum'`, and `CatalogPackageEntrySchema` would need no new fields. The `.oep` filename convention `<id>-<version>.oep` and the release tag convention `<id>-v<semver>` (`registry/src/github.ts:14-20`) apply unchanged.

### 26.3 Who authors a pack, and where ingestion lives

0.1 §43 listed six PDF-derived reference packs while §41 excluded source-document ingestion. Contradiction, now resolved:

- **Ingestion lives in the standalone `open-edu-pipeline` repo** (per `AGENTS.md`, Epic 31, `packages/pipeline-llm` vendored from `@open-edu/llm-config`). The pipeline already owns PDF → curriculum conversion, with `LLM_STAGES` including `concept_map`, `concept_enrichment`, and `lesson_blueprint` (`packages/llm-config/src/stages.ts:1-45`).
- **Packs are its output format.** The pipeline emits `packs/knowledge/<id>/` and `packs/curriculum/<id>/`; it does not live inside this system.
- This makes the pack system's out-of-scope list honest: it needs no ingestion because ingestion already exists elsewhere.

For Phase 1 validation, one small **hand-authored** knowledge pack (`openedu-fractions`, 5 concepts) is sufficient — committed at `examples/packs/knowledge/openedu-fractions/` (§7). NIOS is a Phase 2 fixture once the pipeline can emit a pack.

---

# 27. Phased Plan

### Phase 0 — Convergence (prerequisite, no pack concepts)

Deliverables P0-1–P0-7 in §6.5. Independent of everything below. Each is a small PR in `packages/widgets`.

### Phase 1 — Packs

| #    | Story                                                                                                                         | Package                                                | Depends on |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| 1.1  | `PackManifestSchema`, `ConceptSchema`, `CurriculumSchema` + tests                                                             | new `@open-edu/packs`                                  | P0-7       |
| 1.2  | `packLoader` — read a pack dir, validate, return typed data                                                                   | new `@open-edu/packs`                                  | 1.1        |
| 1.3  | `resolveConcept` + `resolveAuthoringContext` (§16.2, §18.3) + tests                                                           | `@open-edu/packs`                                      | 1.2        |
| 1.4  | `AuthoringContextSchema` + extend `studioContextSnapshotSchema`                                                               | `packages/companion`                                   | 1.3        |
| 1.5  | `listPacks` / `getPackDetail` / `setAuthoringSelection` Studio API methods                                                    | `apps/dev-server`                                      | 1.4        |
| 1.6  | Pack selection UI in the Create Course flow                                                                                   | `apps/dev-server`                                      | 1.5        |
| 1.7  | Context grounding in the AI prompt                                                                                            | `apps/dev-server`                                      | 1.4        |
| 1.8  | `objective-intent` skill                                                                                                      | `apps/dev-server`                                      | 1.7        |
| 1.9  | Blueprint validation: widget-id enforcement                                                                                   | `@open-edu/packs` + dev-server                         | 1.7        |
| 1.10 | `provenance.json` write on commit + `file-loader` lenient read                                                                | `packages/core`, dev-server                            | 1.9        |
| 1.11 | `edu pack validate <dir>` CLI command                                                                                         | `packages/cli`                                         | 1.2        |
| 1.12 | Locale propagation: `CourseSpecJSONSchema.metadata.language` from the snapshot locale, plus the artifact-contract locale rule | `packages/course-compiler`, `packages/domain-guidance` | 1.7        |
| 1.13 | Vitest coverage for every story                                                                                               | all                                                    | each       |

### Phase 2 — Not in this document

- Source-document → pack ingestion in `open-edu-pipeline`.
- NIOS / EVS reference packs.
- Deterministic profile → widget filtering (§15.2).
- `step` / `misconceptions` preservation in `mapLesson` (§19.2).
- Pack → `.oep` archive and registry publication (§26).
- Bloom level surviving into the package.
- Community-contributed packs.

---

# 28. Acceptance Criteria

### Phase 0

- [ ] `WIDGET_CATALOG_ENTRIES` is generated from widget definitions; hand-editing fails the build
- [ ] No unknown `LearningIntent` values in catalog data: every catalog intent is one of the 11 enum members (`create` is reserved and legitimately absent)
- [ ] `BUILTIN_WIDGETS`, catalog entries, and `WIDGET_LEARNING_INTENTS` keys are set-equal, enforced by test
- [ ] `WIDGET_ALIAS_MAP` and `renderWidgetGuideMarkdown` have one declaration each
- [ ] `searchWithFilters({ intents, subjectTags })` works

### Phase 1

**Packs**

- [ ] A pack directory loads and validates
- [ ] Manifest ID/version are displayed in the Studio
- [ ] An invalid pack fails with a `PACK_*` / `KNOWLEDGE_*` / `CURRICULUM_*` code and no partial load

**Knowledge & curriculum**

- [ ] Concepts are browsable and qualified by pack
- [ ] `{ pack, concept }` refs resolve or fail with `PACK_REFERENCE_MISSING`
- [ ] Provenance is displayable for any sourced concept
- [ ] Prerequisite cycles are rejected

**Activities**

- [ ] Objectives resolve to candidate activities via `searchWithFilters`
- [ ] An objective with no match produces a `CAPABILITY_GAP` warning, not a failure
- [ ] No pack file contains a widget ID or engine name

**Authoring context**

- [ ] Packs, unit, and profile compose into an `AuthoringContext`
- [ ] The context is serializable and under its declared budget
- [ ] `budget.truncated` is populated and displayed when truncation occurs
- [ ] Identical pack versions produce a byte-identical context

**AI**

- [ ] The AI receives the context
- [ ] A generated Course Spec referencing an unavailable widget is rejected
- [ ] Every `requiresIntents` value is satisfied by an emitted activity or recorded as a `CAPABILITY_GAP` (§23.2)

**Course**

- [ ] `provenance.json` records pack versions and node → concept mapping
- [ ] `capabilityGaps` is surfaced in the Studio
- [ ] The reproduction record pins packs, versions, activities, and `contextFingerprint` for identical inputs (lineage, not replay — §18.4)

---

# 29. Out of Scope for Phase 1

```text
❌ Pack marketplace or remote pack hosting
❌ Semver ranges, ^ or >=          (exact X.Y.Z only, as today)
❌ Dependency solving               (explicit requires, fail-closed)
❌ Package signing
❌ Pack embeddings / RAG
❌ Ontology depth beyond concept + prerequisites
❌ Activity packs / Asset packs / Assessment packs   (§5)
❌ Assessment and asset registries   (§24, §12.2)
❌ Multi-profile composition          (one profile per context)
❌ Source-document ingestion          (lives in open-edu-pipeline)
❌ Browser-mode pack installation     (bundled at build time, §22.3)
❌ Pack authoring UI
❌ Localization overlays              (§25)
```

---

# 30. Open Questions

| #   | Question                                                                                                  | Blocks  | Owner suggestion                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does a curriculum pack need its own `subject`/`level` taxonomy, or does `RegistryMetadataSchema` suffice? | 1.1     | Keep `subject`/`level` as free strings for Phase 1; no enum until a second curriculum proves the first was wrong                         |
| 2   | Should `ConceptSchema.summary` cap at 2000 chars, or should the cap live only in the context budget?      | 1.3     | Budget only — a hard schema cap prevents a pack from storing richer content for non-AI consumers. Revisit after Phase 1 data             |
| 3   | Is `derivedFrom: 'document'` on the manifest the right gate for required provenance, or per-concept?      | 1.1     | Manifest-level. Per-concept is more precise but adds a field to every concept                                                            |
| 4   | Should the Studio write `provenance.json` on AI commit only, or also on manual `writeFile`?               | 1.10    | AI commit only in Phase 1. Manual edits make the record advisory, not authoritative — say so in the doc rather than pretending otherwise |
| 5   | Do `Adult` and `Family` profiles get authored, or removed from `LearnerProfileKindSchema`?                | §15.1   | Not a pack question, but the two vocabularies are already drifting and packs will expose it                                              |
| 6   | Should `provenance.json` ship inside `.oep`?                                                              | Phase 2 | Yes, under `contentRoot`. It is course data                                                                                              |
