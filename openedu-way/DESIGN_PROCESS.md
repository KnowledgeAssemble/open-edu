# Design Process

> _"Good design is not discovered by accident. It is assembled through thoughtful iteration."_

---

# Purpose

This document defines how design decisions are made within OpenEdu.

It is not a style guide.

It is a process guide.

Its purpose is to ensure that every contributor—human or AI—follows the same path from philosophy to implementation.

---

# Philosophy

OpenEdu does not begin by designing screens.

It begins by designing ideas.

Every visual decision should be traceable back to the project's philosophy.

A beautiful interface that contradicts the philosophy is considered a poor design.

---

# The Design Pyramid

Every design activity should follow this order.

```
Philosophy
        ↓
Design Language
        ↓
Visual DNA
        ↓
Design System
        ↓
User Experience
        ↓
Implementation
```

Higher layers constrain lower layers.

Lower layers should never redefine higher layers.

---

# Stage 1 — Philosophy

Questions answered:

- Why are we building this?
- What principles guide us?
- What values must never change?

Canonical source:

**Volume I**

Outputs:

- Vision
- Principles
- Learning Philosophy
- Open Modules
- Project Pipili
- Design Philosophy

---

# Stage 2 — Design Language

Questions answered:

- What should OpenEdu look and feel like?

Canonical source:

**Volume II**

Outputs:

- Geometry
- Color Language
- Typography
- Motion
- Layout
- Components
- Accessibility
- Design Tokens

At this stage we define principles.

Not products.

---

# Stage 3 — Visual DNA

Questions answered:

- What makes OpenEdu instantly recognizable?

Outputs:

- Geometric Primitive
- Open Module
- Pipili
- Logo
- Pattern Language
- Illustration Style

This stage is exploratory.

Large numbers of concepts should be generated.

Only a few should survive.

Iteration is expected.

---

# Stage 4 — Design System

Questions answered:

- How do we build interfaces consistently?

Outputs:

- Figma Library
- Components
- Variables
- Tokens
- Icons
- Patterns
- Templates

This becomes the canonical implementation of the Design Language.

---

# Stage 5 — Product Design

Questions answered:

- How do learners experience OpenEdu?

Examples:

- Learner App
- Authoring App
- AI Experiences
- Reward Engine

Products should be assembled from the Design System rather than designed independently.

---

# Stage 6 — Engineering

Questions answered:

- How is the experience implemented?

Outputs:

- Source Code
- Components
- APIs
- Documentation
- Tests

Engineering should faithfully implement the Design System.

It should not redefine it.

---

# The Exploration Cycle

Every significant design problem should follow the same workflow.

```
Understand

↓

Research

↓

Explore

↓

Review

↓

Refine

↓

Prototype

↓

Validate

↓

Implement
```

Avoid selecting the first reasonable solution.

Explore broadly before converging.

---

# AI-Native Design Workflow

OpenEdu embraces AI as a creative collaborator.

Recommended workflow:

```
Problem

↓

Design Brief

↓

AI Exploration

↓

Human Review

↓

Refinement

↓

Figma

↓

Prototype

↓

Implementation
```

AI accelerates exploration.

Humans make the final decisions.

---

# Design Reviews

Every review should evaluate designs using the same questions.

- Is it consistent with Volume I?
- Is it consistent with Volume II?
- Does it improve learning?
- Does it reduce cognitive effort?
- Is it accessible?
- Is it reusable?
- Is it implementation-independent?
- Is it appropriate for the MVP?

If a design fails one of these questions, refine before continuing.

---

# Decision Hierarchy

When multiple solutions exist, prefer the one that is:

1. More consistent
2. Simpler
3. More accessible
4. More reusable
5. Easier to maintain
6. Easier to understand

Novelty is never a deciding factor.

---

# Visual DNA Rules

Before designing a screen, ensure these exist:

- Geometric Primitive
- Open Module
- Pipili
- Logo
- Pattern Language
- Illustration Language
- Color System
- Typography

If these are incomplete, continue working on the visual language.

Do not skip ahead.

---

# MVP Discipline

The current objective is to build an excellent MVP.

When uncertain:

Prefer:

- fewer features
- fewer components
- fewer colors
- fewer animations

More refinement.

Less complexity.

---

# Success Criteria

The design process succeeds when:

- contributors make consistent decisions,
- AI agents generate compatible designs,
- interfaces feel unmistakably OpenEdu,
- learners experience calm, accessible, modular learning.

The goal is not to design quickly.

The goal is to design thoughtfully.

Every experience should feel assembled with intention.
