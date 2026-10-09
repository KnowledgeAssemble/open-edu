---
sidebar_position: 1
---

# CLI Overview

The `edu` CLI provides development tools for Open-Edu packages. All commands support `--json` for machine-readable output.

## Commands

### Dev

Start a development server for a package:

```bash
edu dev ./my-package
```

### Validate

Validate a package structure, schemas, and optional integrity:

```bash
edu validate ./my-package
edu validate --verify-integrity ./my-package
```

### Pack Validate

Validate a pack directory (manifest, concepts, curriculum, prerequisites):

```bash
edu pack validate ./examples/packs/knowledge/openedu-fractions
edu pack validate ./examples/packs/curriculum/nios-math-level-a
```

Reports structured diagnostics (`CODE: message`) on failure — for example `PACK_MANIFEST_MISSING` or `CURRICULUM_PREREQ_UNKNOWN`. Packs are the curriculum/knowledge inputs that ground Studio AI drafts; see [Packs](../packs.md).

### Build

Build a package for distribution with manifest metadata:

```bash
edu build ./my-package -o ./dist
```

Produces a build directory with an `open-edu-build.json` manifest containing file hashes, timestamps, and entry point.

### Package

Create a distributable archive:

```bash
edu package ./my-package
```

Produces `<id>-<version>.tar.gz` with deterministic content, excluding `dist`, `node_modules`, and `.git`.

### Create

Scaffold a new package directory:

```bash
edu create ./my-lesson --id my-lesson --title "My Lesson" --author "Me"
```

Generates a valid `package.json`, `workflow.json`, `nodes/intro.md`, and `validate.test.ts`. Refuses to write into non-empty directories unless `--force` is passed.

### Report

Summarize telemetry JSONL files:

```bash
edu report ./telemetry.jsonl
edu report ./telemetry.jsonl --json
```

Displays total events, sessions, node completions, and average quiz score.

### Lint-Content

Run content quality checks beyond schema validation:

```bash
edu lint-content ./my-package
edu lint-content ./my-package --max-warnings 0
```

Checks for: empty headings, quizzes with all correct answers, short reflection prompts, unreachable workflow nodes, and more.

### Patch

Apply surgical, validated JSON patches to existing packages:

```bash
edu patch ./my-package ./patch-file.json
edu patch ./my-package ./patch-file.json --dry-run
```

Patch operations: `add`, `remove`, `replace`, `upsert-node`, `remove-node`. Runs validation after applying — rejects invalid patches without modifying files.

### Generate

Output agent-ready prompts and generate packages from descriptions:

```bash
edu generate --prompt
edu generate --from-description "Create a JavaScript variables lesson"
```

`--prompt` outputs the content of the thin reference skill (`packages/cli/skills/course-spec-generator.skill.md`) as agent context. For full interactive authoring with discovery, validation, and quality checks, use the portable `openedu-course-authoring` skill instead (see [Agentic Course Authoring](../agentic-authoring)). `--from-description` scaffolds a package with basic content generation.

### Widget Create

Scaffold a publishable widget package:

```bash
edu widget create ./my-widget --id my-widget-id --title "My Widget"
```

Generates a complete widget package with `package.json`, `src/index.tsx`, `src/index.test.tsx`, and `vitest.config.ts`.

### Compile

Compile a `course-spec.md` into a validated OpenEdu educational package:

```bash
edu compile ./course-spec.md --output ./my-course
edu compile ./course-spec.md --validate
edu compile ./course-spec.md --verbose
```

Parses Markdown via Remark/Unified, semantically validates structure (duplicate IDs, missing fields, dependency loops), and generates the package directory with `package.json`/`bundle.json`, `workflow.json`, lesson nodes, quiz JSON, and placeholder assets. Diagnostics are collected from each pipeline stage and reported to the user.

### Import Learn-Easy

Import Learn-Easy curriculum content and generate an Open-Edu bundle:

```bash
edu import learn-easy ./source-dir ./output-dir
edu import learn-easy ./source-dir ./output-dir --bundle-title "Math Bundle" --bundle-id "math-bundle"
```

Reads JSON module files from the source directory, auto-detects node types from naming conventions, and generates:

- `bundle.json` — bundle manifest with `BundleManifestSchema`-compliant structure
- Per-module directories with `package.json`, `workflow.json`, node files, and `validate.test.ts`
- Root-level `validate.test.ts` for the bundle
- Returns JSON output with `--json` flag: `{ bundleDir, moduleCount, nodeCount, warnings }`

### OEP Build

Build a portable `.oep` (Open-Edu Package) distribution artifact:

```bash
edu oep:build ./my-course -o ./dist
edu oep:build ./my-course  # defaults to current directory
```

Produces a `.oep` ZIP archive with SHA-256 content integrity, a distribution manifest, and outputs the archive path, checksum, and file size. The `.oep` format is the standard distribution format for Open-Edu courses, supporting secure installation through the `InstallCoordinator` in `@open-edu/oep-distribution`.
