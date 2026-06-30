import type { EngineTarget, ReplayResult, TurnRecord } from './StoryEngine'
import { ZmachineEngine } from './ZmachineEngine'

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

  const banner = await engine.boot(story)
  turns.push({ command: '', output: banner })

  for (let i = 0; i < commands.length; i++) {
    turns.push(await engine.send(commands[i]!))
    onProgress?.(i + 1, commands.length)
  }
  return { turns, ms: Date.now() - started }
}
