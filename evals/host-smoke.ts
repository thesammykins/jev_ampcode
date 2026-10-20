import type { PluginAPI, PluginToolDefinition } from '@ampcode/plugin'
import plugin from '../index'
import { cases } from './cases'

// Explicit opt-in live check, not installed. Requires a real accessible Amp thread.
export default function (amp: PluginAPI) {
  let tool: PluginToolDefinition
  plugin({ on: amp.on.bind(amp), ai: amp.ai, registerTool(definition: PluginToolDefinition) {
    tool = definition
    return amp.registerTool(definition)
  } } as PluginAPI)
  amp.on('session.start', async (_event, ctx) => {
    const result = JSON.parse(await tool.execute(cases[0].input, ctx) as string)
    if (result.recommendation?.choice !== 'option_0') throw new Error('Smoke case did not select the expected candidate.')
    ctx.logger.log(JSON.stringify({ smoke: 'passed', source: result.source, model: result.model, selection: result.recommendation.choice }))
  })
}
