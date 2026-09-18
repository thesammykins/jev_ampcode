import type { PluginAPI, PluginToolDefinition } from '@ampcode/plugin'
import plugin from '../index'
import { cases } from './cases'

// Explicit opt-in live check, not installed. Uses the secret already in the executor.
// This CLI's plugins exec does not implement configuration.get, so substitute defaults.
export default function (amp: PluginAPI) {
  let tool: PluginToolDefinition
  plugin({ ...amp, configuration: { ...amp.configuration, get: async () => ({}) }, registerTool(definition) {
    tool = definition
    return amp.registerTool(definition)
  } })
  amp.on('session.start', async (_event, ctx) => {
    if (!process.env.JEV_KEY?.trim()) throw new Error('JEV_KEY is unavailable to the plugin runtime.')
    const result = JSON.parse(await tool.execute(cases[0].input, ctx) as string)
    if (result.recommendation?.choice !== 'option_0') throw new Error('Smoke case did not select the expected candidate.')
    ctx.logger.log(JSON.stringify({ smoke: 'passed', credentialSource: 'JEV_KEY', model: result.model, selection: result.recommendation.choice, usage: result.usage }))
  })
}
