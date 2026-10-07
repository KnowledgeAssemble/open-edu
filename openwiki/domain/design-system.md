---
type: Domain Guide
title: Design System and UI Architecture
description: Guide to the two-tier UI architecture in the Open-Edu design system — primitives for generic building blocks and visual DNA for learner-facing surfaces.
tags: [openwiki, domain, design-system, ui]
---

# Design System and UI Architecture

The UI layer is split into two tiers:

1. **Primitives** — generic building blocks
2. **Visual DNA** — opinionated Open-Edu patterns for learner-facing surfaces

This split is documented in `docs/COMPONENT_GUIDE.md` and is reflected in the exports from `packages/design-system/src/index.ts`.

## Primitives

Primitives live in `packages/design-system/src/primitives/` and follow a shadcn/ui-style pattern:

- forward refs
- named exports only
- `className` passthroughs
- `cva` variants when needed
- token-based Tailwind classes only
- co-located tests

They include basics like buttons, cards, badges, dialogs, selects, progress bars, tabs, switches, tooltips, spinners, and text inputs, plus Open-Edu-specific primitives such as `OpenEduLogo`, `AssemblyFlow`, `OpenModule`, and `Pipili`.

## Visual DNA patterns

Patterns live in `packages/design-system/src/patterns/` and `packages/design-system/src/learning/`.
They are used for application-level surfaces such as:

- `PageHeader`
- `HeroSection`
- `StatsSummary`
- `CourseCardWithModule`
- `BundleCardWithModule`
- `BundleModuleIndicator`
- `AppLayout`, `SideNav`, and `TopAppBar`
- learning cards and overviews such as `BundleOverview`, `BundleCard`, and `ProgressCard`

These components are not generic UI atoms; they encode the visual language of the product.

## Runtime UI and learning UI split

`packages/runtime` exports runtime-facing components such as:

- `CourseCard`
- `KnowledgeCard`
- `KnowledgeCardGrid`
- `KnowledgeCardViewer`
- `KnowledgeCardUnlockedToast`
- `BundleOverview`
- `ProgressRing`
- layout shells and theme system pieces

The learner app composes these runtime components with design-system patterns. That separation keeps rendering behavior in the runtime package and visual composition in the design system.

## Theme and token system

The design system underpins the 3-theme system described in `apps/docs/docs/runtime.md` and the AGENTS instructions.

Relevant files:

- `packages/design-system/src/tokens/`
- `packages/design-system/src/theme/`
- `packages/design-system/src/tokens/tailwind.ts`
- `packages/runtime/src/themes/`

The important rule is that styling must flow through semantic tokens. Raw Tailwind palette colors and hardcoded hex values are avoided.

## Recent naming clarifications

Recent git history shows a progression from generic `Card` naming to more specific concepts:

- runtime `Card` → `KnowledgeCard`
- design-system `BundleCard` and `ProgressCard` additions
- card/bundle/progress components used in catalog, progress, and bundle overview screens

That history is useful because it explains why similar-sounding components live in different packages.

## Change guidance

When changing UI:

- use primitives for reusable controls
- use visual-dna patterns for Open-Edu-specific surfaces
- keep `className` and ref support intact on exported components
- add rendering, interaction, and accessibility tests
- regenerate the dev-server Tailwind CSS when runtime styling changes affect that output

## Useful source references

- `docs/COMPONENT_GUIDE.md`
- `packages/design-system/src/index.ts`
- `packages/runtime/src/index.ts`
- `packages/design-system/src/tokens/`
- `packages/design-system/src/patterns/`
- `packages/design-system/src/learning/`
