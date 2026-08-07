const migratedKeys = new Set<string>()
const OMITTED_DATA_URL = '[legacy image removed; use server evidence reference]'
const OMITTED_LARGE_FIELD = '[large tool payload omitted; reconnect for server replay]'
const AGENT_SESSION_PREFIX = 'co:agent:'
let quotaRecoveryInstalled = false

function shouldKeepImage(value: unknown): value is string {
  return (
    typeof value === 'string'
    && !value.startsWith('data:')
    && value.length <= 8192
  )
}

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(
      /data:[^;,\s]+;base64,[A-Za-z0-9+/=]+/g,
      OMITTED_DATA_URL,
    )
  }
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value

  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === 'images' && Array.isArray(item)) {
      const images = item.filter(shouldKeepImage)
      if (images.length) next[key] = images
      continue
    }
    if (key === 'dataUrl' && typeof item === 'string' && item.startsWith('data:')) {
      continue
    }
    next[key] = sanitize(item)
  }
  return next
}

function compactToolPayload(value: unknown, parentType = ''): unknown {
  if (typeof value === 'string') {
    if (parentType === 'tool_call' && value.length > 32_000) return OMITTED_LARGE_FIELD
    return value
  }
  if (Array.isArray(value)) return value.map((item) => compactToolPayload(item, parentType))
  if (!value || typeof value !== 'object') return value

  const record = value as Record<string, unknown>
  const itemType = typeof record.type === 'string' ? record.type : parentType
  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    // The server owns the canonical transcript. Persisting trace plus messages
    // and UI duplicates the largest parts of a long research run three times.
    if (key === 'trace') continue
    if (
      itemType === 'tool_call'
      && ['result', 'output', 'raw_result', 'arguments'].includes(key)
      && JSON.stringify(item ?? '').length > 32_000
    ) {
      next[key] = OMITTED_LARGE_FIELD
      continue
    }
    next[key] = compactToolPayload(item, itemType)
  }
  return next
}

function compactPersistedAgentSession(value: string): string {
  try {
    const parsed = JSON.parse(value) as { state?: Record<string, unknown> }
    const state = parsed.state
    if (!state) return value

    if (Array.isArray(state.messages)) {
      state.messages = state.messages.slice(-40).map((item) => compactToolPayload(item))
    }
    if (Array.isArray(state.ui)) {
      state.ui = state.ui.slice(-300).map((item) => compactToolPayload(item))
    }
    if (state.session && typeof state.session === 'object') {
      const session = { ...(state.session as Record<string, unknown>) }
      delete session.trace
      delete session.messages
      state.session = compactToolPayload(session)
    }
    return JSON.stringify(parsed)
  } catch {
    return value
  }
}

function installAgentStorageQuotaRecovery(): void {
  if (quotaRecoveryInstalled || typeof window === 'undefined') return
  quotaRecoveryInstalled = true

  const storagePrototype = window.Storage?.prototype
  if (!storagePrototype) return
  const nativeSetItem = storagePrototype.setItem

  storagePrototype.setItem = function setItemWithAgentQuotaRecovery(
    key: string,
    value: string,
  ): void {
    try {
      nativeSetItem.call(this, key, value)
      return
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error
      if (!key.startsWith(AGENT_SESSION_PREFIX)) throw error
    }

    // Old session caches are recoverable from the agent relay. Evict only as a
    // quota fallback, oldest first, and never evict the session being written.
    const candidates: Array<{ key: string, updatedAt: number }> = []
    for (let index = 0; index < this.length; index++) {
      const storedKey = this.key(index)
      if (!storedKey?.startsWith(AGENT_SESSION_PREFIX) || storedKey === key) continue
      let updatedAt = 0
      try {
        const stored = JSON.parse(this.getItem(storedKey) ?? '{}')
        updatedAt = Number(stored?.state?.updatedAt ?? 0)
      } catch {
        // Malformed caches are safest to evict first.
      }
      candidates.push({ key: storedKey, updatedAt })
    }
    candidates.sort((left, right) => left.updatedAt - right.updatedAt)

    for (const candidate of candidates) {
      this.removeItem(candidate.key)
      try {
        nativeSetItem.call(this, key, value)
        return
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error
      }
    }

    // A single 100-post research transcript can itself exceed the browser's
    // quota. Keep recent user-visible UI and message context while dropping
    // duplicated trace/tool payloads; server replay remains authoritative.
    nativeSetItem.call(this, key, compactPersistedAgentSession(value))
  }
}

function sanitizeStoredSession(key: string): void {
  const original = window.localStorage.getItem(key)
  if (!original || !original.includes('data:')) return
  try {
    const sanitized = JSON.stringify(sanitize(JSON.parse(original)))
    if (sanitized.length >= original.length) return
    window.localStorage.removeItem(key)
    try {
      window.localStorage.setItem(key, sanitized)
    } catch (error) {
      window.localStorage.setItem(key, original)
      throw error
    }
  } catch {
    // A malformed SDK cache is left untouched; server replay remains authoritative.
  }
}

/**
 * Remove legacy base64 payloads before SDK hydration.
 *
 * The transcript remains owned by the SDK's bounded local cache; screenshots do
 * not. New screenshots are server assets referenced from replayable tool results.
 * We intentionally do not move sessions into IndexedDB: doing so creates a second
 * client-side transcript owner and makes delete/restore semantics inconsistent.
 */
export function prepareAgentSessionStorage(
  agentAddress: string,
  sessionId: string,
): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  installAgentStorageQuotaRecovery()
  const currentKey = `co:agent:${agentAddress}:session:${sessionId}`
  if (migratedKeys.has(currentKey)) return Promise.resolve()
  migratedKeys.add(currentKey)

  const sessionKeys: string[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const storedKey = window.localStorage.key(index)
    if (storedKey?.startsWith('co:agent:')) sessionKeys.push(storedKey)
  }
  for (const storedKey of sessionKeys) sanitizeStoredSession(storedKey)
  return Promise.resolve()
}
