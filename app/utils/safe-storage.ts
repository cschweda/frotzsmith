/**
 * localStorage access that never throws.
 *
 * Browsers can deny storage entirely (Chrome "Block all cookies" and some
 * embedded/private contexts throw a SecurityError on ANY access) or refuse
 * writes (QuotaExceededError once the origin quota is full). State composables
 * must keep working in memory in both cases, so these wrappers turn every
 * storage failure into a null / false return instead of an exception.
 */

/** Read a key, or null when the key is absent or storage is unavailable. */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Write a key. @returns true when persisted, false when storage refused it. */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
