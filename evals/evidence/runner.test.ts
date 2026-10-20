import { expect, test } from 'bun:test'
import type { PluginAPI } from '@ampcode/plugin'
import runner, { runCase } from './runner'
import { fixtures } from './fixtures'

test('explicit candidate checks bind literal data, preserve unknowns and exclude labels/baseline', async () => {
  let payload: any
  const record = await runCase(1, 'T-test', async request => {
    payload = request
    throw Error('SECRET_PROVIDER_METADATA')
  })
  expect(payload.state).not.toHaveProperty('baseline')
  expect(payload.state).not.toHaveProperty('expected')
  expect(payload.state).not.toHaveProperty('id')
  const check = JSON.parse(payload.questions.check_1_0.instructions)
  expect(check.candidate).toBe(fixtures[1].input.candidates[1].description)
  expect(check.requirement).toBe(fixtures[1].input.requirements[0])
  expect(payload.questions.check_1_0.criteria).toHaveProperty('unknown')
  expect(record.executionFailure).toBe(true)
  expect(record.modelJudgmentMatches).toBe(false)
  expect(JSON.stringify(record)).not.toContain('SECRET_PROVIDER_METADATA')
})

test('fresh eval requires opt-in and never retries failed attempts', async () => {
  let tool: any
  let calls = 0
  runner({ registerTool: (t: any) => { tool = t }, ai: { decide: async () => { calls++; throw Error('failure') } } } as unknown as PluginAPI)
  const ctx = { thread: { id: 'T-test' } }
  await expect(tool.execute({ live: false, indexes: [0] }, ctx)).rejects.toThrow()
  expect(calls).toBe(0)
  await tool.execute({ live: true, indexes: [0] }, ctx)
  await expect(tool.execute({ live: true, indexes: [0] }, ctx)).rejects.toThrow()
  expect(calls).toBe(1)
})
