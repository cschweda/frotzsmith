import type { CompileResult, StoryExt } from '~/modules/inform6/types'

/**
 * The shared worker client (request IDs, timeouts, dead-worker recovery) now
 * lives in @frotzinc/worker-rpc; what stays here is frotzsmith's own policy.
 */
export {
  createWorkerRpc,
  type CallOptions,
  type ParsedReply,
  type WorkerOutcome,
  type WorkerRpcOptions,
} from '@frotzinc/worker-rpc'

/** The CompileResult a timed-out compile reports — no main-thread retry: a
 *  source that spun the worker for a minute would freeze the tab instead. */
export function timedOutResult(storyExt: StoryExt, ms: number): CompileResult {
  const msg =
    `Compile timed out after ${Math.round(ms / 1000)} s and was stopped. `
    + 'Compile again to retry; if it keeps happening, please report it (About → Report a problem).'
  return {
    ok: false,
    storyExt,
    diagnostics: [{ severity: 'fatal', message: msg }],
    rawStderr: msg,
    ms,
    byteLength: 0,
  }
}
