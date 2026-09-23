<!--
  PRODUCT SPEC TEMPLATE (greenfield method)
  Method: /Users/rich/NothingNotes/Research/Claude/greenfield-planning-method.md
  This is the WHAT/WHY doc — features, workflows, problem context. Not an
  implementation plan; keep tech to the thin section at the end. Companion:
  notes/implementation-plan.md.
-->

# <Project> — Spec

<Elevator paragraph: what it is, who it's for, the shape of the thing in 2–4
sentences. Follow with ONE sentence of what it deliberately does not do.>

- **Base URL / where it lives:** <…>
- **Owner / operator:** <…>
- **Nature:** <internal tool / client-facing / commercial — and the right-sizing that
  implies: shared defaults over configurability, etc.>
- **Status:** <Spec in progress — what's settled · what's open · next question to
  answer · YYYY-MM-DD. Becomes "Spec signed off <date>" when done. Update this line
  every session — it's how a paused spec conversation resumes cold.>

---

## Purpose & scope

<The problem context: what pain forces this to exist, in concrete terms.>

### In scope

- <…>

### Out of scope (explicitly)

<As load-bearing as the in list. Name where each excluded concern lives instead.>

- <…>

---

## Core concept

<The central mental model — the thing that, if conflated, makes the product messy. Often: what the fundamental unit is, what its captured against, what it accumulates.>

## <Domain sections — access model, workflows, the product shape>

<The bulk of the spec. Freeform: roles + capability matrix, status workflows,
key user journeys — whatever this product demands. Decisions here carry their WHY
and the rejected alternative.>

## Data model (entities)

<Entities and relationships, not schema. One line each: what it is, what it belongs
to, what it carries conceptually.>

- **<Entity>** — <…>

## Functional requirements

<Grouped per surface (endpoint, dashboard, widget, …). Bullets of observable
behavior.>

## Non-functional requirements

<Only the load-bearing ones, each with its because. Name the single most
load-bearing one explicitly.>

## Intended tech stack

<THIN. One line per choice with its why. Non-obvious rejections get a "### Why not X" subsection recording the reasoning — it stops a later session re-proposing it. If this section wants to be pages, it notes/technical-architecture.md instead.>

## Scope discipline (v1 vs later)

- **v1:** <…>
- **Later:** <…>

## Open questions & to-verify

<Genuinely open product questions, plus "verify at build time" items — live API
details to confirm rather than assume when spec becomes implementation.>

- <…>
