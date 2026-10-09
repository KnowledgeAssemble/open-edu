---
type: Operations Guide
title: Operations, Commands, and Change Workflow
description: Runbook-style guide for building, testing, linting, and regenerating derived assets in the Open-Edu monorepo, including the widget catalog pipeline and the current `edu generate` flow.
tags: [openwiki, operations, testing, runbook]
---

# Operations, Commands, and Change Workflow

This repo is optimized for local development and agentic code changes. The root `package.json` and `AGENTS.md` define the main commands and constraints.

## Core commands

From the repository root:

- `pnpm install` — install dependencies
- `pnpm build` — build every package
- `pnpm test` — run all package tests
- `pnpm lint` — run package linting plus repo-wide style checks
- `pnpm typecheck` — type-check the workspace
- `pnpm format:check` — check formatting
- `pnpm format` — apply formatting
- `pnpm test:e2e` — run Playwright end-to-end tests
- `pnpm --filter @open-edu/learner dev` — start the learner app
- `pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js ...` — use the CLI after building it
- `pnpm --filter @open-edu/widgets generate:catalog` — regenerate the widget catalog JSON from the canonical widget roster in `packages/widgets/src/builtin-roster.ts` (mapped by `packages/widgets/src/catalog-gen.ts`)
- `pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js dev ./examples/hello-world` — start the OpenEdu Course Creator Studio (single unified authoring shell)
- `pnpm --filter @open-edu/dev-server test` — run the Course Creator Studio package tests (Studio UI, library, AI, flow logic)
- `pnpm --filter @open-edu/domain-guidance generate` — regenerate the authoring-skill reference files from canonical data; must produce no diff in CI
- `node --test skills/openedu-course-authoring/evals/schema.test.mjs` — validate the authoring-skill eval scenarios against the skill-creator schema
- `pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js i18n:extract ./my-lesson ./locales` — extract translatable strings from a package
- `pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js i18n:validate ./my-lesson ./locales` — validate translation completeness
- `pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js i18n:missing ./locales ./target-lang` — find missing translations for a target language
- Curriculum pipeline (`@open-edu/pipeline`) moved to the standalone `open-edu-pipeline` repo — see its `packages/pipeline/README.md` for `curriculum:generate` usage
- `pnpm --filter @open-edu/registry test` — run the registry package tests (catalog builder, release validation, metadata validation)
- `pnpm --filter @open-edu/packs test` — run the pack system tests (loader, manifest, curriculum, authoring-context bounds, blueprint validation)
- `pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js pack validate ./examples/packs/knowledge/openedu-fractions` — validate a pack directory (manifest, concepts/curriculum, prerequisites)
- `pnpm --filter @open-edu/widget-sdk test` — run widget-sdk tests (framework-agnostic protocol, fixtures, build helpers)
- `pnpm test:e2e tests/e2e/community-widget.spec.ts` — run community widget E2E tests (sandbox isolation, persistence, revocation)
- `EDU_WIDGET_DIR=./examples/community-widget-counter pnpm --filter @open-edu/learner dev` — manually test community widgets in the learner app (auto-discovers catalog, no globals needed)

## Package-local commands

Examples of package-specific scripts from `package.json` files:

- `apps/learner` uses `vite`, `vitest run`, `tsc --noEmit`, and `eslint src/`
- `packages/cli` uses `tsc`, `vitest run`, and `eslint 'src/**/*.{ts,tsx}'`

## Testing expectations

The repo treats tests as a primary change guard. The agent instructions and root scripts emphasize:

- every story should include tests
- components should have rendering, interaction, and accessibility tests
- schema-driven changes should be validated at the package level
- learner flows rely on Vitest and Playwright coverage

## Studio AI test paths

The Course Creator Studio assistant runs on a single Node backend mounted in both
Creator (file-system) and Browser (OPFS) modes — no Vercel static-function gateway.
Unit coverage for the surface lives in `apps/dev-server/src/studio/ai/`:

- `middleware.test.ts` — `createStudioAiMiddleware` routing + the storage-independent
  item/course-draft endpoints (`existingTitles` instead of a package dir)
- `handler.test.ts` / `agentLoop.test.ts` — the `/api/studio/ai/chat` loop
- `StudioChatProvider.transport.test.tsx` — the single client targets
  `/api/studio/ai/chat` in both modes and never routes intents
- `browserAiGateway.test.ts` — browser-mode status/draft/item calls against
  `/api/studio/ai/*` (no `/api/ai/*` anywhere)
- Pack/authoring-context coverage — `packages/packs/src/*.test.ts`;
  `apps/dev-server/src/studio/packs/packApi.test.ts`,
  `components/PackSelectionPanel.test.tsx`, `components/PackBrowserPanel.test.tsx`,
  `ai/provenance.test.ts`, `ai/commitCourseDraft.test.ts` (draft codes incl. `spec-invalid`),
  `ai/chat/policy.test.ts` (system-prompt bounds), `browserStudioApi.test.ts`
  (draft code propagation + capability gaps); E2E in `tests/e2e/pack-selection.spec.ts`
  (`OPEN_EDU_PACKS_DIR=examples/packs`, set repo-wide in `playwright.config.ts`)
- The chat wire schema + `toAiSdkMessages` / `fromUIMessage` converters live in
  `@open-edu/companion/chat` (see `packages/companion/src/chat.test.ts`).

## Tailwind and styling maintenance

The repo has an explicit workflow for CSS freshness:

- root linting checks for inline styles and Tailwind CSS staleness
- after changing runtime Tailwind classes, regenerate `apps/dev-server/src/tailwind.css` using the command in `AGENTS.md`

This matters because runtime and dev-server styling are intentionally coupled through generated CSS output.

## What to watch out for when making changes

- Preserve schema authority: do not hand-maintain types where Zod should own them.
- Preserve package boundaries: many packages expose behavior only through their public exports.
- Preserve accessibility: especially in runtime and learner-app surfaces.
- Preserve progress persistence and local-storage behavior when changing learner flows.
- Be careful with bundle navigation, because module-level navigation can bypass some normal exit warnings.
- When touching widget catalogs, update the canonical widget definitions / roster (`packages/widgets/src/builtin-roster.ts`) and regenerate the derived JSON rather than editing the JSON by hand.
- Community widget protocol changes must update conformance fixtures in `packages/widget-sdk/src/fixtures/` and pass the full E2E suite in `tests/e2e/community-widget.spec.ts`.
- When adding new user-facing strings to runtime or learner components, use `t('namespace.key')` via `useTranslation()` from `@open-edu/i18n` and add the English translation to the appropriate locale file in `packages/i18n/locales/en/`.

## Best starting points by change type

- content structure or validation: `packages/schemas`, `packages/core`
- workflow logic: `packages/workflow`
- learner UI: `apps/learner`, `packages/runtime`, `packages/design-system`
- Course Creator Studio UI/API/authoring: `apps/dev-server/src/studio/`, `apps/dev-server/vite.config.ts`, and the `studio` i18n namespace in `packages/i18n/locales/en/studio.json`
- packs and authoring context: `packages/packs/src/`, `apps/dev-server/src/studio/packs/`, and `apps/dev-server/src/studio/ai/` (see the [Packs domain guide](../domain/packs.md))
- CLI behavior: `packages/cli`
- test coverage and test utilities: the package-level `src/**/*.test.ts[x]` files plus `tests/e2e/`
- translation and locale management: `packages/i18n`
- course registry tooling: `packages/registry`
