# Frozen framing comparison

24 calls: eight cases × three arms, one attempt each, no rerolls. Arm order rotates
across cases. Baseline is the request builder from GitHub commit
b68f10c557bb102b972572d1b2f547ab79b6ac74, copied verbatim into baseline.ts.

- Baseline: old prompt, JSON-string evidence and all properties in requirements.
- Prompt-only: new ordered decision policy, otherwise identical baseline input.
- Framed: new policy, same evidence as an object, and diagnostic properties moved
  out of hard requirements into diagnostics. No facts, candidates or preferences added.

The last comparison bundles structured serialization and property separation. It
cannot establish which component causes any difference. The legacy input deliberately
reproduces the ambiguous practice of calling diagnostics requirements while saying
they are nonmandatory in priorities; prompt-only may make that ambiguity worse.
There is no hidden user grant: authority is supplied data, not authenticated consent.

Two retry preference conditions and the API validity case are development regressions
adapted from observed failures, not holdouts. Three sorting cases are fresh and use
executed JavaScript array operations; retry/API observations come from the earlier
executed disposable Python fixtures. The bottleneck and private-SLA controls are
synthetic engineering scenarios, not real profiling or benchmarks. Cases are correlated.
Expected recommendations and each candidate/property relation are frozen in fixtures.

The actual local explicit tool is captured; only native inference goes to the host.
Baseline requests replace only its inference payload. This is not a genuine installed
tool dispatch evaluation and does not modify global installation. Output warnings and
nextStep are deterministic application behavior, not model reasoning or new authority.

Report selection matches and all relation disagreements separately, plus selected
hard-constraint warnings versus diagnostic negatives. All raw synthetic payloads and
responses must be retained, including failures. No probability calibration, population
error rate or release-readiness claim. No actual candidate actions or human dialogs.

Run `bun run typecheck` and `bun test` first. Temporarily load runner.ts through a
project plugin; call jev_framing_eval with live:true and indexes 0–23 in groups of
three. Do not reload mid-run (attempt accounting is process-local). Remove the wrapper
afterward. No inference happens at import. Saved results support offline reproduction.
