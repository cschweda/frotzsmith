import type { CompileResult } from '~/modules/inform6/types'
import type { CompileOpts } from '~/modules/languages/types'
import { createWorkerRpc, timedOutResult } from './worker-rpc'

/**
 * Inform 6 compile orchestration: Web Worker primary, main-thread fallback.
 *
 * Mirrors useZilfWasm (ADR-013 pattern). The worker chunk carries the
 * Emscripten glue + the ~900 KB PROFILE_FILES library text, so neither ever
 * touches the critical-path bundle; the main-thread fallback reaches the same
 * compile body (compile-main.ts) via dynamic import — that path also serves
 * Node (unit/golden tests), where `Worker` doesn't exist.
 *
 * Failure modes (shared with the ZIL client via worker-rpc.ts):
 * - No Worker global               → main-thread path directly, no latch.
 * - Worker can't be built, or fires error/messageerror (script failed to
 *   load / bad message)             → _workerFailed latch, main-thread
 *                                    fallback (the worker will never work).
 * - Worker replies { error }       → main-thread fallback for THIS compile
 *                                    only — one bad compile must not demote
 *                                    the whole session to main-thread mode.
 * - Worker times out (>60 s)      → worker terminated, "timed out" result.
 *                                    NO main-thread retry: a source that spun
 *                                    the worker for a minute would freeze the
 *                                    tab with nothing able to stop it.
 * - Main-thread import/compile throw → ok:false with a fatal Diagnostic.
 */

/** Wall-clock budget for a Worker compile. Generous: the FIRST compile
 *  fetches the worker chunk (libraries + glue) and inform6.wasm (~180 KB gz);
 *  the compile itself is sub-second. */
const WORKER_TIMEOUT_MS = 60_000

/** Once true, the worker is considered unusable for this session and every
 *  compile goes directly to the main-thread fallback. */
let _workerFailed = false

const rpc = createWorkerRpc<CompileResult>({
  // The `new Worker(new URL(...), { type: 'module' })` pattern makes Vite
  // bundle the worker (and its static import chain, including the heavy
  // PROFILE_FILES text) as a separate chunk graph.
  spawn: () =>
    new Worker(new URL('../modules/inform6/inform6.worker.ts', import.meta.url), { type: 'module' }),
  parse: (data) =>
    data.result !== undefined
      ? { kind: 'ok', value: data.result as CompileResult }
      : { kind: 'error', message: String(data.error ?? 'worker compile failed') },
})

/**
 * Composable wrapping the Inform 6 compile worker (with main-thread fallback).
 *
 * Usage:
 * ```ts
 * const { compile } = useI6Wasm()
 * const result = await compile(source, { profileId: 'std', ext: 'z5' })
 * ```
 */
export function useI6Wasm() {
  async function compile(source: string, opts: CompileOpts): Promise<CompileResult> {
    // ── Worker path (primary) ──────────────────────────────────────────────
    if (!_workerFailed && typeof Worker !== 'undefined') {
      const outcome = await rpc.call({ source, opts }, { timeoutMs: WORKER_TIMEOUT_MS })
      if (outcome.kind === 'ok') return outcome.value
      if (outcome.kind === 'timeout') return timedOutResult(opts.ext ?? 'z5', outcome.ms)
      if (outcome.kind === 'unavailable') _workerFailed = true
      // unavailable / error reply — fall through to the main thread.
    }

    // ── Main-thread fallback (also the Node path for tests) ────────────────
    try {
      const { runI6Compile } = await import('~/modules/inform6/compile-main')
      return await runI6Compile(source, opts)
    } catch (err: unknown) {
      const msg = `Inform 6 compiler failed to run: ${String(err)}`
      return {
        ok: false,
        storyExt: opts.ext ?? 'z5',
        diagnostics: [{ severity: 'fatal', message: msg }],
        rawStderr: msg,
        ms: 0,
        byteLength: 0,
      }
    }
  }

  return { compile }
}
