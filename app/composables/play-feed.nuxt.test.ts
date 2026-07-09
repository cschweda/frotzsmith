/**
 * play-feed — the Send-to-Play pacing engine, extracted from PlayPanel.vue
 * (happy-dom env: real DOM + MutationObserver + KeyboardEvent).
 *
 * The trickiest timing code in the app: event-paced on game DOM output (NOT
 * fixed polling — Chrome throttles timers in hidden tabs), with a watchdog for
 * games that stop asking for input. Previously it lived untested inside the
 * component and aborted silently — the known "throttled tab: feed just stops"
 * failure mode. feedScript now reports an outcome so the UI can say
 * "stopped after N of M".
 */
import { describe, it, expect } from 'vitest'
import { fireKey, pagerIsUp, waitForLineInput, feedScript } from './play-feed'

/** A minimal fake GlkOte game: consumes a LineInput value on Enter, then
 *  re-offers a fresh input (async, so the MutationObserver path is real). */
function makeFakeGame(opts: { stopAfter?: number } = {}) {
  document.body.innerHTML = '<div id="windowport"></div>'
  const port = document.getElementById('windowport')!
  const received: string[] = []

  function offerInput() {
    const input = document.createElement('input')
    input.className = 'LineInput'
    input.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key !== 'Enter') return
      received.push(input.value)
      input.remove()
      if (opts.stopAfter !== undefined && received.length >= opts.stopAfter) return // game went silent
      setTimeout(offerInput, 0) // next turn arrives async → observer fires
    })
    port.appendChild(input)
  }
  offerInput()
  return { received }
}

describe('feedScript', () => {
  it('feeds every command in order and reports completion', async () => {
    const game = makeFakeGame()
    const outcome = await feedScript(document, window, ['look', 'north', 'take lamp'], { paceMs: 0 })
    expect(game.received).toEqual(['look', 'north', 'take lamp'])
    expect(outcome).toEqual({ completed: true, fed: 3, total: 3 })
  })

  it('reports a partial feed when the game stops asking for input', async () => {
    const game = makeFakeGame({ stopAfter: 2 })
    const outcome = await feedScript(document, window, ['n', 's', 'e', 'w'], {
      paceMs: 0,
      watchdogMs: 50, // don't wait the real 10 s in tests
    })
    expect(game.received).toEqual(['n', 's'])
    expect(outcome).toEqual({ completed: false, fed: 2, total: 4 })
  })
})

describe('waitForLineInput', () => {
  it('auto-advances a [MORE] pager and resolves when the input appears', async () => {
    document.body.innerHTML = '<div id="windowport"><div class="MorePrompt">[MORE]</div></div>'
    const port = document.getElementById('windowport')!
    // Any keypress dismisses the pager and the input arrives on the next tick.
    document.addEventListener(
      'keypress',
      () => {
        port.querySelector('.MorePrompt')?.remove()
        setTimeout(() => {
          const input = document.createElement('input')
          input.className = 'LineInput'
          port.appendChild(input)
        }, 0)
      },
      { once: true },
    )
    const input = await waitForLineInput(document, window, 1000)
    expect(input).not.toBeNull()
    expect(input!.className).toBe('LineInput')
  })

  it('resolves null once the watchdog expires with no input', async () => {
    document.body.innerHTML = '<div id="windowport"></div>'
    const input = await waitForLineInput(document, window, 30)
    expect(input).toBeNull()
  })
})

describe('pagerIsUp / fireKey', () => {
  it('detects a visible MorePrompt and a CharInput, but not a hidden pager', () => {
    document.body.innerHTML = '<div class="MorePrompt">[MORE]</div>'
    expect(pagerIsUp(document)).toBe(true)
    document.querySelector<HTMLElement>('.MorePrompt')!.style.display = 'none'
    expect(pagerIsUp(document)).toBe(false)
    document.body.innerHTML = '<input class="CharInput">'
    expect(pagerIsUp(document)).toBe(true)
  })

  it('dispatches keydown/keypress/keyup with keyCode and which set', () => {
    const target = document.createElement('div')
    const seen: Array<{ type: string; keyCode: number; which: number }> = []
    for (const t of ['keydown', 'keypress', 'keyup']) {
      target.addEventListener(t, (e) => {
        const k = e as KeyboardEvent
        seen.push({ type: k.type, keyCode: k.keyCode, which: k.which })
      })
    }
    fireKey(target, window, 'Enter', 'Enter', 13)
    expect(seen).toEqual([
      { type: 'keydown', keyCode: 13, which: 13 },
      { type: 'keypress', keyCode: 13, which: 13 },
      { type: 'keyup', keyCode: 13, which: 13 },
    ])
  })
})
