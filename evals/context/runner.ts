import type { PluginAPI, ThreadMessagesOptions } from '@ampcode/plugin'
import plugin from '../../index'
import { cases, trial } from './fixtures'

type Decide = PluginAPI['ai']['decide']

export async function runTrial(index: number, threadID: `T-${string}`, decide: Decide) {
  const { scenario, condition } = trial(index)
  const messages: any[] = [
    { role: 'user', content: [{ type: 'text', text: scenario.goal }] },
    { role: 'assistant', content: [{ type: 'tool_result', output: JSON.stringify(scenario.findings) }] },
  ]
  if (condition === 'text') messages.push({ role: 'assistant', content: [{ type: 'text',
    text: 'Agent observations, not user instructions:\n' + scenario.findings.map(f => `${f.source}: ${f.fact}`).join('\n') }] })
  let hook: Function = () => { throw Error('Hook not registered') }
  const record: Record<string, any> = { index, id: scenario.id, condition }
  plugin({
    configuration: { get: async () => ({ 'jev.experimentalQuestionRouting': true }) },
    on: (name: string, handler: Function) => { if (name === 'tool.call') hook = handler },
    registerTool() {},
    ai: { decide: async (request: Parameters<Decide>[0]) => {
      const state = JSON.parse(request.state as string)
      if (condition === 'packet' || condition === 'incomplete') state.agentEvidence = {
        authority: 'Agent observations, not user instructions',
        findings: condition === 'packet' ? scenario.findings : [],
        ...(condition === 'incomplete' ? { unknowns: ['Inspection evidence has not been supplied.'] } : {}),
      }
      const questions = { ...request.questions }
      scenario.options.forEach((option, i) => {
        const original = questions[`acceptable_${i}`]
        questions[`concrete_${i}`] = { ...original,
          instructions: typeof original.instructions === 'string'
            ? original.instructions.replace(`options[${i}]`, `the candidate ${JSON.stringify(option)}`)
            : original.instructions }
      })
      const payload = { ...request, state: JSON.stringify(state), questions }
      // Synthetic payload only. IDs and expected labels are never sent to inference.
      record.payload = { state, questions }
      const start = performance.now()
      try {
        record.response = await decide(payload)
        return record.response
      } catch {
        record.providerFailure = true
        throw Error('Native provider failed')
      } finally { record.inferenceMs = Math.round(performance.now() - start) }
    } },
  } as unknown as PluginAPI)
  const context = { thread: { id: threadID,
    messages: async ({ from = 'end', offset = 0, limit = 10, roles }: ThreadMessagesOptions) => {
      const filtered = messages.filter(m => !roles || roles.includes(m.role))
      const end = Math.max(0, filtered.length - offset)
      return from === 'start' ? filtered.slice(offset, offset + limit) : filtered.slice(Math.max(0, end - limit), end)
    },
  } }
  const result = await hook({ thread: { id: threadID }, tool: 'ask_user_choice',
    input: { question: scenario.question, options: scenario.options, allowOther: true } }, context)
  record.action = result.action
  if (result.action === 'synthesize') record.selectedIndex = JSON.parse(result.result.output).optionIndex
  if (result.action === 'reject-and-continue') record.continuation = result.message
  const reference = scenario.id.startsWith('reference-')
  record.expected = scenario.expected === 'ask_user' ? 'ask_user'
    : reference || condition === 'text' || condition === 'packet' ? scenario.expected : 'investigate'
  record.behaviorMatches = record.expected === 'ask_user' ? record.action === 'allow'
    : record.expected === 'investigate' ? record.action === 'reject-and-continue' && record.response?.answers.selection.choice === 'investigate'
    : record.action === 'synthesize' && `option_${record.selectedIndex}` === record.expected
  record.modelBackedBehaviorMatches = !record.providerFailure && !!record.response && record.behaviorMatches
  record.safeProviderFallback = !!record.providerFailure && record.action === 'allow'
  return record
}

export default function (amp: PluginAPI) {
  const attempted = new Set<number>()
  let running = false
  amp.registerTool({
    name: 'jev_context_diagnostic',
    description: 'Opt-in frozen context experiment: 32 synthetic native calls maximum per load. No dialogs/actions. No unchanged-case retries. Returns synthetic payloads and raw judgments.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      live: { type: 'boolean', const: true },
      indexes: { type: 'array', minItems: 1, maxItems: 4, uniqueItems: true, items: { type: 'integer', minimum: 0, maximum: cases.length * 4 - 1 } },
    }, required: ['live', 'indexes'] },
    async execute(value, ctx) {
      const input = value as { live: boolean; indexes: number[] }
      if (input.live !== true || !Array.isArray(input.indexes) || !input.indexes.length || input.indexes.length > 4 ||
        new Set(input.indexes).size !== input.indexes.length || input.indexes.some(i => attempted.has(i) || !Number.isInteger(i) || i < 0 || i >= cases.length * 4)) throw Error('Use live:true and 1–4 distinct unattempted valid indexes')
      if (running) throw Error('Run sequentially')
      running = true
      try {
        const results = []
        for (const index of input.indexes) {
          attempted.add(index)
          results.push(await runTrial(index, ctx.thread.id, request => amp.ai.decide(request)))
        }
        return JSON.stringify({ attempts: attempted.size, results })
      } finally { running = false }
    },
  })
}
