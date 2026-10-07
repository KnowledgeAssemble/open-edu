---
type: Domain Guide
title: Content, Workflows, and Examples
description: Canonical explanation of package structure, workflow routing, progress semantics, rewards, bundles, SVG-backed widgets, and example content in the Open-Edu monorepo.
tags: [openwiki, domain, workflows, content]
---

# Content, Workflows, and Examples

This repository models learning content as portable package directories rather than database-backed courses.

## Package model

The package authoring guide describes the core package shape:

- `package.json` manifest with id, title, version, author, and entry node
- `workflow.json` for routing and branching
- optional `rewards.json`
- optional `cards.json`
- `nodes/` containing Markdown or JSON learning nodes
- optional `assets/`

The canonical documentation for authoring details is `docs/PACKAGE_AUTHORING.md`.

## Node and workflow semantics

The repo supports several node types:

- lesson nodes in Markdown
- quiz nodes in JSON
- reflection nodes in JSON
- exercise nodes backed by widgets
- custom JSON nodes for specialized integrations

Workflow routing can be linear or conditional. The examples in `docs/PACKAGE_AUTHORING.md` show:

- sequential completion chains
- score-based branching
- remediation loops
- reflection steps after assessment

The `@open-edu/workflow` package owns the traversal and ordering logic; `getOrderedNodes` is used by the learner app and runtime to present node order consistently.

## Progress and mastery concepts

The platform distinguishes between:

- node traversal progress
- course completion state
- skill/mastery progress
- bundle/module progress
- reward and card unlock state

That separation matters because different UI surfaces summarize different slices of learner state. For example, the progress dashboard aggregates course progress and badges, while bundle overview pages aggregate module completion.

## Rewards and Knowledge Cards

The framework allows packages to attach rewards and card definitions to learning events.

In the learner runtime:

- rewards are handled by `RewardBroker`
- cards are handled by `CardBroker`
- badge and card progress are persisted in local storage helpers
- toasts surface earned badges and unlocked cards

Rewards and cards are supported at **both** module and bundle scope. Module-level `rewards.json`/`cards.json` live in the package directory; bundle-level files live at the bundle root and are referenced from `bundle.json` via `rewards`/`cards` relative paths. The runtime wires bundle-scoped brokers that listen for `module_complete`/`bundle_complete` events. Condition scope is enforced: module files cannot reference bundle-level signals (`bundleCompleted`, `moduleCompleted`) and bundle files cannot reference module-local signals (`score`, `chain`, `skill`, etc.).

The recent rename from `Card` to `KnowledgeCard` in `packages/runtime` reflects a domain clarification: these are collection-style learning artifacts, not generic UI cards.

## Bundles and module chains

Bundles extend single-package learning into multi-module curricula.

Bundles are collections of standard packages with prerequisite chaining between modules; the `bundle.json` manifest format is documented in `apps/docs/docs/package-format.md`. This affects both the runtime and the learner app:

- bundle summary and overview surfaces live in the learner catalog
- per-module status is tracked through bundle progress snapshots
- module progression can unlock later modules through prerequisite relationships

## Example set

The examples directory is a useful map of supported behaviors:

- `hello-world` — minimal happy path
- `intro-javascript` — multi-node lesson with quiz
- `fractions` — branching based on score
- `adaptive-study` — remediation loops and badges
- `skill-graph` — mastery-based unlocking
- `level-b-math` — bundle with multiple modules
- `widget-practice` and `widget-showcase` — widget execution
- `remote-widget-demo` — remote widget loading
- `autism-reading` — accessibility-oriented content
- `living-vs-nonliving` — rewards/cards-heavy content

## Internationalization

User-facing strings in runtime renderers (quiz buttons, feedback messages, widget errors, reflection prompts) and learner app screens (navigation, settings, catalog) are translated through `@open-edu/i18n`. The package provides:

- namespace-based translation keys (e.g., `runtime.quiz.submit`, `learner.settings.theme`)
- English locale files in `packages/i18n/locales/en/`
- a `TranslationEngine` with fallback to the default locale
- React `I18nProvider` + `useTranslation` hook for component-level access
- CLI commands (`i18n:extract`, `i18n:validate`, `i18n:missing`) for translation workflow

When adding new user-facing strings to runtime or learner components, use `t('namespace.key')` instead of hardcoded text and add the English translation to the appropriate locale file.

## Agentic course authoring

The `openedu-course-authoring` skill (`skills/openedu-course-authoring/`) provides an agentic workflow for generating Open-Edu course specifications without manual XML/JSON authoring. It supports two modes:

- **Portable mode** — works anywhere without an Open-Edu repository. Produces `course-spec.json`, `course-spec.md`, `course-brief.md`, and `quality-report.json` with structural validation only.
- **Repository mode** — detected when an Open-Edu monorepo is present. Adds full compilation via the course-compiler CLI, package validation (`edu validate`), and content linting (`edu lint-content`). Repository mode requires the CLI to be built (`dist/cli.js` present).

### Key components

| File                               | Role                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/discover-openedu.mjs`     | Detects repo, capabilities, executable status, commands, paths; distinguishes `packagePresent` from `executable`                           |
| `scripts/openedu-adapter.mjs`      | Shared adapter: repo discovery, command resolution (structured argv, never shell), command execution                                       |
| `scripts/widget-catalog.mjs`       | Loads live `widget-catalog-data.json`; resolves canonical/deprecated/legacy widget IDs                                                     |
| `scripts/profiles.mjs`             | Normalizes learner-profile input (`resolveProfile`) and loads machine-checkable knobs from `profiles.config.json`                          |
| `scripts/validate-course-spec.mjs` | Structural preflight checks + optional compiler invocation via `cmdArgv`                                                                   |
| `scripts/validate-package.mjs`     | Orchestrates compile → validate → lint phases with `runOpenEduCommand`                                                                     |
| `scripts/quality-report.mjs`       | Central report merger — sole writer of `quality-report.json` during orchestration                                                          |
| `scripts/summarize-quality.mjs`    | Quality rubric across 7 dimensions (objective coverage, assessment alignment, duration, progression, widgets, accessibility, completeness) |

### Quality rubric

The skill evaluates generated specs against pedagogical dimensions with specific check IDs:

- **Objective Coverage** (`QC-OBJ-01` through `-04`) — every objective mapped to an activity and assessment signal; measurable verbs; max 6 per lesson
- **Assessment Alignment** (`QC-ASM-01` through `-03`) — assessment concepts are a subset of introduced concepts; difficulty matches course level
- **Duration** (`QC-DUR-01` through `-03`) — lesson minutes within 20% of `estimatedHours`; no lesson over 45 min or under 5 min
- **Progression** (`QC-PROG-01` through `-03`) — all 5 pedagogical steps present; sequential ordering; observe-first pattern
- **Widget** (`QC-WDG-01` through `-04`) — canonical IDs from live catalog; not deprecated; required config fields present; rationale recorded
- **Accessibility** (`QC-ACC-01` through `-04`) — plain language; keyboard support; non-color-only distinctions; chunked content
- **Completeness** (`QC-COM-01` through `-03`) — all required schema fields present; no unresolved assumptions; coreIdea/examples/misconceptions

### Learner profiles, bundles, and generated references

- The skill adapts output to four learner profiles (`neurotypical`, `autism`, `school`, `college`) via `references/profiles.md` and `references/profile-{neurotypical,autism,school,college}.md`; educational context (`educationLevel`, `gradeBand`, `curriculum`) is recorded separately. The `autism` profile is only ever explicitly stated, never inferred.
- Bundle authoring (`references/bundle-authoring.md`) and rewards & cards authoring (`references/rewards-cards-authoring.md`) extend the portable workflow to multi-module and reward-driven content.
- The reference files in `skills/openedu-course-authoring/references/` are **generated** from `@open-edu/domain-guidance` (profiles, quality rubric, artifact contract) — regenerate with `pnpm --filter @open-edu/domain-guidance generate`; see ADR-0009 (`openedu-way/ADR-0009-unified-course-authoring-guidance.md`).

### Command execution

All commands are executed as structured `argv` arrays via `spawnSync` — never shell-interpolated strings. The adapter distinguishes `packagePresent` (directory exists) from `executable` (entrypoint exists). When the CLI is not built, compile/validate/lint phases are skipped with an explicit `cli-unavailable` reason in the report.

### Source materials (PDF pipeline)

When users supply PDF textbooks, the skill routes through the standalone `open-edu-pipeline` repo with profile-aware generation (generic/math/science/nios). Pipeline artifacts (source inventory, concept map, blueprint, coverage report) are preserved in output.

### Evaluation framework

The skill ships with 15 evaluation scenarios (`evals/evals.json`) covering portable, repository, source-material (PDF), bundle, rewards/cards, learner-profile, and edge cases — validated against the standard skill-creator schema (`evals/schema.test.mjs`).

### Where to start

- Skill workflow: `skills/openedu-course-authoring/SKILL.md`
- Learner profiles: `skills/openedu-course-authoring/references/profiles.md` + `profile-{neurotypical,autism,school,college}.md`
- Artifact schema: `skills/openedu-course-authoring/references/artifact-contract.md` (generated from `@open-edu/domain-guidance`)
- Authoring stages: `skills/openedu-course-authoring/references/authoring-workflow.md`
- Bundle authoring: `skills/openedu-course-authoring/references/bundle-authoring.md`
- Rewards & cards authoring: `skills/openedu-course-authoring/references/rewards-cards-authoring.md`
- Quality rubric spec: `skills/openedu-course-authoring/references/quality-rubric.md` (generated from `@open-edu/domain-guidance`)
- Repository adapter: `skills/openedu-course-authoring/references/repository-adapter.md`
- Source materials: `skills/openedu-course-authoring/references/source-materials.md`

## Where to start when changing content behavior

- Update schema shape or validation rules in `packages/schemas`
- Update content loading or bundle scanning in `packages/core`
- Update route or mastery logic in `packages/workflow`
- Update rendered node behavior in `packages/runtime`
- Add or adjust example content in `examples/` to cover the new behavior

## Widget catalog and ID resolution

Widget-based exercises depend on the registry and catalog pipeline. The canonical widget metadata is defined in `packages/widgets/src/widget-catalog-source.ts`, resolved through `packages/widgets/src/domains.ts`, and consumed by `packages/core/src/widget-catalog.ts` when the CLI builds prompt/catalog output. That separation keeps author-facing widget IDs stable while allowing legacy `open-edu.*` IDs to be migrated automatically. The SVG explorer widget family also lives under `packages/widgets/src/svg-explorer/` and extends the same catalog pathway for interactive content.

### Community widgets

Community widgets run in sandboxed iframes and communicate with the host through the `open-edu.widget/1` protocol. Courses reference them via `widgetRef` with `source: 'registry'` and mandatory integrity. The `WidgetResolver` (`packages/widgets/src/resolver/`) handles verification, caching, and adapter selection. See the [Community Widgets Developer Guide](../../apps/docs/docs/widgets/community-widgets) for the full reference on building, publishing, and installing community widgets.

## Pipeline: content-to-course-spec generation

The curriculum pipeline moved to the standalone [`open-edu-pipeline`](https://github.com/KnowledgeAssembly/open-edu-pipeline) repository. It generates course specifications from educational source files (PDF, DOCX, PPTX, Markdown, Images, ZIP) through an 8-stage AI-driven pipeline with profile-aware generation (generic/math/science/nios). See that repo's `packages/pipeline/README.md` for CLI usage, profiles, scope options, and resume behavior.
