import type { PluginEventContext, ThreadMessage } from '@ampcode/plugin'

type Conversation = { role: 'user' | 'assistant'; text: string }[]

function textOnly(messages: Pick<ThreadMessage, 'role' | 'content'>[]): Conversation {
  return messages.flatMap(m => m.role === 'user' || m.role === 'assistant'
    ? [{ role: m.role, text: m.content.filter(b => b.type === 'text').map(b => b.text).join('\n') }].filter(m => m.text)
    : [])
}

// The CLI export is a documented full-thread read, not the model-visible compaction summary.
// Parse only known conversation fields; never return env, metadata, tool results or thinking.
function exportedConversation(raw: string, threadID: string) {
  if (raw.length > 16 * 1024 * 1024) throw Error('Thread export exceeds local read budget')
  const data = JSON.parse(raw)
  if (data?.id !== threadID || !Array.isArray(data.messages)) throw Error('Invalid thread export')
  const messages = data.messages.map((m: any) => {
    if (!m || typeof m.role !== 'string' || !Array.isArray(m.content)) throw Error('Invalid exported message')
    const content = m.content.filter((b: any) => b?.type === 'text').map((b: any) => {
      if (typeof b.text !== 'string') throw Error('Invalid exported text')
      return { type: 'text' as const, text: b.text }
    })
    return { role: m.role, content }
  })
  return { userHistory: textOnly(messages).filter(m => m.role === 'user'), recentConversation: textOnly(messages.slice(-20)) }
}

export async function questionHistory(ctx: Pick<PluginEventContext<'tool.call'>, 'thread' | '$'>) {
  try {
    const recent = await ctx.thread.messages({ full: true, limit: 20, from: 'end' })
    if (!recent.length) throw Error('Full history unavailable')
    const userHistory: Conversation = []
    for (let offset = 0; offset < 1000; offset += 20) {
      const page = await ctx.thread.messages({ full: true, roles: ['user'], from: 'start', offset, limit: 20 })
      userHistory.push(...textOnly(page))
      if (JSON.stringify(userHistory).length > 50000) return null
      if (page.length < 20) {
        if (!userHistory.length) throw Error('Original user history unavailable')
        return { source: 'thread.messages', userHistory, recentConversation: textOnly(recent) }
      }
    }
    return null // Incomplete within the page budget; never infer from a truncated prefix.
  } catch {
    // A read-only authenticated Amp command, invoked only when the plugin history API fails.
    // Shell interpolation is escaped by Amp. Do not print or persist the full export.
    const result = await ctx.$`amp threads export ${ctx.thread.id}`
    if (result.exitCode !== 0) throw Error('Full thread export unavailable')
    const { userHistory, recentConversation } = exportedConversation(result.stdout, ctx.thread.id)
    if (!userHistory.length) return null
    return { source: 'amp threads export', userHistory, recentConversation }
  }
}
