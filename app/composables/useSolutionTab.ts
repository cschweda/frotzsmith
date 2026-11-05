import { solutionCommands, SOLUTION_MAX } from './solution-text'
import { sampleWalkthrough } from '~/modules/samples-shared/walkthroughs'

export type TabResult =
  | { ok: true; note?: string }
  /** `needsConfirm`: nothing changed; ask, then call again with `{ confirmed: true }`. */
  | { ok: false; message: string; needsConfirm?: true }

type Opts = { confirmed?: boolean }

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
  const solutions = useSolutions()
  const recorder = useSolutionRecorder()

  /** The story key the author pressed Show solution for. */
  const revealedKey = useState<string | null>('frotz:solution-revealed', () => null)
  const revealed = computed(() => revealedKey.value === ide.activeStoryKey.value)

  /** The sample's solution as last made, for the game and source it was made from. */
  const sample = useState<{ key: string; gen: number; id: string; text: string; note?: string } | null>(
    'frotz:solution-sample',
    () => null,
  )
  const sampleMessage = useState<string | null>('frotz:solution-sample-msg', () => null)
  const sampleBusy = useState<boolean>('frotz:solution-sample-busy', () => false)
  const busy = useState<boolean>('frotz:solution-tab-busy', () => false)

  const hasSampleWalkthrough = computed(() => {
    const id = ide.loadedSampleId.value
    return id !== null && sampleWalkthrough(id) !== null
  })
  const currentSample = computed(() => {
    const s = sample.value
    return s && revealed.value && s.key === ide.activeStoryKey.value && s.gen === ide.sourceGen.value && s.id === ide.loadedSampleId.value
      ? s
      : null
  })
  const sampleText = computed(() => currentSample.value?.text ?? null)
  const sampleNote = computed(() => currentSample.value?.note ?? null)

  /** The game's own solution, once revealed (live while recording). */
  const ownText = computed(() => (revealed.value ? solutions.view.value : null))

  const downloadName = computed(() => `${ide.storyBase.value || 'story'}-solution.txt`)

  const REC_BUSY: TabResult = { ok: false, message: 'That can’t be done while recording, so press Pause first.' }

  function reveal() {
    revealedKey.value = ide.activeStoryKey.value
  }

  /** Make the sample's solution (when the editor holds a sample with a walkthrough). */
  async function makeSample(): Promise<void> {
    const id = ide.loadedSampleId.value
    const cmds = id ? sampleWalkthrough(id) : null
    if (!id || !cmds) return
    const key = ide.activeStoryKey.value
    const gen = ide.sourceGen.value
    sampleBusy.value = true
    sampleMessage.value = null
    try {
      const r = await useSolutionGenerator().generate(cmds)
      if (!r.ok) {
        if (!r.superseded) sampleMessage.value = r.message
        return
      }
      if (ide.activeStoryKey.value !== key || ide.sourceGen.value !== gen) return
      sample.value = { key, gen, id, text: r.text, ...(r.note ? { note: r.note } : {}) }
    } finally {
      sampleBusy.value = false
    }
  }

  /** Show solution: lift the spoiler guard for this game (and make the sample's). */
  async function showSolution(): Promise<void> {
    reveal()
    await makeSample()
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

  async function copy(): Promise<TabResult> {
    const text = solutions.view.value
    if (text === null) return { ok: false, message: 'This game has no solution to copy.' }
    try {
      await navigator.clipboard.writeText(text)
      return { ok: true }
    } catch {
      return { ok: false, message: 'The browser would not let Frotzsmith use the clipboard, so use Download instead.' }
    }
  }

  function download(): void {
    const text = solutions.view.value
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
      return { ok: false, message: 'That file is over 1 MiB, which is more than Frotzsmith keeps for one solution.' }
    let text: string
    try {
      text = await file.text()
    } catch {
      return { ok: false, message: 'That file could not be read.' }
    }
    if (text.length > SOLUTION_MAX)
      return { ok: false, message: 'That file is over 1 MiB, which is more than Frotzsmith keeps for one solution.' }
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
    sampleText,
    sampleNote,
    sampleMessage,
    sampleBusy,
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
