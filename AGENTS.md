# AGENTS.md

Instructions for AI coding agents working on the Open-Edu Framework.

## Project Overview

Open-Edu is an open runtime for educational experiences — a monorepo framework that separates educational content from delivery platforms. Learning packages (Markdown + JSON) are loaded, validated, and rendered through a configurable runtime with built-in accessibility, telemetry, internationalization, rewards, course distribution (`.oep` format), an AI companion (Pipili), and a **3-theme system (Light, Dark, Zen)** with Tailwind CSS styling. It also ships **OpenEdu Course Creator Studio** (in `apps/dev-server`) — a teacher-facing authoring product with a single unified authoring shell (Outline | Files, Preview + DevTools, AI Author Assistant) that produces the same OpenEdu packages.

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:

- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

## Technology Stack

| Layer           | Technology                                     |
| --------------- | ---------------------------------------------- |
| Language        | TypeScript 5.x                                 |
| Package Manager | pnpm 9.x                                       |
| Monorepo        | pnpm workspaces                                |
| Build Tool      | Vite 5.x                                       |
| Schemas         | Zod 3.x                                        |
| State Machine   | XState 5.x                                     |
| UI Framework    | React 18.x                                     |
| UI Primitives   | Radix UI + shadcn/ui + Lucide Icons            |
| Styling         | Tailwind CSS 3.x + clsx + cva + tailwind-merge |
| Accessibility   | React Aria + axe-core                          |
| Telemetry       | RxJS 7.x                                       |
| CLI             | Commander 12.x                                 |
| Testing         | Vitest 1.x                                     |
| E2E             | Playwright 1.x                                 |

## Essential Commands

```bash
pnpm install                          # Install all dependencies
pnpm build                            # Build all packages
pnpm test                             # Run all tests
pnpm lint                             # Lint all packages
pnpm typecheck                        # Type-check all packages
pnpm format:check                     # Check formatting
pnpm format                           # Auto-format all files
pnpm --filter @open-edu/learner dev   # Start the learner app (port 4001)
EDU_WIDGET_DIR=./examples/community-widget-counter pnpm --filter @open-edu/learner dev  # Learner with community widgets
pnpm test:e2e                         # Run Playwright E2E tests
pnpm test:e2e -- bundle-navigation    # Run bundle-specific E2E tests
pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js import learn-easy ./source-dir ./output-dir  # Import Learn-Easy content as a bundle
pnpm --filter @open-edu/course-compiler test  # Run course-compiler tests
pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js compile course-spec.md -o ./output  # Compile a course spec (also supports .json)
# The curriculum pipeline lives in the standalone open-edu-pipeline repo:
#   cd ../open-edu-pipeline && pnpm curriculum:generate --pdf ./textbook.pdf --level B --subject math
pnpm --filter @open-edu/registry test  # Run registry package tests
pnpm --filter @open-edu/widget-sdk test  # Run widget-sdk tests (framework-agnostic protocol)
pnpm --filter @open-edu/widgets generate:catalog  # Regenerate widget-catalog-data.json from canonical source
pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js i18n:extract ./my-lesson ./locales  # Extract translatable strings
pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js i18n:validate ./my-lesson ./locales  # Validate translation completeness
pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js i18n:missing ./locales ./target-lang  # Find missing translations
pnpm lint:hardcoded-strings                       # Scan for hardcoded user-facing strings (part of pnpm lint)
node packages/i18n/src/i18n-keys.test.ts          # Run i18n key validation test
pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js oep:build ./my-course -o ./dist  # Build .oep distribution artifact
# Regenerate dev-server Tailwind CSS after runtime style changes
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
# Start the Course Creator Studio (single unified authoring shell)
pnpm --filter @open-edu/cli build && node packages/cli/dist/cli.js dev ./examples/hello-world
# Run the dev-server package tests (Studio UI + library/ai/flow logic)
pnpm --filter @open-edu/dev-server test
# Regenerate the authoring-skill reference files from @open-edu/domain-guidance
pnpm --filter @open-edu/domain-guidance generate
# Run the course-authoring skill eval-schema tests
node --test skills/openedu-course-authoring/evals/schema.test.mjs
# Install the portable course-authoring skill for an agent
cp -r skills/openedu-course-authoring ~/.agents/skills/openedu-course-authoring
```

## Monorepo Structure

```
open-edu/
├── apps/
│   ├── dev-server/          # OpenEdu Course Creator Studio (unified shell: Outline | Files + Preview DevTools, StudioAPI, single Node AI backend)
│   ├── docs/                # Docusaurus documentation site
│   └── learner/             # Standalone learner app with 8-page router + theme switching + Pipili chat + course install
├── packages/
│   ├── schemas/             # Zod schemas + type generation
│   ├── core/                # Package loader + validator + scanner + patcher + lint + generator
│   ├── workflow/            # XState workflow engine + skill tracking + topology
│   ├── runtime/             # React runtime + 6 layout components + 3 themes + 7 renderers
│   ├── accessibility/       # Focus traps, live regions, ARIA, axe-core
│   ├── telemetry/           # RxJS telemetry + JSONL reader + summary
│   ├── rewards/             # Reward broker + CardBroker + conditions + verification + replay
│   ├── cli/                 # edu CLI (10+ commands)
│   ├── course-compiler/     # Course spec compiler (course-spec.md/.json → OpenEdu package)
│   ├── llm-config/          # LLM provider abstraction (OpenAI + OpenRouter)
│   ├── widgets/             # Widget SDK + registry + 28 built-in widgets + metadata enrichment + validation + catalog generation + remote loader + WidgetResolver + artifact cache
│   ├── widget-sdk/          # Framework-agnostic community widget protocol SDK (no React dependency)
│   ├── i18n/                # Internationalization — locale types, translation engine, React I18nProvider, namespaces, formatters, LanguageSwitcher
│   ├── interactive-runtime/ # OpenEdu bridge + React mounts for @knowledgeassemble interactive engines
│   ├── oep-distribution/    # .oep archive writer/reader, install coordinator, catalog loader, ZIP security, version compare
│   ├── companion/           # AI companion contracts — chat schema + converters, tools, skills, tasks, permissions
│   ├── domain-guidance/     # Authoring domain knowledge — learner profiles + quality rubric; generates skill references
│   ├── logger/              # Structured isomorphic logging engine
│   └── registry/             # Course registry tooling (catalog builder, release validation, open-edu-registry CLI)
├── examples/                # Example educational packages
│   ├── adaptive-study/
│   ├── autism-reading/
│   ├── fractions/
│   ├── hello-world/
│   ├── interactive-demo/    # Single-engine + composed interactive lesson nodes
│   ├── intro-javascript/
│   ├── level-b-math/        # Multi-module bundle example (3 modules)
│   ├── living-vs-nonliving/
│   ├── remote-widget-demo/
│   ├── skill-graph/
│   ├── widget-practice/
│   └── widget-showcase/
├── tests/e2e/               # Playwright integration tests (9 spec files)
├── docs/                    # Architecture docs (VISION, ARCHITECTURE, FRAMEWORK_SPEC)
└── PLAN.md                  # Implementation plan with epic/story breakdown
```

## Development Rules

1. **Every story must produce tests.** No story is complete without Vitest unit tests.
2. **Schemas are the source of truth.** All types derive from Zod schemas, never hand-written.
3. **Packages must be self-contained.** No cross-package imports except through published interfaces (package.json exports).
4. **Accessibility is not optional.** Every rendered component must pass axe-core.
5. **Internationalization is not optional.** All user-facing strings in renderers, layout components, and learner app must use `t()` from `@open-edu/i18n`. Never hardcode UI labels — add the English translation to `packages/i18n/locales/en/{namespace}.json`. The lint step (`pnpm lint:hardcoded-strings`) enforces this automatically.
6. **Commits should be scoped.** Use conventional commits: `feat(schemas): add workflow schema`
7. **One story per PR.** Each story gets its own branch and PR.

## Known Issues & Fix Patterns

### ESM Extensionless Imports in Vite Config Loading

**Problem:** Packages using `"type": "module"` with `moduleResolution: "bundler"` (the base tsconfig default) produce `.js` dist files with extensionless relative imports (e.g., `from '../../metadata/learning-intents'` instead of `from '../../metadata/learning-intents.js'`). This works fine in bundlers (Vite, webpack) but fails when Node.js ESM resolution encounters them at runtime.

This causes Vercel deployment failures when `vite.config.ts` transitively imports a workspace package whose dist files have extensionless imports. The error looks like:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../dist/types' imported from '.../dist/registry.js'
```

**The import chain that triggers it:**
`vite.config.ts` → a local source file → a file that imports `@open-edu/some-package` → the package's `dist/index.js` → internal dist files with extensionless imports → Node.js ESM fails.

**Correct fix — use subpath exports to bypass the full package:**

1. Add a subpath export in the package's `package.json` pointing directly to the specific module needed (which should have only external imports, not internal extensionless ones):
   ```json
   "exports": {
     ".": { ... },
     "./catalog": {
       "types": "./dist/resolver/catalog.d.ts",
       "import": "./dist/resolver/catalog.js"
     }
   }
   ```
2. Update the consuming import to use the subpath: `import { ... } from '@open-edu/widgets/catalog'`

**Do NOT do this:**

- Do not add `.js` extensions to every source file import across the monorepo. The `moduleResolution: "bundler"` setting is correct for development and testing; adding `.js` everywhere is a sledgehammer fix that creates churn and doesn't address the real issue.
- Do not change `moduleResolution` to `"node16"`/`"nodenext"` in the base tsconfig — this would force `.js` extensions in all source files project-wide.

**Already-applied examples:**

- `@open-edu/core/widget-catalog-data` — subpath export for JSON catalog data
- `@open-edu/widgets/catalog` — subpath export for `loadStaticCatalog` (breaks the import chain from `vite.config.ts` → `itemGenerate.ts` → `curatedCatalog.ts` → full `@open-edu/widgets` tree)

**How to diagnose:** If you see `ERR_MODULE_NOT_FOUND` for a `.js` file importing another `.js` file without extension, trace the import chain from `vite.config.ts` to find which workspace package is being pulled in. Then create a subpath export for just the function(s) needed.

## UI Coding Standards

1. **Styling:** Use Tailwind utility classes + `cn()` from `@open-edu/design-system`. Never use inline `style={{}}` except for dynamic sizing props.
2. **Tokens:** All colors via `--oe-*` tokens through Tailwind classes. Never hardcode hex/rgb values or use non-token Tailwind palette colors (e.g., `text-amber-400`).
3. **Components:** Follow shadcn/ui pattern — `forwardRef`, `displayName`, `cva` for variants, named exports.
4. **Primitives:** Use Radix UI primitives from `@open-edu/design-system` (Button, Dialog, Select, etc.).
5. **Class ordering:** Tailwind classes in recommended order (automated by `prettier-plugin-tailwindcss`).
6. **Responsive:** Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) with mobile-first approach.
7. **Accessibility:** Every component must pass axe-core. Use semantic HTML, ARIA attributes, keyboard navigation.
8. **Testing:** Every component needs rendering + interaction + a11y tests.
9. **Dev-server CSS:** After adding/changing Tailwind classes in `packages/runtime/src/`, regenerate: `pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css`
10. **Exceptions:** Inline styles are allowed only for: dynamic sizing from props, CSS variable references (`var(--oe-*)`), and the RuntimeThemeProvider.
11. **Component Guide:** Consult `@docs/COMPONENT_GUIDE.md` for the authoritative reference on building new UI components — two-tier architecture (primitives vs. visual DNA), file structure, prop conventions, token usage rules, and testing patterns.

## Package Naming

All packages use the `@open-edu/` scope:

- `@open-edu/schemas`, `@open-edu/core`, `@open-edu/workflow`, `@open-edu/runtime`
- `@open-edu/accessibility`, `@open-edu/telemetry`, `@open-edu/rewards`, `@open-edu/cli`
- `@open-edu/widgets`, `@open-edu/widget-sdk`, `@open-edu/dev-server`, `@open-edu/docs`, `@open-edu/course-compiler`
- `@open-edu/llm-config`, `@open-edu/i18n`, `@open-edu/interactive-runtime`
- `@open-edu/design-system`, `@open-edu/ai-companion`
- `@open-edu/companion`, `@open-edu/domain-guidance`
- `@open-edu/logger`, `@open-edu/storage`, `@open-edu/pwa-core`
- `@open-edu/oep-distribution`
- `@open-edu/registry`

Examples use `@open-edu/example-` prefix.

## Dependency Graph

```
Epic 1 (Foundation)  ← CURRENT
  └─► Epic 2 (Schemas)
        ├─► Epic 3 (Package Loader)
        │     └─► Epic 5 (Runtime Renderer)
        │           ├─► Epic 6 (Accessibility)
        │           ├─► Epic 10 (Course Creator Studio / dev-server)
        │           │     └─► Epic 9 (CLI)
        │           └─► Epic 12 (Testing)
        ├─► Epic 4 (Workflow Engine)
        │     └─► Epic 5 (Runtime Renderer)
        ├─► Epic 7 (Telemetry)
        │     └─► Epic 8 (Rewards)
        └─► Epic 11 (Examples)

Epic 13 (Learner App)
  └─► Epics 3, 4, 5, 6, 7, 8, 11 (consumes all packages)

Epic 29 (Course Compiler)
  └─► Epics 2, 3 (compiles specs into validated packages)

Epic 30 (Step Titles)
  └─► Epics 2, 3, 4, 5 (adds `title` to ContentNode schema, extracts from markdown, fixes COMPLETED sentinel, updates runtime UI)

Epic 31 (Pipeline) — moved to the standalone open-edu-pipeline repo
  └─► @open-edu/pipeline-llm (vendored LLM provider abstraction, forked from @open-edu/llm-config)

Epic 32 (LLM Config)
  └─► @open-edu/llm-config (LLM provider abstraction — OpenAI + OpenRouter, used by apps/learner)

Epic 298 (Recognition Engine)
  └─► Epics 2, 3, 8, 5, 13 (card schemas, loader, CardBroker, card UI components, Collection Binder learner app integration)

Epic 300 (Course Distribution)
  └─► Epics 2, 3 (oep-distribution package, schemas, storage extension, CLI oep:build, learner install UI)
        └─► @open-edu/registry (registry tooling) ──► openedu-library (course registry repo)

Epic 301 (Pipili AI Companion)
  └─► Epics 2, 3 (ai-companion pipili subsystem, llm-config model-factory, learner server-side endpoint, streaming chat UI)

Epic 5 (Runtime Renderer) consumes @open-edu/design-system for UI primitives, tokens, and patterns.
Epic 5 (Runtime Renderer) also consumes @open-edu/interactive-runtime for `{ type: "interactive" }` nodes.
Epic 13 (Learner App) consumes @open-edu/ai-companion for AI companion services.
@open-edu/companion and @open-edu/domain-guidance underpin the Course Creator Studio assistant (chat contracts) and authoring (profiles/rubric generation).
```

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:

- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

### Theme System (Epics 138–145)

A 3-theme system (Light, Dark, Zen) built as a sub-track within the runtime:

```
Epic 1: Token Foundation (#138, PR #174)
  └─► Epic 2: Tailwind Integration (#140, PR #175)
        ├─► Epic 3: Theme Provider & Runtime (#141, PR #176)
        │     └─► Epic 5: Layout Shell Components (#142, PR #178)
        │           └─► Epic 6: Pages (#143, PR #179)
        │                 └─► Epic 7: Tailwind Refactor (#144, PR #180)
        │                       └─► Epic 8: Polish & Verification (#145, PR #181)
        └─► Epic 4: Theme Selector UI (#139, PR #177)
```

## Configuration Files

- `tsconfig.base.json` — Shared TypeScript config, extended by all packages
- `.eslintrc.json` — Shared ESLint config (React packages have their own extending this)
- `.prettierrc` — Shared Prettier config
- `vitest.workspace.ts` — Vitest workspace definition
- `pnpm-workspace.yaml` — pnpm workspace packages

## Tailwind CSS & Dev-Server

Runtime components (`packages/runtime/src`) use Tailwind utility classes. The learner app processes Tailwind through PostCSS at dev/build time. The dev-server **does not** run PostCSS — it imports a pre-generated CSS file (`apps/dev-server/src/tailwind.css`).

**When you add or change Tailwind classes in runtime components, regenerate the dev-server CSS:**

```bash
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
```

Both the learner (`apps/learner/tailwind.config.ts`) and dev-server (`apps/dev-server/tailwind.config.js`) share the same theme token mappings (colors, spacing, border radius, fonts) that reference `--oe-*` CSS variables injected by `RuntimeThemeProvider`.

## PR Checklist

Before marking a story complete, verify:

- [ ] All tests pass: `pnpm test`
- [ ] No lint errors: `pnpm lint` (includes i18n hardcoded string check)
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Formatting is correct: `pnpm format:check`
- [ ] Conventional commit messages
- [ ] No dead code, debug logs, or temporary edits
- [ ] Accessibility: axe-core audits pass for all affected components
- [ ] Internationalization: all user-facing strings use `t()` with keys in `packages/i18n/locales/en/`

## Cursor Cloud specific instructions

The learner app is the primary development surface. After `install` completes, the `start` script launches the Vite dev server on **port 4001** (`http://localhost:4001`). Example courses are served from `examples/` by default.

- **Workspace packages require a build.** Monorepo packages resolve to `dist/` outputs; `pnpm build` runs during environment install. If you change package source and imports fail at runtime, rerun `pnpm build`.
- **Dev-server CSS staleness.** After editing Tailwind classes in `packages/runtime/src/`, regenerate dev-server CSS (see Tailwind CSS & Dev-Server section above).
- **E2E tests.** Run `pnpm test:e2e:install` once per environment for Playwright Chromium, then `pnpm test:e2e tests/e2e/learner-experience.spec.ts` for the canonical learner smoke test.
- **Optional services.** The Course Creator Studio (`edu dev`, port 4000), docs (port 3000), and Storybook (port 6006) are not started automatically; see Essential Commands above. The Studio is a single unified shell (no mode toggle): Outline | Files tabs, Preview with a DevTools drawer, and a pinned Author Assistant. The course library uses `OPEN_EDU_STUDIO_WORKSPACE` (defaults to the parent of the opened package).
- **Author Assistant.** Enabled by default in Creator. Toggle with `Cmd/Ctrl+Shift+A`. Disable via `OPEN_EDU_STUDIO_ASSISTANT=0` or `localStorage` key `openedu.studio.assistant.enabled=false`. Chat streams through `/api/studio/ai/chat`; conversation history is stored per course in IndexedDB (sessionStorage fallback).
- **Studio AI is a single Node backend.** There is no Vercel static-function gateway (`/api/ai/*` was deleted). Both Creator (local FS) and Browser (hosted OPFS) modes mount the same `/api/studio/ai/*` middleware (`apps/dev-server/src/studio/ai/middleware.ts`): `/api/studio/ai/status`, `/api/studio/ai/generate-draft`, `/api/studio/ai/commit`, `/api/studio/ai/item/add`, `/api/studio/ai/item/edit`, and the agent loop at `/api/studio/ai/chat`. The chat message schema + `toAiSdkMessages` / `fromUIMessage` converters live in `@open-edu/companion/chat`. Routing is server-owned: the client ships raw messages to `/api/studio/ai/chat` and never re-parses intents.
- **LLM / Pipili.** Cloud API keys are optional for basic course browsing and completion; set `LLM_API_KEY` only when testing the AI companion. Studio AI drafting is server-side and uses `OPEN_EDU_STUDIO_LLM_*` (or existing llm-config env vars); it degrades to templates when unavailable.

<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
