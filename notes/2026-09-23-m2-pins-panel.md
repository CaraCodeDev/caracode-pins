<!--
  Milestone M2 of the greenfield plan (notes/implementation-plan.md), descended
  into the notes method. Product spec: notes/spec.md. Previous: notes/2026-09-23-m1-spike.md.
-->

# M2 — Pins, threads and the panel

Status: **Spec written · next: mockup, then build** · Last updated: 2026-09-23

**State detail:** M1 proved the round trip with a provisional file shape and a
plain-text panel. M2 replaces both with the real thing: the pin file format,
the full lifecycle, threads, markers, and the panel's design. The design is done
here, not as a later polish pass, because M3 and every later bit of UI inherit it.

This is the milestone where carapin becomes usable: Rich opens the panel, pins
a dozen things with a sentence each, sees them as markers on the page, and later
reads Claude's replies and either marks them done or answers back.

---

## Core framing

One pin, three views of it. Keep them consistent, because they're the same data:

| View | Shows | Where |
|---|---|---|
| **The file** | The truth: every pin, every comment, every status | `<site>/.carapin/<page>.json` |
| **The panel** | The page's pins as a list, and one pin's thread at a time | Astro dev toolbar |
| **The markers** | Where each visible pin lives on the page | Numbered dots over the page, only while the panel is open |

And the lifecycle (notes/spec.md → "Pin lifecycle", "Replying sends it back"):

| Status | Who sets it | How |
|---|---|---|
| `open` | Rich (new pin), or automatically | Placing a pin; **any human reply to a `review` or `done` pin** |
| `review` | Claude only | Editing the file after making the change, with a comment |
| `done` | Rich only | "Mark done" in the panel |

## Decisions (locked 2026-09-23)

1. **The pin file format** (replaces M1's provisional shape; key order as written, 2-space indent, trailing newline):

   ```json
   {
     "page": "/",
     "pins": [
       {
         "id": "c27c07dc",
         "status": "open",
         "createdAt": "2026-09-23T16:23:06.990Z",
         "updatedAt": "2026-09-23T16:23:06.990Z",
         "anchor": {
           "source": "src/components/FeatureCard.astro:17:5",
           "sourceChain": ["src/components/FeatureCard.astro", "src/pages/index.astro", "src/layouts/Base.astro"],
           "selector": "body > main > … > h3",
           "text": "Traded directly with growers",
           "tag": "h3"
         },
         "comments": [
           { "author": "human", "text": "Make this bigger", "at": "2026-09-23T16:23:06.990Z" }
         ]
       }
     ]
   }
   ```

   - `label` (string) is an **optional** pin field after `status`, for things like
     `content` (notes/spec.md → "Core concept"). The format carries it and the panel
     shows it if present; **no UI to set it in M2** (Rich didn't want CMS pins to be
     click-heavy; Claude or a hand edit can add it).
   - **`author` is `"human"` or `"claude"`**, not `"rich"`. The spec's data model said
     `rich`; the package is going on npm, so the neutral word. Same meaning.
   - The anchor is grouped under `anchor` so the lifecycle fields read first in a diff.
   - **No migration from M1's shape.** Nothing real was ever pinned; delete spike files.
2. **Reply rules.** A human comment on a `review` or `done` pin sets it to `open`.
   A human comment on an `open` pin leaves it `open`. A claude comment never changes
   status (Claude sets `review` itself when it edits the file). Every write updates
   `updatedAt`.
3. **Done from any status.** "Mark done" is offered on `review` pins prominently and on
   `open` pins as a quieter action ("never mind" is a real case). Done pins are hidden by
   default; a toggle shows them. There's no separate "reopen" button: replying reopens.
4. **A pin needs a note.** Clicking an element in pin mode opens a composer in the panel
   showing what was picked (tag, text, source location). The pin is written only when
   Rich saves a non-empty note. **Cmd/Ctrl+Enter saves, Escape cancels the composer.**
   After saving, **pin mode stays on** so a quick pass of a dozen tweaks doesn't need a
   click per pin to re-enter it; Escape with no composer open leaves pin mode.
5. **Delete asks once, inline.** Delete turns into "Delete pin?" confirm/cancel in place.
   No browser `confirm()` dialogs.
6. **Markers exist only while the Pins panel is open.** With the panel closed there is
   nothing of carapin's on the page at all, which settles notes/spec.md → "Doesn't get in
   the way of the page" outright. With the panel open, markers are small numbered dots
   pinned to their element; **only the dots take clicks, never the layer around them**.
   Clicking a dot opens that pin's thread. Markers follow the current status filter.
7. **Pin numbers are stable**: a pin's number is its position in the file (1-based),
   counting done pins too, so "pin 4" means the same pin whether or not done pins are shown.
8. **Finding a pin's element again** (notes/spec.md → "Anchoring"): try the selector; accept
   the match if its nearest `data-pins-src` has the same file as `anchor.source`. Otherwise
   look for an element whose `data-pins-src` equals `anchor.source` exactly and whose
   snippet equals `anchor.text`; take it if exactly one matches. **Otherwise the pin is
   lost**: shown in the list with a "lost" mark and its recorded text and source, no
   marker. Never attach a pin to a guess.
9. **Pin mode blocks keyboard activation too.** Enter and Space keydowns aimed at the page
   are blocked while pin mode is on, as mouse/pointer events already are (closes M1's
   Watch-out). The composer's own inputs and the toolbar are exempt.
10. **The panel is a right-docked drawer, not the default bottom window.** The default
    `astro-dev-toolbar-window` is max 480px tall and sits over the middle of the page,
    covering what's being pinned. The drawer is full height, docked right, roughly
    380–420px wide; the page stays visible and scrollable to its left. The M0/M1 findings
    say the window's styles are overridable and the canvas is unconstrained. Exact width,
    type and colour come from the mockup.
11. **The panel shows the current page's pins only.** Cross-page lists are "Later"
    (notes/spec.md → "Scope discipline").

## Current state (what already exists)

From notes/2026-09-23-m1-spike.md → "What's built so far" (read it; this is a summary):

- **Source locations**: `data-pins-src` on plain elements, dev only
  (`packages/pins/src/vite-plugin.ts`, `src/source-attr.ts`). Unchanged by M2.
- **Capture**: `packages/pins/src/toolbar/capture.ts` — `sourceInfo`, `buildSelector`,
  `snippet`. Reuse for `anchor`, and for Decision 8's re-finding.
- **Server**: `packages/pins/src/index.ts` (`astro:server:setup`) with a per-file write
  queue, `src/store.ts` (`readPins`, `appendPin`: re-read before every write, invalid JSON
  → error to panel, file untouched), `src/pages.ts` (`pageKey`), watcher on `.carapin/`
  pushing changes. Messages in `src/types.ts` (`caracode-pins:{list,add,pins}`).
- **Toolbar app**: `packages/pins/src/toolbar/app.ts` — pin mode (window capture listeners
  on one `AbortController`, Escape keyup handling so the toolbar doesn't close the app),
  plain-text list. The pin-mode mechanics are keepers; the panel UI is replaced.
- **Tests**: vitest + happy-dom in `packages/pins/test/` (43).

---

## What's built so far (the contract)

<!-- empty at spec time -->

## Phases

### Phase 1 — The pin file and its operations  <!-- ☐ TODO -->

Everything the panel will ask the server to do, against the real format.

- [ ] Format per Decision 1, replacing the provisional one in `src/types.ts` / `src/store.ts`.
- [ ] Server operations: create pin (with first comment), reply (with Decision 2's status
  rule), mark done, delete. Each **re-reads the file, applies one change, writes it back**,
  through the existing per-file queue. Operations name pins by `id`; a missing id is an
  error sent back, not a crash.
- [ ] A file Claude or Rich edits by hand in the documented format is read correctly,
  including unknown extra fields (kept on write, not dropped) and a missing optional `label`.
- [ ] Tests for every operation and every Decision 2 transition, plus: unknown fields survive
  a write; a hand edit between two operations survives.

*Files:* —

### Phase 2 — Panel and markers, wired  <!-- ☐ TODO -->

All the behaviour, structurally complete. Looks plain; Phase 3 makes it right.

- [ ] Right-docked drawer (Decision 10) with: pin-mode toggle; the list of the page's pins
  (number, status, first line of the first comment, lost mark), filtered by status with
  done hidden by default (Decisions 3, 7); a pin's thread view (all comments, author and
  time, label if any, source location) with a reply box, Mark done, Delete (Decision 5).
- [ ] Composer flow per Decision 4.
- [ ] Markers per Decision 6, re-found per Decision 8, repositioned on scroll/resize and
  after the page's layout changes. Clicking a marker opens its thread; selecting a pin in
  the list highlights its element and scrolls it into view.
- [ ] Keyboard blocking per Decision 9.
- [ ] External edits (the watcher) update the list and an open thread in place without
  losing a half-typed reply.

*Files:* —

### Phase 3 — Visual pass  <!-- ☐ TODO · build: fable -->

The panel and markers look and feel right. Establishes carapin's design language.

*Mockup:* `notes/mockups/m2-panel.html` — authoritative for layout, hierarchy, the set of
states (list, thread, composer, empty, lost, done-shown, delete-confirm, error) and the
spacing/type/colour tokens; illustrative for copy and sample data.

- [ ] Drawer, list, thread, composer, markers and all states match the mockup.
- [ ] Hover, focus and pressed states; keyboard focus is visible throughout.
- [ ] Sits comfortably next to Astro's own toolbar styling (dark), without copying it.

*Files:* —

---

## Exit verify (milestone M2)

From notes/implementation-plan.md → M2: *place three pins, reply to one, mark one done (it
disappears, and comes back with the toggle), and delete one. Hand-edit a pin in the JSON to
`review` with a `claude` comment: the panel shows it live, and replying moves it back to open.
Change the page's markup so one pin's element disappears, and it shows as lost.*

1. `pnpm -r typecheck`, `pnpm -r build`, `pnpm --filter @caracode/pins test` clean; production
   grep of `playground/dist` for `data-pins-src|caracode` → nothing.
2. Panel closed → no carapin elements in the page's DOM outside the toolbar.
3. Open Pins, enter pin mode, click the hero heading, type "Tighten this", Cmd+Enter → pin 1,
   status open, marker "1" on the heading. Still in pin mode: pin the second feature card's
   title ("Bigger") and the CTA band button ("Indigo") → pins 2 and 3. File matches Decision 1.
4. Escape leaves pin mode. With pin mode on, Enter on a focused link does not navigate.
5. Reply "and bolder" on pin 2 → two comments, still open.
6. Mark pin 1 done → it disappears from the list and its marker goes; toggle "show done" →
   it's back, still numbered 1.
7. Delete pin 3 → inline confirm → gone from list, marker and file.
8. Hand-edit pin 2 in the file: `status: "review"` plus a `{"author":"claude",…}` comment.
   → within a couple of seconds the open panel shows it in review with Claude's comment.
   Reply "not quite" → status `open` in the file, three comments.
9. Edit `playground/src/components/FeatureCard.astro` so the card title isn't an `h3` inside
   that structure (e.g. remove the title element) → pin 2 shows as lost, no marker. Revert.
10. Close the panel → markers gone; clicking the CTA navigates normally.
11. **(HUMAN)** The drawer, list, thread and composer look right and feel quick for a pass of
    a dozen pins.
12. **(HUMAN)** Markers sit on their elements and stay put when scrolling.

---

## Watch-outs / known limitations

- **Port 4321 is Rich's other project.** Never touch it. Stop only what you start.
- **Toolbar code has no HMR**; reload the browser after package edits.
- **Shadow DOM.** The panel lives in the toolbar's shadow root; markers live over the page.
  Pin mode must ignore both, and markers must not be picked up by pin mode's hover.
- **Keep a half-typed reply or composer note when a file-change push arrives.** Re-render
  around the input, don't blow it away.
- **Layout shifts move markers.** Images loading, fonts swapping and the page's own
  animations all move elements after first paint.
- **Style-only HMR is coarser for `.astro` files** (M1 Watch-out). Accepted.

## Open questions / decide during build

- **Marker placement** — top-left corner of the element's box, nudged inside the viewport.
  If two markers would overlap exactly (same element pinned twice), offset the later one.
- **Drawer width** — follow the mockup; if it proves too cramped for threads in real use,
  widen within 380–440px and note it.

## Deferred / out of scope

- Setting `label` from the UI → later, if Rich asks.
- Cross-page pin list, screenshots, other frameworks → notes/spec.md → "Scope discipline".
- The Claude skill → M3.
