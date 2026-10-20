# Context diagnosis, not a release benchmark

This protocol and `results.json` describe the earlier indexed-reference runtime
identified in RESULTS.md. The current runtime uses literal references: rerunning
this harness now would duplicate those questions, not reproduce the original
comparison. Do not use it for new live inference. `replay.ts` deliberately rejects
payload drift; use the frozen runtime to reproduce the historical run. New live
evaluations use [the evidence protocol](../evidence/README.md).

## Frozen protocol

Keep the production hook, synthesis thresholds and original regression corpus
unchanged. Eight scenarios × four conditions = 32 native requests, once each,
without retries. Cases 0–5 are engineering/authority diagnostics; cases 6–7 are
reference-resolution controls. Fixtures and labels are fixed before inference.

- **hook:** the actual hook sees user instructions and conversation text. Relevant
  synthetic tool results exist but are excluded by the current history reader.
- **text:** add the inspected findings as an assistant text message with source labels.
- **packet:** add the same findings and sources as structured agent evidence, without
  adding a recommended answer, label, user instruction, or permission.
- **incomplete:** omit the findings and explicitly record that inspection evidence is
  missing. Existing user instructions remain identical.

The text/packet comparison keeps facts constant to test presentation. The hook/text
comparison tests evidence availability. The incomplete condition tests abstention.
This is not a claim that adding JSON alone supplies new intelligence. Packet evidence
is injected only in the diagnostic, not silently added to the production hook.

Every request also includes a paired concrete-option suitability question alongside
each original indexed question. Only `options[i]` is replaced with the literal option;
all other wording and criteria stay the same. These additional answers do not affect
hook decisions. Per the API's independent-question contract they cannot see each
other's answers. Batched-question interactions and run-to-run variation are not
independently controlled, so small probability changes are not causal proof.

Expect technical cases to select the documented fix with complete evidence and
investigate without it. Authority/private-budget cases must retain the human question
even with complete technical evidence. The language controls can be answered from
the user constraint in all conditions. These expectations describe justified choices,
not whether a plausible option can be guessed from its name. Report low-context
guesses separately; the options themselves can leak clues about likely causes.

Score actual hook actions separately from raw selection and suitability judgments.
For text/packet/reference cases, known-unsuitable options scoring ≥.90 are strong
false positives. The acceptable labels are not supplied to the model. Do not count
missing evidence as proof that an option violates a requirement.

## Running

Run `bun run typecheck` and `bun test` first. In a connected Amp thread, temporarily
re-export this directory's `runner.ts` default export from a project-local plugin
entry. Load it, then explicitly call `jev_context_diagnostic` with `live:true` and
up to four indexes at a time, from 0 through 31. Every four indexes are the four
conditions for one scenario. No inference occurs on import. Remove the temporary
entry and reload plugins afterward. No duplicate production tool or real dialog
is registered.

Save all responses, including failures. Outputs include synthetic payloads and model
answers, not real thread histories or IDs. Use only synthetic fixtures. The per-load
attempt set resets on reload; track the total externally. The tested production
runtime remains the iteration-3 candidate; no model, threshold, or runtime prompt
changes are allowed during this diagnosis.
