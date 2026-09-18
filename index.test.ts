import { expect, test } from 'bun:test'
import type { PluginAPI, PluginToolDefinition } from '@ampcode/plugin'
import plugin, { apiKey } from './index'
import { evaluate, parseInput, parseChoice, TOOL_DESCRIPTION } from './decision'
import { cases } from './evals/cases'

test('public plugin registers only the advisory tool, with no capture or outcome contract', () => {
  const tools: PluginToolDefinition[] = []
  plugin({ registerTool: (t: PluginToolDefinition) => { tools.push(t) } } as unknown as PluginAPI)
  expect(tools.map(t => t.name)).toEqual(['jev_evaluate'])
  expect(TOOL_DESCRIPTION).toContain('Do NOT use')
  expect(TOOL_DESCRIPTION).not.toContain('jev_record_outcome')
})

test('bounded inputs reject missing baseline, duplicate candidates and extra token fields', () => {
  const input = cases[0].input
  expect(parseInput(input)).toEqual(input)
  for (const v of [{ ...input, baseline: 'missing' }, { ...input, apiKey: 'never-a-tool-input' },
    { ...input, candidates: [input.candidates[0], input.candidates[0]] }]) expect(() => parseInput(v)).toThrow()
})

test('native secret is preferred, fallback works, and missing credentials fail', () => {
  const saved = { JEV_KEY: process.env.JEV_KEY, TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY }
  try {
    process.env.JEV_KEY = 'fake-native'; process.env.TYPESAFE_API_KEY = 'fake-fallback'
    expect(apiKey()).toBe('fake-native')
    delete process.env.JEV_KEY
    expect(apiKey()).toBe('fake-fallback')
    delete process.env.TYPESAFE_API_KEY
    expect(() => apiKey()).toThrow('JEV_KEY')
  } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
})

test('provider errors are sanitized and never retried', async () => {
  let calls = 0
  await expect(evaluate(cases[0].input, 'test', undefined, async () => { calls++; return new Response('SECRET_BODY', { status: 401 }) })).rejects.toThrow('Jev HTTP 401; no automatic retry.')
  expect(calls).toBe(1)
  await expect(evaluate(cases[0].input, 'test', undefined, async () => { throw Error('SECRET_BODY') })).rejects.toThrow('Jev network failure')
})

test('choice validation preserves rounded probabilities but rejects invalid winners and missing outcomes', () => {
  expect(parseChoice({ type: 'choice', choice: 'b', confidence: 0.2, probabilities: { a: 0.33, b: 0.34, c: 0.32 } }, ['a', 'b', 'c']).probabilities.b).toBe(0.34)
  expect(() => parseChoice({ type: 'choice', choice: 'a', confidence: 1, probabilities: { a: 0.1, b: 0.9 } }, ['a', 'b'])).toThrow('Invalid Jev distribution')
  expect(() => parseChoice({ type: 'choice', choice: 'a', confidence: 1, probabilities: { a: 1 } }, ['a', 'b'])).toThrow('Invalid Jev distribution')
})
