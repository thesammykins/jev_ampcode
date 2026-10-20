import { expect, test } from 'bun:test'
import type { PluginAPI } from '@ampcode/plugin'
import runner, { runTrial } from './runner'
import { cases } from './fixtures'

test('context arms preserve authority, isolate evidence, and never send labels', async () => {
  const payloads: any[] = []
  const decide = (async (request: any) => {
    payloads.push(request)
    return { model: 'mock', answers: { permission: { type: 'choice', choice: 'implementation', confidence: 1,
      probabilities: { approval: 0, implementation: 1, fact: 0 } },
      selection: { type: 'choice', choice: 'ask_user', confidence: 1,
        probabilities: { option_0: 0, option_1: 0, option_2: 0, ask_user: 1, investigate: 0, none: 0 } } } }
  }) as PluginAPI['ai']['decide']
  for (let i = 0; i < 4; i++) await runTrial(i, 'T-synthetic', decide)
  const states = payloads.map(p => JSON.parse(p.state))
  for (const state of states) {
    expect(state.userHistory).toEqual(states[0].userHistory)
    expect(state.options).toEqual(cases[0].options)
    expect(state).not.toHaveProperty('expected')
    expect(state).not.toHaveProperty('acceptable')
  }
  for (const finding of cases[0].findings) {
    expect(payloads[0].state).not.toContain(finding.fact)
    expect(payloads[1].state).toContain(finding.fact)
    expect(states[2].agentEvidence.findings).toContainEqual(finding)
    expect(payloads[3].state).not.toContain(finding.fact)
  }
  expect(states[3].agentEvidence.unknowns).toHaveLength(1)
  const q = payloads[0].questions
  expect(q.acceptable_1.instructions.candidate).toBe(cases[0].options[1])
  expect(q.concrete_1.instructions).toEqual(q.acceptable_1.instructions)
  expect(q.concrete_1.criteria).toEqual(q.acceptable_1.criteria)
})

test('diagnostic requires opt-in and preserves failed attempts without provider metadata', async () => {
  let tool: any
  let calls = 0
  runner({ registerTool: (t: any) => { tool = t }, ai: { decide: async () => {
    calls++
    throw Error('PRIVATE_METADATA')
  } } } as unknown as PluginAPI)
  const ctx = { thread: { id: 'T-synthetic' } }
  await expect(tool.execute({ live: false, indexes: [0] }, ctx)).rejects.toThrow()
  expect(calls).toBe(0)
  const output = await tool.execute({ live: true, indexes: [0] }, ctx)
  expect(calls).toBe(1)
  expect(output).not.toContain('PRIVATE_METADATA')
  expect(output).not.toContain('T-synthetic')
  expect(JSON.parse(output).results[0]).toMatchObject({ providerFailure: true, action: 'allow', behaviorMatches: false })
  await expect(tool.execute({ live: true, indexes: [0] }, ctx)).rejects.toThrow()
  expect(calls).toBe(1)
})

test('safe human fallback on provider failure is not a successful model judgment', async () => {
  const result = await runTrial(16, 'T-synthetic', async () => { throw Error('failure') })
  expect(result).toMatchObject({ behaviorMatches: true, modelBackedBehaviorMatches: false, safeProviderFallback: true })
})
