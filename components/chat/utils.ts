import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Save an image (data: URI or http(s) URL) to disk. Fetch → blob → <a download>
// works for data: and same-origin/CORS-enabled URLs; this is the only reliable
// path for base64 data: images, which Chrome refuses to open via window.open.
// Cross-origin images without CORS fail the fetch and fall back to a new tab.
export async function downloadImage(src: string, name: string) {
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    window.open(src, '_blank')
  }
}

// Best-effort extension for the download filename, from a data: mime or URL suffix.
function imageExt(src: string): string {
  const mime = src.match(/^data:image\/([a-z0-9.+-]+)/i)?.[1]
  if (mime) return mime.toLowerCase() === 'jpeg' ? 'jpg' : mime.toLowerCase()
  const suffix = src.split(/[?#]/)[0].match(/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i)?.[1]
  return suffix ? suffix.toLowerCase() : 'png'
}

export function imageFileName(src: string, index: number): string {
  return `image-${index + 1}.${imageExt(src)}`
}
