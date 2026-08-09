import { NextRequest, NextResponse } from 'next/server'
import { createLLM, address } from 'connectonion'
import { join } from 'path'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Load or generate server keys for signed requests
let serverKeys: ReturnType<typeof address.load> = null

function getServerKeys() {
  if (serverKeys) return serverKeys

  // Try to load existing keys
  const coDir = join(process.cwd(), '.co')
  serverKeys = address.load(coDir)

  if (!serverKeys) {
    // Generate new keys if none exist
    console.log('Generating new server keys for oo-chat...')
    serverKeys = address.generate()
    // Note: In production, you'd want to save these keys
    // For now, they're regenerated on each server restart
  }

  console.log(`oo-chat identity: ${serverKeys.shortAddress}`)
  return serverKeys
}

export async function POST(request: NextRequest) {
  const { message, messages, apiKey, model, agentUrl, agentSession } = await request.json()

  // If agentUrl is provided, connect to remote agent with signing
  if (agentUrl) {
    const keys = getServerKeys()

    // Extract agent address from URL
    // URL pattern: https://{name}-{short_address}.agents.openonion.ai
    const addressMatch = agentUrl.match(/-(0x[a-f0-9]+)\./i)
    let agentAddress = addressMatch ? addressMatch[1] : ''

    // If we have a short address, fetch the full address from /info
    if (agentAddress && agentAddress.length < 66) {
      const infoResponse = await fetch(`${agentUrl}/info`)
      if (infoResponse.ok) {
        const info = await infoResponse.json() as { address?: string }
        agentAddress = info.address || ''
      } else {
        agentAddress = ''
      }
    }

    // Direct HTTP with session support for multi-turn conversations
    const body = createSignedBody(keys, message, agentAddress || '0x', agentSession)
    const response = await fetch(`${agentUrl}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `Agent error: ${error}` }, { status: response.status })
    }

    const data = await response.json() as {
      result?: string
      response?: string
      content?: string
      session?: unknown
    }
    const content = typeof data === 'string' ? data : (data.response || data.content || data.result || JSON.stringify(data))

    // Return session for multi-turn conversation continuation
    return NextResponse.json({
      response: content,
      session: data.session,
    })
  }

  // Otherwise use direct LLM connection
  const history = messages
    .filter((m: ChatMessage) => m.role !== 'system')
    .map((m: ChatMessage) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  history.push({ role: 'user' as const, content: message })

  const llm = createLLM(model || 'co/gemini-2.5-flash', apiKey || undefined)

  const llmMessages = [
    { role: 'system' as const, content: 'You are a helpful AI assistant. Be concise and helpful.' },
    ...history,
  ]

  const result = await llm.complete(llmMessages, [])
  return NextResponse.json({ response: result.content })
}

/**
 * Create signed request body for direct fetch (when address not extractable)
 */
function createSignedBody(
  keys: NonNullable<ReturnType<typeof address.load>>,
  prompt: string,
  toAddress: string,
  session?: unknown
): Record<string, unknown> {
  const payload = {
    prompt,
    to: toAddress,
    timestamp: Math.floor(Date.now() / 1000),
  }

  // Canonical JSON with sorted keys
  const sortedKeys = Object.keys(payload).sort()
  const sortedPayload: Record<string, unknown> = {}
  for (const key of sortedKeys) {
    sortedPayload[key] = payload[key as keyof typeof payload]
  }
  const canonicalMessage = JSON.stringify(sortedPayload)

  const signature = address.sign(keys, canonicalMessage)

  const body: Record<string, unknown> = {
    payload,
    from: keys.address,
    signature,
  }

  // Include session for multi-turn conversation continuation
  if (session) {
    body.session = session
  }

  return body
}
