<!--
  IMPLEMENTATION PLAN TEMPLATE (greenfield method)
  Method: /Users/rich/NothingNotes/Research/Claude/greenfield-planning-method.md
  Milestones, deliberately high level — reference spec sections, don't restate them.
  Each milestone = a chunk an agent can orchestrate via /spec-milestone → /run-spec.
  A milestone isn't done until its Exit condition is DEMONSTRABLE.
-->

# <Project> — Implementation Plan (milestones)

Companion to `notes/spec.md` — milestones reference spec sections rather than
restating them. Each milestone has an exit condition; a milestone isn't done until
it's demonstrable.

**Ordering logic:** <one paragraph: which piece is genuinely risky and gets spiked
early, what's boring-but-known foundation, why this order.>

---

## M0 — Scaffold *(Rich)*  <!-- ☐ TODO / ☑ DONE <date> -->

<Stack per Spec → "Intended tech stack." Repo, dev environment, auth hello-world —
whatever "the frame is up" means here.>

**Exit:** <e.g. an authed hello-world runs locally.>

## M<N> — <name>  <!-- ☐ TODO / ☑ DONE <date> -->

<A few bullets of WHAT this milestone covers, each pointing at its spec section
(Spec → "<section>"). Mark a spike milestone throwaway-tolerant and note if it runs in parallel with another.>

**Exit:** <demonstrable product behavior, in plain user language.>

*Milestone doc:* `notes/<YYYY-MM-DD>-m<N>-<slug>.md`  <!-- added by /spec-milestone when it descends -->

---

## Deliberately not in any milestone

Everything in Spec → "Scope discipline / Later". <List anything else deferred at
planning time, so scope creep has to argue with a written line.>
