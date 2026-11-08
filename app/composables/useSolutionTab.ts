import { solutionCommands, SOLUTION_MAX } from './solution-text'
import { sampleWalkthrough } from '~/modules/samples-shared/walkthroughs'

export type TabResult =
  | { ok: true; note?: string }
  /** `needsConfirm`: nothing changed; ask, then call again with `{ confirmed: true }`. */
  | { ok: false; message: string; needsConfirm?: true }

type Opts = { confirmed?: boolean }

/** How a request for the sample's solution ended: its text is shown, a
 *  message says what happened, or a newer request took over the tab. */
export type SampleOutcome = 'text' | 'message' | 'newer'

/** The sample's solution being made right now. Module-level so every
 *  useSolutionTab() caller (the tab, the left pane's Show solution) joins
 *  the same request instead of starting a second one that cancels it. */
let sampleRun: { seq: number; key: string; id: string; promise: Promise<SampleOutcome> } | null = null
let sampleSeq = 0

/** A request for the same game is retried this many times when the editor
 *  reloads that game under it (a restore, the sample picked again). */
const SAMPLE_RETRIES = 2

const CHANGED = 'The game changed while its solution was being made, so press Try again.'

/**
 * The Solution tab's logic (SolutionPanel renders it).
 *
 * - **Spoiler guard:** nothing is shown, and a sample's solution isn't even
 *   made, until the author presses Show solution — per game.
 * - **Sample:** when the editor holds a bundled sample, Show solution replays
 *   its walkthrough; Make it my solution copies that text into the game's own.
 * - **Own solution:** Regenerate, Copy, Download, Load file, Clear. Anything
 *   that replaces or removes the game's solution asks first.
 */
export function useSolutionTab() {
  const ide = useIde()
  const { profile } = useLanguage()
  const solutions = useSolutions()
  const recorder = useSolutionRecorder()

  /** The story key the author pressed Show solution for (a language switch
   *  clears it: the Inform 6 and the ZIL Mingus I share a title, so a story
   *  key alone is not one game — see useIde's restore). */
  const revealedKey = useState<string | null>('frotz:solution-revealed', () => null)
  const revealed = computed(() => revealedKey.value === ide.activeStoryKey.value)

  /**
   * The sample's solution as last made: the game, the source generation and
   * whether the sample had been edited. Loading the same sample again (pick
   * it again, a restore) bumps the generation but not the game: the text of
   * an unedited sample still holds.
   */
  const sample = useState<{ key: string; gen: number; edited: boolean; id: string; text: string; note?: string } | null>(
    'frotz:solution-sample',
    () => null,
  )
  /** The last request's failure, for the game it was for. */
  const failure = useState<{ key: string; id: string; text: string } | null>('frotz:solution-sample-msg', () => null)
  /** The game whose sample solution is being made, while one is. */
  const making = useState<{ key: string; id: string } | null>('frotz:solution-sample-busy', () => null)
  const busy = useState<boolean>('frotz:solution-tab-busy', () => false)

  const isCurrent = (g: { key: string; id: string } | null) =>
    g !== null && g.key === ide.activeStoryKey.value && g.id === ide.loadedSampleId.value

  const hasSampleWalkthrough = computed(() => {
    const id = ide.loadedSampleId.value
    return id !== null && sampleWalkthrough(id) !== null
  })
  const currentSample = computed(() => {
    const s = sample.value
    if (!s || !revealed.value || !isCurrent(s)) return null
    return s.gen === ide.sourceGen.value || (!s.edited && !ide.sampleEdited.value) ? s : null
  })
  /**
   * What the tab presents as the game's solution:
   * - `sample`: a bundled sample is loaded and the game has no solution of its
   *   own — the sample's is THE solution (until Make it my solution);
   * - `own`: the game's own solution (saved, or being recorded) — it wins;
   * - `none`: neither (not a sample, nothing recorded yet).
   */
  const mode = computed<'sample' | 'own' | 'none'>(() => {
    if (solutions.has.value || recorder.state.value !== 'stopped') return 'own'
    return hasSampleWalkthrough.value ? 'sample' : 'none'
  })
  const sampleText = computed(() => currentSample.value?.text ?? null)
  const sampleNote = computed(() => currentSample.value?.note ?? null)
  /** The sample's solution is being made for the game in the editor. */
  const sampleBusy = computed(() => isCurrent(making.value))
  /** What the busy indicator says: compiling first (slow for ZIL) or replaying. */
  const sampleBusyText = computed(() =>
    ide.buildIsCurrent.value
      ? 'Replaying the game’s walkthrough…'
      : profile.value.id === 'zil'
        ? 'Compiling the game and replaying its walkthrough… ZIL can take up to a minute the first time.'
        : 'Compiling the game and replaying its walkthrough…',
  )
  /**
   * Why the sample's solution isn't shown, when it is not — never blank: the
   * last request's failure, or (shown, not busy, no text) that it isn't made
   * for the game now in the editor.
   */
  const sampleMessage = computed<string | null>(() => {
    if (!revealed.value || sampleBusy.value || sampleText.value !== null || !hasSampleWalkthrough.value) return null
    if (isCurrent(failure.value)) return failure.value!.text
    if (mode.value !== 'sample') return null
    return isCurrent(sample.value)
      ? 'The game was loaded again since its solution was made, so press Try again.'
      : 'This game’s solution from the sample isn’t made yet, so press Try again.'
  })

  /** The game's own solution, once revealed (live while recording). */
  const ownText = computed(() => (revealed.value ? solutions.view.value : null))

  const downloadName = computed(() => `${ide.storyBase.value || 'story'}-solution.txt`)

  const REC_BUSY: TabResult = { ok: false, message: 'That can’t be done while recording, so press Pause first.' }

  function reveal() {
    revealedKey.value = ide.activeStoryKey.value
  }

  /**
   * Make the sample's solution (when the editor holds a sample with a
   * walkthrough). Never silent: it ends with the text shown, a message, or
   * (`newer`) a newer request — whose own outcome is shown — in charge.
   * A second call for the same game joins the request already running.
   */
  function makeSample(): Promise<SampleOutcome | null> {
    const id = ide.loadedSampleId.value
    const cmds = id ? sampleWalkthrough(id) : null
    if (!id || !cmds) return Promise.resolve(null)
    const key = ide.activeStoryKey.value
    if (sampleRun && sampleRun.key === key && sampleRun.id === id) return sampleRun.promise
    const seq = ++sampleSeq
    making.value = { key, id }
    failure.value = null
    const promise = runSample(seq, key, id, cmds)
    sampleRun = { seq, key, id, promise }
    return promise
  }

  async function runSample(seq: number, key: string, id: string, cmds: string[]): Promise<SampleOutcome> {
    const fail = (text: string): SampleOutcome => {
      failure.value = { key, id, text }
      return 'message'
    }
    const sameGame = () => ide.activeStoryKey.value === key && ide.loadedSampleId.value === id
    try {
      for (let attempt = 0; ; attempt++) {
        const gen = ide.sourceGen.value
        const edited = ide.sampleEdited.value
        const r = await useSolutionGenerator().generate(cmds)
        if (seq !== sampleSeq) return 'newer' // another game's request took over; it ends visibly itself
        if (!sameGame()) return fail(CHANGED)
        if (r.ok) {
          sample.value = { key, gen, edited, id, text: r.text, ...(r.note ? { note: r.note } : {}) }
          return 'text'
        }
        if (!r.superseded) return fail(r.message)
        // The same sample was loaded again under the request (a restore, the
        // sample picked again): its build was dropped, not its game. Ask again.
        if (r.moved && attempt < SAMPLE_RETRIES) continue
        return fail(r.moved ? CHANGED : 'Another solution request replaced this one, so press Try again.')
      }
    } finally {
      if (seq === sampleSeq) {
        sampleRun = null
        making.value = null
      }
    }
  }

  /** Show solution: lift the spoiler guard for this game (and make the sample's). */
  async function showSolution(): Promise<SampleOutcome | null> {
    reveal()
    return makeSample()
  }

  function adoptSample(opts: Opts = {}): TabResult {
    if (recorder.state.value === 'recording') return REC_BUSY
    const text = sampleText.value
    if (text === null) return { ok: false, message: 'Press Show solution first to make the sample’s solution.' }
    if (solutions.has.value && !opts.confirmed)
      return { ok: false, needsConfirm: true, message: `Replace the solution for “${ide.storyTitle.value || 'Untitled'}”?` }
    const r = solutions.set(text)
    if (r.ok) recorder.discardUnsaved()
    return r
  }

  /** Rebuild the text from its `> ` lines against the current build. */
  async function regenerate(opts: Opts = {}): Promise<TabResult> {
    if (recorder.state.value === 'recording') return REC_BUSY
    const text = solutions.text.value
    if (text === null) return { ok: false, message: 'This game has no solution to regenerate.' }
    if (!opts.confirmed)
      return {
        ok: false,
        needsConfirm: true,
        message: 'Regenerating replays the solution’s commands and replaces the text, including anything you wrote between them.',
      }
    const key = ide.activeStoryKey.value
    busy.value = true
    try {
      const r = await useSolutionGenerator().generate(solutionCommands(text))
      if (!r.ok) return { ok: false, message: r.superseded ? 'Another solution request replaced this one, so try again.' : r.message }
      if (ide.activeStoryKey.value !== key) return { ok: false, message: 'A different game was loaded, so the solution was not regenerated.' }
      const put = solutions.set(r.text)
      if (!put.ok) return put
      return r.note ? { ok: true, note: r.note } : { ok: true }
    } finally {
      busy.value = false
    }
  }

  function clear(opts: Opts = {}): TabResult {
    if (recorder.state.value === 'recording') return REC_BUSY
    if (!solutions.has.value) return { ok: true }
    if (!opts.confirmed)
      return { ok: false, needsConfirm: true, message: `Clear the solution for “${ide.storyTitle.value || 'Untitled'}”?` }
    solutions.clear()
    recorder.discardUnsaved()
    return { ok: true }
  }

  /** The text Copy and Download act on: the sample's while it is the solution. */
  function shownText(): string | null {
    return mode.value === 'sample' ? sampleText.value : solutions.view.value
  }

  async function copy(): Promise<TabResult> {
    const text = shownText()
    if (text === null) return { ok: false, message: 'This game has no solution to copy.' }
    try {
      await navigator.clipboard.writeText(text)
      return { ok: true }
    } catch {
      return { ok: false, message: 'The browser would not let frotzsmith use the clipboard, so use Download instead.' }
    }
  }

  function download(): void {
    const text = shownText()
    if (text === null) return
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName.value
    a.click()
    // Revoking synchronously can cancel the download in some Safari/Firefox builds.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  /** Read a chosen solution file as text (at most 1 MiB). */
  async function readFile(file: File): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
    // Bytes first (cheap, before reading); UTF-16 length after (the cap's unit).
    if (file.size > SOLUTION_MAX * 3)
      return { ok: false, message: 'That file is over 1 MiB, which is more than frotzsmith keeps for one solution.' }
    let text: string
    try {
      text = await file.text()
    } catch {
      return { ok: false, message: 'That file could not be read.' }
    }
    if (text.length > SOLUTION_MAX)
      return { ok: false, message: 'That file is over 1 MiB, which is more than frotzsmith keeps for one solution.' }
    return { ok: true, text }
  }

  /** Use loaded text as the game's solution; asks before replacing one. */
  function load(text: string, opts: Opts = {}): TabResult {
    if (recorder.state.value === 'recording') return REC_BUSY
    if (solutions.has.value && !opts.confirmed)
      return { ok: false, needsConfirm: true, message: `Replace the solution for “${ide.storyTitle.value || 'Untitled'}”?` }
    const r = solutions.set(text)
    if (r.ok) {
      reveal() // the author chose this text; no spoiler to guard
      recorder.discardUnsaved()
    }
    return r
  }

  /** Edit: open the solution in the left pane. */
  function edit() {
    useProjectFiles().openFile('solution')
  }

  return {
    revealed,
    reveal,
    showSolution,
    hasSampleWalkthrough,
    mode,
    sampleText,
    sampleNote,
    sampleMessage,
    sampleBusy,
    sampleBusyText,
    sampleEdited: ide.sampleEdited,
    ownText,
    busy,
    downloadName,
    adoptSample,
    regenerate,
    clear,
    copy,
    download,
    readFile,
    load,
    edit,
  }
}
