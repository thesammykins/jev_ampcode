import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { apiKey } from '../index'
import { buildRequest, evaluate, MODEL, PROMPT_VERSION, VERSION, type Input, type Result } from '../decision'
import { cases, parseCases, variantInput } from './cases'

if (import.meta.main) {
  const extra = process.argv[2] ? parseCases(await Bun.file(process.argv[2]).json()) : []
  const corpus = parseCases([...cases, ...extra])
  const key = apiKey()
  // Never persist the configured token, including one accidentally included in fixtures.
  if (JSON.stringify(corpus).includes(key)) throw new Error('Eval corpus contains the API token.')
  const rows: ({ name: string; group: string; kind: string; after: boolean; reversed: boolean } & (
    { input: Input; result: Result; winner: string; expected: string[]; correct: boolean } | { error: string }
  ))[] = []
  for (const c of corpus) for (const after of c.clarification ? [false, true] : [false]) for (const reversed of [false, true]) {
    const input = variantInput(c, after, reversed)
    try {
      const result = await evaluate(input, key)
      const winner = result.recommendation.choice.startsWith('option_') ? input.candidates[Number(result.recommendation.choice.slice(7))].id : result.recommendation.choice
      const expected = after ? c.expectedAfter! : c.expectedBefore
      const correct = expected.includes(winner)
      rows.push({ name: c.name, group: c.group, kind: c.kind, after, reversed, input, result, winner, expected, correct })
      console.log(`${c.name} ${after ? 'clarified' : 'before'} ${reversed ? 'reversed' : 'original'}: ${winner}; ${correct ? 'match' : 'MISMATCH'}`)
    } catch (e) { rows.push({ name: c.name, group: c.group, kind: c.kind, after, reversed, error: e instanceof Error ? e.message : 'Failure' }) }
  }
  const summary = { calls: rows.length, serviceFailures: rows.filter(r => 'error' in r).length,
    // Reversals are sensitivity checks, not new independent examples.
    original: ['synthetic', 'human-preference', 'relayed-preference', 'agent-decision'].flatMap(kind => [false, true].map(after => {
      const selected = rows.filter(r => r.kind === kind && r.after === after && !r.reversed)
      return { kind, after, count: selected.length, correct: selected.filter(r => 'correct' in r && r.correct).length }
    })),
  }
  const directory = join(import.meta.dir, 'results')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID()}.json`)
  await writeFile(path, JSON.stringify({ version: VERSION, promptVersion: PROMPT_VERSION, model: MODEL,
    corpusDigest: createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),
    promptDigest: createHash('sha256').update(JSON.stringify(corpus.map(c => buildRequest(c.input)))).digest('hex'),
    methodology: 'Curated development diagnostics, not independent held-out calibration. Labels fixed before calls. Historical summaries/options reconstructed with hindsight risk. Blind inputs exclude clarification, sources and labels. Clarified cases measure applying supplied preferences, not predicting them. Reversed candidates test sensitivity. No claims of superiority to Amp-alone.',
    summary, corpus, rows }, null, 2), { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ path, summary }, null, 2))
  if (summary.serviceFailures) process.exitCode = 1
}
