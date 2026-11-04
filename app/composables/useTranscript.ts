import type { TurnRecord } from '~/modules/inform6/engine/StoryEngine'
import { ReplayCancelledError, ReplayTimeoutError } from './useReplay'

/** Wall-clock budget for a headless replay: 15s base + 250ms per command,
 *  capped at 2 minutes — "arbitrarily long" scripts shouldn't hit a flat 15s wall. */
export function replayBudgetMs(commandCount: number): number {
  return Math.min(15_000 + 250 * commandCount, 120_000)
}

// Module-level so Stop still works after the Test Script panel remounts
// (tab switches v-if the panel away mid-run; a per-closure fn went stale).
let cancelFn: (() => void) | null = null
/** Bumped by reset(): a run started before it (an older build / game) must
 *  neither write its turns nor report "Stopped" into the fresh transcript. */
let runGen = 0

/** Owns the current transcript run: state, progress, cancellation. */
export function useTranscript() {
  const { result, activeTab, canPlay } = useIde()
  const { replay } = useReplay()

  const turns = useState<TurnRecord[]>('frotz:transcript-turns', () => [])
  const running = useState<boolean>('frotz:transcript-running', () => false)
  const progress = useState<{ done: number; total: number } | null>('frotz:transcript-progress', () => null)
  const ms = useState<number | null>('frotz:transcript-ms', () => null)
  const error = useState<string | null>('frotz:transcript-error', () => null)

  async function run(commands: string[]) {
    if (!canPlay.value || running.value) return
    const story = result.value?.storyFile
    if (!story) return

    activeTab.value = 'testscript' // stateful right pane focuses the run
    running.value = true
    error.value = null
    turns.value = []
    ms.value = null
    progress.value = { done: 0, total: commands.length }
    const gen = runGen

    try {
      const ctrl = replay(new Uint8Array(story), 'zmachine', commands, {
        onProgress: (done, total) => {
          if (gen === runGen) progress.value = { done, total }
        },
        timeoutMs: replayBudgetMs(commands.length),
      })
      cancelFn = ctrl.cancel
      const res = await ctrl.promise
      if (gen !== runGen) return
      turns.value = res.turns
      ms.value = res.ms
    } catch (e) {
      if (gen !== runGen) return
      if (e instanceof ReplayCancelledError) error.value = `Stopped after ${progress.value?.done ?? 0} commands.`
      else if (e instanceof ReplayTimeoutError)
        error.value = `Timed out after ${progress.value?.done ?? 0} of ${progress.value?.total ?? 0} commands (${Math.round(e.timeoutMs / 1000)}s limit).`
      else error.value = e instanceof Error ? e.message : 'Replay failed.'
    } finally {
      if (gen === runGen) {
        running.value = false
        progress.value = null
        cancelFn = null
      }
    }
  }

  function cancel() {
    cancelFn?.()
  }

  /** New build / new game: stop any run in flight (it replays the old story)
   *  and blank the transcript. */
  function reset() {
    runGen += 1
    cancelFn?.()
    cancelFn = null
    running.value = false
    turns.value = []
    ms.value = null
    error.value = null
    progress.value = null
  }

  return { turns, running, progress, ms, error, run, cancel, reset }
}
