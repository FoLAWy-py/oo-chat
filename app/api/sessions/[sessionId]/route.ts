import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ sessionId: string }>
}

async function forwardLifecycle(method: 'DELETE' | 'POST', context: RouteContext) {
  const { sessionId } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
  }

  const baseUrl = (process.env.AGENT_INTERNAL_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
  const token = (
    process.env.SOCIAL_SESSION_LIFECYCLE_TOKEN
    || process.env.OPENONION_API_KEY
    || localDevelopmentToken()
    || ''
  ).trim()
  if (!token) {
    return NextResponse.json(
      { error: 'Server session lifecycle is not configured' },
      { status: 503 },
    )
  }

  try {
    const response = await fetch(`${baseUrl}/session-lifecycle/v1/${sessionId}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent session request failed' },
      { status: 502 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  return forwardLifecycle('DELETE', context)
}

export async function POST(_request: NextRequest, context: RouteContext) {
  return forwardLifecycle('POST', context)
}

function localDevelopmentToken(): string {
  try {
    const source = readFileSync(resolve(process.cwd(), '..', '.env'), 'utf8')
    const values = new Map<string, string>()
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(SOCIAL_SESSION_LIFECYCLE_TOKEN|OPENONION_API_KEY)\s*=\s*(.*)\s*$/)
      if (!match) continue
      values.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2').trim())
    }
    return values.get('SOCIAL_SESSION_LIFECYCLE_TOKEN') || values.get('OPENONION_API_KEY') || ''
  } catch {
    return ''
  }
}
