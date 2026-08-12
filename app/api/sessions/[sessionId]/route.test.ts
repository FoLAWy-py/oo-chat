import { afterEach, describe, expect, test, vi } from 'vitest'
import { DELETE, POST } from './route'

const sessionId = '123e4567-e89b-42d3-a456-426614174000'
const context = { params: Promise.resolve({ sessionId }) }

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.AGENT_INTERNAL_URL
  delete process.env.SOCIAL_SESSION_LIFECYCLE_TOKEN
})

describe('session lifecycle proxy', () => {
  test('forwards stop with the server token', async () => {
    process.env.AGENT_INTERNAL_URL = 'http://agent:8000/'
    process.env.SOCIAL_SESSION_LIFECYCLE_TOKEN = 'lifecycle-token'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ interrupt_delivered: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(new Request('http://localhost') as never, context)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      `http://agent:8000/session-lifecycle/v1/${sessionId}`,
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer lifecycle-token' },
      }),
    )
  })

  test('forwards deletion and rejects malformed ids', async () => {
    process.env.SOCIAL_SESSION_LIFECYCLE_TOKEN = 'lifecycle-token'
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const deleted = await DELETE(new Request('http://localhost') as never, context)
    const invalid = await DELETE(new Request('http://localhost') as never, {
      params: Promise.resolve({ sessionId: 'bad-id' }),
    })

    expect(deleted.status).toBe(200)
    expect(invalid.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
