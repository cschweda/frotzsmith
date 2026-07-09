/**
 * useStorageNotice — the non-blocking "storage full" cue (happy-dom env).
 *
 * Persist paths call notifyStorageFull() when a write is refused
 * (QuotaExceededError / blocked storage). It must fire at most one toast per
 * session — every keystroke re-persists the recovery snapshot, so an
 * unthrottled cue would be a toast storm — and must NEVER itself throw
 * (it runs inside failure handling).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

const { notifyStorageFull, resetStorageNoticeForTests } = await import('./useStorageNotice')

describe('notifyStorageFull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStorageNoticeForTests()
  })

  it('shows a warning toast', () => {
    notifyStorageFull()
    expect(_toastAdd).toHaveBeenCalledTimes(1)
    const arg = _toastAdd.mock.calls[0]![0] as { title: string; color: string }
    expect(arg.title.toLowerCase()).toContain('storage')
    expect(arg.color).toBe('warning')
  })

  it('fires at most once per session (persists retry on every keystroke)', () => {
    notifyStorageFull()
    notifyStorageFull()
    notifyStorageFull()
    expect(_toastAdd).toHaveBeenCalledTimes(1)
  })

  it('never throws, even when the toast system itself is unavailable', () => {
    vi.stubGlobal('useToast', () => {
      throw new Error('no toast provider')
    })
    try {
      resetStorageNoticeForTests()
      expect(() => notifyStorageFull()).not.toThrow()
    } finally {
      vi.stubGlobal('useToast', () => ({ add: _toastAdd }))
    }
  })
})
