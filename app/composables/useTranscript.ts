import type { TurnRecord } from '~/modules/inform6/engine/StoryEngine'
import { ReplayCancelledError } from './useReplay'

const REPLAY_TIMEOUT_MS = 15_000

/** Owns the current transcript run: state, progress, cancellation. */
export function useTranscript() {
  const { result, activeTab, canPlay } = useIde()
  const { replay } = useReplay()

  const turns = useState<TurnRecord[]>('frotz:transcript-turns', () => [])
  const running = useState<boolean>('frotz:transcript-running', () => false)
  const progress = useState<{ done: number; total: number } | null>('frotz:transcript-progress', () => null)
  const ms = useState<number | null>('frotz:transcript-ms', () => null)
  const error = useState<string | null>('frotz:transcript-error', () => null)

  let cancelFn: (() => void) | null = null

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

    try {
      const ctrl = replay(new Uint8Array(story), 'zmachine', commands, {
        onProgress: (done, total) => (progress.value = { done, total }),
        timeoutMs: REPLAY_TIMEOUT_MS,
      })
      cancelFn = ctrl.cancel
      const res = await ctrl.promise
      turns.value = res.turns
      ms.value = res.ms
    } catch (e) {
      if (e instanceof ReplayCancelledError) error.value = `Stopped after ${progress.value?.done ?? 0} commands.`
      else error.value = e instanceof Error ? e.message : 'Replay failed.'
    } finally {
      running.value = false
      progress.value = null
      cancelFn = null
    }
  }

  function cancel() {
    cancelFn?.()
  }

  return { turns, running, progress, ms, error, run, cancel }
}
