# Interactive Lesson Node Authoring

This reference describes when to emit `{type:"interactive", engine, spec}` in a lesson node vs a legacy widget activity, and how to author the spec.

## Interactive vs Widget Decision

- **Use a widget** when a catalog widget covers the learning intent (existing `authoring-workflow.md` rules stay authoritative).
- **Use an interactive node** when the content is representational/dynamic (number lines, charts, maps, timelines, diagrams) or composed of multiple engines — the widget catalog has no entry.

## How to Author the Spec

1. Load the engine's `SKILL.md` via `engine-skill-catalog.mjs`.
2. Follow its authoring rules for the `spec` shape.
3. Round-trip the spec against its `schema.json` (ajv) or the manifest `validationContract`.
4. Place the validated spec in the lesson node as `{type:"interactive", engine: "<type>", spec: { ... }}`.

## Engine Skill Catalog Discovery

In **repository mode**, the manifest is at `node_modules/@knowledgeassemble/engine-skills/manifest.json` (resolved via adapter `paths.engineSkillsManifest`).

In **portable mode**, first install the package:

```bash
pnpm add @knowledgeassemble/engine-skills
```

Then reference the manifest via `engine-skill-catalog.mjs`.

## Do Not Duplicate Per-Engine Guidance

Route to `references/engine-skills.md` (generated matrix) for the engine-to-kind mapping. Route to the engine's own `SKILL.md` (loaded from the installed package) for per-engine prose. Never re-derive per-engine guidance in this file.
