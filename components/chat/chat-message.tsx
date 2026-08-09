'use client'

import { cn } from './utils'
import type { ChatMessageProps } from './types'

export function ChatMessage({ message, className }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <div className="mx-auto max-w-3xl">
        {isUser ? (
          // User message - right-aligned bubble
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-3">
              <p className="text-base leading-relaxed text-neutral-900 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
          </div>
        ) : (
          // Assistant message - left-aligned, no bubble
          <div className="pr-12">
            <p className="text-base leading-relaxed text-neutral-900 whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
