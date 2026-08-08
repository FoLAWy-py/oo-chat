export const OOCHAT_DISABLED_OPTION_PREFIX = '__OOCHAT_DISABLED__::'
export const OOCHAT_OPEN_URL_OPTION_PREFIX = '__OOCHAT_OPEN_URL__::'
export const OOCHAT_CLOSE_OPENED_URL_OPTION_PREFIX = '__OOCHAT_CLOSE_OPENED_URL__::'
export const OOCHAT_OPENED_WINDOW_NAME = 'oo-chat-remote-assist'

export function isAskUserOptionDisabled(option: string, disabledOptions: Set<string>): boolean {
  return disabledOptions.has(option) || option.startsWith(OOCHAT_DISABLED_OPTION_PREFIX)
}

export function askUserOptionLabel(option: string): string {
  if (option.startsWith(OOCHAT_DISABLED_OPTION_PREFIX)) {
    return option.slice(OOCHAT_DISABLED_OPTION_PREFIX.length)
  }
  if (option.startsWith(OOCHAT_OPEN_URL_OPTION_PREFIX)) {
    const payload = option.slice(OOCHAT_OPEN_URL_OPTION_PREFIX.length)
    const separator = payload.indexOf('::')
    return separator >= 0 ? payload.slice(separator + 2) : payload
  }
  if (option.startsWith(OOCHAT_CLOSE_OPENED_URL_OPTION_PREFIX)) {
    return option.slice(OOCHAT_CLOSE_OPENED_URL_OPTION_PREFIX.length)
  }
  return option
}

export function askUserOptionOpenUrl(option: string): string | null {
  if (!option.startsWith(OOCHAT_OPEN_URL_OPTION_PREFIX)) return null
  const payload = option.slice(OOCHAT_OPEN_URL_OPTION_PREFIX.length)
  const separator = payload.indexOf('::')
  if (separator < 1) return null

  try {
    const url = new URL(decodeURIComponent(payload.slice(0, separator)))
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function runAskUserOptionSideEffect(option: string): void {
  if (option.startsWith(OOCHAT_CLOSE_OPENED_URL_OPTION_PREFIX)) {
    const openedWindow = window.open('', OOCHAT_OPENED_WINDOW_NAME)
    if (openedWindow) {
      openedWindow.close()
    }
  }
}
