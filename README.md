# Open-Edu Framework

An open runtime for educational experiences that separates content from delivery platforms. Learning packages (Markdown + JSON) are loaded, validated, and rendered through a configurable runtime with accessibility, telemetry, internationalization, rewards, course distribution (`.oep`), and an AI companion (Pipili).

> **Vision:** Educational experiences as portable, extensible, observable, and accessible as modern software. — [Full Vision](./docs/VISION.md)

## Features

- **Learning packages** — Markdown + JSON content with workflow routing, quizzes, widgets, and rewards
- **Learner app** — Course catalog, themed runtime, PWA/offline support, and Pipili AI companion
- **Course Creator Studio** — Unified authoring shell (Outline | Files, Preview, AI Author Assistant)
- **CLI** — Validate, build, compile, lint, and distribute courses (`edu` commands)
- **Extensible widgets** — Built-in widgets plus a community widget SDK
- **i18n & a11y** — Internationalization and accessibility first-class in the runtime

## Quick Start

**Prerequisites:** Node.js >= 18, pnpm >= 9

```bash
pnpm install
pnpm build

# Learner app — http://localhost:4001
pnpm --filter @open-edu/learner dev

# Course Creator Studio — http://localhost:4000
pnpm --filter @open-edu/cli build
node packages/cli/dist/cli.js dev ./examples/hello-world
```

Useful CLI commands after building — run them with `pnpm exec edu`, or with a bare `edu` if you install the CLI globally:

```bash
edu validate ./examples/fractions
edu create ./my-lesson --id my-lesson --title "My Lesson" --author "Me"
edu compile ./course-spec.md -o ./output
edu oep:build ./my-course -o ./dist
```

### Docker

```bash
docker compose up --build
```

- **Learner:** http://localhost:4001
- **Studio:** http://localhost:4000

Verify the stack end-to-end with `./docker/smoke-test.sh`.

Optional AI keys: copy `.env.example` to `.env`. AI features degrade gracefully without keys.

## Documentation

| Resource                                                          | Description                                       |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| [OpenWiki quickstart](./openwiki/quickstart.md)                   | Architecture, workflows, domain concepts, testing |
| [Package Authoring Guide](./docs/PACKAGE_AUTHORING.md)            | How to author learning packages                   |
| [Architecture](./docs/ARCHITECTURE.md)                            | System design and package relationships           |
| [Component Guide](./docs/COMPONENT_GUIDE.md)                      | UI component conventions                          |
| [Release Process](./docs/RELEASE.md)                              | Changesets, publish, and rollback                 |
| [Agentic Course Authoring](./apps/docs/docs/agentic-authoring.md) | AI skill-based course generation                  |

## Examples

Example packages live in [`examples/`](./examples):

| Example                                       | Description                            |
| --------------------------------------------- | -------------------------------------- |
| [hello-world](./examples/hello-world)         | Minimal single-lesson package          |
| [fractions](./examples/fractions)             | Quiz with score-based remediation      |
| [level-b-math](./examples/level-b-math)       | Multi-module bundle with prerequisites |
| [widget-showcase](./examples/widget-showcase) | Built-in widget demos                  |

## Development

```bash
pnpm build          # Build all packages
pnpm test           # Unit tests
pnpm test:e2e       # Playwright E2E (run pnpm build first)
pnpm lint           # Lint + i18n checks
pnpm typecheck      # TypeScript
pnpm format         # Auto-format
```

This is a pnpm monorepo (`apps/`, `packages/`, `examples/`). Agent-oriented guidance lives in [`AGENTS.md`](./AGENTS.md); deeper maps are in [OpenWiki](./openwiki/quickstart.md).

## License

This project is licensed under the [MIT License](./LICENSE).
