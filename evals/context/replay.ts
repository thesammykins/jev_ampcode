// Offline replay: checks request identity and routing, not fresh model accuracy.
import { deepStrictEqual, strictEqual } from 'node:assert'
import { runTrial } from './runner'
import records from './results.json'

strictEqual(records.length, 32)
deepStrictEqual(records.map(r => r.index), Array.from({ length: 32 }, (_, i) => i))
for (const saved of records) {
  let calls = 0
  const replay = await runTrial(saved.index, 'T-offline-replay', async request => {
    calls++
    deepStrictEqual({ state: JSON.parse(request.state as string), questions: request.questions }, saved.payload)
    return saved.response as any
  })
  strictEqual(calls, 1)
  for (const key of ['action', 'selectedIndex', 'continuation', 'expected', 'behaviorMatches'] as const) {
    deepStrictEqual(replay[key], (saved as Record<string, unknown>)[key])
  }
}
console.log('32 saved payloads and routing outcomes reproduced; no inference.')
