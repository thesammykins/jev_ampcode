import { expect, test } from 'bun:test'
import type { PluginAPI } from '@ampcode/plugin'
import plugin from './index'

function choice(winner: string, probability: number, keys: string[]) {
  return { type: 'choice', choice: winner, confidence: 0.99,
    probabilities: Object.fromEntries(keys.map(k => [k, k === winner ? probability : (1 - probability) / (keys.length - 1)])) }
}

function harness(route = 'answer', probability = 0.95, selected = 'option_1', selectedProbability = 0.96) {
  const hooks: Record<string, Function> = {}
  const tools: Record<string, any> = {}
  const requests: any[] = []
  const api = {
    on: (name: string, fn: Function) => { hooks[name] = fn },
    registerTool: (tool: any) => { tools[tool.name] = tool },
    ai: { decide: async (request: any) => {
      requests.push(request)
      return { model: 'jev-test', answers: {
        route: choice(route, probability, ['answer', 'ask_user', 'investigate']),
        selection: choice(selected, selectedProbability, ['option_0', 'option_1', 'none']),
        recommendation: choice('option_1', 0.95, ['option_0', 'option_1', 'ask_user', 'investigate', 'none']),
        check_0_0: choice('supported', 1, ['supported', 'contradicted', 'unknown']),
        check_1_0: choice('unknown', 1, ['supported', 'contradicted', 'unknown']),
      } }
    } },
  }
  plugin(api as unknown as PluginAPI)
  const context = { thread: { id: 'T-test', messages: async () => [
    { role: 'user', content: [{ type: 'text', text: 'Use the existing dependency, no new services.' }] },
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'PRIVATE_THINKING' }, { type: 'tool_use', input: 'TOOL_SECRET' }] },
  ] } }
  const event = { thread: { id: 'T-test' }, tool: 'ask_user_choice', input: {
    question: 'Which approach?', options: ['New paid service', 'Existing dependency'], allowOther: true,
  } }
  return { hooks, tools, requests, api, context, event, run: () => hooks['tool.call'](event, context) }
}

test('routine answer is advice, selects the correct non-first option, and excludes hidden context', async () => {
  const h = harness()
  const response = await h.run()
  expect(response.action).toBe('synthesize')
  expect(JSON.parse(response.result.output)).toMatchObject({ source: 'decision_model', userAnswered: false,
    recommendation: 'Existing dependency', optionIndex: 1, model: 'jev-test' })
  expect(h.requests[0].threadID).toBe('T-test')
  expect(h.requests[0].state).not.toContain('PRIVATE_THINKING')
  expect(h.requests[0].state).not.toContain('TOOL_SECRET')
})

test('human routing, uncertainty, and no fitting option preserve the original dialog', async () => {
  for (const h of [harness('ask_user', 1), harness('answer', 0.899), harness('answer', 1, 'none', 1),
    harness('answer', 1, 'option_1', 0.899)]) expect(await h.run()).toEqual({ action: 'allow' })
  expect((await harness('answer', 0.9, 'option_1', 0.9).run()).action).toBe('synthesize')
  expect((await harness('investigate', 0.95).run()).action).toBe('reject-and-continue')
})

test('unrelated tools, malformed input, missing/oversized context and provider errors never synthesize', async () => {
  const h = harness()
  h.event.tool = 'shell_command'
  expect(await h.run()).toEqual({ action: 'allow' })
  expect(h.requests).toHaveLength(0)
  h.event.tool = 'ask_user_choice'
  h.event.input.options = []
  expect(await h.run()).toEqual({ action: 'allow' })
  h.event.input.options = ['One', 'Two']
  h.context.thread.messages = async () => []
  expect(await h.run()).toEqual({ action: 'allow' })
  h.context.thread.messages = async () => [{ role: 'user', content: [{ type: 'text', text: 'x'.repeat(50001) }] }]
  expect(await h.run()).toEqual({ action: 'allow' })
  expect(h.requests).toHaveLength(0)
  const failure = harness()
  failure.api.ai.decide = async () => { throw Error('provider disabled') }
  expect(await failure.run()).toEqual({ action: 'allow' })
})

test('bounded comparisons use native routing, preserve requirement disagreements, and reject invalid input', async () => {
  const h = harness()
  const input = { decision: 'Choose dependency', whyNow: 'Two supported approaches', evidence: 'Existing library is installed.',
    priorities: 'Avoid new services', baseline: 'existing', candidates: [
      { id: 'new', description: 'Paid service' }, { id: 'existing', description: 'Existing library' },
    ], requirements: ['No new service'] }
  const result = JSON.parse(await h.tools.jev_evaluate.execute(input, h.context))
  expect(result.recommendation.choice).toBe('option_1')
  expect(result.candidates[1].id).toBe('existing')
  expect(result.warnings).toHaveLength(1)
  expect(h.requests[0].threadID).toBe('T-test')
  expect(h.requests[0].model).toBeUndefined()
  expect(h.requests[0].state).not.toHaveProperty('baseline')
  expect(h.tools.jev_record_outcome).toBeUndefined()
  await expect(h.tools.jev_evaluate.execute({ ...input, candidates: [] }, h.context)).rejects.toThrow()
  expect(h.requests).toHaveLength(1)
})
