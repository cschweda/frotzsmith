/**
 * A GlkOte implementation with no display. glkapi drives it the same way it
 * drives the web/terminal GlkOte: it calls `init(iface)` once (we kick off the
 * VM with an `init` event), then `update(arg)` whenever the VM produces output
 * and/or requests input. We accumulate buffer-window text (the transcript body)
 * and grid-window text (the status line) separately, and resolve one "turn"
 * each time the VM asks for line input — at which point the caller can read the
 * captured text and feed the next command via `sendLine`.
 *
 * The protocol shapes (update.content / update.input / the accept event) follow
 * the GlkOte spec (eblong.com/zarf/glk/glkote/docs.html).
 */
type Accept = (event: unknown) => void

interface Turn {
  buffer: string
  grid: string
  /** false once the VM has exited (quit) rather than asked for more input. */
  wantsLine: boolean
}

export class HeadlessGlkOte {
  private accept: Accept | null = null
  private gen = 0
  private buffer = ''
  private grid = ''
  private lineWindow: number | null = null
  private pending: ((turn: Turn) => void) | null = null
  // Turns resolved before the caller has awaited nextTurn(). The VM runs
  // synchronously inside Glk.init()/sendLine(), so it produces its turn *before*
  // the driver awaits it — this latch hands that turn to the next nextTurn().
  private ready: Turn[] = []
  private exited = false

  // ── GlkOte interface (called by glkapi) ──────────────────────────────────
  init(iface: { accept: Accept }) {
    this.accept = iface.accept
    // Kick the VM off. Metrics use 1×1 character cells with zero margins so the
    // pixel→cell math in glkapi yields an 80×25 grid (otherwise gridheight is
    // NaN and the grid window has no lines). Mirrors glkote-term's
    // measure_window(); nothing renders.
    this.accept({
      type: 'init',
      gen: 0,
      support: [],
      metrics: {
        width: 80,
        height: 25,
        buffercharwidth: 1,
        buffercharheight: 1,
        buffermarginx: 0,
        buffermarginy: 0,
        gridcharwidth: 1,
        gridcharheight: 1,
        gridmarginx: 0,
        gridmarginy: 0,
        graphicsmarginx: 0,
        graphicsmarginy: 0,
        inspacingx: 0,
        inspacingy: 0,
        outspacingx: 0,
        outspacingy: 0,
      },
    })
  }

  update(arg: {
    gen: number
    content?: Array<{ id: number; text?: Array<{ content?: unknown[] }>; lines?: Array<{ content?: unknown[] }> }>
    input?: Array<{ id: number; type: string; gen: number }>
    specialinput?: { type: string }
  }) {
    this.gen = arg.gen
    if (arg.content) this.absorbContent(arg.content)

    // A fileref prompt (save / restore / script) — answer "cancelled".
    if (arg.specialinput) {
      this.accept?.({ type: 'specialresponse', gen: this.gen, response: 'fileref_prompt', value: null })
      return
    }

    const line = arg.input?.find(i => i.type === 'line')
    if (line) {
      this.lineWindow = line.id
      this.resolveTurn(true)
    }
  }

  warning() {}
  log() {}
  error(msg: string) {
    throw new Error(`GlkOte error: ${msg}`)
  }
  exit() {
    this.exited = true
    this.resolveTurn(false)
  }
  // NOTE (spike): run the golden test; if glkapi throws "GlkOte.X is not a
  // function", add a no-op `X()` here. Likely candidates: getlibrary, setlog,
  // set_autosave, getdomid, getinterface, save_allstate.

  // ── Driver API (called by ZmachineEngine) ────────────────────────────────
  /** Resolves at the next line-input request (or VM exit). */
  nextTurn(): Promise<Turn> {
    const queued = this.ready.shift()
    if (queued) return Promise.resolve(queued)
    if (this.exited) return Promise.resolve({ buffer: this.takeBuffer(), grid: this.grid, wantsLine: false })
    return new Promise<Turn>(resolve => {
      this.pending = resolve
    })
  }

  /** Send a command line to the VM; the VM runs until its next update. */
  sendLine(value: string) {
    if (this.lineWindow == null || !this.accept) throw new Error('No line input pending')
    const window = this.lineWindow
    this.lineWindow = null
    this.accept({ type: 'line', gen: this.gen, window, value })
  }

  // ── internals ─────────────────────────────────────────────────────────────
  private resolveTurn(wantsLine: boolean) {
    const turn: Turn = { buffer: this.takeBuffer(), grid: this.grid, wantsLine }
    if (this.pending) {
      const p = this.pending
      this.pending = null
      p(turn)
    } else {
      // No awaiter yet (synchronous boot/send) — stash it for the next nextTurn().
      this.ready.push(turn)
    }
  }

  private takeBuffer(): string {
    const b = this.buffer
    this.buffer = ''
    return b
  }

  private absorbContent(content: NonNullable<Parameters<HeadlessGlkOte['update']>[0]['content']>) {
    for (const win of content) {
      // Buffer window: paragraphs in `text[]`; each paragraph's `content` is a
      // run array (see runText). An empty paragraph `{}` is a blank line.
      if (win.text) {
        for (const para of win.text) this.buffer += runText(para.content) + '\n'
      }
      // Grid window (status line): lines in `lines[]`.
      if (win.lines) {
        this.grid = win.lines.map(l => runText(l.content)).join('\n')
      }
    }
  }
}

/**
 * Flatten a GlkOte line-data array. glkapi emits the compressed run format
 * (glkote-term/glkapi.js): non-hyperlinked runs are a pair of strings
 * `[styleName, text]`, and hyperlinked runs are a single `{ style, text,
 * hyperlink }` object. So a string is a *style name* and the run's text is the
 * following string — we append the text and skip the style name. Object runs
 * carry their text directly.
 */
function runText(runs: unknown[] | undefined): string {
  if (!runs) return ''
  let out = ''
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]
    if (typeof r === 'string') {
      // Style name; its text is the next element.
      const text = runs[i + 1]
      if (typeof text === 'string') out += text
      i++
    } else if (typeof r === 'object' && r && 'text' in r) {
      out += String((r as { text: unknown }).text ?? '')
    }
  }
  return out
}
