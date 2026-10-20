import { expect, test } from 'bun:test'
import type { PluginAPI } from '@ampcode/plugin'
import runner, { runFixture } from './runner'
import { fixtures } from './fixtures'

test('fixture IDs are unique; fixed labels name available choices or explicit deferrals', () => {
  expect(new Set(fixtures.map(f => f.id)).size).toBe(fixtures.length)
  for (const fixture of fixtures) {
    const count = 'options' in fixture.input ? fixture.input.options.length : fixture.input.candidates.length
    const valid = ['none', 'ask_user', 'investigate', 'not-called', ...Array.from({ length: count }, (_, i) => `option_${i}`)]
    expect(fixture.expected.selection.split('|').every(s => valid.includes(s))).toBe(true)
  }
})

test('deterministic guard fixtures preserve dialogs without live inference', async () => {
  const never = (async () => { throw Error('Must not reach provider') }) as PluginAPI['ai']['decide']
  for (const id of ['oversize', 'no-user', 'provider-failure']) {
    const result = await runFixture(fixtures.findIndex(f => f.id === id), 'T-synthetic', never)
    expect(result.action).toBe('allow')
    expect(result.liveRequest).toBe(false)
  }
})

test('runner requires opt-in and retains failed attempts without leaking provider metadata', async () => {
  let tool: any
  let calls = 0
  runner({ registerTool: (t: any) => { tool = t }, ai: { decide: async () => {
    calls++
    throw Error('PRIVATE_PROVIDER_METADATA')
  } } } as unknown as PluginAPI)
  const ctx = { thread: { id: 'T-synthetic' } }
  await expect(tool.execute({ live: false, indexes: [0] }, ctx)).rejects.toThrow('explicit')
  expect(calls).toBe(0)
  const result = await tool.execute({ live: true, indexes: [0] }, ctx)
  expect(calls).toBe(1)
  expect(result).not.toContain('PRIVATE_PROVIDER_METADATA')
  expect(result).not.toContain('T-synthetic')
  expect(JSON.parse(result).results[0]).toMatchObject({ providerFailure: true, action: 'allow' })
  await expect(tool.execute({ live: true, indexes: [0] }, ctx)).rejects.toThrow('not-yet-attempted')
  expect(calls).toBe(1)
})
