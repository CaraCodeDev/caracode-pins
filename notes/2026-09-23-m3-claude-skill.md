<!--
  Milestone M3 of the greenfield plan (notes/implementation-plan.md), descended
  into the notes method. Product spec: notes/spec.md. Previous: notes/2026-09-23-m2-pins-panel.md.
-->

# M3 — The Claude skill

Status: **M3 shipped; exit verified except Rich's own session (step 8) · next: M4** · Last updated: 2026-09-23

M2 made pins you can place, read and answer. M3 teaches Claude to act on them.
Rich says "work the pins" in a site that has carapin installed; Claude reads the
open pins, makes each change in the code, replies on the pin saying what it did,
and moves it to review. Without the skill, every new session would have to
rediscover the file format and the lifecycle.

---

## Core framing

The skill is **a contract for the file, written for Claude**. It's not code; it's
instructions. What it has to get right:

| Claude must… | Because |
|---|---|
| Work only pins that are `open` **and whose latest comment is human** | A pin whose latest comment is Claude's is waiting on Rich (a question, or a note it can't act on). Re-working it would loop. |
| Treat the latest human comment as the instruction, the whole thread as context | notes/spec.md → "Replying sends it back" ("no, indigo") |
| Change the component at `anchor.source` by default | notes/spec.md → "Component by default"; the note overrides ("just this one") |
| Reply with what it changed, then set `review` | notes/spec.md → "Pin lifecycle"; **never `done`** |
| Keep the file's format | The panel and Rich's diffs depend on it (M2 Decision 1) |

## Decisions (locked 2026-09-23)

1. **The skill ships inside the package** at `packages/pins/skill/SKILL.md`, in Claude
   Code's skill format (frontmatter `name` + `description`). Its name is **`pins`**, so
   Rich can also type `/pins`. The description must make Claude load it for "work the
   pins", "check the pins", "what's pinned", and mentions of `.carapin`.
2. **The dev server installs it into the site on `astro dev` start**, at
   `<site root>/.claude/skills/pins/SKILL.md`, because notes/spec.md says installing the
   package is the only setup. Rules:
   - The installed file carries a marker line identifying it as carapin's, with the
     package version.
   - **Missing → write it. Present with carapin's marker and a different version →
     overwrite. Present without the marker (Rich wrote or edited his own) → never touch
     it**, log one line saying so.
   - Log one line when it writes or updates, nothing when it's current.
   - This is carapin's one write outside `.carapin/`. It's tooling in `.claude/`, not
     site source code, so notes/spec.md → "Out of scope: editing source code" still holds.
     Record this in the spec.
3. **"Work the pins" procedure** (the skill's core; wording is the builder's, behaviour is this):
   1. Find pin files: `.carapin/**/*.json` under the site root (the dir with `astro.config.*`).
   2. Take pins with `status: "open"` whose **last comment has `author: "human"`**. Report
      the count first.
   3. For each: read the whole thread; the last human comment is the instruction. Read
      `anchor.source` (file:line:col) and `anchor.sourceChain`; open the file. The line may
      have moved since the pin was made: find the element by `anchor.tag` and `anchor.text`
      near that line. `anchor.selector` identifies the exact instance on the page if the
      note says "just this one".
   4. **Default to changing the component** at `anchor.source` (affects every instance);
      the note can narrow it.
   5. Make the change. Then edit the pin: append
      `{ "author": "claude", "text": "<what changed, with file:line>", "at": "<ISO now>" }`,
      set `status` to `"review"`, set `updatedAt`. **Never set `done`.**
   6. **If the note is ambiguous, or asks for something carapin shouldn't do alone**
      (below), don't guess: append a claude comment with the question and leave the pin
      `open`. It won't be picked up again until Rich replies.
   7. End with a short summary: which pins moved to review, which have questions.
4. **Content / CMS pins aren't implemented by "work the pins".** A pin labelled `content`,
   or whose note describes editable fields ("image or video, optional CTA with URL"),
   is input to a CMS conversation, not a code change (notes/spec.md → "Out of scope:
   generating CMS schemas"). "Work the pins" skips them and lists them in its summary. The
   skill also explains how to *read* them when Rich asks something like "what content
   fields did I pin?": group by page and section, quote the notes, cite sources. It does
   not prescribe a CMS or a schema.
5. **Editing the pin file by hand.** The skill states the format (M2 Decision 1) and the
   rules: 2-space indent, trailing newline, keep existing key order, keep unknown fields,
   don't renumber or reorder pins (numbers are file positions), timestamps in ISO UTC.
   Claude edits the JSON directly; the dev server doesn't need to be running.
6. **The skill is short.** One screen or two. It's loaded into context every time; a
   long skill costs every session.

## Current state (what already exists)

- Pin file format and operations: notes/2026-09-23-m2-pins-panel.md → Decision 1 and
  "What's built so far" (`packages/pins/src/{types.ts,store.ts}`).
- Integration hooks: `packages/pins/src/index.ts` — `astro:config:setup` (dev only) and
  `astro:server:setup` (has `siteRoot`, `logger`). The installer belongs in the dev path.
- Package: `packages/pins/package.json` — `files: ["dist"]`; the skill must be added so it
  ships to npm. Version currently `0.0.0`.
- Playground: `playground/` (port 4358); hero / features (`FeatureCard.astro`) / CTA.

---

## What's built so far (the contract)

- **Phase 1 — skill + installer.** `packages/pins/skill/SKILL.md` (name `pins`, ~70 lines, neutral wording: "the developer", not Rich) ships via `files: ["dist", "skill"]`. `installSkill` (`packages/pins/src/skill.ts`) runs from `astro:server:setup` (dev only), non-blocking, errors → warning. Writes `<site>/.claude/skills/pins/SKILL.md` with `<!-- carapin-skill v<version> · … -->` straight after the frontmatter. **Missing → write; carapin marker and content differs → overwrite; no marker → left alone; one log line for each; identical → nothing.** (Content comparison, not version-only: see Resolved decisions.) Package dir found as `new URL('..', import.meta.url)` (works from `dist/` in the workspace and from npm). Tests `test/skill.test.ts` (111 total). `.gitignore` ignores `playground/.claude/skills/pins/`.

## Phases

### Phase 1 — The skill and its installer  <!-- ☑ DONE 2026-09-23 -->

- [x] `packages/pins/skill/SKILL.md` per Decisions 1, 3–6.
- [x] Installer per Decision 2, run from the dev-server path only (never on `astro build`),
  reading the package version from the package's own `package.json`. Included in the
  published files.
- [x] Tests for the installer's three cases (missing, older carapin version, user-owned
  file) and the "current → no write" case.
- [x] This repo's `.gitignore` ignores the installed copy at `playground/.claude/skills/pins/`
  so the package's copy stays the single source.

*Verified 2026-09-23:* orchestrator: typecheck + build clean, 111 tests pass; `pnpm dev` installed the skill with the marker on line 5. Builder: `pack --dry-run` lists `skill/SKILL.md`; a real tarball unpacked as `node_modules/@caracode/pins` installed correctly; restart = no write/no log; marker removed → left alone + one log line; no `.claude/` after `astro build`.

**Exit run (orchestrator):** wrote three pins into `playground/.carapin/index.json` (CTA button "make it blue", card 2 title "add a short eyebrow label above the heading", hero section "Hero: image or video, optional CTA with URL"). A fresh Opus agent told only "read the installed skill, work the pins": button → royal blue via a new `button--blue` class (`index.astro:64`, `global.css:124`); "Why it matters" eyebrow added in `FeatureCard.astro:18` (all three cards); both pins `review` with claude comments citing file:line; hero pin skipped and listed as content; nothing `done`. Replied "no, indigo" via the package's own `replyToPin` → btn01 `open`. A second fresh agent: worked only btn01 (card02 left in review, hero skipped again), button indigo, btn01 back to `review`. Panel screenshot: two review pins + the open content pin, indigo button and three eyebrows visible. Playground code reverted afterwards.

*Files:* `packages/pins/skill/SKILL.md`, `packages/pins/src/{skill.ts,index.ts}`, `packages/pins/package.json`, `packages/pins/test/skill.test.ts`, `.gitignore`.

---

## Exit verify (milestone M3)

From notes/implementation-plan.md → M3: *pin the CTA button "make it blue" and pin a feature
card "add an icon above the heading". Tell Claude "work the pins": both change, both move to
review with a comment saying what was done, and the icon lands on every card, not just the one
pinned. Reply "no, indigo" on the button; it reopens, and the next "work the pins" fixes it.*

1. Typecheck, build, tests clean; prod grep of `playground/dist` still empty;
   `pnpm --filter @caracode/pins pack --dry-run` lists `skill/SKILL.md`.
2. `pnpm dev` → `playground/.claude/skills/pins/SKILL.md` exists with the marker; restart →
   no write, no log line; hand-remove the marker line → restart leaves the file alone and logs.
3. In the panel, pin the CTA band button "make it blue" and a feature card's title "add a
   small icon above the heading" (note: the playground cards already have an icon; use a
   different ask if needed, e.g. "add a short eyebrow label above the heading").
4. A fresh Claude session in `playground/`, following the installed skill, is told "work the
   pins" → both code changes made; the card change is in `FeatureCard.astro` (all three
   cards); both pins `review` with a claude comment citing file:line; neither `done`.
5. The open panel shows both in review within seconds.
6. Reply "no, indigo" on the button pin → `open`. "Work the pins" again → only that pin is
   worked; button is indigo; pin back to `review`.
7. A pin with the note "Hero: image or video, optional CTA with URL" is skipped by "work the
   pins" and listed as a content pin in the summary.
8. **(HUMAN)** Rich runs "work the pins" himself in a real session and the result reads well
   in the panel.

Revert the playground's code changes after verifying; the playground is a fixture.

---

## Resolved decisions (2026-09-23)

1. **The installer compares content, not just version** (orchestrator change after the build). Version-only meant skill edits never reached a site while the version stayed `0.0.0`. Now a carapin-marked copy is rewritten whenever its text differs from what the package would write; still never touches an unmarked file. (Phase 1)
2. **Skill wording is neutral** ("the developer"), since it ships on npm. (Phase 1)

## Watch-outs / known limitations

- **Astro logs as JSON when stdout isn't a terminal** (e.g. under an agent). The installer's log lines look like `{"message":"Installed the pins skill…"}` there; normal in a real terminal.

- **Port 4321 is Rich's other project.** Never touch it.
- **The installer must not run on `astro build`** or in `astro preview`.
- **Never overwrite a user-owned skill file** (no marker). This is the one place carapin
  writes into `.claude/`; getting it wrong would clobber Rich's own work.
- **Claude's comments are plain text.** No Markdown rendering in the panel; keep replies
  short and readable as plain text.

## Deferred / out of scope

- A CMS-schema skill or command → notes/spec.md says that stays a conversation.
- Other agents (Cursor etc.) reading pins → the format is plain JSON; nothing extra in v1.
