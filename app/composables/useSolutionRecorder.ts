import { solutionCommands } from './solution-text'
import { registerSessionOnce } from './session-once'

export type RecorderState = 'recording' | 'paused' | 'stopped'
export type RecorderResult =
  | { ok: true; empty?: true; note?: string }
  /** `needsConfirm`: nothing happened; ask the author (`message` is the
   *  question) and call again with `{ confirmed: true }`. */
  | { ok: false; message: string; needsConfirm?: true }

/** sessionStorage key: '1' while a recording runs, so a reload can tell the
 *  author once that the commands since the last Pause were lost. Session
 *  storage on purpose: it belongs to this tab, and survives only a reload. */
const RELOAD_MARK = 'frotzsmith:solution-recording'
/** ms after a captured command before the live text is regenerated. */
export const LIVE_DEBOUNCE_MS = 300

function setMark(on: boolean) {
  try {
    if (on) sessionStorage.setItem(RELOAD_MARK, '1')
    else sessionStorage.removeItem(RELOAD_MARK)
  } catch { /* storage unavailable: no reload notice */ }
}
function takeMark(): boolean {
  try {
    const was = sessionStorage.getItem(RELOAD_MARK) === '1'
    sessionStorage.removeItem(RELOAD_MARK)
    return was
  } catch {
    return false
  }
}

// Module-level, shared by every caller: the live-regenerate debounce, the
// "this Play restart is ours" flag, and the one-at-a-time guard.
let liveTimer: ReturnType<typeof setTimeout> | null = null
let ownBoot = false
let starting = false

function cancelLive() {
  if (liveTimer) clearTimeout(liveTimer)
  liveTimer = null
}

/**
 * Records a game's solution while the author plays it.
 *
 * - **Recording** (green): Play runs from the start (or from where the
 *   solution ends) and every typed command is captured. The solution is
 *   regenerated live, read-only, by headless replay.
 * - **Paused** (amber): what was played is saved as the solution and capture
 *   stops, so the author can edit it. Resume replays the (edited) solution's
 *   commands into a fresh Play and carries on capturing after them.
 * - **Stopped** (red): Stop saves the same way and ends the session.
 *
 * The session pauses itself when the game is recompiled or Play is restarted
 * by hand, and stops itself (saving nothing more) when another game is
 * loaded. A reload ends it; `noticeAfterReload` tells the author once.
 */
export function useSolutionRecorder() {
  const ide = useIde()
  const solutions = useSolutions()
  const transcript = usePlayTranscript()

  const state = useState<RecorderState>('frotz:solution-rec-state', () => 'stopped')
  /** Commands fed into Play when the session (re)started; Play doesn't report them. */
  const base = useState<string[]>('frotz:solution-rec-base', () => [])
  /** Commands the author typed since the session (re)started. */
  const captured = useState<string[]>('frotz:solution-rec-captured', () => [])
  /** Commands a failed save couldn't keep: Resume starts from them. */
  const unsaved = useState<string[] | null>('frotz:solution-rec-unsaved', () => null)
  /** One plain sentence about the last automatic change or failure. */
  const notice = useState<string | null>('frotz:solution-rec-notice', () => null)
  /** A save (Pause/Stop) is replaying the commands. */
  const saving = useState<boolean>('frotz:solution-rec-saving', () => false)
  /** For the live region: the state as words, changed on every transition. */
  const announcement = useState<string>('frotz:solution-rec-announce', () => '')

  const recording = computed(() => state.value === 'recording')
  const commandCount = computed(() => base.value.length + captured.value.length)

  function setState(next: RecorderState, why?: string) {
    state.value = next
    setMark(next === 'recording')
    if (next !== 'recording') cancelLive()
    const word = next === 'recording' ? 'Recording' : next === 'paused' ? 'Recording paused' : 'Recording stopped'
    announcement.value = why ? `${word}: ${why}` : `${word}.`
  }

  function allCommands(): string[] {
    return [...base.value, ...captured.value]
  }

  function scheduleLive() {
    cancelLive()
    liveTimer = setTimeout(() => {
      liveTimer = null
      if (state.value !== 'recording') return
      const cmds = allCommands()
      void useSolutionGenerator().generate(cmds).then(r => {
        // Only while still recording, and only the latest request's text.
        if (r.ok && state.value === 'recording') solutions.setLive(r.text)
      })
    }, LIVE_DEBOUNCE_MS)
  }

  /** Save base + captured as the solution. Zero commands saves nothing. */
  async function save(): Promise<RecorderResult> {
    const cmds = unsaved.value ?? allCommands()
    if (cmds.length === 0) {
      solutions.setLive(null)
      return { ok: true, empty: true }
    }
    const gen = ide.sourceGen.value
    saving.value = true
    try {
      const r = await useSolutionGenerator().generate(cmds)
      if (ide.sourceGen.value !== gen) return { ok: false, message: 'A different game was loaded, so the solution was not saved.' }
      if (!r.ok) {
        unsaved.value = cmds
        const message = `The solution was not saved: ${r.superseded ? 'another solution request replaced it' : r.message.replace(/\.$/, '')}; Resume or Stop tries again.`
        notice.value = message
        return { ok: false, message }
      }
      const put = solutions.set(r.text)
      if (!put.ok) {
        unsaved.value = cmds
        notice.value = put.message
        return put
      }
      unsaved.value = null
      solutions.setLive(null)
      // The saved text is now the starting point; its commands are the base.
      base.value = solutionCommands(r.text)
      captured.value = []
      return r.note ? { ok: true, note: r.note } : { ok: true }
    } finally {
      saving.value = false
    }
  }

  /** Start capturing after `cmds` have been fed into a fresh Play. */
  async function startFrom(cmds: string[]): Promise<RecorderResult> {
    if (starting || state.value === 'recording') return { ok: false, message: 'A recording is already running.' }
    starting = true
    try {
      const gen = ide.sourceGen.value
      const built = await ide.ensureBuild()
      if (ide.sourceGen.value !== gen) return { ok: false, message: 'A different game was loaded, so recording did not start.' }
      if (!built || !ide.result.value?.storyFile)
        return { ok: false, message: 'The game did not compile, so recording can’t start; Results has the errors.' }
      if (ide.result.value.storyExt === 'ulx')
        return { ok: false, message: 'Solutions need a Z-machine build, and this game compiles to Glulx.' }
      notice.value = null
      unsaved.value = null
      base.value = cmds.slice()
      captured.value = []
      solutions.setLive(null)
      setState('recording')
      // The author is making this solution: no spoiler to guard (useSolutionTab).
      useState<string | null>('frotz:solution-revealed', () => null).value = ide.activeStoryKey.value
      // The game on the right, its solution on the left.
      useProjectFiles().openFile('solution')
      ownBoot = true
      try {
        // Both switch to the Play tab before booting, so the feed runs in a
        // visible tab (hidden tabs throttle it; see play-feed.ts).
        if (cmds.length) ide.sendToPlay(cmds)
        else ide.playFromStart()
      } finally {
        ownBoot = false
      }
      scheduleLive()
      return { ok: true }
    } finally {
      starting = false
    }
  }

  /** Record from scratch. Asks first when the game already has a solution. */
  async function record(opts: { confirmed?: boolean } = {}): Promise<RecorderResult> {
    if (state.value === 'recording') return { ok: false, message: 'A recording is already running.' }
    if (solutions.has.value && !opts.confirmed)
      return { ok: false, needsConfirm: true, message: `Replace the solution for “${ide.storyTitle.value || 'Untitled'}”?` }
    return startFrom([])
  }

  /** Save what was played and stop capturing, so the author can edit. */
  async function pause(): Promise<RecorderResult> {
    if (state.value !== 'recording') return { ok: false, message: 'Nothing is being recorded.' }
    setState('paused')
    return save()
  }

  /** Carry on from where the solution ends (its `> ` lines, edits included). */
  function resumeCommands(): string[] {
    return unsaved.value ?? solutionCommands(solutions.text.value ?? '')
  }

  async function resume(): Promise<RecorderResult> {
    if (state.value !== 'paused') return { ok: false, message: 'The recording is not paused.' }
    return startFrom(resumeCommands())
  }

  /** From Stopped: pick up where the game's solution (perhaps a loaded file) ends. */
  async function continueRecording(): Promise<RecorderResult> {
    if (state.value !== 'stopped') return { ok: false, message: 'A recording session is already open.' }
    if (!solutions.has.value && !unsaved.value) return { ok: false, message: 'This game has no solution to continue yet.' }
    return startFrom(resumeCommands())
  }

  /** "Save": save the solution and end the session. */
  async function stop(): Promise<RecorderResult> {
    const was = state.value
    if (was === 'stopped') return { ok: true }
    setState('stopped')
    if (was === 'paused' && !unsaved.value) return { ok: true } // saved at Pause
    return save()
  }

  /** On the first load after a reload that cut a recording short: tell the author once. */
  function noticeAfterReload(): boolean {
    if (!takeMark()) return false
    useToast().add({
      title: 'Solution recording ended',
      description: 'The page was reloaded while recording, so commands played since the last Pause were not saved.',
      color: 'warning',
      icon: 'i-lucide-circle-stop',
    })
    return true
  }

  registerSessionOnce('solution-recorder', () => {
    // Capture: the transcript grows by one per typed command. Sync, so a
    // reset that follows at once (a fresh Compile) can't drop a command.
    watch(
      () => transcript.commands.value,
      (next, prev) => {
        if (state.value !== 'recording') return
        if (next.length === prev.length + 1) {
          captured.value = [...captured.value, next[next.length - 1]!]
          scheduleLive()
        }
      },
      { flush: 'sync' },
    )
    // A recompile pauses (Resume replays into the new build). Sync, so the
    // pause lands before the Compile blanks the play transcript.
    watch(
      () => ide.status.value,
      s => {
        if (s !== 'compiling' || state.value !== 'recording') return
        setState('paused', 'the game was recompiled')
        notice.value = 'Recording paused because the game was recompiled; Resume replays the solution into the new build.'
        void save()
      },
      { flush: 'sync' },
    )
    // Play restarted by hand (Play, Send to Play): the game went back to the start.
    watch(
      () => ide.playNonce.value,
      () => {
        if (ownBoot || state.value !== 'recording') return
        setState('paused', 'Play was restarted')
        notice.value = 'Recording paused because Play was restarted; Resume carries on from the end of the solution.'
        void save()
      },
      { flush: 'sync' },
    )
    // Another game loaded: stop, and save nothing more into the new game.
    watch(
      () => ide.sourceGen.value,
      () => {
        if (state.value === 'stopped') return
        const lost = state.value === 'recording' && captured.value.length > 0
        setState('stopped', 'a different game was loaded')
        base.value = []
        captured.value = []
        unsaved.value = null
        solutions.setLive(null)
        notice.value = lost
          ? 'Recording stopped because a different game was loaded, so commands since the last Pause were not saved.'
          : 'Recording stopped because a different game was loaded.'
      },
      { flush: 'sync' },
    )
  })

  return {
    state,
    recording,
    commandCount,
    saving,
    notice,
    announcement,
    record,
    pause,
    resume,
    stop,
    continueRecording,
    noticeAfterReload,
  }
}
