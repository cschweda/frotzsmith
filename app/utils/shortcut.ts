/** True on Apple platforms, where the compile shortcut is ⌘B (Ctrl+B elsewhere). */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform ?? nav.platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** Label for the Mod-B compile shortcut as the user's keyboard shows it. */
export function compileShortcutLabel(): string {
  return isApplePlatform() ? '⌘B' : 'Ctrl+B'
}

/** Is this keydown the compile shortcut (Mod-B, no Shift/Alt)? */
export function isCompileShortcut(e: KeyboardEvent): boolean {
  const mod = isApplePlatform() ? e.metaKey : e.ctrlKey
  return mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b'
}
