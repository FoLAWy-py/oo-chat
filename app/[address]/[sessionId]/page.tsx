'use client'

import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Chat, useAgentSDK, ModeStatusBar, PlanModeBanner, UlwModeBanner } from '@/components/chat'
import type { UI, ApprovalMode } from '@/components/chat/types'
import { dedupeUI } from '@/components/chat/dedupe-ui'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress } from '@/hooks/use-agent-info'

export default function ChatSessionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const address = params.address as string
  const sessionId = params.sessionId as string

  // Read initial mode from URL (stateless, simple)
  const initialMode = (searchParams.get('mode') as ApprovalMode) || 'safe'
  const initialTurns = searchParams.get('turns') ? parseInt(searchParams.get('turns')!) : null

  const {
    agents,
    addAgent,
    conversations,
    createConversation,
    selectConversation,
    updateTitle,
    consumePendingMessage,
    _hasHydrated,
  } = useChatStore()

  useIdentity()

  const agentInfoMap = useAgentInfo([address])
  const skills = agentInfoMap[address]?.skills

  // Add agent if not in list
  useEffect(() => {
    if (address && !agents.includes(address)) {
      addAgent(address)
    }
  }, [address, agents, addAgent])

  // Find the conversation
  const conversation = useMemo(
    () => conversations.find(c => c.sessionId === sessionId),
    [conversations, sessionId]
  )

  // Set active session when route changes
  useEffect(() => {
    if (sessionId) {
      selectConversation(sessionId)
    }
  }, [sessionId, selectConversation])

  const {
    ui: hookUI,
    isLoading,
    isStopping,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    pendingUlwTurnsReached,
    pendingPlanReview,
    sessionState,
    mode,
    ulwTurnsRemaining,
    send,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    respondToUlwTurnsReached,
    respondToPlanReview,
    setMode,
    reconnect,
    interrupt,
  } = useAgentSDK({
    agentAddress: address,
    sessionId,
    onError: (error) => setConnectionError(error),
  })

  // Consume pending message and apply initial mode from URL
  const consumedRef = useRef<string | null>(null)

  // Connection error state for retry functionality
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    if (consumedRef.current === sessionId) return
    consumedRef.current = sessionId

    // Apply mode from URL FIRST (before sending message)
    if (initialMode !== 'safe') {
      setMode(initialMode, initialTurns ? { turns: initialTurns } : undefined)
    }

    // Then send the pending message
    const pendingMessage = consumePendingMessage()
    if (pendingMessage) {
      send(pendingMessage.content, pendingMessage.images, pendingMessage.files)
    }
  }, [sessionId, initialMode, initialTurns, consumePendingMessage, send, setMode])

  // The SDK's per-session store is the transcript's single source of truth;
  // it hydrates synchronously from localStorage, so hookUI already carries
  // the persisted conversation on reload.
  const displayUI = useMemo((): UI[] => dedupeUI(hookUI as UI[]), [hookUI])

  // Keep the sidebar title in sync with the first user message
  useEffect(() => {
    if (!sessionId) return
    const firstUser = displayUI.find(e => e.type === 'user')
    if (firstUser && 'content' in firstUser) {
      // Strip markdown punctuation so the sidebar shows plain text, not '# Heading'
      const title = firstUser.content.replace(/[#*`>_~\n]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (title) updateTitle(sessionId, title)
    }
  }, [sessionId, displayUI, updateTitle])

  const handleSend = useCallback((content: string, images?: string[], files?: import('@/components/chat/types').FileAttachment[]) => {
    if (!conversation) {
      createConversation(sessionId, address)
    }
    setConnectionError(null)
    send(content, images, files)
  }, [conversation, sessionId, address, createConversation, send, setConnectionError])

  // Retry resends the last user message from the transcript — survives page reloads,
  // unlike transient state.
  const lastUserMessage = useMemo(() => {
    for (let i = displayUI.length - 1; i >= 0; i--) {
      const item = displayUI[i]
      if (item.type === 'user' && 'content' in item) return item.content
    }
    return ''
  }, [displayUI])

  const handleReconnect = useCallback(() => {
    setConnectionError(null)
    reconnect()
  }, [reconnect, setConnectionError])

  // Redirect to agent landing if no conversation and no pending messages
  // Only after store has hydrated from localStorage — avoids redirect on refresh
  const shouldRedirect = _hasHydrated && !conversation && hookUI.length === 0
  useEffect(() => {
    if (shouldRedirect) {
      router.replace(`/${address}`)
    }
  }, [shouldRedirect, router, address])

  if (shouldRedirect) {
    return null
  }

  const isUlwActive = mode === 'ulw'

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* Plan mode banner */}
        {mode === 'plan' && (
          <PlanModeBanner onExit={() => setMode('safe')} />
        )}

        {/* ULW mode banner */}
        {isUlwActive && (
          <UlwModeBanner turnsRemaining={ulwTurnsRemaining} onExit={() => setMode('safe')} />
        )}

        {/* Chat with mode status bar (ULW toggle integrated) */}
        <Chat
          ui={displayUI}
          onSend={handleSend}
          onStop={interrupt}
          isLoading={isLoading}
          isStopping={isStopping}
          suggestions={[]}
          pendingAskUser={pendingAskUser}
          onAskUserResponse={respondToAskUser}
          pendingApproval={pendingApproval}
          onApprovalResponse={respondToApproval}
          pendingOnboard={pendingOnboard}
          onOnboardSubmit={submitOnboard}
          pendingUlwTurnsReached={pendingUlwTurnsReached}
          onUlwTurnsReachedResponse={respondToUlwTurnsReached}
          pendingPlanReview={pendingPlanReview}
          onPlanReviewResponse={respondToPlanReview}
          sessionState={sessionState}
          statusBar={
            <ModeStatusBar
              mode={mode}
              onModeChange={setMode}
              disabled={false}
              ulwTurnsRemaining={ulwTurnsRemaining}
              sessionState={sessionState}
              isLoading={isLoading}
              connectionError={connectionError}
              onRetry={lastUserMessage ? () => handleSend(lastUserMessage) : undefined}
              onReconnect={handleReconnect}
            />
          }
          connectionError={connectionError}
          onRetry={lastUserMessage ? () => handleSend(lastUserMessage) : undefined}
          onDismissError={() => setConnectionError(null)}
          skills={skills}
          agentName={agentInfoMap[address]?.name || shortAddress(address)}
        />
      </div>
    </>
  )
}
