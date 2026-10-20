# Jev for Amp

Bounded decisions and routine question routing using Amp's native
[`amp.ai.decide(...)`](https://ampcode.com/docs/customize/decision-models) API.
Jev returns typed choices and probabilities, not research, explanations, proof,
or permission to act.

If my Jev plugin for Amp is useful to you, you can support its development.

<a href="https://ko-fi.com/sammykins/tip"><img src="https://cdn.prod.website-files.com/5c14e387dab576fe667689cf/670f5a01c01ea9191809398c_support_me_on_kofi_blue.avif" alt="Support Jev plugin for Ampcode on Ko-fi" height="32"></a>

## What it does

- **`jev_evaluate`** compares 2–6 supplied alternatives against evidence, stated
  priorities, and up to three independent requirements.
- An **`agent.start` hook** encourages the agent to resolve routine choices from
  available context, investigating technical facts instead of asking the user.
- An **experimental, default-off `tool.call` hook** can intercept `ask_user_choice`. Routine, reversible choices
  supported by user context can return clearly labeled model advice. Missing
  technical evidence redirects the agent to investigation. Missing consequential
  user-only context, explicit approvals, and explicit requests to personally answer
  questions retain the original human dialog.

By default the built-in question tool is untouched: no history read or inference
occurs on its calls. Explicit `jev_evaluate` and agent guidance are the production
path. To opt into experimental interception, set the Amp configuration key
`"jev.experimentalQuestionRouting": true`. Only boolean `true` enables it; disabling
it takes effect on the next call. This installation does not change that setting.
The built-in tool's normal usage restrictions still apply.
In experimental mode, uncertainty, provider/context errors, and oversized or absent user context
retain the dialog. When routing permits an agent decision and every offered option
is clearly unsuitable, the agent is redirected to repair the options instead.

Automatic answers require **≥0.90** total probability over options independently
judged acceptable at **≥0.90** each. A joint Choice ranks options alongside asking
the human, investigating, and repairing the options. A separate question-kind
judgment retains the human question when approval probability exceeds **0.10**.
A ranking tie does not itself require a human preference. A winning investigation
outcome above **0.50** suggests read-only inspection within existing authority; it
does not synthesize an answer or authorize a fix. This lower investigation threshold
reflects a different consequence, not equivalent confidence in an automatic answer.
These are initial thresholds, not calibrated safety guarantees. The model can
misclassify questions. Synthesized answers contain `source: "decision_model"`
and `userAnswered: false`; they are **never user consent**. Existing permission
and approval rules remain mandatory. This plugin is not an authorization boundary.

Make obvious reversible choices directly. Use Jev for a bounded unresolved choice,
not reassurance, open-ended research, inventing preferences, or correctness proof.
Do not repeat unchanged questions to obtain endorsement.

## Migration from the direct TypeSafe API pilot

This replaces the old credential-based plugin rather than adding a second tool.

- No `JEV_KEY` or `TYPESAFE_API_KEY` is needed by the installed plugin. Requests
  use Amp's thread-scoped provider routing and default TypeSafe Jev model.
- `jev.model` no longer configures the plugin. Amp resolves its default Jev version;
  the exact responding model is returned. There is no cross-provider fallback.
- The `jev_evaluate` input schema, candidate mappings, recommendation and requirement
  checks remain. Direct-provider `usage` and `elapsedMs` fields are no longer returned.
- Automatic question routing and conversation reading are **new behavior**. Review
  this before updating an existing installation that was advisory-tool-only.
- No private capture companion or `jev_record_outcome` tool is included.

Old credentials are not read, changed, or deleted by the plugin. Do not install
this alongside another plugin registering `jev_evaluate`.

## Installation

Requires a current Amp release supporting `amp.ai.decide`, `thread.messages`, and
the `tool.call` synthesized-result API. Development types are pinned in `package.json`.
Only **`index.ts`, `decision.ts`, and `history.ts`** are needed at runtime; there are no runtime
package dependencies. A GitHub checkout is source, not an automatically installed
global Amp plugin.

### Copy this prompt into Amp to install

```text
Install the native Jev plugin from https://github.com/thesammykins/jev_ampcode
for this project only. Load building-plugins and inspect the source and current
plugin API. Clone outside .amp/plugins, record the reviewed revision, and run
bun install --frozen-lockfile, bun run typecheck, and bun test.

Copy only index.ts, decision.ts, and history.ts into .amp/plugins/jev/, preserving imports.
Do not overwrite an existing installation without showing me what differs.
Do not copy tests, evals, or private development helpers. Reload the plugin using
Amp's supported mechanism. Confirm jev_evaluate is its only registered tool and
that question interception is disabled by default. Do not enable experimental routing.

Use Amp's native decision API; do not configure a separate TypeSafe key. Do not
change approval rules or publish anything. Report any missing API capability.
```

For a global User Plugins installation, request that scope instead. Use Amp's
global plugin-repository workflow and obtain approval before publishing. New
threads load a published update automatically; existing threads need a reload.

## Calling and interpreting `jev_evaluate`

Supply one decision, why this call could change the plan, evidence, priorities,
a pre-advice `baseline` candidate ID (or `undecided`), alternatives, and requirements.
Baseline and whyNow are visible in the tool call but are not sent to Jev.
Within evidence, distinguish user constraints, source-labelled inspected observations,
assumptions and missing facts. Technical observations do not establish permission.
Prefer the structured form below. `authority` records existing scope; it is not
authenticated approval. Unknowns owned by `agent` are inspectable technical facts;
those owned by `human` require private context or approval. Keep the serialized
evidence under 12,000 characters.

`requirements` are hard constraints. `priorities` are preferences, most important
first, among eligible candidates. `diagnostics` assess optional properties without
making them vetoes or ranking preferences. Requirements and diagnostics together
may contain at most three properties (at most 19 native questions with six candidates).
Existing text evidence without a diagnostics field retains the published recommendation
policy; structured evidence or an explicit diagnostics array opts into the ordered policy.

```json
{
  "decision": "Choose the report status update channel.",
  "whyNow": "Both paths have been measured; the choice changes dependencies.",
  "evidence": {
    "authority": "Recommend a local implementation; do not purchase a service.",
    "observations": [
      { "source": "Timing checks", "finding": "Polling updates within 30 seconds; managed push within one second." },
      { "source": "Service inventory and pricing", "finding": "Polling uses the existing endpoint; managed push adds a vendor bill." }
    ],
    "assumptions": [],
    "unknowns": []
  },
  "priorities": "The user accepts 30 seconds and prioritizes no new service.",
  "baseline": "poll",
  "candidates": [
    { "id": "poll", "description": "Poll the existing authenticated endpoint." },
    { "id": "push", "description": "Add the managed push service." }
  ],
  "requirements": ["No new paid service is needed."],
  "diagnostics": ["Updates arrive within one second."]
}
```

The response maps `option_0`, `option_1`, etc. to candidate IDs. The recommendation
includes probabilities for each option plus `ask_user`, `investigate`, and `none`.
Each requirement gets independent supported/contradicted/unknown judgments for
each candidate. A selected candidate with a non-supported hard requirement produces
a warning and `nextStep.kind: "review_constraints"`, listing those requirements.
Otherwise it returns `candidate_advice` with the candidate ID and supplied action.
Deferrals return `ask_user`, `investigate`, or `none` (repair the options). Diagnostic
results remain visible but do not trigger hard-constraint warnings. No new rationale
is generated. `nextStep.authorizationGranted` is always false; advice never grants
permission, even when checks agree. Unknowns remain model judgments, not proven facts.

No warning is not proof of correctness. Do not average away a hard constraint or
translate probability into “chance the implementation succeeds.” Verify the action.
Provider failures in `jev_evaluate` are errors, not fabricated advice.

## Privacy and context limits

The explicit comparison tool sends only supplied decision context. The experimental question
hook uses Amp's `thread.messages({ full: true })` to read original user-role text
across history, including before compaction, alongside the latest 20 original
conversation messages. User history is paginated from the start; assistant chatter
does not evict earlier user instructions. Tool outputs and hidden thinking are excluded.
This sends more historical user text than the previous last-20-message implementation.
Both native and export paths take the latest 20 original messages before filtering
text; tool-only messages can therefore evict recent observations. User-role text
is not authenticated human authorship: plugins can append user messages. Neither
history nor the model's question-kind judgment is an authorization boundary.
Keep real approvals outside synthesis. Amp documents `requireHuman` for plugin UI
dialogs, not for `ask_user_choice` inputs. User text can contain secrets; there is
no automatic redaction guarantee.

The hook retains the human dialog if history is empty, unavailable, exceeds 50
pages of 20 user messages, or produces a serialized state above 50,000 characters.
It never substitutes a partial history or a generated summary for missing originals.
Full history availability is a prerequisite for automatic question routing, not for
the explicit comparison tool. If the native history API fails or returns empty
history, the hook uses the documented authenticated `amp threads export` command.
It validates the thread ID and extracts conversation text only; export metadata,
environment data, tool results and thinking are never included in the decision request.
The plugin does not write the export to disk. Export text over 16 × 1024 × 1024
UTF-16 code units is rejected after capture; this is not a streaming memory limit.
The CLI must be available and
authenticated; a failure retains the dialog. This fallback was exercised in a
connected host where native full-history reads returned empty arrays.

This local candidate is **not release-qualified**. The regression targets reported
in [iteration 3](evals/native/ITERATION-3.md) are small hand-authored samples, not
population reliability estimates. A subsequent frozen [context diagnosis](evals/context/RESULTS.md)
found missing inspection evidence, position-sensitive candidate references, and an
ambiguous evaluation label. Complete evidence helped, but structured packets did
not consistently outperform ordinary text. Previous failures and original labels
remain preserved; no thresholds were lowered during this diagnosis.

After review, the default-off interception candidate matched all 13 preferred
selections in a fresh [explicit-evidence diagnostic](evals/evidence/RESULTS.md),
including counterfactual evidence and reversed options. This small tool-only run
does not establish release readiness, calibration or end-to-end task improvement.

### Native API and model gotchas

- Full-history reads returned empty arrays on the tested host; CLI export is the
  tested fallback, not a guarantee that every Amp host supplies complete history.
  Missing CLI/authentication or excessive context leaves the human question intact.
- Tool results and thinking are intentionally excluded. Summarize inspected technical
  evidence in ordinary conversation, or supply it explicitly to `jev_evaluate`.
  Do not re-ask an unchanged question hoping for higher confidence.
- Generic interchangeable options and recently revoked personal-answer restrictions
  still sometimes cause unnecessary questions. No automatic retry is performed.
- Independent judgments can be wrong or disagree. A five-option evaluation wrongly
  rated Python suitable for a JavaScript-only requirement, though the joint Choice
  selected JavaScript correctly. Treat checks as advice and verify the chosen action;
  neither option checks nor the question-kind classifier enforce authorization.
- The observed native alias returns Jev 1.13.0. A provider preview release does not
  imply Amp exposes that version or a version-selection parameter. Model changes
  require rerunning the evals; do not assume scores transfer to a different model.
- Real host synthesis and inert human fallback were exercised, but actual human
  dialog rendering/answer delivery and other host versions remain untested.

Conversation and supplied evidence are sent through Amp's decision API to TypeSafe.
Do not include secrets. There is no general secret scanner. Amp's transcript
retention and provider processing policies still apply.

There are no plugin capture files, outcome records, analytics, or uploads. Hooks
run on agent turns and question calls; there is no background polling. Private
development helpers and historical project corpora are not part of this repository.

## Development

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
```

Tests cover advice labeling, option mapping, routing and acceptability threshold
boundaries, human fallback, investigation, context limits, provider failure, and
requirement disagreement, including full-history pagination and export fallback.
Mocked probabilities verify control flow, not model quality.

The local [structured-framing comparison](evals/framing/RESULTS.md) retains all
24 native responses and an offline replay. Structured framing matched the baseline
on preferred selections (7/8), removed a misleading diagnostic warning, and did
not resolve the observed retry and API-behavior errors. It is not release proof.

`evals/host-smoke.ts` is an opt-in Amp runtime harness for one synthetic native
comparison. It needs an accessible real thread ID and spends inference credits.
It also requires a host that implements `ai.decide` for `plugins exec`:

```sh
amp plugins exec ./evals/host-smoke.ts session.start \
  --data '{"thread":{"id":"YOUR_REAL_THREAD_ID"}}'
```

Require an explicit `smoke: passed` log; an empty CLI response is not success.
This checks the comparison tool, not automatic question classification or calibration.
The CLI tested during this migration reports `No handler for plugin request method:
ai.decide` in `plugins exec`. On that CLI, test the installed `jev_evaluate` tool
in a connected Amp thread instead. The native transport was smoke-tested that way
with a synthetic no-new-paid-service choice; Jev selected the existing endpoint.

The standalone `bun run eval` remains a **legacy direct-provider diagnostic**.
It uses `JEV_KEY` or `TYPESAFE_API_KEY`, the pinned legacy model, and explicitly
writes ignored results under `evals/results/`. It is not the installed plugin's
transport and does not validate native routing. Its six synthetic cases and
candidate reversals are development diagnostics, not a held-out benchmark.
