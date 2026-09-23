<!--
  SPEC / LIVING PLAN DOC TEMPLATE
  Method: /Users/rich/NothingNotes/Research/Claude/notes-planning-method.md
  Copy to notes/<YYYY-MM-DD>-<feature>.md (ISO date prefix so files sort
  chronologically), replace every <…>, delete sections that don't apply. Order reads
  top-to-bottom: orient me → don't rebuild this → here's the model → here's the plan
  → here's what's settled → here's what to watch. This doc is BOTH the spec and the
  build log, written for a cold reader who never saw the conversation.
-->

# <Feature name> — <one-line qualifier>

Status: **<ONE line: which phase is in flight / the single most important state fact —
the answer to "what do I do next">** · Last updated: <YYYY-MM-DD>

**State detail:** <the nuance that would otherwise bloat the status line — what's done,
what's parked vs. pending, deploy stance, deliberate deferrals. Omit on a small feature.>

<The motivating scenario in 1–3 sentences: the concrete pain that forces this work.
"The flat sidebar doesn't survive 15 projects across 4 teams." Make it visceral.>

---

## Core framing / the reframe

<The single most important mental model to keep straight — the thing that, if
conflated, makes the whole feature messy. Often a small table naming the concepts and
how they differ. This is the most valuable section; spend on it.>

| Concept | What it affects | Owner | Lives in | Lifetime |
|---|---|---|---|---|
| … | … | … | … | … |

## Decisions (locked <YYYY-MM-DD>)

<Numbered. Each is a settled call + the reason. Record the rejected alternative when
it's non-obvious — it stops the next session re-proposing it.>

1. **<Decision>.** <Why. What it rules out.>

## Migration / rollout stance  <!-- only if there's data/state to migrate -->

<Why you can be aggressive or must be careful. Naming this once saves re-justifying
every schema change.>

## Current state (what already exists)

<The pre-existing codebase this feature touches or reuses, with `file.ts:line` refs, so
a cold session knows what NOT to rebuild. Call out precedents and load-bearing
assumptions this feature will break.>

- **<Thing>** — <where it is> (`path/file.ts:NN`). <What it does today.>

## Data model  <!-- if schema is involved -->

```ts
<table>: defineTable({
  <field>: v.<type>(),  // <why this field exists / the subtlety>
}).index("by_<x>", ["<x>"]),
```

---

## What's built so far (the contract)  <!-- grows as phases ship; empty at spec time -->

<DISTINCT from "Current state": that's the pre-existing codebase, this is the reusable
surface *this feature* has added. A cold session reads it first. Add a line as each
phase ships; it stays visible after that phase's *Verified* prose is folded away.>

- **<Phase N — what it shipped>** — <`fn()` at `file.ts:NN`, the table/field, the exact
  rule the next phase leans on.>

## Phases

<Each phase is independently shippable and leaves the app working. Number from 0 when
there's a pure-plumbing foundation phase. A fresh session picks up the first unchecked
phase. Tag the builder per the method doc's Routing section.

Within a step, mark RULE vs. SKETCH: **bold the rule** that must hold exactly as
written; leave a suggested approach plain — a builder may adapt a sketch when the code
disagrees, but never bends a rule. Bias toward FEWER sketches: an invented signature a
builder dutifully implements is worse than no signature at all.>

### Phase <N> — <name>  <!-- ☐ TODO / ☑ DONE <date> · build: fable (omit if opus) -->

<One-line statement of what this phase unlocks.>

*Mockup:* `notes/mockups/<file>.html` — authoritative for <layout/states/…>;
illustrative for <copy/colors/sample data>.  <!-- UI phases only -->

- [ ] <Concrete, checkable task.>

*Verified <date>:* <What you observed — the before/after numbers, the log line.
"Hid project → cards 66→62 on board AND its Upcoming card vanished; console clean;
typecheck clean." Vague "tested, works" is worthless. Note anything only checkable by hand.>

<!-- Once a LATER phase ships on top of this one, wrap this note in <details> so the
     live plan stays scannable; the checklist + Files stay visible. -->

*Files:* `path/a.ts`, `path/b.tsx`.

---

## Resolved decisions (<date>)  <!-- follow-ups settled mid-build -->

1. **<Question> → <answer>.** <Why.> (Phase <N>)

## Watch-outs / known limitations

<Edge cases anticipated at spec time, gotchas hit during the build (append as they
happen), and limitations accepted on purpose so the next session doesn't flag them as
bugs. An anticipated edge case that matters shouldn't live only here — give it a
decided behavior and a verify step too.>

- <Anticipated edge case + the decided behavior (+ which verify step checks it).>
- <Gotcha + the fix.>
- <Accepted limitation + why it's acceptable.>

## Open questions / decide during build

<Keep this SHORT. What legitimately remains: feel calls that can only be judged live.
Those get a decision RULE, not a lean — "if X, do A; otherwise B" — so the build
session executes a procedure instead of making a judgment call. "Needs a decision
before coding" items shouldn't survive the spec session.>

- **<Question>** — <options + the decision rule for resolving it live>.

## Deferred / out of scope

- <Thing> — <why deferred>.

## File-reference appendix  <!-- handy on big features -->

- <Area>: `path/file.ts` — `<fn>` (NN), `<fn>` (NN).

