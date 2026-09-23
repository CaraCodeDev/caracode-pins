<!--
  IMPLEMENTATION PLAN (greenfield method)
  Method: /Users/rich/NothingNotes/Research/Claude/greenfield-planning-method.md
  Milestones, deliberately high level — reference spec sections, don't restate them.
  Each milestone = a chunk an agent can orchestrate via /spec-milestone → /run-spec.
  A milestone isn't done until its Exit condition is DEMONSTRABLE.
-->

# carapin — Implementation Plan (milestones)

Companion to `notes/spec.md` — milestones reference spec sections rather than
restating them. Each milestone has an exit condition; a milestone isn't done until
it's demonstrable.

**Ordering logic:** the only real unknown is the Astro side: whether the Dev
Toolbar App API can do what the spec needs (a panel with room for threads,
client ↔ dev-server messages, hearing about file changes on disk) and whether
`data-astro-source-*` attributes land on the elements we'd click, including
inside components. So M1 is a spike that proves the full round trip (click an
element, get a file written with its source location) before any real UI gets
built. If it fails, the spec's "Anchoring" and "In-page UI" sections change, and
we'd rather know on day one. M2 is the product itself, and it front-loads the
panel's look along with the behaviour, since every later bit of UI inherits it.
The Claude skill (M3) comes after the file format has been used for real in M2,
so the skill describes a format that's settled. Publishing is last.

---

## M0 — Scaffold  <!-- ☑ DONE 2026-09-23 -->

Small enough for Claude to do rather than Rich.

- pnpm workspace: `packages/pins` (published as `@caracode/pins`) and
  `playground/` (Spec → "Intended tech stack").
- The playground is an Astro site with a homepage that has a hero, a features
  grid rendered in a loop from one card component, and a CTA section. That
  matches the spec's examples and gives us a repeated component to test
  "Component by default" against.
- The integration is registered in the playground and adds an empty toolbar app.

**Exit:** `pnpm dev` runs the playground, and the Astro toolbar shows a carapin
icon that opens an empty panel.

*Milestone doc:* `notes/2026-09-23-m0-scaffold.md`

☑ 2026-09-23: exit demonstrated (Pins panel opens on the playground at 4358). Found: Astro 7.3.4 emits no `data-astro-source-*` attributes; M1 now has to supply source locations itself.

## M1 — Spike: element to file round trip  <!-- ☑ DONE 2026-09-23 -->

Throwaway-tolerant. Proves the risky parts before M2 builds on them.

- Hover-highlight and click-to-select an element on the page (Spec →
  "Functional requirements / Toolbar app").
- Capture the three anchors for the clicked element (Spec → "Anchoring"),
  including on a feature card rendered inside a loop.
- Send it to the dev server and write it to `.carapin/` (Spec → "Storage").
- Edit the JSON by hand and confirm the panel hears about it without a reload.
- Write down what the toolbar API actually allows (panel size, messaging, file
  watching). If anything in the spec turns out to be impossible, stop and flag it.

**Exit:** click the second feature card in the playground and a JSON file
appears in `.carapin/` with the card component's file and line, a selector for
that exact card, and its text. Editing that file by hand updates the panel.

*Milestone doc:* `notes/2026-09-23-m1-spike.md`

☑ 2026-09-23: exit demonstrated (card 2's title → `FeatureCard.astro:17:5` in `.carapin/index.json`; hand edit reached the panel live). Source locations come from carapin's own dev-only transform using compiler-rs `parse()`.

## M2 — Pins, threads and the panel  <!-- ☐ TODO / ☑ DONE <date> -->

The product. Includes the panel's visual design, not as a polish pass at the end.

- The pin file format: pins, comments, statuses, anchors (Spec → "Data model",
  "Anchoring"). Pretty-printed, stable key order, re-read before every write
  (Spec → "Non-functional requirements").
- Place a pin with a note; markers on the page; click a marker to open it in
  the panel (Spec → "In-page UI").
- Pin list filtered by status, done hidden by default (Spec → "Pin lifecycle").
- Threads, replying, reply-reopens, mark done, delete (Spec → "Replying sends
  it back").
- Lost pins shown as lost (Spec → "Anchoring").
- Markers never block the page when pin mode is off.

**Exit:** on the playground, place three pins, reply to one, mark one done
(it disappears, and comes back with the toggle), and delete one. Then hand-edit
a pin in the JSON to status `review` with a `claude` comment: the panel shows it
live, and replying moves it back to open. Change the page's markup so one pin's
element disappears, and it shows as lost.

## M3 — The Claude skill  <!-- ☐ TODO / ☑ DONE <date> -->

- A skill shipped in the package that explains the file format and the
  lifecycle, and teaches "work the pins" (Spec → "Functional requirements /
  Claude skill").
- A way to get the skill into a site's `.claude/` when the package is
  installed. How exactly is for this milestone's doc to settle.
- The skill follows "Component by default" and never marks a pin done.

**Exit:** on the playground, pin the CTA button "make it blue" and pin a feature
card "add an icon above the heading". Tell Claude "work the pins": both change,
both move to review with a comment saying what was done, and the icon lands on
every card, not just the one pinned. Reply "no, indigo" on the button; it
reopens, and the next "work the pins" fixes it.

## M4 — Publish and first real site  <!-- ☐ TODO / ☑ DONE <date> -->

- Publish `@caracode/pins` to npm (Spec → "Open questions / Publishing").
- A README: install, what the pins are, how to invoke the skill.
- Install it in one of Rich's real Astro sites and do a real pass.

**Exit:** a real Astro site installs `@caracode/pins` from npm, and Rich does
one full pass on it: pins placed, worked by Claude, reviewed and marked done.

---

## Deliberately not in any milestone

Everything in Spec → "Scope discipline / Later": other frameworks, screenshots,
a cross-page pin list, a CMS helper. Also not planned: any setting or
configuration option, since the spec says installing it is the only setup.
