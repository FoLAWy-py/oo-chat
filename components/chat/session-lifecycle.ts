interface StopServerSessionOptions {
  retryStartup?: boolean
}

export async function stopServerSession(
  sessionId: string,
  options: StopServerSessionOptions = {},
): Promise<boolean> {
  // A brand-new chat can render its Stop button just before the websocket INPUT
  // has registered the server execution. Retry this narrow startup window so the
  // stop request cannot be lost between navigation and registry creation.
  const attempts = options.retryStartup === false ? 1 : 40
  for (let attempt = 0; attempt < attempts; attempt += 1) {
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
      // The websocket interrupt may still succeed; retry the server fallback.
    }
    if (attempt + 1 < attempts) {
      await new Promise(resolve => window.setTimeout(resolve, 100))
    }
  }
  return false
}

export async function deleteServerSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
  if (response.ok) return
  const payload = await response.json().catch(() => ({})) as { error?: string }
  throw new Error(payload.error || `Session cleanup failed (${response.status})`)
}

export async function deleteServerSessions(sessionIds: string[]): Promise<void> {
  for (const sessionId of sessionIds) {
    await deleteServerSession(sessionId)
  }
}
