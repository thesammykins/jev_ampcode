import { deepStrictEqual, strictEqual } from 'node:assert'
import { runTrial } from './runner'

const records = await Bun.file(new URL('./results.json', import.meta.url)).json()
strictEqual(records.length, 24)
deepStrictEqual(records.map((r: any) => r.index), Array.from({ length: 24 }, (_, i) => i))
const summaries: Record<string, { matches: number; relations: number; total: number; warnings: number }> = {}
for (const saved of records) {
  let calls = 0
  let payload: unknown
  const result = await runTrial(saved.index, 'T-offline-replay', async request => {
    calls++
    payload = { state: request.state, questions: request.questions }
    if (!saved.response) throw Error('Recorded failure')
    return saved.response
  })
  strictEqual(calls, 1)
  deepStrictEqual(payload, saved.payload)
  for (const key of ['input', 'output', 'selected', 'matches', 'observedRelations', 'failure']) deepStrictEqual(result[key], saved[key])
  const s = summaries[saved.arm] ??= { matches: 0, relations: 0, total: 0, warnings: 0 }
  s.matches += Number(saved.matches)
  s.warnings += Number((saved.output?.warnings.length ?? 0) > 0)
  saved.expectedRelations.forEach((row: string[], i: number) => row.forEach((label, j) => {
    s.total++
    s.relations += Number(saved.observedRelations?.[i]?.[j] === label)
  }))
}
console.log('24 payloads and tool outcomes reproduced without inference.')
console.log(JSON.stringify(summaries, null, 2))
