# Jev for Amp

A small advisory tool for comparing **supplied alternatives against supplied evidence**.
Jev returns typed choices and probabilities, not research, explanations, or permission
to act. This is a V1 pilot, not an Oracle replacement or a correctness gate.

If my Jev plugin for Amp is useful to you, you can support its development.

<a href="https://ko-fi.com/sammykins/tip"><img src="https://cdn.prod.website-files.com/5c14e387dab576fe667689cf/670f5a01c01ea9191809398c_support_me_on_kofi_blue.avif" alt="Support Jev plugin for Ampcode on Ko-fi" height="32"></a>

## What to use it for

- Compare implementation approaches after inspecting relevant code and constraints.
- Compare product or workflow options when the user's priorities are already known.
- Choose between evidence-gathering actions that resolve a concrete uncertainty.

Do not use it for routine choices, reassurance, open-ended research, generating
missing designs, guessing what a user will authorize, or proving a system safe.
Inspect sources, run tests, ask the user, or use a reasoning model for those tasks.
One call per unchanged decision; do not repeat calls to obtain endorsement.
This is agent guidance, not a technical quota or an automatic usage gate.

## Installation and credentials

Requires Amp with directory-plugin support and its Bun plugin runtime. Development
was checked on Linux/x64 with Bun 1.3.10 and the pinned Amp API types in `package.json`.
Only **`index.ts` and `decision.ts`** are needed at runtime; there are no runtime
package dependencies. Do not install the entire checkout as loose plugin files.

Use Amp's native secrets UI to add **`JEV_KEY`** to the scope available to the target
orb/project. The plugin reads the environment variable Amp injects into its executor.
The current plugin API exposes no separate secret-fetch method. After adding or
changing the secret in an existing orb, run `amp orb restart-processes`, then reload
the plugin if needed. Verify availability without printing the value:

```sh
test -n "$JEV_KEY" && echo 'JEV_KEY available' || echo 'JEV_KEY missing'
```

The fallback is `TYPESAFE_API_KEY` in the executor's environment. A local CLI/runner
must receive the variable through its own launch environment; do not assume orb
secrets synchronize to a local machine. Restart that client after updating its
environment. `JEV_KEY` takes precedence when both are set.

**Never paste a key into a tool argument, chat, source file, `.env` in this repository,
or Amp plugin settings.** No plaintext `jev.apiKey` setting is supported. If a key
was exposed, rotate it through your provider. The plugin blocks its configured token
when found verbatim in input, but this is not a general secret scanner: sanitize
all project context yourself.

### Copy this prompt into Amp to install

```text
Install the Jev advisory plugin from https://github.com/thesammykins/jev_ampcode
for this project only. Load Amp's building-plugins skill and inspect the source
and current plugin API before installing. Clone outside .amp/plugins, choose and
record the reviewed Git revision, and run bun install --frozen-lockfile,
bun run typecheck, and bun test. Do not overwrite an existing Jev installation
without showing me what differs.

Copy only index.ts and decision.ts into this project's .amp/plugins/jev/
directory, preserving their relative imports. Do not copy tests, evals, captures,
or development helpers. Use load_plugin if supported, or tell me how to reload
Amp plugins. Confirm that jev_evaluate is the only tool this plugin registers.

Use the existing JEV_KEY secret from Amp's native secrets environment. Check only
whether it is present, never print or read its value back to me. If absent, ask
me to add it in Amp's secrets UI in the correct scope. In an orb, refresh with
amp orb restart-processes after I add it. Outside an orb, explain that JEV_KEY
or TYPESAFE_API_KEY must be supplied to the client's environment securely.
Do not persist the token in settings, files, shell history, commands, or tool input.

Once the key is available, make one minimal synthetic advisory smoke call (this
prompt authorizes that API request), then report the selected option and any
warnings without printing credentials. Do not install a capture companion,
change command approvals, publish anything, or enable automatic Jev calls.
```

For a global User Plugins installation, explicitly request that scope instead;
Amp should use its supported global plugin-repository workflow. A public GitHub
checkout is a source repository, not an automatically installed Amp global plugin.
Keep the selected revision so updates can be reviewed before replacing the two files.

## Calling and interpreting `jev_evaluate`

Supply one decision, why this call could change the plan, evidence, explicit
priorities, a pre-advice `baseline` candidate ID (or `undecided`), 2–6 candidates,
and zero to three independent requirements. Baseline and whyNow make the agent's
intent explicit in the tool call; they are not sent to Jev. The plugin does not
read repository files or thread messages automatically.

```json
{
  "decision": "Choose the report status update channel.",
  "whyNow": "Both paths have been measured; the choice changes dependencies.",
  "evidence": "Polling updates within 30 seconds. Managed push updates within one second but adds a vendor bill and reconnection management.",
  "priorities": "The user accepts 30 seconds and prioritizes no new service.",
  "baseline": "poll",
  "candidates": [
    { "id": "poll", "description": "Poll the existing authenticated endpoint." },
    { "id": "push", "description": "Add the managed push service." }
  ],
  "requirements": ["No new paid service is needed."]
}
```

The response maps `option_0`, `option_1`, etc. to your candidate IDs. Its
`recommendation` includes a full distribution over those options plus `ask_user`,
`investigate`, and `none`. Each optional requirement gets a separate
supported/contradicted/unknown judgment for each candidate, in the same API request.
The recommendation and checks are independent; they do not read each other's answers.

Use the distribution to compare alternatives, then inspect conflicts with your
evidence. Do not average away a hard constraint or translate probability into
"chance the implementation succeeds." Confidence describes distribution concentration;
it does not establish correctness. Equivalent acceptable options can split probability.
The tool flags disagreement on the recommended candidate; no warning is **not** proof
that all constraints are met. Tests and human approval requirements still apply.

The default model is pinned to `jev-1.13.0`; the optional non-secret Amp setting
`jev.model` overrides it. Each call makes one HTTPS request to
`https://api.typesafe.ai/v1/systemone`, with a 20-second timeout and no automatic
retry. API or validation failures are errors, never fabricated advice. Error bodies
are not echoed.

## Privacy and public scope

The public plugin has **no capture library, outcome tool, local decision logs,
background hooks, analytics, or reporting endpoint**. There is no hidden capture flag.
Its only network operation is the requested TypeSafe evaluation. Tool calls and
responses remain subject to Amp's normal transcript retention, and content sent to
TypeSafe is subject to that provider's policies. "No plugin logs" does not mean
"no transcript" or "no external data processing."

Private development helpers and historical project corpora are excluded from Git.
They are not needed to install, test, or run the public plugin.

## Development checks and explicit evals

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
# Optional: spends TypeSafe tokens; uses JEV_KEY or TYPESAFE_API_KEY from the environment.
bun run eval
```

The six public synthetic cases test priority changes, missing preferences, missing
measurements, no-valid-candidate handling and acceptable ties. Reversed candidates
are sensitivity checks, not independent accuracy samples. The eval runner uses the
same request builder and response validation as the plugin. It explicitly writes
timestamped results to ignored `evals/results/`; it is never imported by the plugin.
These are development diagnostics, not calibration, a held-out benchmark or an
Amp-alone comparison. A successful API call does not imply a correct judgment.

For an explicit live Amp-runtime smoke check, with `JEV_KEY` already available:

```sh
amp plugins exec ./evals/host-smoke.ts session.start \
  --data '{"thread":{"id":"T-00000000-0000-0000-0000-000000000000"}}'
```

The smoke harness exercises registration and the real tool handler. This CLI's
`plugins exec` lacks `configuration.get`, so the harness substitutes empty settings.
It verifies secret access and a real provider response, not installation, persistent
settings integration or whether an autonomous agent chooses the tool appropriately.

TypeSafe references: [System One](https://docs.typesafe.ai/concepts/system-one),
[Choice](https://docs.typesafe.ai/primitives/choice),
[confidence](https://docs.typesafe.ai/confidence), and
[agent skill](https://docs.typesafe.ai/agent-skill).
