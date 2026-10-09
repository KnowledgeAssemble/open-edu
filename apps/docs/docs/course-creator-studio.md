---
sidebar_position: 4
---

# Course Creator Studio

**OpenEdu Course Creator Studio** is the authoring companion to the learner app. It lives in `apps/dev-server` (`@open-edu/dev-server`) and evolved from the original local Vite preview + inspector + file editor into **one unified authoring shell**. It is a façade over the package model: authoring edits the same on-disk OpenEdu packages whether you run it locally or in the browser (OPFS) mode.

## Quick Start

```bash
# Start the Studio for a specific package (port 4000)
pnpm --filter @open-edu/cli build
node packages/cli/dist/cli.js dev ./examples/hello-world
```

Or via `edu` after installing the CLI:

```bash
edu dev ./my-package
```

The Studio has a **single shell — there is no mode toggle.** Set `OPEN_EDU_STUDIO_WORKSPACE` to a folder of courses to enable the course library (defaults to the parent of the opened package):

```bash
OPEN_EDU_STUDIO_WORKSPACE=~/courses edu dev ./examples/hello-world
```

Packs are read from `OPEN_EDU_PACKS_DIR` (defaults to `packs/`). For the bundled fixtures:

```bash
OPEN_EDU_PACKS_DIR=examples/packs edu dev ./examples/hello-world
```

Navigation: **Home · Library · Outline · Preview · Share**.

## Home / Library

- **Template gallery** — reading lesson, lesson + quiz, practice warm-up, and short-unit starters
- **AI draft** — paste notes or a lesson outline; Studio generates a full draft with a quality checklist
- **Recent courses** — reopen recently worked-on packages
- **My courses** — a local course library with open / duplicate / rename / archive / import-folder actions, plus **units** (bundle 2–5 courses into one shareable unit)

## Outline (default tab) and Files

The **Outline** page hosts two page-local tabs:

| Tab         | Default | Contents                                                                                                                                  |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Outline** | Yes     | The course spine: add lessons, quizzes, and practice activities, reorder. Activity order drives the linear `workflow.json` automatically. |
| **Files**   | No      | Package file tree + file editors (Markdown/JSON, manifest, workflow, rewards, cards) + new node + asset upload                            |

Picking an activity row on Outline opens the form editor; picking a file on Files opens the typed or raw editor in the source pane. The **Author Assistant** stays pinned in the right rail across both tabs.

## Activity editors

- **Lesson** — Markdown body with coaching if a heading is missing
- **Quiz** — MCQ form that enforces at least one correct answer
- **Practice** — a curated widget picker with schema-driven settings forms and a **live preview**

## Guided flow, rewards & cards

- **Learning path** — simple score-based branching ("If score is at least… then go to…")
- **Rewards & cards** — completion badges, quiz-pass badges, and knowledge cards via plain forms

## Preview + DevTools

Preview runs the full learner runtime (`@open-edu/runtime`). **DevTools** live in a collapsed-by-default bottom drawer opened from the Preview toolbar: **Telemetry · Logs · Rewards · A11y** (and **Bundle** when bundle data is present). There is no separate developer-only mode.

## Share

Runs a **Ready check** (title, at least one activity, quiz correct answers, lesson headings, package validity), exports a `.oep` file, and shows copyable "how students open it" instructions plus a classroom note.

> **Bundles:** authoring and previewing multi-module bundles is **not supported** in the Studio today (unsupported empty state). Bundle _preview_ inside the Studio comes with a later story; the learner app remains the bundle surface.

## Curriculum Packs

The Create Course flow starts with **pack selection** — pick a curriculum pack, unit, learner profile, and language, then **Create Learning Experience**. The selection resolves to a bounded **authoring context** (objectives, concepts, required intents, provenance) that grounds the Author Assistant and AI drafts (`listPacks` / `getPackDetail` / `setAuthoringSelection` on the `StudioAPI`).

- **Grounding** — AI drafts trace back to pack objectives and concepts; a read-only pack panel shows the concepts, source documents, and selection diagnostics in scope.
- **Capability gaps** — if a generated draft cannot cover an objective's required intents with available activities, the gaps are reported after generate/commit instead of being silently dropped.
- **Validation** — blueprint checks run at draft **and** commit time: unknown widgets reject the draft (`invalid-blueprint`), unreadable specs return `spec-invalid`, and a failed commit never leaves a half-created course behind.
- **Provenance** — committed courses record `provenance.json` (pack lineage + matched lesson objectives) for reproduction and review.

See [Packs](./packs.md) for the package reference and `docs/OPENEDU-PACK-SYSTEM.md` for the design document. In browser mode, packs are bundled at build time (`OPEN_EDU_PACKS_DIR` → `virtual:open-edu-packs`), so adding a pack requires a rebuild.

## Author Assistant

A persistent AI surface in the right rail (enabled by default; toggle `Cmd/Ctrl+Shift+A`, disable via `OPEN_EDU_STUDIO_ASSISTANT=0` or `localStorage.openedu.studio.assistant.enabled=false`). It explains, guides, and answers questions about the open course, and its agent loop can draft/commit course and item content after approval. Chat streams through the single `/api/studio/ai/chat` backend; conversation history is stored per course in IndexedDB (sessionStorage fallback).

## Architecture

The Studio UI is a façade over the package model. It talks to a thin `StudioAPI` (`apps/dev-server/src/studio/studioApi.ts`) implemented by a **local adapter** — Vite middleware for `/api/package/*` (file read/write, tree, outline, validate, assets, export `.oep`) and `/api/studio/*` (AI generate/status, library scan/open/duplicate/rename/archive/import, unit creation/export) — and a **browser adapter** (`BrowserStudioApi`) over the OPFS workspace, so a hosted cloud Studio can reuse the same UX later.

AI drafting runs **server-side** on a single Node backend: LLM → `course-spec.json` → `@open-edu/course-compiler`. API keys stay in the server process (`OPEN_EDU_STUDIO_LLM_*` or existing llm-config env vars) and templates remain the offline fallback. The chat message schema + `toAiSdkMessages` / `fromUIMessage` converters live in `@open-edu/companion/chat`; learner profiles and the quality rubric render from `@open-edu/domain-guidance`. There is no Vercel static-function gateway (`/api/ai/*` was removed).

The current design spec is `docs/superpowers/specs/2026-09-01-studio-unified-view-design.md` (outside the docs tree, so shown as a code path). It supersedes the Creator/Developer split (§3.4–3.5) of the earlier `docs/superpowers/specs/2026-08-05-course-creator-studio-design.md`.
