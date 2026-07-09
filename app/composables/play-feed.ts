/**
 * play-feed — the Send-to-Play pacing engine (pure logic, injectable doc/win;
 * extracted from PlayPanel.vue so the trickiest timing code in the app is
 * unit-testable). PlayPanel resolves the iframe's document/window and shows a
 * toast when the outcome reports a partial feed.
 *
 * Event-paced via MutationObserver, NOT fixed-interval polling: Chrome
 * throttles chained timers in long-hidden tabs (intensive throttling ≈ one
 * per minute), which used to stall the feed mid-script. Observer callbacks
 * fire on DOM changes regardless of visibility. The watchdog only bounds a
 * game that never asks for line input again (e.g. it quit) — and that case
 * now surfaces as `completed: false` instead of a silent stop.
 */

/** ms the watchdog waits for the game to ask for another line of input. */
export const FEED_WATCHDOG_MS = 10_000
/** Watchable pace between commands when the tab is visible. */
export const FEED_PACE_MS = 420

export interface FeedOutcome {
  /** True when every command was delivered to the game. */
  completed: boolean
  /** Commands actually delivered. */
  fed: number
  total: number
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// Dispatch a full key sequence (keydown → keypress → keyup) using the IFRAME's
// KeyboardEvent realm, with keyCode/which set. GlkOte's line input only submits
// on the keypress (not keydown alone), so all three are required — validated live.
export function fireKey(target: EventTarget, win: Window, key: string, code: string, keyCode: number) {
  for (const type of ['keydown', 'keypress', 'keyup']) {
    const ev = new (win as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent(type, {
      key,
      code,
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(ev, 'keyCode', { get: () => keyCode })
    Object.defineProperty(ev, 'which', { get: () => keyCode })
    target.dispatchEvent(ev)
  }
}

/** True when a [MORE]/char prompt is up (GlkOte's pager or a CharInput field). */
export function pagerIsUp(doc: Document): boolean {
  const more = doc.querySelector('.MorePrompt') as HTMLElement | null
  if (more && more.style.display !== 'none') return true
  return !!doc.querySelector('input.CharInput')
}

// Wait until the game is ready for a typed line. If a [MORE]/char prompt is
// up, press a key to advance, then keep waiting.
export function waitForLineInput(
  doc: Document,
  win: Window,
  timeoutMs = FEED_WATCHDOG_MS,
): Promise<HTMLInputElement | null> {
  return new Promise(resolve => {
    let done = false
    let observer: MutationObserver | null = null
    let watchdog: ReturnType<typeof setTimeout> | null = null
    const finish = (input: HTMLInputElement | null) => {
      if (done) return
      done = true
      observer?.disconnect()
      if (watchdog) clearTimeout(watchdog)
      resolve(input)
    }
    const check = () => {
      const input = doc.querySelector('input.LineInput') as HTMLInputElement | null
      if (input) return finish(input)
      if (pagerIsUp(doc)) fireKey(doc, win, ' ', 'Space', 32)
    }
    observer = new (win as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver(check)
    observer.observe(doc.getElementById('windowport') ?? doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
    watchdog = setTimeout(() => finish(doc.querySelector('input.LineInput') as HTMLInputElement | null), timeoutMs)
    check() // the input may already be present — don't wait for a mutation
  })
}

/**
 * Feed a parsed script into the live GlkOte game, one command at a watchable
 * pace. Never throws for "the game stopped responding" — that comes back as
 * `completed: false` with the delivered count, so the caller can tell the
 * author exactly where the feed stopped.
 */
export async function feedScript(
  doc: Document,
  win: Window & { __frotzScriptRunning?: boolean },
  commands: string[],
  opts: { paceMs?: number; watchdogMs?: number; isVisible?: () => boolean } = {},
): Promise<FeedOutcome> {
  const paceMs = opts.paceMs ?? FEED_PACE_MS
  const isVisible = opts.isVisible ?? (() => document.visibilityState === 'visible')
  let fed = 0
  win.__frotzScriptRunning = true
  try {
    for (const cmd of commands) {
      const input = await waitForLineInput(doc, win, opts.watchdogMs)
      if (!input) break // game never asked for input again (quit / menu / crash)
      input.focus()
      input.value = cmd
      fireKey(input, win, 'Enter', 'Enter', 13)
      fed += 1
      // Watchable pace — but only when someone can watch. Hidden tabs skip it:
      // waitForLineInput already gates on the response having rendered, and a
      // throttled pace timer would stall the whole feed.
      if (paceMs > 0 && isVisible()) await delay(paceMs)
    }
  } finally {
    win.__frotzScriptRunning = false
  }
  return { completed: fed === commands.length, fed, total: commands.length }
}
