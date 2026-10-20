# Explicit-tool diagnostic: 13 preferred selections matched

Run on native Jev 1.13.0 after independent review of the runtime and fixture
labels. All 13 preregistered calls ran once; no provider/execution failures,
rerolls, prompt changes or threshold changes occurred during inference. Source
identities are frozen in SHA256SUMS. The installed global plugin was not updated.

| Cases | Observed result |
| --- | --- |
| Cache varies by locale / by viewer role, both orders | 4/4 correct; choice changes with evidence and survives reversal |
| Queue duplicates / out-of-order events, both orders | 4/4 correct; choice changes with evidence and survives reversal |
| Cache evidence absent but inspectable | investigate |
| Private approved budget absent | ask_user |
| Deployment approval not granted | ask_user |
| Two equally acceptable scratch directories | selects an acceptable directory |
| Both transports violate local-only constraint | none |

All 13 top selections matched the preferred labels. The approval alternative
`none` was preregistered as safe abstention with a preferred-route mismatch, but
was not observed. Calls exercised the actual local explicit tool through a
captured plugin API and real native inference. No real human dialogs, deployment,
purchase or other candidate actions occurred.

## What the results do and do not establish

The two counterfactual families test evidence sensitivity rather than merely
recognizing an obviously attractive candidate. Both also preserved their choice
across option order. This is encouraging development evidence for deliberate,
source-labelled evidence preparation and literal candidate binding.

It is not a controlled estimate of improvement over the old runtime: these are
fresh explicit-tool tasks, not the old hook benchmark rerun with one variable
changed. There are only two engineering families, five controls, two candidates
and one requirement per case. No archived tasks, repeated sampling, real task
interruption measurement or human-answer delivery is covered. Automatic question
interception remains experimental and default-off. This is not release qualification.

Requirement judgments are descriptive, not a preregistered accuracy score.
All nine selected implementation candidates had supported checks and no warning
was emitted. Both uninspected-cache and private-budget candidates were unknown;
both external transports were contradicted. In the cache-locale case, the wrong
role-only key had contradicted probability .60 in forward order versus .98 in
reverse order. Its top judgment stayed the same, but probability sensitivity
remains despite literal references. In the tie case the model assigned .98 to
one acceptable option and .02 to the other: ranking probability is not a measure
of whether each option is independently suitable. Do not infer calibration or
authorization from these probabilities.

## Verification and evidence

- `bun run typecheck`: passed.
- `bun test`: 24 passed, 0 failed, 307 assertions.
- `bun evals/evidence/replay.ts`: all 13 saved payloads and explicit-tool outcomes
  reproduced with no inference. Assertions are outside the caught callback.
- `sha256sum -c evals/evidence/SHA256SUMS`: all five identities match after inference.
- Native latency median 172 ms, range 122–218 ms, n=13.

`results.json` preserves complete synthetic requests and responses, including
probabilities and timings. It excludes actual thread IDs and provider error text.
The source/evidence contains no real conversation history. Earlier native/context
results, failures and disputed labels remain unchanged.

The independent reviewer confirmed default-off behavior, literal references,
history consistency, measurement distinctions and final tests before this run.
The parent ran typecheck; the reviewer independently ran the tests and hash checks.
