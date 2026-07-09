import type { CompileResult } from '~/modules/inform6/types'
import type { CompileOpts } from '~/modules/languages/types'

/**
 * Inform 6 compile orchestration: Web Worker primary, main-thread fallback.
 *
 * Mirrors useZilfWasm (ADR-013 pattern). The worker chunk carries the
 * Emscripten glue + the ~900 KB PROFILE_FILES library text, so neither ever
 * touches the critical-path bundle; the main-thread fallback reaches the same
 * compile body (compile-main.ts) via dynamic import — that path also serves
 * Node (unit/golden tests), where `Worker` doesn't exist.
 *
 * Failure modes (mirroring the ZIL client):
 * - No Worker global               → main-thread path directly, no latch.
 * - Worker construction fails      → _workerFailed, main-thread fallback.
 * - Worker replies { error }       → _workerFailed, main-thread fallback.
 * - Worker fires error/messageerror (script failed to load / bad message)
 *                                  → terminate worker, _workerFailed,
 *                                    main-thread fallback immediately.
 * - Worker times out (>60 s)      → terminate worker, _workerFailed, main.
 * - Main-thread import/compile throw → ok:false with a fatal Diagnostic.
 */

/** ms to wait for a Worker compile before falling back to the main thread.
 *  Generous: the FIRST compile fetches the worker chunk (libraries + glue)
 *  and inform6.wasm (~180 KB gz); the compile itself is sub-second. */
const WORKER_TIMEOUT_MS = 60_000

let _worker: Worker | null = null

/** Once true, the worker is considered unusable for this session and every
 *  compile goes directly to the main-thread fallback. */
let _workerFailed = false

/** Monotonic id so a late response from an aborted compile can't be mistaken
 *  for the current one (the worker is reused across compiles). */
let _requestSeq = 0

function getWorker(): Worker {
  if (!_worker) {
    // The `new Worker(new URL(...), { type: 'module' })` pattern makes Vite
    // bundle the worker (and its static import chain, including the heavy
    // PROFILE_FILES text) as a separate chunk graph.
    _worker = new Worker(
      new URL('../modules/inform6/inform6.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return _worker
}

/**
 * Attempt a compile via the Web Worker. Resolves with the worker-produced
 * CompileResult, or null if the worker failed / timed out (which latches
 * _workerFailed and sends the caller to the main-thread fallback).
 */
function tryWorkerCompile(
  source: string,
  opts: CompileOpts,
  o: { timeoutMs?: number | null } = {},
): Promise<CompileResult | null> {
  const { timeoutMs = WORKER_TIMEOUT_MS } = o
  return new Promise<CompileResult | null>((resolve) => {
    let worker: Worker
    try {
      worker = getWorker()
    } catch {
      _workerFailed = true
      resolve(null)
      return
    }

    const requestId = ++_requestSeq

    const finish = (payload: CompileResult | null) => {
      if (timer !== null) clearTimeout(timer)
      worker.removeEventListener('message', handler)
      worker.removeEventListener('error', onWorkerError)
      worker.removeEventListener('messageerror', onWorkerError)
      resolve(payload)
    }

    const timer =
      timeoutMs === null
        ? null
        : setTimeout(() => {
            // Terminate the stuck worker; next getWorker() creates a fresh one.
            try {
              worker.terminate()
              _worker = null
            } catch {
              /* ignore — the worker may already be dead */
            }
            _workerFailed = true
            finish(null)
          }, timeoutMs)

    const handler = (event: MessageEvent) => {
      const data = event.data as { requestId?: number; result?: CompileResult; error?: string }
      if (data.requestId !== requestId) return // stale response from a prior compile
      if (data.result === undefined) {
        // Worker surfaced a compile-path error — fall back to the main thread.
        _workerFailed = true
        finish(null)
        return
      }
      finish(data.result)
    }

    /** The worker script itself failed (load/parse error) or a message failed
     *  to deserialize — no response will ever arrive, so fail fast instead of
     *  waiting out the timeout. Drop the dead worker so a later attempt gets
     *  a fresh construction (and a fresh, fast error signal). */
    const onWorkerError = () => {
      try {
        worker.terminate()
        _worker = null
      } catch {
        /* ignore */
      }
      _workerFailed = true
      finish(null)
    }

    worker.addEventListener('message', handler)
    worker.addEventListener('error', onWorkerError)
    worker.addEventListener('messageerror', onWorkerError)
    worker.postMessage({ source, opts, requestId })
  })
}

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
      const result = await tryWorkerCompile(source, opts)
      if (result !== null) return result
      // Worker failed or timed out — fall through to the main thread.
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
