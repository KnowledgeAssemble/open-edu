# OpenEdu Engine Skills Reference

> GENERATED reference — do not hand-edit. Regenerate with `pnpm --filter @open-edu/domain-guidance generate`.
> Source of truth: `@knowledgeassemble/engine-skills manifest.json`.

Package: `@knowledgeassemble/engine-skills` v0.1.2; Schema Version: 1

### visual (`educational-visual`)

- **Skill name:** `educational-visual`
- **Kinds:** number-line, counting-set, fraction, fraction-circle, fraction-comparison, clock, coordinate-grid, geometry, comparison, illustration
- **Schema:** `./skills/visual/schema.json`
- **Example:** `./skills/visual/skill-example.json`
- **Validation contract:** `@knowledgeassemble/visual-engine.VisualEngine()`
- **Namespaced events:** visual._-selected, visual._-focused

> Per-engine prose lives in the installed package's `SKILL.md`, loaded at runtime — never re-derived.

### chart (`quantitative-chart`)

- **Skill name:** `quantitative-chart`
- **Kinds:** bar, line
- **Schema:** `./skills/chart/schema.json`
- **Example:** `./skills/chart/skill-example.json`
- **Validation contract:** `@knowledgeassemble/chart-engine.ChartEngine()`
- **Namespaced events:** chart._-selected, chart._-focused

> Per-engine prose lives in the installed package's `SKILL.md`, loaded at runtime — never re-derived.

### geomap (`geographic-map`)

- **Skill name:** `geographic-map`
- **Kinds:** _none_
- **Schema:** `./skills/geomap/schema.json`
- **Example:** `./skills/geomap/skill-example.json`
- **Validation contract:** `@knowledgeassemble/geomap-engine.GeoMapEngine()`
- **Namespaced events:** geomap._-selected, geomap._-focused

> Per-engine prose lives in the installed package's `SKILL.md`, loaded at runtime — never re-derived.

### timeline (`temporal-timeline`)

- **Skill name:** `temporal-timeline`
- **Kinds:** events
- **Schema:** `./skills/timeline/schema.json`
- **Example:** `./skills/timeline/skill-example.json`
- **Validation contract:** `@knowledgeassemble/timeline-engine.TimelineEngine()`
- **Namespaced events:** timeline._-selected, timeline._-focused

> Per-engine prose lives in the installed package's `SKILL.md`, loaded at runtime — never re-derived.

### diagram (`structural-diagram`)

- **Skill name:** `structural-diagram`
- **Kinds:** concept-map, cycle, flow, hierarchy
- **Schema:** `./skills/diagram/schema.json`
- **Example:** `./skills/diagram/skill-example.json`
- **Validation contract:** `@knowledgeassemble/diagram-engine.DiagramEngine()`
- **Namespaced events:** diagram._-selected, diagram._-focused

> Per-engine prose lives in the installed package's `SKILL.md`, loaded at runtime — never re-derived.

### composition (`composition`)

- **Skill name:** `composition`
- **Kinds:** _none_
- **Schema:** `./skills/composition/schema.json`
- **Example:** `./skills/composition/skill-example.json`
- **Validation contract:** `@knowledgeassemble/engine-skills.validateSpec()`
- **Namespaced events:** _none_

> Per-engine prose lives in the installed package's `SKILL.md`, loaded at runtime — never re-derived.
