import { describe, it, expect, vi, afterEach } from 'vitest'
import { compileShortcutLabel, isCompileShortcut } from './shortcut'

const key = (o: Partial<KeyboardEvent>) => ({ key: 'b', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...o }) as KeyboardEvent

describe('compile shortcut', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is ⌘B on a Mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(compileShortcutLabel()).toBe('⌘B')
    expect(isCompileShortcut(key({ metaKey: true }))).toBe(true)
    expect(isCompileShortcut(key({ ctrlKey: true }))).toBe(false)
  })

  it('is Ctrl+B elsewhere', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    expect(compileShortcutLabel()).toBe('Ctrl+B')
    expect(isCompileShortcut(key({ ctrlKey: true }))).toBe(true)
    expect(isCompileShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(isCompileShortcut(key({ ctrlKey: true, key: 'B' }))).toBe(true)
  })
})
