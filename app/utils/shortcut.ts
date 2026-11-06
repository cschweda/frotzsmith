import { isModShortcut, modShortcutLabel } from '@frotzinc/nuxt-base/utils/shortcut'

/** Label for the Mod-B compile shortcut as the user's keyboard shows it (⌘B / Ctrl+B). */
export function compileShortcutLabel(): string {
  return modShortcutLabel('b')
}

/** Is this keydown the compile shortcut (Mod-B, no Shift/Alt)? */
export function isCompileShortcut(e: KeyboardEvent): boolean {
  return isModShortcut(e, 'b')
}
