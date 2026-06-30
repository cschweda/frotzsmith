/// <reference lib="webworker" />
import { runReplay } from './replayCore'
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
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
