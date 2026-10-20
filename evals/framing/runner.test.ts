import { expect, test } from 'bun:test'
import { cases, trial } from './fixtures'
import { parseInput, buildRequest } from '../../decision'
import { runTrial } from './runner'

test('comparison keeps evidence and actions constant and reserves hard versus diagnostic checks', () => {
  for (let i = 0; i < cases.length; i++) {
    const group = [0, 1, 2].map(n => trial(i * 3 + n))
    const framed = group.find(t => t.arm === 'framed')!.input
    for (const t of group) {
      expect(parseInput(t.input)).toEqual(t.input)
      expect(t.input.candidates).toEqual(framed.candidates)
      expect(t.input.priorities).toBe(framed.priorities)
      expect(typeof t.input.evidence === 'string' ? JSON.parse(t.input.evidence) : t.input.evidence).toEqual(framed.evidence)
      expect([...t.input.requirements, ...(t.input.diagnostics ?? [])]).toEqual([...framed.requirements, ...(framed.diagnostics ?? [])])
      expect(Object.keys(buildRequest(t.input).questions).length).toBe(1 + t.input.candidates.length * cases[i].relations[0].length)
    }
  }
})

test('provider failures are retained without leaking error text or counting as matches', async () => {
  const result = await runTrial(0, 'T-test', async () => { throw Error('PRIVATE_SENTINEL') })
  expect(result.failure).toBe(true)
  expect(result.matches).toBe(false)
  expect(JSON.stringify(result)).not.toContain('PRIVATE_SENTINEL')
})

test('fresh sorting evidence distinguishes mutating and non-mutating implementations', () => {
  const input = [10, 2, 2]
  const copy = [...input].sort((a, b) => a - b)
  expect(input).toEqual([10, 2, 2])
  expect(copy).toEqual([2, 2, 10])
  expect(copy).not.toBe(input)
  const inplace = input.sort((a, b) => a - b)
  expect(inplace).toBe(input)
  expect(input).toEqual([2, 2, 10])
})
