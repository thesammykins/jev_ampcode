import type { PluginAPI, ThreadMessagesOptions } from '@ampcode/plugin'
import plugin from '../../index'
import { fixtures } from './fixtures'

type Decide = PluginAPI['ai']['decide']

// Registers the production implementation against a capture API, not the host.
// Only decide reaches the host; conversation retrieval is synthetic.
export async function runFixture(index: number, threadID: `T-${string}`, decide: Decide) {
  const fixture = fixtures[index] as (typeof fixtures)[number] & { messages?: unknown[]; failure?: boolean }
  if (!fixture) throw Error('Unknown fixture index')
  const hooks: Record<string, Function> = {}
  const tools: Record<string, { execute: Function }> = {}
  const record: Record<string, any> = { id: fixture.id, expected: fixture.expected, liveRequest: false }
  plugin({
    configuration: { get: async () => ({ 'jev.experimentalQuestionRouting': true }) },
    on: (name: string, handler: Function) => { hooks[name] = handler },
    registerTool: (tool: { name: string; execute: Function }) => { tools[tool.name] = tool },
    ai: { decide: async (request: Parameters<Decide>[0]) => {
      if (fixture.failure) throw Error('Injected provider failure')
      record.liveRequest = true
      const start = performance.now()
      try {
        record.modelResult = await decide(request)
        return record.modelResult
      } catch {
        // Never persist provider errors: they can contain account or request metadata.
        record.providerFailure = true
        throw Error('Decision provider failed')
      } finally { record.inferenceMs = Math.round(performance.now() - start) }
    } },
  } as unknown as PluginAPI)
  const start = performance.now()
  const context = { thread: { id: threadID, messages: async ({ limit = 10, offset = 0, from = 'end', roles }: ThreadMessagesOptions) => {
    // These fixtures are uncompacted original transcripts. Honor native paging and
    // filtering so a history-reading change is evaluated against the same evidence.
    const messages = (fixture.messages ?? []).filter((m: any) => !roles || roles.includes(m.role))
    const end = Math.max(0, messages.length - offset)
    return from === 'start' ? messages.slice(offset, offset + limit) : messages.slice(Math.max(0, end - limit), end)
  } } }
  try {
    if (fixture.kind === 'hook') {
      const result = await hooks['tool.call']({ tool: 'ask_user_choice', input: fixture.input, thread: { id: threadID } }, context)
      record.action = result.action
      if (result.action === 'reject-and-continue') record.continuation = result.message
      if (result.action === 'synthesize') record.synthesized = JSON.parse(result.result.output)
    } else record.toolResult = JSON.parse(await tools.jev_evaluate.execute(fixture.input, context))
  } catch { record.executionFailure = true }
  record.elapsedMs = Math.round(performance.now() - start)
  const answers = record.modelResult?.answers
  const matches = (expected: string, observed: string) => expected.split('|').includes(observed)
  if (answers) {
    record.selectionMatches = matches(fixture.expected.selection, record.synthesized
      ? `option_${record.synthesized.optionIndex}` : (answers.selection ?? answers.recommendation).choice)
    if ('route' in fixture.expected && answers.route) record.routeMatches = matches(fixture.expected.route, answers.route.choice)
  }
  return record
}

// No inference at import/registration time. Never registers ask_user_choice or
// jev_evaluate, and never forwards a captured hook to the live host.
export default function (amp: PluginAPI) {
  const attempted = new Set<number>()
  let requests = 0
  let running = false
  amp.registerTool({
    name: 'jev_native_eval',
    description: 'Explicit opt-in synthetic native Jev evaluation. No real dialogs. Each index may run once per load; maximum 80 native requests. Returns synthetic-only results; save outside the repository.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        live: { type: 'boolean', const: true },
        indexes: { type: 'array', minItems: 1, maxItems: 4, uniqueItems: true, items: { type: 'integer', minimum: 0, maximum: fixtures.length - 1 } },
      }, required: ['live', 'indexes'],
    },
    async execute(value, ctx) {
      const input = value as { live: boolean; indexes: number[] }
      if (input.live !== true) throw Error('Live inference requires explicit live: true')
      if (!Array.isArray(input.indexes) || input.indexes.length < 1 || input.indexes.length > 4 ||
        new Set(input.indexes).size !== input.indexes.length || input.indexes.some(i => !Number.isInteger(i) || !fixtures[i] || attempted.has(i))) {
        throw Error('Use 1–4 distinct, valid, not-yet-attempted indexes')
      }
      if (running) throw Error('Run sequentially to preserve the budget')
      running = true
      try {
        const results = []
        for (const index of input.indexes) {
          attempted.add(index)
          results.push(await runFixture(index, ctx.thread.id, (async request => {
            if (requests >= 80) throw Error('Request budget exhausted')
            requests++
            return amp.ai.decide(request)
          }) as Decide))
        }
        return JSON.stringify({ requests, results })
      } finally { running = false }
    },
  })
}
