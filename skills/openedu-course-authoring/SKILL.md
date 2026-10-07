---
name: openedu-course-authoring
description: Generate, validate, and compile Open-Edu educational courses. Use this whenever you need to create educational content, design curricula, author course specifications, or build structured educational packages for the Open-Edu framework. Supports both portable mode (spec-only, works anywhere) and repository mode (full compilation with validation).
trigger:
  - create.*open-edu.*course
  - generate.*educational.*content
  - author.*curriculum
  - design.*learning.*experience
  - build.*educational.*package
  - compile.*course.spec
  - create.*lesson.plan
  - generate.*course.*spec
  - author.*course.*spec
  - create.*bundle.*course
  - author.*multi.module.*course
  - create.*open-edu.*bundle
---

# Open-Edu Course Authoring Skill

You are an expert educational content author for the Open-Edu framework. This skill guides you through generating a compiler-compatible `course-spec.json` and optionally compiling it into a validated Open-Edu package.

## Quick Start

1. **Discover environment:** Run `node skills/openedu-course-authoring/scripts/discover-openedu.mjs` to detect repository capabilities. All helper scripts resolve relative to the `OPENEDU_SKILL_DIR` environment variable or the skill directory.
2. **Interview:** Ask the user for topic, learner level, goals, language, duration, prerequisites, accessibility needs, learner profile (see [Profiles](#profiles)), and source materials. Record unstated inputs as assumptions.
3. **Select profile:** Pick the matching `references/profile-*.md` in Stage 1 and apply its **Guidance Deltas** to every authoring stage and its **Output Deltas** to every generated artifact.
4. **Generate:** Follow the staged workflow in `references/authoring-workflow.md`.
5. **Output:** Produce artifacts per `references/artifact-contract.md`.
6. **Validate:** In repository mode, run `quality-report.mjs` as the central orchestrator — it produces `quality-report.json` and coordinates compile, validate, and lint via `validate-package.mjs`.

## Profiles

The skill supports four learner profiles that vary **both** the authoring guidance the agent follows **and** the content it produces:

| Key            | Default | Reference                            |
| -------------- | ------- | ------------------------------------ |
| `neurotypical` | yes     | `references/profile-neurotypical.md` |
| `autism`       | no      | `references/profile-autism.md`       |
| `school`       | no      | `references/profile-school.md`       |
| `college`      | no      | `references/profile-college.md`      |

Select the matching `profile-<key>.md` in Stage 1 and apply its **Guidance Deltas** to every authoring stage and its **Output Deltas** to every generated artifact. `scripts/profiles.mjs` normalizes user input (`resolveProfile`) and loads the machine-checkable knobs (`profiles.config.json`) that scripts use for verification and reporting.

- Ask for `learnerProfile` after Learner Age/Level in the Stage 1 interview; it may be named (`autism | school | college`) or inferred from age context, defaulting to `neurotypical`.
- Record every selection (or default) under a `## Learner Profile` section in `course-brief.md`.
- Unknown profile names are mapped to the closest supported profile and that mapping is recorded as an assumption.
- Record **educational context** — `educationLevel` (`school`/`college`), `gradeBand` (school only), and `curriculum` — separately under `## Educational Context`. These compose with the learner profile as distinct fields, never as composite profiles (see `references/profiles.md`).

## Modes

### Portable Mode (no repo detected, or no executable CLI/compiler)

- Output: `course-spec.json`, `course-spec.md`, `course-brief.md`, `quality-report.json`
- Validation: structural-only via `validate-course-spec.mjs` with `validationMode: "structural-only"`. Compiler/package phases skipped.
- Report commands the user can run for full validation

### Repository Mode (Open-Edu detected with executable CLI)

- Requires executable CLI (`dist/cli.js`), not just detected package directories
- Output: all portable artifacts + compiled `package/` directory
- Validation: `quality-report.mjs` orchestrates structural checks + `edu compile --validate` + `edu validate` + `edu lint-content` via `validate-package.mjs`

## Critical Rules

1. **`course-spec.json` is canonical.** The Markdown export is secondary.
2. **Validate before claiming success.** A run is successful only when all validation gates pass.
3. **Record assumptions.** Never silently invent learner level, prerequisites, or scope.
4. **Widget IDs must come from the discovered catalog.** Never guess widget IDs. Community widgets use `widgetRef` with `source: 'registry'` and mandatory integrity — see the [Community Widgets Developer Guide](../../apps/docs/docs/widgets/community-widgets).
5. **Preserve pipeline artifacts.** When using the PDF pipeline, keep source inventory, concept map, and blueprint.
6. **Respect output safety.** Create new directories, prompt before overwriting.
7. **Be truthful about capability.** Never claim compilation or validation that wasn't actually run.
8. **Each lesson must be complete.** Include measurable objectives, core explanation, examples, misconceptions, progressive activities, and aligned assessment.
9. **Never infer `autism`.** A neurodivergence profile is never deduced from age, level, or behavior — it is only ever explicitly stated by the user or defaulted to `neurotypical`. `school`/`college` may be inferred from age/educational context; `autism` alone is never auto-labeled.
10. **Interactive lesson nodes must come from the engine skill catalog.** Load `engine-skill-catalog.mjs`, read the engine's `SKILL.md`, follow its authoring rules, round-trip the `spec` against its `schema.json`/validationContract, then emit `{type:"interactive", engine, spec}`. Never invent a spec shape or engine id.

## References

- **Artifact Contract:** `references/artifact-contract.md` — exact JSON schema, field requirements, ID rules
- **Profiles:** `references/profiles.md` — index of the four learner profiles and delta semantics
- **Authoring Workflow:** `references/authoring-workflow.md` — staged generation sequence, activity progression, widget selection rules
- **Bundle Authoring:** `references/bundle-authoring.md` — USE when authoring a multi-module bundle: module split rules, bundle.json manifest, dependsOn ordering, bundle-level rewards/cards placement
- **Quality Rubric:** `references/quality-rubric.md` — objective coverage, alignment, accessibility, inclusion checks
- **Repository Adapter:** `references/repository-adapter.md` — discovery, commands, catalog loading, pipeline integration
- **Rewards & Cards Authoring:** `references/rewards-cards-authoring.md` — USE when authoring rewards.json/cards.json: triggers, conditions, scope rules (module vs bundle), global card-ID uniqueness
- **Source Materials:** `references/source-materials.md` — PDF and curriculum document handling via pipeline
- **Interactive Authoring:** `references/interactive-authoring.md` — USE when authoring an interactive lesson node: interactive vs widget decision, spec authoring, engine catalog discovery

## Helper Scripts

- `scripts/discover-openedu.mjs` — detect repository, capabilities, executable status, commands, paths; distinguishes `packagePresent` from `executable`
- `scripts/openedu-adapter.mjs` — shared adapter for repo discovery, command execution, path resolution; all helpers import it
- `scripts/widget-catalog.mjs` — loads the widget catalog from the discovered repo, replacing hardcoded widget IDs
- `scripts/validate-course-spec.mjs` — validate `course-spec.json` structurally and via compiler; exposes `validationMode` field (`"structural-only"` | `"compiler"`)
- `scripts/validate-package.mjs` — orchestrates compile → validate → lint in sequence for a compiled package
- `scripts/quality-report.mjs` — central orchestrator and sole writer of `quality-report.json`; merges findings from all phases
- `scripts/summarize-quality.mjs` — complete quality rubric (catalog-backed, all dimensions) consumed by `quality-report.mjs`
- `scripts/engine-skill-catalog.mjs` — loads the engine skill catalog from the installed `@knowledgeassemble/engine-skills` package; provides lookup helpers for engine entries, kinds, and doc/schema/example loading

## Source Material Pipeline

When source materials (PDFs, textbooks) are provided:

1. Detect pipeline availability via `discover-openedu.mjs`
2. Resolve the appropriate profile (`generic`, `math`, `science`, or `nios`)
3. Run: `pnpm --filter @open-edu/pipeline curriculum:generate --pdf <file> --subject math` (use `--subject math`, not `--subject mathematics`)
4. Preserve pipeline artifacts: source inventory, concept map, blueprint, coverage report
5. Transform pipeline output (`course-spec.md`) into canonical `course-spec.json`
6. If pipeline unavailable: use material as context, mark extraction as manual
7. Preserve pipeline command evidence and source-material provenance in the quality report

See `references/source-materials.md` for full profile selection guide and pipeline options.

## Output Directory Structure

```
course-output/
├── course-brief.md           # Scope, assumptions, lesson outline
├── lesson-blueprints.json    # Detailed plan for each lesson
├── course-spec.json          # Canonical compiler input
├── course-spec.md            # Human-readable export
├── quality-report.json       # Diagnostics and quality findings
└── package/                  # Compiled package (repo mode only)
    ├── package.json          # Package manifest
    ├── workflow.json         # Routing graph
    └── nodes/                # Content nodes
```
