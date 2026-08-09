export interface FileAttachment {
  name: string
  type: string
  size: number
  dataUrl: string
}

export type AskUserResponseHandler = (
  answer: string | string[],
  images?: string[],
  files?: FileAttachment[],
) => void

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: Date
}

export type StreamEventType =
  | 'user_input'
  | 'thinking'
  | 'llm_call'      // Backend sends this when LLM completes
  | 'tool_call'     // Backend sends this BEFORE tool execution
  | 'tool_result'   // Backend sends this AFTER tool execution
  | 'assistant'
  | 'error'
  | 'complete'
  | 'ask_user'

export type WsMessageType = StreamEventType | 'OUTPUT' | 'ERROR' | 'INPUT'

export interface AskUserEvent {
  type: 'ask_user'
  question: string
  options?: string[]
  disabled_options?: string[]
  multi_select?: boolean
}

export interface StreamEvent {
  type: WsMessageType
  id?: string  // Tool call ID for matching tool_call with tool_result
  content?: string
  kind?: 'intent' | 'plan' | 'reflect'
  name?: string
  args?: Record<string, unknown>
  status?: 'success' | 'error' | 'not_found'
  result?: string
  timing_ms?: number
  error?: string
  source?: string
  message?: string
  tools_used?: string[]
  llm_calls?: number
  iterations?: number
  // ask_user fields
  question?: string
  options?: string[]
  disabled_options?: string[]
  multi_select?: boolean
}

export interface Activity {
  id: string
  type: StreamEventType  // Only streaming events, not protocol messages
  data: StreamEvent
  timestamp: Date
}

export interface PendingAskUser {
  question: string
  options: string[]
  disabled_options: string[]
  multi_select: boolean
  input_type?: string
  fields?: AskUserField[]
}

export interface AskUserField {
  name: string
  label: string
  type?: 'text' | 'password'
  placeholder?: string
  required?: boolean
  autocomplete?: string
}

export interface PendingApproval {
  tool: string
  arguments: Record<string, unknown>
  description?: string
  batch_remaining?: Array<{ tool: string; arguments: string }>
}

export interface PendingOnboard {
  methods: string[]
  paymentAmount?: number
  paymentAddress?: string  // Agent's address for payment transfer
}

export interface PendingUlwTurnsReached {
  turns_used: number
  max_turns: number
}

export interface PendingPlanReview {
  plan_content: string
}

// UI types (matches ConnectOnion SDK: connectonion-ts/src/connect.ts)
export type UIType = 'user' | 'agent' | 'thinking' | 'tool_call' | 'ask_user' | 'approval_needed' | 'onboard_required' | 'onboard_success' | 'intent' | 'eval' | 'compact' | 'tool_blocked' | 'ulw_turns_reached' | 'plan_review' | 'files_received'

/** Base UI with common fields */
interface BaseUI {
  id: string
  type: UIType
}

/** User message */
export interface UserUI extends BaseUI {
  type: 'user'
  content: string
  images?: string[]
  files?: FileAttachment[]
}

/** Agent response */
export interface AgentUI extends BaseUI {
  type: 'agent'
  content: string
  images?: string[]
}

/** Token usage info from LLM */
export interface TokenUsage {
  input_tokens?: number
  output_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cost?: number
}

/** Thinking indicator */
export interface ThinkingUI extends BaseUI {
  type: 'thinking'
  status: 'running' | 'done' | 'error'
  content?: string
  kind?: 'intent' | 'plan' | 'reflect'
  model?: string
  duration_ms?: number
  context_percent?: number  // Context window usage percentage
  usage?: TokenUsage
}

/** Tool execution (merged from tool_call + tool_result) */
export interface ToolCallUI extends BaseUI {
  type: 'tool_call'
  name: string
  args?: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  result?: string
  timing_ms?: number
}

/** Ask user */
export interface AskUserUI extends BaseUI {
  type: 'ask_user'
  text: string
  options?: string[]
  disabled_options?: string[]
  multi_select?: boolean
  input_type?: string
  fields?: AskUserField[]
  answered?: boolean
  answer?: string
}

/** Approval needed for dangerous tool */
export interface ApprovalNeededUI extends BaseUI {
  type: 'approval_needed'
  tool: string
  arguments: Record<string, unknown>
  description?: string
  batch_remaining?: Array<{ tool: string; arguments: string }>
}

/** Onboard required for stranger */
export interface OnboardRequiredUI extends BaseUI {
  type: 'onboard_required'
  methods: string[]
  paymentAmount?: number
  paymentAddress?: string  // Agent's address for payment transfer
}

/** Onboard success */
export interface OnboardSuccessUI extends BaseUI {
  type: 'onboard_success'
  level: string
  message: string
}

/** Intent analysis (user feels seen) */
export interface IntentUI extends BaseUI {
  type: 'intent'
  status: 'analyzing' | 'understood'
  ack?: string  // Acknowledgment message e.g., "checking the files in this directory"
  is_build?: boolean  // Whether this is a build/code task
}

/** Evaluation result from eval plugin (structured) */
export interface EvalUI extends BaseUI {
  type: 'eval'
  status: 'evaluating' | 'done'
  passed?: boolean     // True if task completed successfully
  summary?: string     // Brief explanation (1-2 sentences)
  expected?: string    // What should happen
  eval_path?: string   // Path to eval file (.co/evals/...)
}

/** Auto-compact event from auto_compact plugin */
export interface CompactUI extends BaseUI {
  type: 'compact'
  status: 'compacting' | 'done' | 'error'
  context_before?: number  // Context % before compact
  context_after?: number   // Context % after compact
  context_percent?: number // Current context % (when compacting)
  message?: string
  error?: string
}

/** Tool blocked (e.g., bash file creation blocked by prefer_write_tool) */
export interface ToolBlockedUI extends BaseUI {
  type: 'tool_blocked'
  tool: string      // Tool that was blocked
  reason: string    // Why it was blocked (e.g., 'file_creation')
  message: string   // Human-readable message
  command?: string  // The blocked command
}

/** ULW turns reached checkpoint */
export interface UlwTurnsReachedUI extends BaseUI {
  type: 'ulw_turns_reached'
  turns_used: number
  max_turns: number
}

/** Plan review - agent sends plan for user approval */
export interface PlanReviewUI extends BaseUI {
  type: 'plan_review'
  plan_content: string
}

/** Files received by the agent */
export interface FilesReceivedUI extends BaseUI {
  type: 'files_received'
  files: Array<{ name: string; path: string }>
}

/** Union of all UI types */
export type UI = UserUI | AgentUI | ThinkingUI | ToolCallUI | AskUserUI | ApprovalNeededUI | OnboardRequiredUI | OnboardSuccessUI | IntentUI | EvalUI | CompactUI | ToolBlockedUI | UlwTurnsReachedUI | PlanReviewUI | FilesReceivedUI

/** Approval mode (matches ConnectOnion SDK) */
export type ApprovalMode = 'safe' | 'plan' | 'accept_edits' | 'ulw'

export interface SkillInfo {
  name: string
  description: string
  location?: string
}

export interface ChatProps {
  ui?: UI[]
  onSend: (message: string, images?: string[], files?: FileAttachment[]) => void
  /** Gracefully stop the running agent (shown as a stop button while isLoading) */
  onStop?: () => void
  isLoading?: boolean
  /** Stop was clicked and the old server turn is unwinding. */
  isStopping?: boolean
  placeholder?: string
  className?: string
  emptyStateTitle?: string
  emptyStateDescription?: string
  suggestions?: string[]
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: AskUserResponseHandler
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingOnboard?: PendingOnboard | null
  onOnboardSubmit?: (options: { inviteCode?: string; payment?: number }) => void
  pendingUlwTurnsReached?: PendingUlwTurnsReached | null
  onUlwTurnsReachedResponse?: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void
  pendingPlanReview?: PendingPlanReview | null
  onPlanReviewResponse?: (message: string) => void
  /** Custom status bar inside input (e.g., mode indicator) */
  statusBar?: React.ReactNode
  /** ULW state for 3-state bottom panel */
  mode?: ApprovalMode
  ulwTurnsRemaining?: number | null
  ulwSetupActive?: boolean
  onUlwStart?: (turns: number, goal: string, direction: string) => void
  onUlwStop?: () => void
  onUlwSetupCancel?: () => void
  onUlwGoalSave?: (goal: string) => void
  onUlwDirectionSave?: (direction: string) => void
  ulwGoal?: string
  ulwDirection?: string
  /** Session active state — derived from processing status + connection */
  sessionState: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  /** Connection error for retry functionality */
  connectionError?: string | null
  onRetry?: () => void
  /** Dismiss the error banner without resending anything */
  onDismissError?: () => void
  /** Whether messages exist (session was started) */
  hasSession?: boolean
  /** Called when user clicks the reconnect banner */
  onReconnect?: () => void
  skills?: SkillInfo[]
}

export interface ChatMessageProps {
  message: Message
  className?: string
}

export interface ChatInputProps {
  onSend: (message: string, images?: string[], files?: FileAttachment[]) => void
  /** Gracefully stop the running agent; when provided, the send button becomes a stop button while isLoading */
  onStop?: () => void
  isLoading?: boolean
  isStopping?: boolean
  placeholder?: string
  className?: string
  /** Status bar below input (mode indicator + hints) */
  statusBar?: React.ReactNode
  skills?: SkillInfo[]
}

export interface ChatMessagesProps {
  ui?: UI[]
  className?: string
  isLoading?: boolean
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: AskUserResponseHandler
  pendingOnboard?: PendingOnboard | null
  onOnboardSubmit?: (options: { inviteCode?: string; payment?: number }) => void
  pendingUlwTurnsReached?: PendingUlwTurnsReached | null
  onUlwTurnsReachedResponse?: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void
  pendingPlanReview?: PendingPlanReview | null
  onPlanReviewResponse?: (message: string) => void
}

export interface ChatEmptyStateProps {
  title?: string
  description?: string
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
  className?: string
}
