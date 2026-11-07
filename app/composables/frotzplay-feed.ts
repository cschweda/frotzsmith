/**
 * frotzplay-feed — Send-to-Play for the frotzplay player (pure logic, unit-tested).
 *
 * frotzplay takes commands through its own API (`send(line)`, `press(key)`), each
 * resolving when the turn is done, so there's no DOM to watch, no synthetic key
 * events and no pager: the loop below is the whole engine. A "press a key" prompt
 * is pressed through with Space, as the Parchment feed does. The outcome reports a
 * partial feed so the UI can say where it stopped (same contract as play-feed.ts).
 */
import { FEED_PACE_MS, type FeedOutcome } from './play-feed'

/** What the feed needs from the player (ZPlayer's exposed API). */
export interface FeedablePlayer {
  state: { phase: string }
  send(line: string): Promise<boolean>
  press(key: string): Promise<boolean>
}

/** Key prompts pressed through before a command, at most (a game stuck on keys stops the feed). */
export const MAX_KEY_PROMPTS = 20

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export async function feedPlayer(
  player: FeedablePlayer,
  commands: string[],
  opts: { paceMs?: number; isVisible?: () => boolean } = {},
): Promise<FeedOutcome> {
  const paceMs = opts.paceMs ?? FEED_PACE_MS
  const isVisible = opts.isVisible ?? (() => document.visibilityState === 'visible')
  let fed = 0
  for (const cmd of commands) {
    for (let i = 0; i < MAX_KEY_PROMPTS && player.state.phase === 'char'; i++) await player.press(' ')
    if (!(await player.send(cmd))) break // not waiting for a line: quit, a fault, or still on keys
    fed += 1
    // Watchable pace, only when someone can watch (hidden tabs throttle timers).
    if (paceMs > 0 && isVisible() && fed < commands.length) await delay(paceMs)
  }
  return { completed: fed === commands.length, fed, total: commands.length }
}

/**
 * The room as the auto-map wants it, from the player's status line: v3's location,
 * or a v4+ game's top row up to its first wide gap (as the Parchment page reads its
 * status-line grid: `split(/\s{2,}/)[0]`). Empty when the game shows no status line.
 */
export function roomFromStatus(state: { version: number; status: { left: string }; upper: string[] }): string {
  if (state.version === 3) return state.status.left.trim()
  return (state.upper[0] ?? '').trim().split(/\s{2,}/)[0]!.trim()
}
