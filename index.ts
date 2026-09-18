import type { PluginAPI } from '@ampcode/plugin'
import { ADVISORY, MODEL, TOOL_DESCRIPTION, evaluate, inputSchema, parseInput } from './decision'

export const description = 'Compare bounded alternatives with TypeSafe Jev using explicit evidence and criteria. Advisory only; no capture, telemetry or automatic execution.'

export function apiKey() {
  const key = process.env.JEV_KEY?.trim() || process.env.TYPESAFE_API_KEY?.trim()
  if (!key) throw new Error('Add JEV_KEY in Amp secrets and refresh the orb environment, or supply TYPESAFE_API_KEY in the executor environment. Never put a token in tool arguments or project files.')
  return key
}

export default function (amp: PluginAPI) {
  amp.registerTool({ name: 'jev_evaluate', title: 'Compare alternatives with Jev', description: TOOL_DESCRIPTION, inputSchema,
    async execute(value) {
      const input = parseInput(value)
      const key = apiKey()
      if (JSON.stringify(input).includes(key)) throw new Error('Input contains the configured API token; remove it before evaluation.')
      const config = await amp.configuration.get()
      const model = config['jev.model'] ?? MODEL
      if (typeof model !== 'string') throw new Error('Invalid jev.model.')
      const result = await evaluate(input, key, model)
      return JSON.stringify({ advisory: ADVISORY,
        candidates: input.candidates.map((c, i) => ({ selection: `option_${i}`, id: c.id })), ...result })
    },
  })
}
