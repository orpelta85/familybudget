const STORAGE_KEY = 'impersonation_state'

/**
 * Appends impersonate_user_id query param to a URL if impersonation is active.
 * This is used by fetch calls in hooks that don't have access to React context.
 */
export function withImpersonation(url: string): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return url
    const { userId } = JSON.parse(stored)
    if (!userId) return url
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}impersonate_user_id=${userId}`
  } catch {
    return url
  }
}
