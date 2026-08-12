const STOP_RETRY_ATTEMPTS = 40
const STOP_RETRY_DELAY_MS = 100

export async function stopServerSession(sessionId: string): Promise<boolean> {
  // The UI can render Stop just before the backend has registered the run.
  // Retry that short startup window so the fallback does not miss the session.
  for (let attempt = 0; attempt < STOP_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (response.ok) {
        const payload = await response.json() as { interrupt_delivered?: boolean }
        if (payload.interrupt_delivered) return true
      }
    } catch {
      // The WebSocket interrupt may still work. Keep the HTTP fallback bounded.
    }
    await new Promise(resolve => window.setTimeout(resolve, STOP_RETRY_DELAY_MS))
  }
  return false
}

export async function deleteServerSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
  if (response.ok) return
  const payload = await response.json().catch(() => ({})) as { error?: string }
  // The reusable oo-chat frontend can run without the optional lifecycle
  // endpoint. In that mode there is no owned server session to clean up, so the
  // caller should still remove its local transcript. Configured deployments do
  // not use this path, and every other server error remains blocking.
  if (response.status === 503 && payload.error === 'Server session lifecycle is not configured') {
    return
  }
  throw new Error(payload.error || `Session cleanup failed (${response.status})`)
}

export async function deleteServerSessions(sessionIds: string[]): Promise<void> {
  for (const sessionId of sessionIds) {
    await deleteServerSession(sessionId)
  }
}
