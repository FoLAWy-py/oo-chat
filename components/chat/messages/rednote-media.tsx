'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HiChevronLeft,
  HiChevronRight,
  HiOutlineArrowDownTray,
  HiOutlinePlay,
} from 'react-icons/hi2'

export interface RedNoteMediaItem {
  id: string
  kind: 'image' | 'video'
  url: string
  mimeType: string
  ordinal: number
  width: number
  height: number
  durationMs: number
  caption: string
  posterUrl?: string
  playable: boolean
}

export interface RedNoteMediaData {
  groupId: string
  title: string
  author: string
  postUrl?: string
  items: RedNoteMediaItem[]
  verificationUrl?: string
}

const DIRECTIVE_PATTERN = /\[\[rednote_media\]\]([\s\S]*?)\[\[\/rednote_media\]\]/g

function normalizeEvidenceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = new URL(value)
    if (
      !['http:', 'https:'].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || !parsed.pathname.startsWith('/evidence/v1/')
      || !parsed.searchParams.get('token')
    ) return undefined
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return undefined
  }
}

function normalizePostUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.toLowerCase()
    if (
      parsed.protocol !== 'https:'
      || (hostname !== 'rednote.com' && !hostname.endsWith('.rednote.com'))
      || parsed.username
      || parsed.password
    ) return undefined
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return undefined
  }
}

function boundedNumber(value: unknown, maximum: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(number, maximum)) : 0
}

function normalizeItem(value: unknown): RedNoteMediaItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const kind = item.kind === 'video' ? 'video' : item.kind === 'image' ? 'image' : null
  const url = normalizeEvidenceUrl(item.url)
  const id = typeof item.id === 'string' ? item.id : ''
  if (!kind || !url || !id) return null
  const mimeType = typeof item.mime_type === 'string' ? item.mime_type.toLowerCase() : ''
  if (
    (kind === 'image' && !mimeType.startsWith('image/'))
    || (kind === 'video' && item.playable !== false && !['video/mp4', 'video/webm'].includes(mimeType))
  ) return null
  return {
    id,
    kind,
    url,
    mimeType,
    ordinal: boundedNumber(item.ordinal, 1000),
    width: boundedNumber(item.width, 20000),
    height: boundedNumber(item.height, 20000),
    durationMs: boundedNumber(item.duration_ms, 24 * 60 * 60 * 1000),
    caption: typeof item.caption === 'string' ? item.caption.trim().slice(0, 500) : '',
    posterUrl: normalizeEvidenceUrl(item.poster_url),
    playable: kind === 'image' || item.playable !== false,
  }
}

function normalizeMedia(value: unknown): RedNoteMediaData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.provider !== 'rednote' || !Array.isArray(data.items)) return null
  const groupId = typeof data.group_id === 'string' ? data.group_id : ''
  if (!groupId || !/^[a-zA-Z0-9_.-]{1,160}$/.test(groupId)) return null
  const items = data.items
    .map(normalizeItem)
    .filter((item): item is RedNoteMediaItem => Boolean(item))
    .sort((left, right) => left.ordinal - right.ordinal)
    .slice(0, 36)
  if (!items.length) return null
  const verification = data.verification
  const verificationUrl = verification && typeof verification === 'object' && !Array.isArray(verification)
    ? normalizeEvidenceUrl((verification as Record<string, unknown>).url)
    : undefined
  return {
    groupId,
    title: typeof data.title === 'string' && data.title.trim()
      ? data.title.trim().slice(0, 300)
      : 'RedNote post',
    author: typeof data.author === 'string' ? data.author.trim().slice(0, 160) : '',
    postUrl: normalizePostUrl(data.post_url),
    items,
    verificationUrl,
  }
}

export function extractRedNoteMedia(content: string): {
  text: string
  mediaGroups: RedNoteMediaData[]
} {
  const mediaGroups: RedNoteMediaData[] = []
  const text = content.replace(DIRECTIVE_PATTERN, (_directive, raw: string) => {
    try {
      const media = normalizeMedia(JSON.parse(raw))
      if (media) mediaGroups.push(media)
    } catch {
      // Invalid or untrusted media directives are omitted rather than rendered.
    }
    return ''
  }).trim()
  return { text, mediaGroups }
}

function formatDuration(durationMs: number): string {
  if (!durationMs) return ''
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function MediaThumbnail({ item, active, label, onSelect }: {
  item: RedNoteMediaItem
  active: boolean
  label: string
  onSelect: () => void
}) {
  const preview = item.kind === 'image' ? item.url : item.posterUrl || item.url
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-neutral-100 transition ${
        active ? 'border-neutral-900' : 'border-transparent hover:border-neutral-400'
      }`}
    >
      <img src={preview} alt="" className="h-full w-full object-cover" />
      {item.kind === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
          <HiOutlinePlay className="h-5 w-5" />
        </span>
      )}
    </button>
  )
}

export function RedNoteMediaCards({ mediaGroups }: { mediaGroups: RedNoteMediaData[] }) {
  return (
    <div className="flex w-full flex-col gap-4">
      {mediaGroups.map(group => <RedNoteMediaCard key={group.groupId} media={group} />)}
    </div>
  )
}

function RedNoteMediaCard({ media }: { media: RedNoteMediaData }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const item = media.items[activeIndex] || media.items[0]
  const total = media.items.length
  const previous = () => setActiveIndex(index => (index - 1 + total) % total)
  const next = () => setActiveIndex(index => (index + 1) % total)
  const title = media.author ? `${media.title} — ${media.author}` : media.title
  const aspectRatio = useMemo(() => {
    if (!item.width || !item.height) return undefined
    return `${item.width} / ${item.height}`
  }, [item.height, item.width])

  useEffect(() => {
    videoRef.current?.pause()
  }, [activeIndex])

  return (
    <section
      className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
      aria-label={title}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' && total > 1) previous()
        if (event.key === 'ArrowRight' && total > 1) next()
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">{media.title}</div>
          {media.author && <div className="truncate text-xs text-neutral-500">{media.author}</div>}
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {activeIndex + 1} / {total}
        </span>
      </header>

      <div className="group relative flex min-h-64 items-center justify-center bg-neutral-950">
        {item.kind === 'image' ? (
          <img
            src={item.url}
            alt={item.caption || `RedNote post image ${activeIndex + 1} of ${total}`}
            className="max-h-[560px] w-full object-contain"
            style={{ aspectRatio }}
          />
        ) : item.playable ? (
          <video
            ref={videoRef}
            key={item.id}
            src={item.url}
            poster={item.posterUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-[560px] w-full bg-black object-contain"
            style={{ aspectRatio }}
          >
            Your browser does not support this video.
          </video>
        ) : (
          <div className="relative w-full">
            <img
              src={item.posterUrl || item.url}
              alt={item.caption || 'RedNote video poster'}
              className="max-h-[560px] w-full object-contain opacity-90"
              style={{ aspectRatio }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white">
                Video preview only
              </span>
            </div>
          </div>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={previous}
              aria-label="Previous media"
              className="absolute left-3 rounded-full bg-black/55 p-2 text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <HiChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next media"
              className="absolute right-3 rounded-full bg-black/55 p-2 text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <HiChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
        <a
          href={item.url}
          download
          aria-label={`Download media ${activeIndex + 1}`}
          title="Download media"
          className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white opacity-100 shadow-sm hover:bg-black/80 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <HiOutlineArrowDownTray className="h-4 w-4" />
        </a>
        {item.kind === 'video' && item.durationMs > 0 && (
          <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs text-white">
            {formatDuration(item.durationMs)}
          </span>
        )}
      </div>

      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-neutral-100 px-4 py-3">
          {media.items.map((entry, index) => (
            <MediaThumbnail
              key={entry.id}
              item={entry}
              active={index === activeIndex}
              label={`Show media ${index + 1} of ${total}`}
              onSelect={() => setActiveIndex(index)}
            />
          ))}
        </div>
      )}

      <footer className="border-t border-neutral-100">
        {media.postUrl && (
          <a
            href={media.postUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="block px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Open this post on RedNote
          </a>
        )}
        {media.verificationUrl && (
          <details className="border-t border-neutral-100">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              Verification screenshot
            </summary>
            <div className="border-t border-neutral-100 bg-neutral-50 p-3">
              <img
                src={media.verificationUrl}
                alt="Exact RedNote post DOM verification screenshot"
                className="max-h-[560px] w-full rounded-lg object-contain"
              />
            </div>
          </details>
        )}
      </footer>
    </section>
  )
}
