import { expect, test } from 'bun:test'
import { buildRequest } from '../decision'
import { cases, parseCases, variantInput } from './cases'

test('blind payload excludes labels, provenance, later answers and baseline', () => {
  const c = { ...cases[0], source: 'PRIVATE_SOURCE_SENTINEL', clarification: 'LATER_ANSWER_SENTINEL', expectedBefore: ['PRIVATE_LABEL_SENTINEL'] }
  const before = JSON.stringify(buildRequest(variantInput(c, false, false)))
  expect(before).not.toContain('SENTINEL')
  const after = JSON.stringify(buildRequest(variantInput(c, true, true)))
  expect(after).toContain('LATER_ANSWER_SENTINEL')
  expect(after).not.toContain('PRIVATE_')
  expect(variantInput(c, false, true).candidates.map(c => c.id)).toEqual(['push', 'poll'])
})

test('eval labels must reference available candidates and paired clarification labels', () => {
  expect(parseCases(cases)).toHaveLength(6)
  expect(() => parseCases([{ ...cases[0], expectedBefore: ['invented'] }])).toThrow('Invalid eval labels')
  expect(() => parseCases([{ ...cases[0], clarification: 'Changed preference' }])).toThrow('Invalid eval labels')
})
