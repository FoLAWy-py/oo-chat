import type { ChatItem } from 'connectonion/react'

interface ServerEvidenceImage {
  id: string
  groupId: string
  content: string
  url: string
  ordinal: number
}

interface ServerMediaItem {
  id: string
  groupId: string
  content: string
  url: string
  kind: 'image' | 'video'
  mimeType: string
  ordinal: number
  width: number
  height: number
  durationMs: number
  caption: string
  posterUrl?: string
  playable: boolean
}

interface ServerMediaGroup {
  groupId: string
  content: string
  title: string
  author: string
  postUrl: string
  items: ServerMediaItem[]
  verification?: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isEvidenceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && parsed.pathname.startsWith('/evidence/v1/')
      && Boolean(parsed.searchParams.get('token'))
    )
  } catch {
    return false
  }
}

function collectImages(value: unknown, images: ServerEvidenceImage[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectImages(item, images)
    return
  }
  if (!isRecord(value)) return

  const serverImages = value.server_images
  if (Array.isArray(serverImages)) {
    for (const raw of serverImages) {
      if (!isRecord(raw) || !isEvidenceUrl(raw.url)) continue
      const id = typeof raw.id === 'string' ? raw.id : ''
      const groupId = typeof raw.group_id === 'string' ? raw.group_id : ''
      if (!id || !groupId) continue
      images.push({
        id,
        groupId,
        content: typeof raw.content === 'string' ? raw.content : 'Verification evidence.',
        url: raw.url,
        ordinal: typeof raw.ordinal === 'number' ? raw.ordinal : 0,
      })
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key !== 'server_images') collectImages(child, images)
  }
}

function collectMedia(value: unknown, groups: ServerMediaGroup[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMedia(item, groups)
    return
  }
  if (!isRecord(value)) return

  const rawMedia = value.server_media
  if (Array.isArray(rawMedia)) {
    const items: ServerMediaItem[] = []
    for (const raw of rawMedia) {
      if (!isRecord(raw) || !isEvidenceUrl(raw.url)) continue
      const id = typeof raw.id === 'string' ? raw.id : ''
      const groupId = typeof raw.group_id === 'string' ? raw.group_id : ''
      const kind = raw.kind === 'video' ? 'video' : raw.kind === 'image' ? 'image' : null
      const mimeType = typeof raw.mime_type === 'string' ? raw.mime_type : ''
      if (!id || !groupId || !kind || !mimeType) continue
      items.push({
        id,
        groupId,
        content: typeof raw.content === 'string' ? raw.content : 'RedNote post media.',
        url: raw.url,
        kind,
        mimeType,
        ordinal: typeof raw.ordinal === 'number' ? raw.ordinal : 0,
        width: typeof raw.width === 'number' ? raw.width : 0,
        height: typeof raw.height === 'number' ? raw.height : 0,
        durationMs: typeof raw.duration_ms === 'number' ? raw.duration_ms : 0,
        caption: typeof raw.caption === 'string' ? raw.caption : '',
        posterUrl: isEvidenceUrl(raw.poster_url) ? raw.poster_url : undefined,
        playable: kind === 'image' || raw.playable !== false,
      })
    }
    if (items.length) {
      items.sort((left, right) => left.ordinal - right.ordinal)
      const groupId = items[0].groupId
      const verification = isRecord(value.server_verification)
        && isEvidenceUrl(value.server_verification.url)
        ? value.server_verification
        : undefined
      groups.push({
        groupId,
        content: items[0].content,
        title: typeof value.server_media_title === 'string'
          ? value.server_media_title : 'RedNote post',
        author: typeof value.server_media_author === 'string'
          ? value.server_media_author : '',
        postUrl: typeof value.server_media_post_url === 'string'
          ? value.server_media_post_url : '',
        items,
        verification,
      })
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key !== 'server_media' && key !== 'server_verification') collectMedia(child, groups)
  }
}

function resultImages(result: unknown): ServerEvidenceImage[] {
  if (typeof result !== 'string' || !result.trim()) return []
  try {
    const parsed: unknown = JSON.parse(result)
    const images: ServerEvidenceImage[] = []
    collectImages(parsed, images)
    return images
  } catch {
    return []
  }
}

function resultMedia(result: unknown): ServerMediaGroup[] {
  if (typeof result !== 'string' || !result.trim()) return []
  try {
    const parsed: unknown = JSON.parse(result)
    const groups: ServerMediaGroup[] = []
    collectMedia(parsed, groups)
    return groups
  } catch {
    return []
  }
}

function mediaDirective(group: ServerMediaGroup): string {
  const payload = {
    provider: 'rednote',
    group_id: group.groupId,
    title: group.title,
    author: group.author,
    post_url: group.postUrl,
    items: group.items.map(item => ({
      id: item.id,
      group_id: item.groupId,
      url: item.url,
      kind: item.kind,
      mime_type: item.mimeType,
      ordinal: item.ordinal,
      width: item.width,
      height: item.height,
      duration_ms: item.durationMs,
      caption: item.caption,
      poster_url: item.posterUrl,
      playable: item.playable,
    })),
    verification: group.verification,
  }
  return `${group.content}\n\n[[rednote_media]]${JSON.stringify(payload)}[[/rednote_media]]`
}

function existingMediaGroups(ui: ChatItem[]): Set<string> {
  const groups = new Set<string>()
  const pattern = /\[\[rednote_media\]\]([\s\S]*?)\[\[\/rednote_media\]\]/g
  for (const item of ui) {
    if (item.type !== 'agent' || typeof item.content !== 'string') continue
    for (const match of item.content.matchAll(pattern)) {
      try {
        const parsed: unknown = JSON.parse(match[1])
        if (isRecord(parsed) && typeof parsed.group_id === 'string') groups.add(parsed.group_id)
      } catch {
        // Ignore malformed directives; the renderer will reject them too.
      }
    }
  }
  return groups
}

/** Rebuild server-backed evidence bubbles from replayed tool results. */
export function mergeServerEvidence(ui: ChatItem[]): ChatItem[] {
  const existingUrls = new Set(
    ui.flatMap(item => item.type === 'agent' ? (item.images || []) : []),
  )
  const seenGroups = new Set<string>()
  const seenMediaGroups = existingMediaGroups(ui)
  const merged: ChatItem[] = []

  for (const item of ui) {
    merged.push(item)
    if (item.type !== 'tool_call') continue

    for (const group of resultMedia(item.result)) {
      if (seenMediaGroups.has(group.groupId)) continue
      seenMediaGroups.add(group.groupId)
      merged.push({
        id: `server-media-${group.groupId}`,
        type: 'agent',
        content: mediaDirective(group),
      })
    }

    const groups = new Map<string, ServerEvidenceImage[]>()
    for (const image of resultImages(item.result)) {
      if (existingUrls.has(image.url)) continue
      const group = groups.get(image.groupId) || []
      group.push(image)
      groups.set(image.groupId, group)
    }

    for (const [groupId, images] of groups) {
      if (seenGroups.has(groupId)) continue
      seenGroups.add(groupId)
      images.sort((left, right) => left.ordinal - right.ordinal)
      merged.push({
        id: `server-evidence-${groupId}`,
        type: 'agent',
        content: images[0]?.content || 'Verification evidence.',
        images: images.map(image => image.url),
      })
    }
  }

  return merged
}
