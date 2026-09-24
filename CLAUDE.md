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

<!-- fyi-cli -->
## Publishing with `fyi`

Markdown and HTML files in this directory publish to the **caracode-pins** folder of the **CaraCode Internal** org on riar.fyi.

```bash
fyi publish notes.md          # create the doc the first time, update it after
fyi publish docs/             # every .md in docs/ and in its subdirectories
fyi pull docs/                # bring edits made in the fyi app back into the files
fyi publish report.html       # replace the file behind an HTML doc
fyi publish new-report.html --title "Q3 Report"   # first publish of a new file
```

- **Markdown docs are editable in the app, so publish looks before it writes.**
  A doc that changed in fyi since your last publish is skipped, not overwritten,
  and the message names who changed it. Run `fyi pull <file|dir>` to write their
  version into your file, where git can diff it, or `--force` to send yours
  instead. Neither one writes while somebody has the doc open in the editor.
- **HTML docs are replaced silently.** Every upload is kept as a version, and
  restoring one is a click in the app.
- **`fyi publish <dir>` treats `<dir>` as the org root, not as a folder.**
  Its `.md` files land at the org root; each subdirectory becomes an fyi folder
  with the directory's name, created if it doesn't exist. Folders are one level
  deep, so a `.md` file nested any deeper is an error. To publish docs into a
  folder, publish the parent: `fyi publish docs/` puts `docs/guides/*.md` in
  a folder called "guides", while `fyi publish docs/guides/` puts them at the
  root. Files that aren't `.md` are counted and ignored rather than published.
- A file with no mapping yet **creates a doc**, published immediately. A new
  Markdown doc is titled from its first `# H1`, else from its filename;
  `--title` names one doc and is refused for a directory. `--draft` creates the
  doc unpublished.
- The file → doc mapping lives in `.fyi.json` in this directory. Commit it; it
  holds no secrets. Titles, folders and publish status belong to the app after
  creation. Change them there, not here.
- Add `--yes` in scripts: it never prompts.
<!-- /fyi-cli -->
