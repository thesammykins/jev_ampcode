# Structured framing: clearer diagnostics, no measured selection gain

This local experiment made 24 native calls to Jev 1.13.0: eight cases across
three arms, one attempt per case and arm. There were no provider failures or
rerolls. All synthetic inputs, payloads, responses and outputs are in
`results.json`; labels and scope are documented in `README.md` and `fixtures.ts`.

| Arm | Preferred selection | Property relations | Calls with warnings |
| --- | --- | --- | --- |
| Published baseline | 7/8 | 27/28 | 1 |
| New prompt only | 6/8 | 27/28 | 0 |
| Structured framing and separate diagnostics | 7/8 | 27/28 | 0 |

All three arms chose lookup when the evidence supported safe replay and the
stated preference favored replay. Prompt-only also chose copy-sort despite the
in-place preference; baseline and structured framing selected in-place.
Baseline's in-place choice produced a misleading hard-requirement warning about
an optional property. Separating that diagnostic removed the warning.

The API-behavior error remained but changed form. Baseline and prompt-only
incorrectly judged that the positional call achieved the requested pagination.
Structured framing rejected that claim but incorrectly judged that input
validation failed. Matching aggregate relation counts conceal different errors.
Missing technical evidence, private context and incompatible-candidate controls
returned their expected deferrals.

## Compatibility change after the run

The final implementation retains the published recommendation policy for string
evidence without a `diagnostics` field. Structured evidence or an explicit
diagnostics array opts into the ordered policy. This avoids applying the observed
prompt-only regression to existing callers; it does not fix the underlying model
errors. The runner explicitly reconstructs the experimental prompt-only arm.
Offline replay reproduces all 24 original payloads and complete tool outcomes.

`LIVE-SHA256SUMS` preserves the hashes frozen before inference. It intentionally
does not match the subsequently updated `decision.ts` and runner. `SHA256SUMS`
records the final runtime, fixtures, runner, baseline and saved evidence separately.
Historical results and labels have not been rewritten to improve the scores.

## What this establishes

Structured framing makes authority, observations, assumptions and unknowns
explicit, and separates optional diagnostics from constraints. Tool outputs now
identify candidate advice, constraint review or deferral without granting
authorization. The experiment does not show improved top-choice accuracy.

These are eight correlated engineering cases, including development regressions,
not a held-out release benchmark. Framing combines structured serialization and
property separation, so their individual effects are unresolved. Calls used the
actual local tool handler with native inference, not installed-tool dispatch.
No real actions, human dialogs, authorization enforcement or reduction in task
interruptions were tested. Probabilities are not calibrated success estimates.

## Offline verification

- `bun run typecheck`: passed.
- `bun test`: 28 passed, 0 failed, 468 assertions.
- `bun evals/framing/replay.ts`: 24 payloads and tool outcomes reproduced without inference.
- `git diff --check`: passed.

The new framing remains a local change; this evaluation does not publish or
install it globally.
