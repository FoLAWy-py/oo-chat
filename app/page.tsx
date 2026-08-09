'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatLayout } from '@/components/chat-layout'
import { useIdentity } from '@/hooks/use-identity'
import { useChatStore } from '@/store/chat-store'

export default function DeploymentHome() {
  const router = useRouter()
  const addAgent = useChatStore(state => state.addAgent)
  const { authError } = useIdentity()
  const [bindingError, setBindingError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const bindAgent = useCallback(async () => {
    setBindingError(null)
    const response = await fetch('/api/deployment', { cache: 'no-store' })
    const data = await response.json() as { address?: string; error?: string }
    if (!response.ok || !data.address) {
      throw new Error(data.error || 'Agent discovery failed')
    }
    addAgent(data.address)
    router.replace(`/${data.address}`)
  }, [addAgent, router])

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      bindAgent().catch(error => {
        if (active) {
          setBindingError(error instanceof Error ? error.message : 'Agent binding failed')
        }
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [attempt, bindAgent])

  return (
    <ChatLayout>
      <main className="flex flex-1 items-center justify-center p-8">
        <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">Social Browser Agent</h1>
          {!bindingError && !authError && (
            <p className="mt-3 text-sm text-neutral-500">Initializing balance and binding the deployed Agent…</p>
          )}
          {(bindingError || authError) && (
            <>
              <p className="mt-3 text-sm text-red-600">{bindingError || authError}</p>
              <button
                type="button"
                onClick={() => setAttempt(value => value + 1)}
                className="mt-5 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </>
          )}
        </section>
      </main>
    </ChatLayout>
  )
}
