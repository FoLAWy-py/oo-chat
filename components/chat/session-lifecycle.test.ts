/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  deleteServerSession,
  deleteServerSessions,
  stopServerSession,
} from './session-lifecycle'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('server session lifecycle', () => {
  test('stops through the authenticated server fallback', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ interrupt_delivered: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(stopServerSession('session id')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session%20id', {
      method: 'POST',
      cache: 'no-store',
    })
  })

  test('deletes every server session before local agent removal', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    )

    await deleteServerSessions(['first', 'second'])

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/sessions/first', { method: 'DELETE' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/sessions/second', { method: 'DELETE' })
  })

  test('keeps local history when server deletion fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Session is still running' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(deleteServerSession('busy')).rejects.toThrow('Session is still running')
  })

  test('allows local cleanup when no server lifecycle is configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Server session lifecycle is not configured' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(deleteServerSession('local-only')).resolves.toBeUndefined()
  })
})
