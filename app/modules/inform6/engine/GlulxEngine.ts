import type { EngineState, EngineTarget, StoryEngine, TurnRecord } from './StoryEngine'

const NOPE = 'Glulx not yet supported'

/** Deferred stub (ADR-002): the seam exists; the engine lands later behind it.
 *  Construction is the "not yet supported" gate — createEngine() instantiates this
 *  for a .ulx target, so `new GlulxEngine()` throws. */
export class GlulxEngine implements StoryEngine {
  readonly target: EngineTarget = 'glulx'
  constructor() {
    throw new Error(NOPE)
  }
  boot(_story: Uint8Array): Promise<string> {
    throw new Error(NOPE)
  }
  send(_command: string): Promise<TurnRecord> {
    throw new Error(NOPE)
  }
  snapshot(): EngineState {
    throw new Error(NOPE)
  }
  restore(_state: EngineState): void {
    throw new Error(NOPE)
  }
  reset(): Promise<string> {
    throw new Error(NOPE)
  }
}
