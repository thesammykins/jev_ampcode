import { parseInput, record, text, type Input } from '../decision'

export type Case = { name: string; group: string; kind: 'synthetic' | 'human-preference' | 'relayed-preference' | 'agent-decision';
  source: string; input: Input; expectedBefore: string[]; clarification?: string; expectedAfter?: string[] }

// Freeze these before running. Acceptable-answer sets avoid false precision on ties.
const updates: Input = { decision: 'Choose a status update channel.', whyNow: 'Both paths measured; choosing changes dependencies.',
  evidence: 'Polling the existing authenticated HTTP endpoint takes up to 30 seconds. A managed push service updates within one second but adds vendor cost and reconnection management.',
  priorities: 'The user accepts 30-second delay and prioritizes no added service or cost.', baseline: 'poll', requirements: ['No new paid service is needed.'],
  candidates: [{ id: 'poll', description: 'Poll the existing endpoint.' }, { id: 'push', description: 'Add a managed push service.' }] }

export const cases: Case[] = [
  { name: 'low-operations', group: 'status-channel', kind: 'synthetic', source: 'Authored fixture', input: updates, expectedBefore: ['poll'] },
  { name: 'latency-priority', group: 'status-channel', kind: 'synthetic', source: 'Authored fixture',
    input: { ...updates, priorities: 'Updates must arrive within one second. Vendor cost and reconnection management are acceptable.', requirements: ['Updates arrive within one second.'] }, expectedBefore: ['push'] },
  { name: 'missing-preference', group: 'status-channel', kind: 'synthetic', source: 'Authored fixture',
    input: { ...updates, priorities: 'Show updates. No acceptable delay or budget has been specified; neither option dominates.', baseline: 'undecided', requirements: [] }, expectedBefore: ['ask_user'] },
  { name: 'missing-measurement', group: 'performance', kind: 'synthetic', source: 'Authored fixture',
    input: { decision: 'Choose an endpoint optimization.', whyNow: 'Unsure what to implement.', evidence: 'The endpoint takes four seconds. No profile or query plan exists. SQL and serialization could each dominate.',
      priorities: 'Fix the dominant bottleneck; do not implement a speculative optimization.', baseline: 'undecided', requirements: [],
      candidates: [{ id: 'index', description: 'Add an index assuming SQL dominates.' }, { id: 'serializer', description: 'Replace the serializer assuming JSON dominates.' }] }, expectedBefore: ['investigate'] },
  { name: 'no-valid-candidate', group: 'privacy', kind: 'synthetic', source: 'Authored fixture',
    input: { decision: 'Pick a support-log handoff.', whyNow: 'Need a handoff method consistent with privacy requirements.', evidence: 'Both candidate endpoints are public unauthenticated links. Logs contain customer personal data.',
      priorities: 'No customer data may become public. No redaction occurs in either candidate.', baseline: 'undecided', requirements: ['Customer data remains nonpublic.'],
      candidates: [{ id: 'paste', description: 'Upload raw logs to a public paste site.' }, { id: 'bucket', description: 'Upload raw logs to a public object-storage bucket.' }] }, expectedBefore: ['none'] },
  { name: 'equivalent-alternatives', group: 'ties', kind: 'synthetic', source: 'Authored fixture',
    input: { decision: 'Choose a local parser regression test command.', whyNow: 'Compare equivalent alternatives as an eval, not a real reason to consult Jev.', evidence: 'Both aliases execute exactly the same test binary, environment and fixture, with no side effects and equal duration.',
      priorities: 'Run the parser regression test; there is no preference between aliases.', baseline: 'alpha', requirements: [],
      candidates: [{ id: 'alpha', description: 'Run alias alpha.' }, { id: 'beta', description: 'Run alias beta.' }] }, expectedBefore: ['alpha', 'beta'] },
]

// Imported historical data is explicit and local; no discovery or transcript upload at run time.
export function parseCases(value: unknown): Case[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Expected at most 100 eval cases.')
  const names = new Set<string>()
  return value.map(v => {
    if (!record(v) || !text(v.name, 100) || names.has(v.name) || !text(v.group, 100) || !text(v.source, 2000) ||
      !['synthetic', 'human-preference', 'relayed-preference', 'agent-decision'].includes(String(v.kind))) throw new Error('Invalid eval metadata.')
    names.add(v.name)
    const input = parseInput(v.input)
    const allowed = [...input.candidates.map(c => c.id), 'ask_user', 'investigate', 'none']
    const labels = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(s => typeof s === 'string' && allowed.includes(s))
    if (!labels(v.expectedBefore) || (v.clarification !== undefined && (!text(v.clarification, 4000) || !labels(v.expectedAfter))) ||
      (v.clarification === undefined && v.expectedAfter !== undefined)) throw new Error('Invalid eval labels.')
    return { name: v.name, group: v.group, kind: v.kind as Case['kind'], source: v.source, input,
      expectedBefore: v.expectedBefore, ...(v.clarification === undefined ? {} : { clarification: v.clarification as string, expectedAfter: v.expectedAfter as string[] }) }
  })
}

export function variantInput(c: Case, after: boolean, reversed: boolean): Input {
  return { ...c.input, priorities: c.input.priorities + (after ? `\nClarification: ${c.clarification}` : ''),
    candidates: reversed ? [...c.input.candidates].reverse() : c.input.candidates }
}
