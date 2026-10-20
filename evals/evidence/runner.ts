import type { PluginAPI } from '@ampcode/plugin'
import plugin from '../../index'
import { fixtures } from './fixtures'

export async function runCase(index: number, threadID: `T-${string}`, decide: PluginAPI['ai']['decide']) {
  const fixture = fixtures[index]
  if (!fixture) throw Error('Invalid index')
  let tool: any
  const record: Record<string, any> = { index, id: fixture.id, expected: fixture.expected }
  plugin({ on() {}, registerTool: (value: any) => { tool = value }, ai: { decide: async (request: any) => {
    record.payload = { state: request.state, questions: request.questions }
    const start = performance.now()
    try { record.response = await decide(request); return record.response }
    finally { record.inferenceMs = Math.round(performance.now() - start) }
  } } } as unknown as PluginAPI)
  try {
    record.output = JSON.parse(await tool.execute(fixture.input, { thread: { id: threadID } }))
    const choice = record.output.recommendation.choice
    record.selected = record.output.candidates.find((c: any) => c.selection === choice)?.id ?? choice
    record.modelJudgmentMatches = fixture.expected.includes(record.selected)
    if (fixture.id === 'approval-not-granted') record.safeAbstention = ['ask_user', 'none'].includes(record.selected)
  } catch {
    record.executionFailure = true
    record.modelJudgmentMatches = false
  }
  return record
}

export default function (amp: PluginAPI) {
  const attempted = new Set<number>()
  let running = false
  amp.registerTool({ name: 'jev_evidence_eval', description: 'Opt-in synthetic explicit-tool evaluation. Maximum 13 calls, once each per load. No human dialogs or external actions.',
    inputSchema: { type: 'object', properties: { live: { type: 'boolean', const: true }, indexes: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'integer', minimum: 0, maximum: 12 } } }, required: ['live', 'indexes'], additionalProperties: false },
    async execute(value, ctx) {
      const { live, indexes } = value as { live: boolean; indexes: number[] }
      if (live !== true || !Array.isArray(indexes) || !indexes.length || indexes.length > 4 || new Set(indexes).size !== indexes.length || indexes.some(i => !Number.isInteger(i) || !fixtures[i] || attempted.has(i)) || running) throw Error('Use live:true with 1–4 unattempted indexes; run sequentially')
      running = true
      try {
        const results = []
        for (const i of indexes) { attempted.add(i); results.push(await runCase(i, ctx.thread.id, r => amp.ai.decide(r))) }
        return JSON.stringify({ attempts: attempted.size, results })
      } finally { running = false }
    },
  })
}
