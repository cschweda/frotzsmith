import type { TurnRecord } from '~/modules/inform6/engine/StoryEngine'
import { formatSolution } from './solution-text'
import { ReplayEngineError, ReplayTimeoutError } from './useReplay'
import { replayBudgetMs } from './useTranscript'
import { useOutsideSource } from './outside-source'

export type GenerateResult =
  | { ok: true; text: string; note?: string }
  /** `superseded`: a later generate() call replaced this one; ignore it. */
  | { ok: false; message: string; superseded?: true }

// Module-level so every caller (Solution tab, the live recorder) shares one
// "latest call wins" sequence and the replay in flight can be stopped.
let latestCall = 0
let cancelInFlight: (() => void) | null = null

const SUPERSEDED: GenerateResult = { ok: false, message: 'A newer solution request replaced this one.', superseded: true }

/**
 * Make a solution's text by replaying commands from the start of the game
 * against the current build (compiling first when the build is stale).
 * Cheap to call repeatedly: a later call cancels the replay of an earlier
 * one, and the earlier call resolves `superseded`.
 */
export function useSolutionGenerator() {
  const ide = useIde()
  const { replay } = useReplay()

  async function generate(commands: string[]): Promise<GenerateResult> {
    const call = ++latestCall
    cancelInFlight?.()
    cancelInFlight = null
    // Defence in depth (audit F2): a source from a package, link or opened
    // file is not run headlessly until the author has played or run it once.
    if (useOutsideSource().untrusted.value)
      return { ok: false, message: 'This game came from outside Frotzsmith, so press Play or Run once before making its solution.' }
    const gen = ide.sourceGen.value
    const moved = (): GenerateResult | null => {
      if (call !== latestCall) return SUPERSEDED
      if (ide.sourceGen.value !== gen)
        return { ok: false, message: 'A different game was loaded while the solution was being made.', superseded: true }
      return null
    }

    const built = await ide.ensureBuild()
    const early = moved()
    if (early) return early
    const r = ide.result.value
    if (!built || !r?.storyFile)
      return { ok: false, message: 'The game did not compile, so there is no solution to show; Results has the errors.' }
    if (r.storyExt === 'ulx')
      return { ok: false, message: 'Solutions need a Z-machine build, and this game compiles to Glulx.' }
    const title = ide.storyTitle.value || 'Untitled'

    let turns: TurnRecord[]
    let note: string | undefined
    const ctrl = replay(new Uint8Array(r.storyFile), 'zmachine', commands, {
      timeoutMs: replayBudgetMs(commands.length),
    })
    cancelInFlight = ctrl.cancel
    try {
      turns = (await ctrl.promise).turns
    } catch (e) {
      const late = moved()
      if (late) return late
      if (e instanceof ReplayEngineError && e.turns.length > 0) {
        turns = e.turns
        note = `The game stopped with an error after ${turns.length - 1} of ${commands.length} commands (${e.message}), so the text ends there.`
      } else if (e instanceof ReplayTimeoutError) {
        return { ok: false, message: `Replaying the commands took longer than ${Math.round(e.timeoutMs / 1000)} seconds, so no solution was made.` }
      } else {
        return { ok: false, message: `The game could not be replayed (${e instanceof Error ? e.message : String(e)}).` }
      }
    } finally {
      if (call === latestCall) cancelInFlight = null
    }
    const late = moved()
    if (late) return late

    const [opening, ...played] = turns
    if (!note && played.length < commands.length)
      note = `The game ended after ${played.length} of ${commands.length} commands, so the rest were not played.`
    const text = formatSolution(
      title,
      opening?.output ?? '',
      played.map(t => ({ command: t.command, output: t.output })),
    )
    return note ? { ok: true, text, note } : { ok: true, text }
  }

  return { generate }
}
