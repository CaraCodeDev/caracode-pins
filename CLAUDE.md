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

## Local dev

The playground Astro dev server runs on **port 4358**, never Astro's default
4321. Another Astro project is usually already running on 4321. Set it in
`playground/astro.config.mjs` (`server.port`) and `.claude/launch.json`.
