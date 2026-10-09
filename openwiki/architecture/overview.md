---
type: Architecture Overview
title: Architecture Overview
description: High-level map of the Open-Edu monorepo architecture, including content loading, workflow execution, runtime rendering, the widget catalog pipeline used by core and the CLI, the SVG explorer widget family, course distribution, and the Pipili AI companion.
tags: [openwiki, architecture, monorepo, runtime]
---

# Architecture Overview

Open-Edu is a pnpm workspace monorepo built around a content/runtime split:

1. content is authored as portable package directories
2. schemas validate that content
3. workflow engines determine progression
4. runtime packages render the experience
5. apps assemble those packages into learner-facing tools

## Top-level structure

- `apps/` — deployed applications and local dev surfaces
- `packages/` — reusable framework packages
- `examples/` — content packages that exercise the framework
- `docs/` — canonical design and architecture documents

The root `package.json` exposes repo-wide build, test, lint, typecheck, and formatting commands, while `pnpm-workspace.yaml` includes `packages/*`, `apps/*`, and `examples/*`.

## Runtime stack

The architecture described in `docs/ARCHITECTURE.md` and reflected in package manifests is:

- TypeScript 5.x throughout the monorepo
- React 18 + Vite for runtime apps
- Zod for schema validation and type generation
- XState-based workflow execution
- RxJS-based telemetry collection
- Tailwind CSS for styling
- Radix UI + shadcn/ui-style primitives in the design system
- vite-plugin-pwa + Workbox for service worker generation
- IndexedDB via `idb` for offline-first storage

## Main package responsibilities

### `@open-edu/schemas`

Defines the data contracts that everything else relies on: manifests, workflows, node types, progress snapshots, telemetry events, rewards, and card definitions.

### `@open-edu/core`

Loads packages from disk, validates manifests and content, scans collections, and powers CLI/compiler workflows.

### `@open-edu/workflow`

Owns progression logic, node ordering, mastery/skill tracking, and bundle/module orchestration.

### `@open-edu/runtime`

Owns renderers and runtime UI: markdown, quiz, reflection, widget, placeholder, layout shells, theme provider, theme registry, course cards, bundle overview, progress ring, and knowledge-card surfaces.

### `@open-edu/design-system`

Provides two tiers of UI:

- primitives for general UI building blocks
- visual-dna patterns and learning surfaces for Open-Edu-specific pages

### `@open-edu/i18n`

Provides internationalization infrastructure: locale types (en, hi, or), a translation engine with namespace-based dictionary lookup and fallback, a React context provider with `useTranslation` hook, formatting utilities wrapping `Intl` APIs, and a `LanguageSwitcher` radio-group component. CLI commands extract, validate, and diff translation keys across locales. Consumed by `@open-edu/runtime` and `@open-edu/learner` for all user-facing strings.

### `@open-edu/cli`

Exposes the `edu` command for validation, development, building, packaging, creation, reporting, linting, patching, generation, compilation, and content import.

### `@open-edu/telemetry`

Captures learning interaction streams and persists them in JSONL form.

### `@open-edu/rewards`

Translates events into reward receipts, including badge delivery and card progression.

### `@open-edu/widgets`

Provides the widget registry and built-in widgets used by content nodes and runtime renderers. The registry supports alias resolution, domain namespacing, structured search, metadata validation, and catalog generation for LLM prompts. Recent changes moved the canonical widget metadata onto the built-in `WidgetDefinitionV2` definitions, collected by `packages/widgets/src/builtin-roster.ts` and mapped to catalog entries by `packages/widgets/src/catalog-gen.ts`, and added the SVG explorer widget family, while `@open-edu/core` now reads the generated catalog data at runtime. The `WidgetResolver` handles policy-aware resolution of native, sandboxed, and trusted-remote widgets, with an IndexedDB-backed artifact cache and deterministic fallback transforms.

### `@open-edu/widget-sdk`

Framework-agnostic protocol SDK for community widgets. Provides message validators, a widget-side host client (`createWidgetHostClient`), theme token applicator, protocol conformance fixtures, and build helpers (CSP hash computation). No React dependency — community widgets can use any framework or vanilla JavaScript. See the [Community Widgets Developer Guide](../../apps/docs/docs/widgets/community-widgets) for building, publishing, and installing community widgets.

### `@open-edu/course-compiler`

Compiles course-spec Markdown or JSON into validated package structures.

### `@open-edu/packs`

OpenEdu Pack System: declarative knowledge and curriculum **packs** that ground Studio AI drafting without paralleling the package model.

- **Schemas + loader** — `PackManifestSchema`, `ConceptSchema`, `CurriculumSchema`, and `loadPacksDir` / `loadPackDirectory` (filesystem via the `@open-edu/packs/loader` subpath; structured `PackValidationError` diagnostics).
- **Authoring context** — `AuthoringContextSchema` with hard bounds on every array/field, and `resolveAuthoringContext()` that scopes a curriculum/unit selection into objectives, concepts, activities, and provenance under a character budget (retrieval, not loading).
- **Blueprint validation** — `validateBlueprint()` checks compiled output: widget IDs must exist in the context (`invalid-blueprint` rejection), and objective intents must be covered by the emitted activities or reported as `capabilityGaps[]`.
- **Consumers** — `apps/dev-server` (Studio selection UX, AI draft generate/commit, `provenance.json`), `packages/companion` (`CourseDraftResult.capabilityGaps`), `packages/cli` (`edu pack validate`).

See the [Packs domain guide](../domain/packs.md) for the full reference.

### `@open-edu/dev-server` — OpenEdu Course Creator Studio

The `apps/dev-server` app (package `@open-edu/dev-server`) evolved from the original local Vite preview + inspector + file editor into **OpenEdu Course Creator Studio**, one unified authoring shell over the same on-disk packages (there is **no mode toggle**):

- **Home / Library** — start from a template, AI draft, or recent course; manage a local course library (open, duplicate, rename, archive, import folder); compose **units** (2–5 courses → canonical `bundle.json`). The Create Course flow starts with **curriculum pack selection** (curriculum → unit → learner → language) that grounds AI drafts in pack objectives and concepts, with `listPacks` / `getPackDetail` / `setAuthoringSelection` on the `StudioAPI`.
- **Outline** (default tab) — the course spine: add lessons/quizzes/practice, reorder → linear workflow. **Files** tab — the package file tree with Markdown/JSON editors, manifest/workflow/rewards/cards editors, and asset upload. The Author Assistant stays pinned in the right rail across both tabs.
- **Preview** — the full learner runtime with a collapsed-by-default **DevTools drawer** (Telemetry / Logs / Rewards / A11y; Bundle only when bundle data is present).
- **Share** — Ready check → `.oep` export → learner-install instructions / classroom note.

Bundles are **not** authorable in the Studio (unsupported empty state).

Architecturally, the Studio UI is a façade over the package model. It talks to a thin `StudioAPI` (`apps/dev-server/src/studio/studioApi.ts`) implemented by a **local adapter** — Vite middleware for `/api/package/*` (file read/write, tree, outline, validate, assets, export `.oep`) and `/api/studio/*` (AI generate/status, library scan/open/duplicate/rename/archive/import, unit creation/export) — and a **browser adapter** (`BrowserStudioApi`) over the OPFS workspace. AI drafting runs server-side (LLM → `course-spec.json` → `@open-edu/course-compiler`) with keys kept out of the client. The workspace root for the course library comes from `OPEN_EDU_STUDIO_WORKSPACE` (defaults to the parent of the opened package). The unified-view design spec is `docs/superpowers/specs/2026-09-01-studio-unified-view-design.md`.

The Studio Assistant runs on a **single Node backend** with one AI pipeline (`createStudioAiMiddleware` in `apps/dev-server/src/studio/ai/middleware.ts`). Both Creator (local file-system) and Browser (hosted OPFS) modes mount the same `/api/studio/ai/*` surface — status, course-draft generate/commit, item add/edit, and the agent loop at `/api/studio/ai/chat`. There is no Vercel static-function gateway / `/api/ai/*` any longer; the chat message schema + `toAiSdkMessages` / `fromUIMessage` converters live in `@open-edu/companion/chat`. Routing belongs to the server-side loop; the client ships raw messages and never re-parses intents.

### Agentic Course Authoring Skill

The `skills/openedu-course-authoring/` directory contains the portable agentic course-authoring skill. It uses the course-compiler and CLI as its authoritative validation backend, distinguishing between structural-only validation (portable mode) and full compiler validation (repository mode). See [content and workflows](../domain/content-and-workflows.md#agentic-course-authoring) for the complete reference.

### `@open-edu/llm-config`

LLM provider abstraction (OpenAI + OpenRouter) with per-stage model routing, environment-variable and CLI overrides, and a **ModelFactory** with two-tier routing (fast/escalation) for AI SDK v4 streaming. Consumed by the learner app's Pipili/LLM proxies.

> The curriculum pipeline (`@open-edu/pipeline`) moved to the standalone [`open-edu-pipeline`](https://github.com/KnowledgeAssembly/open-edu-pipeline) repository, which vendors a renamed copy of this package as `@open-edu/pipeline-llm`.

### `@open-edu/ai-companion`

Provides search, dictionary, conversation, and provider interfaces for the AI companion feature. Includes the **Pipili subsystem**:

- **Context normalization/bounding** (`src/pipili/context-utils.ts`) — priority-based context assembly from page, widget, lesson, module, course, notes, assessment, and learner profile
- **Hint progression engine** (`src/pipili/hint-utils.ts`) — graduated hint levels (nudge → scaffold → answer) with configurable instructions
- **Pipili metadata and V2 extension seams** for future capability expansion

The learner app implements the server-side Pipili endpoint using AI SDK v4's `streamText` with `pipeDataStreamToResponse`, including Zod request validation, assessment policy, accessibility profiles, and a 7-tool registry.

### `@open-edu/companion`

AI companion contracts extracted from the dev-server Studio assistant: the chat message schema and `toAiSdkMessages` / `fromUIMessage` converters in `@open-edu/companion/chat`, plus tool, skill, task, event, permission, runtime, request, and changeset contracts. Consumers: `apps/dev-server` (Studio AI agent loop) and the learner app. Requires a build after source changes (`pnpm --filter @open-edu/companion build`).

### `@open-edu/domain-guidance`

Canonical home for course-authoring domain knowledge — the four learner profiles (`profiles.json`) and the quality rubric (`quality-rubric.json`) — plus a **generated** `artifact-contract.json` derived from the `@open-edu/course-compiler` Zod schemas. `src/generate.ts` renders the `openedu-course-authoring` skill reference files; CI requires `pnpm --filter @open-edu/domain-guidance generate` to be diff-free. Exposes `@open-edu/domain-guidance/profiles` for browser-safe profile resolution (used by the Studio). See ADR-0009.

### `@open-edu/logger`

Structured isomorphic logging engine: `createLogger` / `configureLogger`, child loggers, `ConsoleSink` / `MemorySink` / `JsonlSink` / `TelemetryBridgeSink`, and a React `LoggerProvider` / `useLogger`. Used by dev-server and other packages.

### `@open-edu/oep-distribution`

Course distribution system for portable `.oep` (Open-Edu Package) archives:

- **OepWriter** — builds portable `.oep` ZIP archives with SHA-256 content integrity
- **OepReader** — reads, validates, and extracts `.oep` packages (ZIP security, manifest validation, checksum verification)
- **InstallCoordinator** — stage-then-activate install flow with version detection (upgrade/downgrade/same-version guards)
- **ZIP security** — path traversal, absolute path, decompression bomb, archive size limit protection
- **Source adapters** — file, URL, and catalog source adapters
- **Catalog loader** — fetch and parse static JSON catalogs
- **Version comparison** — SEMVER comparison utilities

### `@open-edu/registry`

Node-only course registry tooling for GitHub-native distribution, published to npm:

- **GitHub API client** — list/get releases, download assets, parse `<id>-v<semver>` tags and `checksums.txt`
- **Catalog builder** — `buildCatalog()` merges `courses/*/metadata.json` + GitHub Releases into a `catalog.json` conforming to `CatalogSchema` (reuses `computeSha256`, `parseSemver`)
- **Release validation** — `validateRelease()` checks metadata presence, `.oep` asset + `checksums.txt`, SHA-256 cross-check, and validates the package with `OepReader`
- **JSON Schema generation** — emits `metadata.schema.json` / `catalog.schema.json` from the Zod schemas via `toJsonSchemaDraft7`
- **CLI** — `open-edu-registry validate-metadata | validate-catalog | generate-catalog | validate-release | generate-schemas`

Consumed by the `openedu-library` course registry repo (GitHub Actions call the CLI via `npx --no-install`).

### `@open-edu/storage`

Provides IndexedDB persistence with 6 typed object stores: courses, progress, badges, cards, search-indexes, and preferences. Built on the `idb` Promise-based wrapper. All learner app persistence (progress, badges, cards, bundle progress, search index) migrated from localStorage to this package.

### `@open-edu/pwa-core`

Framework-agnostic PWA primitives: install prompt detection (`getInstallState`, `promptInstall`), service worker update monitoring (`registerUpdateListener`, `skipWaiting`), connectivity detection (`getOnlineStatus`, `onOnlineStatusChange`), and storage quota queries (`getStorageUsage`). Consumed by the learner app through React hooks.

## Runtime data flow

A typical course launch looks like this:

1. a package is loaded from disk through `@open-edu/core`
2. schemas validate manifest/content shape
3. workflow routing decides which node comes next
4. `@open-edu/runtime` renders the active node
5. telemetry records learner actions
6. rewards and cards react to emitted events
7. learner-app storage persists progress, badges, cards, and bundle state

The learner app's `CourseRuntime` composes `RuntimeProvider`, `LayoutShell`, `WorkflowEngine`, `TelemetrySession`, `AccessibilityProvider`, `RewardBroker`, `CardBroker`, widget registry setup, and local storage helpers.

## Bundle and card architecture

Recent changes in git show a move from generic `Card` naming to `KnowledgeCard` naming in the runtime, and a parallel addition of `BundleCard` and `ProgressCard` in the design system. That split matters:

- runtime components own data-aware runtime surfaces
- design-system components own reusable visual cards and page patterns
- learner pages compose both to build catalog, progress, bundle overview, and collection binder screens

## Why this structure exists

The repo is organized to keep learning content portable and the runtime platform-independent. The architecture favors:

- content-first authoring
- schema-driven contracts
- accessibility by default
- agent-friendly deterministic structures
- modular rendering surfaces that are easy to extend

## Where to look when changing architecture

- package contracts: `packages/schemas`
- filesystem loading and content normalization: `packages/core`
- routing and mastery: `packages/workflow`
- rendering and theme behavior: `packages/runtime`
- visual structure and reusable UI: `packages/design-system`
- widget ID resolution and catalog generation: `packages/widgets/src/domains.ts`, `packages/widgets/src/builtin-roster.ts` (roster), `packages/widgets/src/catalog-gen.ts` (entry mapping), `packages/widgets/scripts/generate-catalog.ts`, plus SVG explorer components under `packages/widgets/src/svg-explorer`
- IndexedDB persistence: `packages/storage` (6 stores: courses, progress, badges, cards, search-indexes, preferences)
- PWA infrastructure (install, update, connectivity): `packages/pwa-core`
- service worker and caching config: `apps/learner/vite.config.ts`
- internationalization and locale management: `packages/i18n`
- course distribution (`.oep` build, install, catalog, updates): `packages/oep-distribution`
- course registry (catalog build, release validation, schema generation): `packages/registry` + the `openedu-library` repo
- packs (curriculum/knowledge format, authoring context, blueprint validation, capability gaps): `packages/packs/src/` and `apps/dev-server/src/studio/packs/` — see the [Packs domain guide](../domain/packs.md)
- Pipili AI companion (chat, hints, context mapping): `packages/ai-companion/src/pipili/` and `apps/learner/src/pipili/`
- Course Creator Studio authoring (unified shell, Outline | Files tabs, StudioAPI, AI drafts + Author Assistant, library/units, share/export): `apps/dev-server/src/studio/` and `apps/dev-server/vite.config.ts`
- end-user navigation and app composition: `apps/learner`
