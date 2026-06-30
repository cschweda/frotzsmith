/**
 * Pure helpers for the Play transcript — the read-only log of commands a player
 * typed during interactive Play. No Vue/DOM, so they unit-test in isolation.
 */

/** Append a command to the log: trim, ignore blank, never mutate the input. */
export function appendCommand(list: string[], cmd: string): string[] {
  const trimmed = cmd.trim()
  if (!trimmed) return list
  return [...list, trimmed]
}

/** Render captured commands as test-script text — one command per line. */
export function toScriptText(commands: string[]): string {
  return commands.join('\n')
}

/**
 * The lowest free "Playthrough N" name (N ≥ 1) not already taken. Used to name
 * the Test Script created from a captured playthrough.
 */
export function nextPlaythroughName(existing: string[]): string {
  const taken = new Set(existing)
  let n = 1
  while (taken.has(`Playthrough ${n}`)) n++
  return `Playthrough ${n}`
}
