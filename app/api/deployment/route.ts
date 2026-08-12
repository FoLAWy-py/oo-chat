import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const baseUrl = (process.env.AGENT_INTERNAL_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

  try {
    const response = await fetch(`${baseUrl}/info`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`Agent returned ${response.status}`)

    const info = await response.json() as {
      address?: string
      name?: string
      tools?: string[]
      skills?: Array<{ name: string; description: string; location?: string }>
      trust?: string
      version?: string
      model?: string
      accepted_inputs?: {
        text?: boolean
        images?: boolean
        files?: { max_file_size_mb: number; max_files_per_request: number }
      }
    }
    if (!info.address || !/^0x[0-9a-fA-F]{64}$/.test(info.address)) {
      throw new Error('Agent did not return a valid address')
    }

    return NextResponse.json({
      ...info,
      name: info.name || 'Social Browser Agent',
      online: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent discovery failed' },
      { status: 503 },
    )
  }
}
