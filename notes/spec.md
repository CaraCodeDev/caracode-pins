<!--
  PRODUCT SPEC (greenfield method)
  Method: /Users/rich/NothingNotes/Research/Claude/greenfield-planning-method.md
  This is the WHAT/WHY doc — features, workflows, problem context. Not an
  implementation plan; keep tech to the thin section at the end. Companion:
  notes/implementation-plan.md.
-->

# carapin — Spec

carapin (`@caracode/pins`) is an Astro dev-toolbar app for pinning notes onto
elements of a site while it runs in local dev. Each pin records where the element
lives in the source (file and line), a short comment thread, and its status. Pins are written to
JSON files in the site's repo, and Claude reads those files and acts on them.
It is for one developer (Rich) working alone on his own Astro sites. It never
edits source code and never runs outside `astro dev`.

- **Where it lives:** an npm package installed into each Astro site as a dev
  integration. Repo: `~/repo/caracode-pins`.
- **Owner / operator:** Rich (CaraCode).
- **Nature:** personal dev tool, possibly published. Right-sized for one person
  on localhost: no accounts, no server, no sync, no configuration beyond
  installing it.
- **Status:** Spec signed off 2026-09-23. Implementation plan drafted in
  `notes/implementation-plan.md`; next: `/spec-milestone 0`.

---

## Purpose & scope

Two situations keep coming up when Rich builds Astro sites.

1. **A quick pass of tweaks.** He's looking at a page in local dev and notices a
   dozen small things. Describing each one to Claude in words ("the second card
   in the features section, the heading is too big") is slow, and Claude then
   has to work out which element he meant.
2. **Defining CMS content.** When a site gets a CMS, the real design work is
   deciding what's editable: this hero is an image or a video, it has an
   optional CTA with a URL, each feature card has an uploaded image and an icon.
   That's easiest to decide while looking at the page, pointing at each part.

Both come down to the same act: point at an element, say something about it,
and hand the pile to Claude.

### In scope

- An Astro dev-toolbar app for placing pins on elements and writing a note on each.
- Pin markers shown on the page, and a list of pins for the current page.
- Pin status: open → review → done, with done pins hidden by default.
- Pins stored as JSON in the site repo.
- A comment thread on every pin, so Rich and Claude can go back and forth.
- A Claude skill, shipped with the package, that teaches Claude the file format
  and how to work through pins.

### Out of scope (explicitly)

- **Editing source code.** carapin only writes pin files. Claude makes the
  changes. (Settled: keeps a clean line between what's recorded and what changed.)
  The one other file it writes is its Claude skill, installed into the site's
  `.claude/skills/pins/` (tooling, not site source; never over a user-edited copy). Added in M3.
- **Frameworks other than Astro.** Next.js, SvelteKit etc. would each need their
  own way of finding elements and their own toolbar. Not v1.
- **Generating CMS schemas.** carapin records what content Rich wants where. It
  does not turn that into a Tina (or any) schema. Every site needs a different
  CMS approach, so that step stays a normal conversation with Claude.
- **Anything outside local dev.** No production widget, no multi-user, no
  client feedback. That's what Vivid is for.
- **Structured field-definition forms.** See "Pins are free text" below.

---

## Core concept

**A pin is a comment thread attached to an element, with a status.** The first
comment is Rich's original note. Everything else is a detail of how it's placed,
shown, or stored.

The mistake to avoid is treating "tweak" pins and "CMS" pins as two different
features with two different UIs. They are the same thing: Rich points at an
element and writes what he wants. A CMS pin just says something like "image or
video, optional CTA with URL" instead of "reduce the padding". Claude can tell
the difference from the text, and a pin can carry an optional label (e.g.
`content`) to make it explicit.

## Pins are free text

Rich doesn't want defining content to be a click-heavy experience. The earlier
idea was a form with fixed field types (image, video, link, icon, repeatable
group). That's rejected for v1: it's slower than typing a sentence, and a fixed
type list would bake in one CMS's view of content.

So a pin's body is free text. Claude does the interpretation, which it's good
at, and asks when something is ambiguous.

**Context:** the current CMS lean is **TinaCMS**. That doesn't change carapin,
but it's worth knowing when Claude reads content pins.

## Pin lifecycle

- **open** — Rich created it. Nothing has happened yet.
- **review** — Claude has made the change and added a short note on what it
  did. Rich needs to look.
- **done** — Rich has checked it. Done pins are hidden by default, with a toggle
  to show them.

Claude never marks a pin done; only Rich does.

*Why three states and not two:* with only open/done, Claude would either close
pins Rich hasn't checked, or leave finished work looking untouched. "review" is
the handoff.

### Replying sends it back

The case that shaped this: Rich pins a button, "make it blue". Claude works the
pins, makes it royal blue, and moves the pin to review with a comment saying so.
Rich wanted indigo.

**Rich replies "no, indigo" and the reply moves the pin back to open on its own.**
There's no separate "send back" step. The next time Claude works the pins, it
picks the pin up again and reads the whole thread, with the latest comment as
the instruction.

- *Rejected: comment and leave it in review.* Claude only works open pins, so
  the comment would sit there unread until Rich remembered to also change the
  status. Two actions for one intent.
- *Rejected: a separate "send back" button.* Same problem, and a reply on a
  review pin always means "not right yet" in practice.
- Replying to a done pin reopens it too. Replying to an open pin just adds to
  the thread.
- *Vivid lesson:* this is the same conclusion Vivid reached with its send-back
  notification. A reply is the signal; a separate status change gets forgotten.

## Data model (entities)

- **Pin** — belongs to one page. Carries: optional label, status, where the
  element is (see "Anchoring"), created/updated times, and its comments.
- **Comment** — belongs to a pin, in order. Carries: author (`human` or `claude`; the spec first said `rich`, changed in M2 for a published package),
  text, time. The first comment is the original note; Claude's "what I changed"
  note is a comment too.
- **Page** — a URL path in the site. Owns a list of pins. One JSON file per page.

## Anchoring

How a pin finds its element again after the page changes. (Draft, to settle.)

Record several anchors, because each one breaks differently:

- **Source location** — Astro dev mode adds `data-astro-source-file` and
  `data-astro-source-loc` to rendered elements. This is the most useful anchor
  for Claude, since it points straight at the code. It doesn't identify one
  instance when a component renders in a loop (every feature card has the same
  source location).
- **CSS selector** — identifies the exact instance on the page, but breaks when
  markup changes.
- **Text snippet** — the element's visible text, trimmed. Helps a human (and
  Claude) recognise the element, and helps re-find it.

*Lesson from Vivid:* when a pin can't find its element, show it as "lost" in the
pin list rather than guessing and attaching it to the wrong thing.

### Component by default

When Rich pins one of three feature cards, the pin usually means the component,
not that one card. So Claude treats a pin as a change to the component at its
source location by default. The note overrides this ("just this one", "only on
the homepage"), and Claude also has the site's own context to go on. Both the
source location and the exact instance are recorded, so either reading is
possible. (Settled, with free text doing the rest.)

## In-page UI

Everything happens in the **Astro dev-toolbar panel**, not in popovers on the
page. The panel has room for a thread, and keeps the page itself clean. Clicking
a pin marker on the page opens that pin in the panel.

*Rejected: a popover next to the element (Vivid's approach).* It's fast for a
one-line note but cramped once pins have threads.

## Functional requirements

**Toolbar app**
- Turn pin mode on, hover to highlight elements, click to place a pin; the
  panel opens with the note input.
- Show pin markers on the page. Clicking a marker opens its pin in the panel.
- List the current page's pins, filterable by status. Done hidden by default.
- Each pin shows its thread. Rich can reply; replying to a review or done pin
  moves it back to open.
- Mark a review pin done; delete a pin.

**Storage**
- Pins are saved via the Astro dev server to `.carapin/` in the site repo, one
  JSON file per page. Committed or ignored is the site's choice; carapin doesn't
  decide.
- Changes Claude makes to the JSON show up in the toolbar without a reload.

**Claude skill**
- Explains the file format and the lifecycle.
- "Work the pins": go through open pins, read each thread, make the change,
  add a comment saying what was done, and move the pin to review.

## Non-functional requirements

- **The files are the source of truth (most load-bearing).** Claude and the
  toolbar both write to the same JSON. The dev server must re-read the file
  before every write and never hold its own copy in memory, or one side
  silently overwrites the other.
- **Zero footprint outside dev.** Nothing is injected into production builds.
- **Doesn't get in the way of the page.** When pin mode is off, markers and
  overlays must not block clicks or change layout. (Vivid lesson: overlays
  catching clicks meant for the page.)
- **The JSON is readable by eye.** Pretty-printed, stable key order, so diffs
  are clean and Claude can read it without tooling.

## Intended tech stack

- **Astro integration + Dev Toolbar App API** — the toolbar already exists in
  every Astro project, so there's no widget to inject or server to run.
- **Dev-server side via the integration's `astro:server:setup` hook** — receives
  pin writes from the toolbar and writes the files.
- **pnpm workspace:** `packages/pins` (published as `@caracode/pins`) + `playground/`
  (an Astro site with a hero, features grid and CTA to test against).

### Why not Vivid

Vivid is a hosted, multi-user feedback tool with accounts and a Convex backend.
For one person on localhost, sending notes to production and pulling them back
down adds steps and gives Claude nothing extra. carapin keeps everything in the
repo, next to the code it's about.

## Scope discipline (v1 vs later)

- **v1:** pins with comment threads, the three-state lifecycle with
  reply-reopens, per-page JSON, the Claude skill for working pins.
- **Later:** other frameworks; screenshots attached to pins; a cross-page pin
  list; a "content" helper for the CMS step.

## Open questions & to-verify

- **How markers look** on the page. A design question for the build, not a
  product one.
- **Publishing.** `@caracode/pins` is the name; confirm the scope is Rich's on
  npm before publishing.
- **Screenshots: not in v1** (settled). Claude can open the page itself, and
  screenshots add real complexity.
- **Verify at build time:** the current Dev Toolbar App API (client ↔ server
  messaging), and that the `data-astro-source-*` attributes still exist and are
  present on elements inside components.
