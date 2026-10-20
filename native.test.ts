import { expect, test } from 'bun:test'
import type { PluginAPI, ThreadMessagesOptions } from '@ampcode/plugin'
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
    configuration: { get: async (): Promise<Record<string, unknown>> => ({ 'jev.experimentalQuestionRouting': true }) },
    on: (name: string, fn: Function) => { hooks[name] = fn },
    registerTool: (tool: any) => { tools[tool.name] = tool },
    ai: { decide: async (request: any) => {
      requests.push(request)
      return { model: 'jev-test', answers: {
        permission: choice('implementation', 1, ['approval', 'implementation', 'fact']),
        acceptable_0: { type: 'noul', noul: selected === 'option_0' ? selectedProbability : 0 },
        acceptable_1: { type: 'noul', noul: selected === 'option_1' ? selectedProbability : 0 },
        selection: choice(route === 'answer' ? selected : route, Math.min(probability, selectedProbability),
          ['option_0', 'option_1', 'none', 'ask_user', 'investigate']),
        recommendation: choice('option_1', 0.95, ['option_0', 'option_1', 'ask_user', 'investigate', 'none']),
        check_0_0: choice('supported', 1, ['supported', 'contradicted', 'unknown']),
        check_1_0: choice('unknown', 1, ['supported', 'contradicted', 'unknown']),
      } }
    } },
  }
  plugin(api as unknown as PluginAPI)
  const context = { thread: { id: 'T-test', messages: async (_options?: ThreadMessagesOptions) => [
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

test('default and non-boolean opt-ins never read history or infer an answer', async () => {
  for (const value of [undefined, false, 'true']) {
    const h = harness()
    let reads = 0
    h.api.configuration.get = async () => ({ 'jev.experimentalQuestionRouting': value })
    h.context.thread.messages = async () => { reads++; throw Error('Must not read history') }
    expect(await h.run()).toEqual({ action: 'allow' })
    expect(h.requests).toHaveLength(0)
    expect(reads).toBe(0)
  }
  const h = harness()
  expect((await h.run()).action).toBe('synthesize')
  h.requests.length = 0
  let reads = 0
  h.api.configuration.get = async () => ({ 'jev.experimentalQuestionRouting': false })
  h.context.thread.messages = async () => { reads++; return [] }
  expect(await h.run()).toEqual({ action: 'allow' })
  expect(reads).toBe(0)
  expect(h.requests).toHaveLength(0)
})

test('human uncertainty retains the dialog; known-invalid choices redirect to repair', async () => {
  for (const h of [harness('ask_user', 1), harness('answer', 0.899),
    harness('answer', 1, 'option_1', 0.899)]) expect(await h.run()).toEqual({ action: 'allow' })
  expect((await harness('answer', 0.9, 'option_1', 0.9).run()).action).toBe('synthesize')
  expect((await harness('investigate', 0.95).run()).action).toBe('reject-and-continue')
  expect((await harness('investigate', 0.51).run()).action).toBe('reject-and-continue')
  expect((await harness('investigate', 0.5).run()).action).toBe('allow')
  expect((await harness('answer', 1, 'none', 1).run()).action).toBe('reject-and-continue')
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

test('structured evidence separates diagnostics from hard blockers without granting authority', async () => {
  const h = harness()
  const original = h.api.ai.decide
  h.api.ai.decide = async request => {
    const response = await original(request)
    return { ...response, answers: { ...response.answers,
      check_1_0: choice('supported', 1, ['supported', 'contradicted', 'unknown']),
      diagnostic_0_0: choice('supported', 1, ['supported', 'contradicted', 'unknown']),
      diagnostic_1_0: choice('contradicted', 1, ['supported', 'contradicted', 'unknown']) } }
  }
  const input = { decision: 'Choose recovery', whyNow: 'Choose a local implementation', baseline: 'undecided',
    evidence: { authority: 'Local implementation only; deployment needs approval.', observations: [{ source: 'test', finding: 'Both paths preserve one record.' }], assumptions: [], unknowns: [] },
    priorities: 'Prefer replay when safe.', candidates: [{ id: 'lookup', description: 'Look up record' }, { id: 'replay', description: 'Replay same key' }],
    requirements: ['No duplicate records'], diagnostics: ['No second POST'] }
  const output = JSON.parse(await h.tools.jev_evaluate.execute(input, h.context))
  expect(output.warnings).toEqual([])
  expect(output.nextStep).toEqual({ kind: 'candidate_advice', candidate: 'replay', action: 'Replay same key', unresolvedRequirements: [], authorizationGranted: false })
  expect(output.diagnostics[1].answer.choice).toBe('contradicted')
  expect(h.requests[0].state.evidence).toEqual(input.evidence)
  const uncertain = await original({})
  h.api.ai.decide = async () => uncertain
  const blocked = JSON.parse(await h.tools.jev_evaluate.execute({ ...input, diagnostics: [] }, h.context))
  expect(blocked.nextStep.kind).toBe('review_constraints')
  expect(blocked.nextStep.unresolvedRequirements).toEqual([{ requirement: 'No duplicate records', judgment: 'unknown' }])
  for (const invalid of [
    { ...input, diagnostics: ['A', 'B', 'C'] },
    { ...input, evidence: { ...input.evidence, unknowns: [{ fact: 'Limit', owner: 'model' }] } },
    { ...input, evidence: { ...input.evidence, observations: [{ source: 'test', finding: 'x', permission: true }] } },
  ]) await expect(h.tools.jev_evaluate.execute(invalid, h.context)).rejects.toThrow()
})

test('original user instructions survive pagination, assistant chatter and compaction', async () => {
  for (const count of [20, 21, 41]) {
    const h = harness('ask_user', 1)
    const decide = h.api.ai.decide
    h.api.ai.decide = async request => {
      const result = await decide(request)
      result.answers.selection = choice(request.state.includes('PERSONAL_ANSWER') ? 'ask_user' : 'option_1', 1,
        ['option_0', 'option_1', 'none', 'ask_user', 'investigate'])
      return result
    }
    const users = Array.from({ length: count }, (_, i) => ({ role: 'user', content: [{ type: 'text',
      text: i === 0 ? 'PERSONAL_ANSWER: I must personally answer every question.' : `User update ${i}` }] }))
    const chatter = Array.from({ length: 25 }, () => ({ role: 'assistant', content: [{ type: 'text', text: 'Working.' }] }))
    h.context.thread.messages = async ({ full, roles, from = 'end', limit = 10, offset = 0 } = {}) => {
      const original = [...users.slice(0, -1), ...chatter, users.at(-1)!]
      const visible = full ? original : [{ role: 'user', content: [{ type: 'text', text: 'LOSSY_SUMMARY: routine work' }] }, ...chatter, users.at(-1)!]
      const filtered = visible.filter(m => !roles || roles.includes(m.role as 'user' | 'assistant'))
      const end = Math.max(0, filtered.length - offset)
      return from === 'start' ? filtered.slice(offset, offset + limit) : filtered.slice(Math.max(0, end - limit), end)
    }
    expect(await h.run()).toEqual({ action: 'allow' })
    for (const user of users) expect(h.requests[0].state).toContain(user.content[0].text)
    expect(h.requests[0].state).not.toContain('LOSSY_SUMMARY')
  }
})

test('incomplete history never reaches inference, even when the recent choice is obvious', async () => {
  for (const failure of ['unavailable', 'read-cap', 'empty-full-history']) {
    const h = harness()
    h.context.thread.messages = async ({ full, roles, offset = 0 } = {}) => {
      if (full && failure === 'empty-full-history') return []
      if (roles && offset >= 20 && failure === 'unavailable') throw Error('History unavailable')
      return Array.from({ length: 20 }, () => ({ role: 'user', content: [{ type: 'text', text: 'Use A.' }] }))
    }
    expect(await h.run()).toEqual({ action: 'allow' })
    expect(h.requests).toHaveLength(0)
  }
})

test('ranking ties do not block acceptable choices; approval and preference vetoes still do', async () => {
  const h = harness('answer', 1)
  const decide = h.api.ai.decide
  let needsHuman = false
  let bothAcceptable = true
  h.api.ai.decide = async request => {
    const result = await decide(request)
    result.answers.selection = choice('option_0', 0.5, ['option_0', 'option_1'])
    result.answers.acceptable_0.noul = 0.99
    result.answers.acceptable_1.noul = bothAcceptable ? 0.99 : 0.1
    if (needsHuman) result.answers.selection = choice('ask_user', 1, ['option_0', 'option_1', 'none', 'ask_user', 'investigate'])
    return result
  }
  expect((await h.run()).action).toBe('synthesize')
  bothAcceptable = false
  expect(await h.run()).toEqual({ action: 'allow' })
  bothAcceptable = true
  needsHuman = true
  expect(await h.run()).toEqual({ action: 'allow' })
  needsHuman = false
  const withTie = h.api.ai.decide
  h.api.ai.decide = async request => {
    const result = await withTie(request)
    result.answers.permission = choice('implementation', 0.798, ['approval', 'implementation', 'fact'])
    return result
  }
  expect(await h.run()).toEqual({ action: 'allow' })
})

test('native export fallback retains original text but never sends export metadata or tool results', async () => {
  const h = harness('ask_user', 1)
  h.context.thread.messages = async () => []
  const data = { id: 'T-test', env: { privateValue: 'ENV_SENTINEL' }, messages: [
    { role: 'user', content: [{ type: 'text', text: 'ORIGINAL: Let me personally answer.' }, { type: 'tool_result', output: 'TOOL_SENTINEL' }] },
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'THINKING_SENTINEL' }] },
  ] }
  const context = { ...h.context, $: async () => ({ exitCode: 0, stdout: JSON.stringify(data), stderr: '' }) }
  expect(await h.hooks['tool.call'](h.event, context)).toEqual({ action: 'allow' })
  expect(h.requests[0].state).toContain('ORIGINAL')
  for (const sentinel of ['ENV_SENTINEL', 'TOOL_SENTINEL', 'THINKING_SENTINEL']) expect(h.requests[0].state).not.toContain(sentinel)
  data.id = 'T-wrong-thread'
  h.requests.length = 0
  expect(await h.hooks['tool.call'](h.event, context)).toEqual({ action: 'allow' })
  expect(h.requests).toHaveLength(0)
})

test('native and export history use the same original-message window', async () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'Keep my constraints.' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'OLDER_OBSERVATION' }] },
    ...Array.from({ length: 20 }, () => ({ role: 'assistant', content: [{ type: 'tool_result', output: 'SECRET_SENTINEL' }] })),
  ]
  const states: any[] = []
  for (const fallback of [false, true]) {
    const h = harness()
    h.context.thread.messages = (async ({ roles }: ThreadMessagesOptions) => fallback ? []
      : roles ? messages.filter(m => roles.includes(m.role as 'user' | 'assistant')) : messages.slice(-20)) as any
    await h.hooks['tool.call'](h.event, { ...h.context,
      $: async () => ({ exitCode: 0, stdout: JSON.stringify({ id: 'T-test', messages }) }) })
    states.push(JSON.parse(h.requests[0].state))
  }
  expect(states[0]).toEqual(states[1])
  expect(states[0].recentConversation).toEqual([])
  expect(states[0].userHistory).toEqual([{ role: 'user', text: 'Keep my constraints.' }])
})
