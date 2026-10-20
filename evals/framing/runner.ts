import type { PluginAPI } from '@ampcode/plugin'
import plugin from '../../index'
import { buildRequest } from '../../decision'
import { buildRequest as baselineRequest, type Input as BaselineInput } from './baseline'
import { cases, trial } from './fixtures'

export async function runTrial(index: number, threadID: `T-${string}`, decide: PluginAPI['ai']['decide']) {
  const { c, arm, input } = trial(index)
  let tool: any
  const r: Record<string, any> = { index, id: c.id, arm, input, expected: c.expected, expectedRelations: c.relations }
  plugin({ on() {}, registerTool: (t: any) => { tool = t }, ai: { decide: async (request: any) => {
    const { state, questions } = arm === 'baseline' ? baselineRequest(input as BaselineInput) : request
    // Preserve the preregistered prompt-only arm after legacy compatibility was restored.
    if (arm === 'prompt-only') questions.recommendation.instructions = buildRequest(c.input).questions.recommendation.instructions
    r.payload = { state, questions }
    r.response = await decide({ threadID, state, questions })
    return r.response
  } } } as unknown as PluginAPI)
  try {
    r.output = JSON.parse(await tool.execute(input, { thread: { id: threadID } }))
    r.selected = r.output.candidates.find((v: any) => v.selection === r.output.recommendation.choice)?.id ?? r.output.recommendation.choice
    r.matches = r.selected === c.expected
    r.observedRelations = input.candidates.map((_, i) => c.relations[i].map((_, j) => {
      const key = arm === 'framed' && j >= input.requirements.length ? `diagnostic_${i}_${j - input.requirements.length}` : `check_${i}_${j}`
      return r.response.answers[key].choice
    }))
  } catch { r.failure = true; r.matches = false }
  return r
}

export default function (amp: PluginAPI) {
  const attempted = new Set<number>()
  let running = false
  amp.registerTool({ name: 'jev_framing_eval', description: 'Frozen 24-call native framing comparison. Explicit live opt-in; one attempt per trial. No real actions or dialogs.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { live: { type: 'boolean', const: true }, indexes: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'integer', minimum: 0, maximum: 23 } } }, required: ['live', 'indexes'] },
    async execute(value, ctx) {
      const { live, indexes } = value as { live: boolean; indexes: number[] }
      if (live !== true || running || !Array.isArray(indexes) || !indexes.length || indexes.length > 3 || new Set(indexes).size !== indexes.length || indexes.some(i => !Number.isInteger(i) || i < 0 || i >= cases.length * 3 || attempted.has(i))) throw Error('Use 1–3 unattempted trial indexes and live:true')
      running = true
      try {
        const results = []
        for (const i of indexes) { attempted.add(i); results.push(await runTrial(i, ctx.thread.id, r => amp.ai.decide(r))) }
        return JSON.stringify({ attempts: attempted.size, results })
      } finally { running = false }
    },
  })
}
