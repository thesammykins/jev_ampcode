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
- A **`tool.call` hook** intercepts `ask_user_choice`. Routine, reversible choices
  supported by user context can return clearly labeled model advice. Missing
  technical evidence redirects the agent to investigation. Missing consequential
  user-only context, explicit approvals, and explicit requests to personally answer
  questions retain the original human dialog.

The built-in question tool is not removed. Its normal usage restrictions still
apply. Uncertainty, provider/context errors, oversized or absent user context,
and no suitable offered option also retain the dialog.

Automatic answers require both routing and selection probability **≥0.90**.
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
Only **`index.ts` and `decision.ts`** are needed at runtime; there are no runtime
package dependencies. A GitHub checkout is source, not an automatically installed
global Amp plugin.

### Copy this prompt into Amp to install

```text
Install the native Jev plugin from https://github.com/thesammykins/jev_ampcode
for this project only. Load building-plugins and inspect the source and current
plugin API. Clone outside .amp/plugins, record the reviewed revision, and run
bun install --frozen-lockfile, bun run typecheck, and bun test.

Copy only index.ts and decision.ts into .amp/plugins/jev/, preserving imports.
Do not overwrite an existing installation without showing me what differs.
Do not copy tests, evals, or private development helpers. Reload the plugin using
Amp's supported mechanism. Confirm jev_evaluate is its only registered tool and
that its hooks implement automatic routine-question routing with human fallback.

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

```json
{
  "decision": "Choose the report status update channel.",
  "whyNow": "Both paths have been measured; the choice changes dependencies.",
  "evidence": "Polling updates within 30 seconds. Managed push updates within one second but adds a vendor bill.",
  "priorities": "The user accepts 30 seconds and prioritizes no new service.",
  "baseline": "poll",
  "candidates": [
    { "id": "poll", "description": "Poll the existing authenticated endpoint." },
    { "id": "push", "description": "Add the managed push service." }
  ],
  "requirements": ["No new paid service is needed."]
}
```

The response maps `option_0`, `option_1`, etc. to candidate IDs. The recommendation
includes probabilities for each option plus `ask_user`, `investigate`, and `none`.
Each requirement gets independent supported/contradicted/unknown judgments for
each candidate. Disagreement on the recommendation produces a warning.

No warning is not proof of correctness. Do not average away a hard constraint or
translate probability into “chance the implementation succeeds.” Verify the action.
Provider failures in `jev_evaluate` are errors, not fabricated advice.

## Privacy and context limits

The explicit comparison tool sends only supplied decision context. The question
hook reads conversational text from the latest 20 visible thread messages, including
the compaction summary if present in that window. It excludes tool outputs and
hidden thinking. Older requirements may be absent. It retains the human dialog
rather than truncating a serialized request above 50,000 characters.

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

Tests cover advice labeling, option mapping, routing and selection threshold
boundaries, human fallback, investigation, context limits, provider failure, and
requirement disagreement. Mocked probabilities verify control flow, not model quality.

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
