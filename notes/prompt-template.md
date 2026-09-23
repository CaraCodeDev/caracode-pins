Build **Phase <N> — <name>** of the **<feature>** feature. Phases <0–N-1> are already
shipped and committed on `<branch>`.

Read `notes/<feature>.md` end to end first — it's the spec + build log. Your phase is
the "### Phase <N>" section; *Core framing* and *Decisions* are the locked context.
<Any repo-specific must-reads: backend guidelines, CONTRIBUTING, a config file.>

**Already built — don't rebuild:** <one line per prior phase, naming the helpers to
REUSE with paths.>

**Scope.** <What must be true when this phase is done. Inline the locked decisions that
govern it, bolded rules bolded. Name real existing surfaces to reuse (`fn()` at
`file.ts:NN`) — facts, not guesses. If you don't know the shape, say what the code must
DO and let the builder look.>

<*Mockup (UI phases):* `notes/mockups/<file>.html` — read it before writing UI code.
Authoritative for <…>, illustrative for <…>. On conflict with the text above, the text
wins — flag it, don't silently pick.>

<NOTE: any nearby concept that is SEPARATE and must be left alone — conflating new work
with an adjacent system is the most common way a session breaks things.>

**Watch-outs:** <known traps for this phase.>

**Verify.** <Numbered action → expected observation, executable mechanically. Include
the edge-case checks from the spec's Watch-outs. Prefix steps only a human can judge —
visual feel, animation quality, copy tone — with **(HUMAN)**; orchestrated runs collect
those onto Rich's end-of-run browser checklist. State the budget and scale it to the
phase: the orchestrator re-runs all of this anyway, so exhaustive self-audit pays twice
for one answer. Logic phase: the commands plus the cheap observable checks. **Pixel
phase: typecheck/lint clean and it compiles — that is the whole budget, and no browser
driving, no screenshots, no iterating against your own rendered output.**>

**Workflow.** Do NOT commit, do NOT edit the spec doc — the orchestrator owns both. If
reality contradicts this brief — a file isn't where it says, an assumption is false, a
rule can't be implemented as written — **stop and report back; don't improvise a
reinterpretation.** End with a structured report: what you built, files touched
(`file.ts:line`), surprises, the verify you ran within budget + what you observed, a
proposed contract line, a proposed *Verified* note. Say what you did NOT check — that's
information, not a failure.
