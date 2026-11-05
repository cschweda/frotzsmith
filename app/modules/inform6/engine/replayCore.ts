import type { EngineTarget, ReplayResult, TurnRecord } from './StoryEngine'
import { ZmachineEngine } from './ZmachineEngine'

/** An engine failure part-way through a replay; `turns` are the ones played
 *  before it (the banner first), so a caller can keep the text so far. */
export class ReplayRunError extends Error {
  constructor(message: string, public readonly turns: TurnRecord[]) {
    super(message)
    this.name = 'ReplayRunError'
  }
}

/**
 * The one testing primitive (ADR-007). Boots the story, captures the banner as
 * turn 0, then sends each command capturing per-turn output. Pure/Node-safe —
 * no worker, no DOM — so the golden test drives it directly.
 */
export async function runReplay(
  story: Uint8Array,
  target: EngineTarget,
  commands: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReplayResult> {
  if (target !== 'zmachine') throw new Error('Glulx not yet supported')
  const started = Date.now()
  const engine = new ZmachineEngine()
  const turns: TurnRecord[] = []

  try {
    const banner = await engine.boot(story)
    turns.push({ command: '', output: banner })

    for (let i = 0; i < commands.length && engine.awaitingLine; i++) {
      turns.push(await engine.send(commands[i]!))
      onProgress?.(i + 1, commands.length)
    }
  } catch (err) {
    throw new ReplayRunError(err instanceof Error ? err.message : String(err), turns.slice())
  }
  return { turns, ms: Date.now() - started }
}
