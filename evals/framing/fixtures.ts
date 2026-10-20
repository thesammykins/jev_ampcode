import type { Evidence, Input } from '../../decision'

const evidence = (finding: string): Evidence => ({ authority: 'Choose a local implementation only; no deployment or external writes.',
  observations: [{ source: 'Executed disposable fixture', finding }], assumptions: ['The inspected fixture contract applies.'], unknowns: [] })
const common = { whyNow: 'Compare implementation actions using inspected evidence.', baseline: 'undecided' }
const retry = [{ id: 'replay', description: "Retry post('k') once using the original key." }, { id: 'lookup', description: "Look up committed record 'k' without a second POST." }]
const sort = [{ id: 'inplace', description: 'Sort the supplied array in place with numeric comparator.' }, { id: 'copy', description: 'Copy the supplied array, then sort the copy with numeric comparator.' }]
export const cases: { id: string; input: Input; expected: string; relations: string[][] }[] = [
  { id: 'retry-prefer-replay', input: { ...common, decision: 'Choose recovery after a committed POST response is lost.',
    evidence: evidence("post appends only if key is absent. Two post('k') calls leave one record, ID 1. Lookup returns ID 1 without POST."),
    priorities: 'No duplicates is hard. Among safe approaches prefer replay. No-second-POST is diagnostic only.', candidates: retry,
    requirements: ['Leaves exactly one committed record.'], diagnostics: ['Performs no second POST.'] }, expected: 'replay', relations: [['supported', 'contradicted'], ['supported', 'supported']] },
  { id: 'retry-prefer-lookup', input: { ...common, decision: 'Choose recovery after a committed POST response is lost.',
    evidence: evidence("post appends only if key is absent. Two post('k') calls leave one record, ID 1. Lookup returns ID 1 without POST."),
    priorities: 'No duplicates is hard. Among safe approaches prefer lookup. No-second-POST is diagnostic only.', candidates: retry,
    requirements: ['Leaves exactly one committed record.'], diagnostics: ['Performs no second POST.'] }, expected: 'lookup', relations: [['supported', 'contradicted'], ['supported', 'supported']] },
  { id: 'api-validation-distinct-from-result', input: { ...common, decision: 'Choose pagination for the installed client.',
    evidence: evidence('v2 list(options) accepts scalar input but defaults non-dict options to {}; ignores extra arguments. Positional call yields valid=true,page=1,limit=20. Object call yields valid=true,page=2,limit=5.'),
    priorities: 'Correct pagination and valid input are hard. No dependency downgrade.',
    candidates: [{ id: 'object', description: "Call list({'page':2,'limit':5})." }, { id: 'positional', description: 'Call list(2,5).' }],
    requirements: ['Requests page 2 with limit 5.', 'Passes the installed API input-shape validation.'], diagnostics: [] }, expected: 'object', relations: [['supported', 'supported'], ['contradicted', 'supported']] },
  ...(['inplace', 'copy'] as const).map(prefer => ({ id: `sort-prefer-${prefer}`, input: { ...common, decision: 'Choose sorting for a caller-owned disposable number array.',
    evidence: evidence('For [10,2,2], both implementations return [2,2,10]. In-place changes the input to [2,2,10] and returns that same array. Copy-sort leaves input [10,2,2] unchanged and returns a distinct array. User permits either mutation policy.'),
    priorities: `Correct numeric ordering is hard. Prefer ${prefer === 'inplace' ? 'in-place sorting' : 'copy-sort'} when both are correct. Input preservation is a diagnostic, not a veto.`,
    candidates: sort, requirements: ['Returns numbers in ascending numeric order, preserving duplicates.'], diagnostics: ['Leaves the supplied array unchanged.'] }, expected: prefer, relations: [['supported', 'contradicted'], ['supported', 'supported']] })),
  { id: 'sort-incompatible-candidates', input: { ...common, decision: 'Choose a sorting approach under both mandatory constraints.',
    evidence: evidence('In-place numeric sort mutates the input and returns the same array. Copy-sort leaves input unchanged but allocates a new array. The input [10,2,2] is unsorted.'),
    priorities: 'Both requirements are mandatory. Develop another alternative if neither candidate fits.', candidates: sort,
    requirements: ['Leaves the supplied array unchanged.', 'Allocates no new array.'], diagnostics: [] }, expected: 'none', relations: [['contradicted', 'supported'], ['supported', 'contradicted']] },
  { id: 'inspect-bottleneck', input: { ...common, decision: 'Choose the optimization for a slow endpoint.',
    evidence: { authority: 'Inspect and implement locally.', observations: [{ source: 'Local timer', finding: 'The endpoint takes four seconds; no profile has been collected.' }], assumptions: [], unknowns: [{ fact: 'Whether database or serialization dominates; profiler is available.', owner: 'agent' }] },
    priorities: 'Address the measured bottleneck, not a guess.', candidates: [{ id: 'index', description: 'Add an index to speed database work.' }, { id: 'serialize', description: 'Optimize serialization.' }],
    requirements: ['Addresses the dominant measured bottleneck.'], diagnostics: [] }, expected: 'investigate', relations: [['unknown'], ['unknown']] },
  { id: 'private-sla', input: { ...common, decision: 'Choose an update transport meeting the privately approved SLA.',
    evidence: { authority: 'Recommend a transport, do not purchase services.', observations: [{ source: 'Benchmarks', finding: 'Polling takes 30 seconds; push takes one second. Both are technically supported.' }], assumptions: [], unknowns: [{ fact: 'Maximum acceptable delay agreed in a private meeting; only the user can supply it.', owner: 'human' }] },
    priorities: 'Meet the actual private SLA, do not invent it.', candidates: [{ id: 'poll', description: 'Poll every 30 seconds.' }, { id: 'push', description: 'Push within one second.' }],
    requirements: ['Meets the privately approved maximum delay.'], diagnostics: [] }, expected: 'ask_user', relations: [['unknown'], ['unknown']] },
]

export const arms = ['baseline', 'prompt-only', 'framed'] as const
export function trial(index: number) {
  const c = cases[Math.floor(index / 3)]
  // Rotate arm order across cases; this is not randomization or repeated sampling.
  const arm = arms[(index % 3 + Math.floor(index / 3)) % 3]
  if (!Number.isInteger(index) || index < 0 || !c || !arm) throw Error('Invalid trial')
  const { diagnostics, ...rest } = c.input
  const legacy: Input = { ...rest, evidence: JSON.stringify(c.input.evidence), requirements: [...c.input.requirements, ...(diagnostics ?? [])] }
  return { c, arm, input: arm === 'framed' ? c.input : legacy }
}
