# Repository Adapter

This reference describes how the skill detects and interfaces with an Open-Edu repository.

## Discovery

The script `scripts/discover-openedu.mjs` walks upward from the working directory looking for:

- `pnpm-workspace.yaml` → repository root
- `packages/course-compiler/` → compiler package present
- `packages/cli/` → CLI package present
- `packages/cli/dist/cli.js` → CLI executable (distinct from `packagePresent`)
- `packages/widgets/` → widget catalog available
- `packages/pipeline/` → PDF pipeline available
- `packages/core/src/widget-catalog-data.json` → catalog data available
- `node_modules/@knowledgeassemble/engine-skills/manifest.json` → engine skills catalog available

**Repository mode requires executable CLI** (`dist/cli.js`), not just detected package directories. If the CLI package exists but `dist/cli.js` is missing, repository mode is not available — portable mode applies.

## Output JSON

```json
{
  "mode": "repository" | "portable",
  "repoRoot": "/path/to/root" | null,
  "capabilities": {
    "compiler": true | false,
    "cli": true | false,
    "widgetCatalog": true | false,
    "engineSkillsCatalog": true | false,
    "pipeline": true | false,
    "examples": true | false
  },
  "commands": {
    "compile": ["node", "/path/to/cli/dist/cli.js", "compile", "{spec}", "--output", "{dir}", "--validate"] | null,
    "validate": ["node", "/path/to/cli/dist/cli.js", "validate", "{dir}"] | null,
    "lintContent": ["node", "/path/to/cli/dist/cli.js", "lint-content", "{dir}"] | null,
    "dev": "edu dev {dir}" | null,
    "generateCatalog": "pnpm --filter @open-edu/widgets generate:catalog" | null,
    "pipelineGenerate": "pnpm --filter @open-edu/pipeline curriculum:generate ..." | null,
    "installEngineSkills": ["pnpm", "add", "@knowledgeassemble/engine-skills"] | null
  },
  "paths": {
    "compilerRoot": "/path/to/course-compiler" | null,
    "cliRoot": "/path/to/cli" | null,
    "cliEntry": "/path/to/cli/dist/cli.js" | null,
    "widgetsRoot": "/path/to/widgets" | null,
    "pipelineRoot": "/path/to/pipeline" | null,
    "catalogData": "/path/to/widget-catalog-data.json" | null,
    "guidanceData": "/path/to/domain-guidance/src/data" | null,
    "examplesDir": "/path/to/examples" | null,
    "engineSkillsManifest": "/path/to/engine-skills/manifest.json" | null,
    "engineSkillsRoot": "/path/to/engine-skills" | null
  },
  "unavailable": ["compiler", "pipeline", "engineSkillsCatalog"]
}
```

Note: `commands.compile`, `commands.validate`, and `commands.lintContent` use **structured argv arrays** (e.g., `['node', cliPath, 'compile', ...]`), not shell strings. The `openedu-adapter.mjs` converts these arrays to shell-safe execution at runtime. `commands.dev` and `commands.pipelineGenerate` are **suggested commands** (shell strings for human reference), not executed by the adapter.

## Command Execution Rules

When in repository mode:

1. **Compile:** Run `['node', cliPath, 'compile', '<course-spec.json>', '--output', '<package-dir>', '--validate']`
   - Structured argv array, converted to shell-safe execution by `openedu-adapter.mjs`
   - Capture exit code, stdout, stderr
   - Non-zero exit = failure

2. **Validate:** Run `['node', cliPath, 'validate', '<package-dir>']`
   - Capture exit code, stdout, stderr
   - Non-zero exit = failure

3. **Lint:** Run `['node', cliPath, 'lint-content', '<package-dir>']`
   - Capture exit code, stdout, stderr
   - Non-zero exit = failure (errors found)

4. **Dev:** Suggest `edu dev <package-dir>` (suggested command only), but do NOT claim visual verification unless actually running the command

5. **Package Build:** `validate-package.mjs` orchestrates compile → validate → lint in sequence. Prefer running `validate-package.mjs` over individual commands.

## Build Prerequisites

If the CLI package is detected (`packages/cli/`) but `dist/cli.js` is missing, the CLI must be built before repository mode is available:

```bash
pnpm --filter @open-edu/cli build
```

After building, re-run discovery to confirm executable status. Without `dist/cli.js`, commands cannot be executed and portable mode applies.

## Package Safety Rules

- Create a new output directory by default (do not overwrite)
- If the output directory exists, prompt the user before overwriting
- Keep all generated assets within the output directory
- Verify manifest via `validate-package.mjs` after compilation (checks for `package.json` or `bundle.json`)
- Verify workflow references resolve before reporting success

## Catalog Discovery

The widget catalog is generated from `packages/widgets/src/widget-catalog-source.ts` into `packages/core/src/widget-catalog-data.json`. If the JSON file exists, parse it. If not, suggest running:

```bash
pnpm --filter @open-edu/widgets generate:catalog
```

If the catalog cannot be loaded, the skill MUST NOT invent widget IDs or configurations.

## Engine Skills Catalog Discovery

The engine skills catalog is discovered from `node_modules/@knowledgeassemble/engine-skills/manifest.json`. If the manifest exists, `capabilities.engineSkillsCatalog` is `true` and `paths.engineSkillsManifest` is set. The engine skills root path (`paths.engineSkillsRoot`) points to the package root for loading SKILL.md, schema.json, and skill-example.json files relative to the manifest.

If the engine skills catalog is unavailable (portable mode, or package not installed), the capability flag is `false` and `unavailable` includes `'engineSkillsCatalog'`. To install:

```bash
pnpm add @knowledgeassemble/engine-skills
```

In this repository (development mode), the package is wired via `file:` override in `pnpm.overrides` — no separate install needed.

## Pipeline Integration

When source materials (PDFs, textbooks) are supplied:

1. Check if `@open-edu/pipeline` is available (via discovery)
2. Resolve a profile: `--subject math` (use `--subject math`, not `--subject mathematics`)
3. Run: `pnpm --filter @open-edu/pipeline curriculum:generate --pdf <file> --subject math`
4. Preserve pipeline output artifacts: source inventory, concept map, blueprint
5. If pipeline unavailable: use supplied material as context only, mark source extraction as manual/unverified

## Profile Resolution

The pipeline supports four built-in profiles:

- `generic` — fallback for any subject
- `math` — triggered by `--subject math`
- `science` — triggered by `--subject science`
- `nios` — triggered by `--curriculum nios`

When using the pipeline, use the profile that matches the user's subject. The `--subject` flag takes the canonical subject name (e.g., `math`, not `mathematics`).
