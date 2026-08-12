import { afterEach, describe, expect, test, vi } from 'vitest'
import { GET } from './route'

const address = `0x${'a'.repeat(64)}`

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.AGENT_INTERNAL_URL
})

describe('deployment discovery route', () => {
  test('returns the bundled agent profile', async () => {
    process.env.AGENT_INTERNAL_URL = 'http://agent:8000/'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ address, name: 'Browser' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ address, name: 'Browser', online: true })
    expect(fetchMock).toHaveBeenCalledWith('http://agent:8000/info', expect.objectContaining({ cache: 'no-store' }))
  })

  test('rejects an invalid agent address', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ address: 'not-an-address' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ))

    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: 'Agent did not return a valid address' })
  })
})
