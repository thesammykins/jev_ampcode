import { deepStrictEqual, strictEqual } from 'node:assert'
import { runCase } from './runner'

// Saved-response replay only. Never calls the native model.
const records = await Bun.file(new URL('./results.json', import.meta.url)).json()
strictEqual(records.length, 13)
deepStrictEqual(records.map((r: any) => r.index), Array.from({ length: 13 }, (_, i) => i))
for (const saved of records) {
  let calls = 0
  let payload: unknown
  const result = await runCase(saved.index, 'T-offline-replay', async request => {
    calls++
    payload = { state: request.state, questions: request.questions }
    if (!saved.response) throw Error('Recorded provider failure')
    return saved.response
  })
  strictEqual(calls, 1)
  deepStrictEqual(payload, saved.payload)
  for (const key of ['output', 'selected', 'expected', 'modelJudgmentMatches', 'safeAbstention', 'executionFailure']) {
    deepStrictEqual(result[key], saved[key])
  }
}
console.log('13 saved payloads and explicit-tool outcomes reproduced; no inference.')
