/// <reference lib="webworker" />
import { ReplayRunError, runReplay } from './replayCore'
import type { EngineTarget } from './StoryEngine'

interface ReplayRequest {
  story: Uint8Array
  target: EngineTarget
  commands: string[]
}

self.onmessage = async (e: MessageEvent<ReplayRequest>) => {
  const { story, target, commands } = e.data
  try {
    const result = await runReplay(story, target, commands, (done, total) =>
      self.postMessage({ type: 'progress', done, total }),
    )
    self.postMessage({ type: 'result', turns: result.turns, ms: result.ms })
  } catch (err) {
    // The turns played before an engine error ride along, so a solution can
    // keep the text so far.
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      turns: err instanceof ReplayRunError ? err.turns : [],
    })
  }
}
