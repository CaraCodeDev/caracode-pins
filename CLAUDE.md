## Greenfield workflow (project bootstrap)

This repo is being taken from zero to usable with the greenfield method — product
spec + milestone implementation plan in `notes/`, each milestone built by descending
into the notes method. Full method:
`/Users/rich/NothingNotes/Research/Claude/greenfield-planning-method.md`.

- `notes/spec.md` — the product spec: what/why, scope, entities, thin tech section.
  Not an implementation plan.
- `notes/implementation-plan.md` — milestones, each with a demonstrable **Exit:**
  condition. Checkboxes are the project state. "Milestone" = plan grain; "Phase" =
  notes-method grain (M1.3 = phase 3 of milestone 1's doc).
- **"spec milestone N" / `/spec-milestone N`** → write that milestone's notes-method
  spec (seeding the notes method first if needed), then `/run-spec` builds it.
- **When a milestone's exit condition is demonstrated** → check it off in the plan
  with a one-line dated note.

If the code contradicts the spec or plan, stop and flag it; don't improvise.

## Planning workflow (big / multi-session features)

For multi-session features Rich uses a living plan doc — spec + build log in one
file per feature at `notes/<YYYY-MM-DD>-<feature>.md`. Full method (routing,
conventions, templates): `/Users/rich/NothingNotes/Research/Claude/notes-planning-method.md`.
Templates: `notes/spec-template.md`, `notes/prompt-template.md`.

- **"make a spec / make a note"** → create the doc from `notes/spec-template.md`,
  before implementing. Slice phases on the model-routing seam (see the method doc).
- **"run the spec" / `/run-spec`** → orchestrated build; the orchestrator divides the work and verifies it.
- **When a phase ships** → update the doc before moving on. Its checkboxes and
  Status line *are* the state between sessions.

If the code contradicts the spec — file moved, assumption false, rule impossible as
written — **stop and flag it**; don't improvise a reinterpretation.

## Local dev

The playground Astro dev server runs on **port 4358**, never Astro's default
4321. Another Astro project is usually already running on 4321. Set it in
`playground/astro.config.mjs` (`server.port`) and `.claude/launch.json`.
