import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { parseZilDiagnostics } from '~/modules/zil/zil-diagnostics'
import { cachedAsync } from '~/utils/cached-async'

/**
 * Lazily spawns a `zilf.worker.ts` Web Worker on the first ZIL compile request,
 * then reuses it for all subsequent compiles.  The 7.5 MB .NET WASM bundle is
 * downloaded only when the user first triggers a ZIL compile — not at page load.
 *
 * Returns the same `CompileResult` shape used by the Inform 6 path so all
 * downstream consumers (play, results panel, auto-map, test scripts) work
 * unchanged.
 *
 * Worker + main-thread fallback strategy (ADR-013):
 *   PRIMARY  — Worker path: compile off the main thread, best UX.
 *   FALLBACK — Main-thread path: runs if the Worker fails to load or times out
 *              (covers the Vite dev-server worker-transform hang AND any env
 *              where the Worker never starts). The fallback boots the same
 *              .NET WASM runtime on the main thread; the UI shows "Compiling…"
 *              throughout (~5–9 s is acceptable for an alpha feature).
 *   CACHING  — Once the worker proves unusable (_workerFailed = true), every
 *              subsequent compile in the session skips the Worker entirely.
 *
 * Failure modes:
 * - Worker construction fails  → _workerFailed, main-thread fallback.
 * - Worker sends { error }     → _workerFailed, main-thread fallback.
 * - Worker times out (>4 s)    → terminate worker, _workerFailed, main-thread.
 * - Main-thread boot/compile error → ok: false with a clear Diagnostic.
 */

/**
 * Whether to attempt the Web Worker path at all.
 *
 * DISABLED: the .NET `wasmbrowser` runtime's `dotnet.create()` never completes
 * inside a plain Web Worker. `dotnet.js` detects the worker context and takes
 * its managed-pthread-worker path, waiting for a main-thread .NET host that our
 * standalone worker doesn't provide — so boot hangs (diagnosed via stage
 * logging; shimming window/document/requestAnimationFrame did not help; the
 * bundle is single-threaded, so COOP/COEP/SharedArrayBuffer is not the cause).
 * Compiling on the main thread is the reliable path (~5–9 s, brief UI block —
 * acceptable for alpha). Re-enabling needs the official .NET worker pattern
 * (a separate worker-configured build + host↔worker messaging); see
 * `docs/superpowers/notes/2026-07-01-zil-worker-followup.md`. Typed `boolean`
 * so the Worker code below stays reachable (not dead) for that future work.
 */
const WORKER_ENABLED: boolean = false

/** ms to wait for the Worker before falling back to the main thread (only used when WORKER_ENABLED). */
const WORKER_TIMEOUT_MS = 4_000

// ─── shared types ─────────────────────────────────────────────────────────────

type ZilfExportCache = {
  ZilfExports: { Compile: (source: string, version: number) => string }
}

type CompilePayload = {
  success: boolean
  storyBase64: string | null
  diagnostics: string[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Map numeric Z-machine version to the file extension used by CompileResult. */
function versionToExt(version: number): StoryExt {
  if (version === 3) return 'z3'
  if (version === 8) return 'z8'
  return 'z5' // Default; z5 is the most common target.
}

/** Decodes a base64 string to a Uint8Array (browser-safe). */
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Build a CompileResult from a raw ZILF compile payload.
 * Shared by both the Worker path and the main-thread fallback.
 */
function buildResultFromPayload(
  payload: CompilePayload,
  storyExt: StoryExt,
  started: number,
): CompileResult {
  const diagnostics = parseZilDiagnostics(payload.diagnostics ?? [])
  const rawStderr = (payload.diagnostics ?? []).join('\n')

  if (!payload.success || !payload.storyBase64) {
    return {
      ok: false,
      storyExt,
      diagnostics,
      rawStderr,
      ms: Math.round(performance.now() - started),
      byteLength: 0,
    }
  }

  try {
    const storyFile = base64ToUint8Array(payload.storyBase64)
    const ms = Math.round(performance.now() - started)
    const warnings = diagnostics.filter(d => d.severity === 'warning').length

    // ZILF emits no output on a clean compile (only errors/warnings surface as
    // diagnostics), so synthesize a summary — the Results "Compiler output"
    // pane shows this instead of "(no output)". Richer ZILF stats (object /
    // routine counts) would need the .NET side to return them; this is the
    // interim summary from what we already have.
    const summary = [
      'ZILF: compiled successfully.',
      `  target       ${storyExt}`,
      `  story size   ${storyFile.length.toLocaleString('en-US')} bytes`,
      `  compile time ${(ms / 1000).toFixed(1)} s`,
      `  diagnostics  0 errors, ${warnings} warning${warnings === 1 ? '' : 's'}`,
    ].join('\n')

    return {
      ok: true,
      storyFile,
      storyExt,
      diagnostics,
      rawStderr: rawStderr ? `${summary}\n\n${rawStderr}` : summary,
      ms,
      byteLength: storyFile.length,
    }
  } catch (decodeErr: unknown) {
    const msg = `Failed to decode ZILF story bytes: ${String(decodeErr)}`
    return {
      ok: false,
      storyExt,
      diagnostics: [{ severity: 'error', message: msg }],
      rawStderr: msg,
      ms: Math.round(performance.now() - started),
      byteLength: 0,
    }
  }
}

// ─── Worker path ──────────────────────────────────────────────────────────────

/** Module-level worker instance — created on first compile, reused thereafter. */
let _worker: Worker | null = null

/**
 * Once set to true, the worker is considered unusable for this session and every
 * compile goes directly to the main-thread fallback.
 */
let _workerFailed = false

function getWorker(): Worker {
  if (!_worker) {
    // Vite bundles the worker file as a separate chunk when it sees the
    // `new Worker(new URL(...), { type: 'module' })` pattern.
    _worker = new Worker(
      new URL('../modules/zil/zilf.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return _worker
}

/**
 * Attempt a compile via the Web Worker.
 * Returns the raw payload on success, or null if the worker failed / timed out.
 * A null result triggers the main-thread fallback and sets _workerFailed.
 */
function tryWorkerCompile(
  source: string,
  version: number,
): Promise<CompilePayload | null> {
  return new Promise<CompilePayload | null>((resolve) => {
    let worker: Worker
    try {
      worker = getWorker()
    } catch (spawnErr: unknown) {
      // Worker construction failed (e.g. Vite dev transform hang, wrong env).
      _workerFailed = true
      resolve(null)
      return
    }

    const timer = setTimeout(() => {
      worker.removeEventListener('message', handler)
      // Terminate the stuck worker; next getWorker() call creates a fresh one.
      try {
        worker.terminate()
        _worker = null
      } catch {
        /* ignore — the worker may already be dead */
      }
      _workerFailed = true
      resolve(null)
    }, WORKER_TIMEOUT_MS)

    const handler = (event: MessageEvent) => {
      clearTimeout(timer)
      worker.removeEventListener('message', handler)

      const data = event.data as CompilePayload | { error: string }
      if ('error' in data) {
        // Worker surfaced a boot or runtime error — fall back to main thread.
        _workerFailed = true
        resolve(null)
        return
      }
      resolve(data)
    }

    worker.addEventListener('message', handler)
    worker.postMessage({ source, version })
  })
}

// ─── Main-thread fallback ─────────────────────────────────────────────────────

/**
 * Boot the .NET WASM ZILF runtime on the main thread (once) and return the
 * cached assembly exports.  Mirror of the boot sequence in zilf.worker.ts.
 * cachedAsync clears the cache when a boot fails (e.g. a network blip fetching
 * dotnet.js on the first compile), so the next compile retries instead of
 * re-throwing the stale rejection for the rest of the session.
 */
const getMainThreadExports = cachedAsync(async (): Promise<ZilfExportCache> => {
  // Bypass Vite's import-analysis URL rewriting (?import) so the external,
  // non-Vite dotnet.js loads unprocessed in dev AND prod.  The Function
  // constructor hides the import from Vite's static analyzer so it cannot
  // rewrite the URL.  The app's CSP already allows unsafe-eval (ZVM JIT).
  const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod = await dynamicImport('/zilf/_framework/dotnet.js')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const { dotnet } = mod as {
    dotnet: { withApplicationArguments(): { create(): Promise<unknown> } }
  }
  const runtime = await (
    dotnet.withApplicationArguments() as {
      create(): Promise<Record<string, unknown>>
    }
  ).create()
  const r = runtime as {
    getConfig(): { mainAssemblyName: string }
    getAssemblyExports(name: string): Promise<unknown>
  }
  const config = r.getConfig()
  return (await r.getAssemblyExports(config.mainAssemblyName)) as ZilfExportCache
})

// ─── composable ───────────────────────────────────────────────────────────────

/**
 * Composable that wraps the ZILF Web Worker (with main-thread fallback) and
 * returns a `CompileResult`.
 *
 * Usage:
 * ```ts
 * const { compile } = useZilfWasm()
 * const result = await compile(source, 5)  // version 5 → z5
 * ```
 */
export function useZilfWasm() {
  async function compile(source: string, version: number): Promise<CompileResult> {
    const started = performance.now()
    const storyExt = versionToExt(version)

    // ── Worker path (disabled — see WORKER_ENABLED) ────────────────────────
    // dotnet.create() hangs inside a plain Web Worker, so we compile on the
    // main thread. The worker code is kept, gated off, for a future re-enable.
    if (WORKER_ENABLED && !_workerFailed) {
      const payload = await tryWorkerCompile(source, version)
      if (payload !== null) {
        return buildResultFromPayload(payload, storyExt, started)
      }
      // Worker failed or timed out — fall through to main-thread.
    }

    // ── Main-thread fallback ───────────────────────────────────────────────
    // Boots the .NET WASM runtime directly on the main thread.  The UI will
    // be blocked for ~5–9 s on first compile; subsequent compiles reuse the
    // cached exports and are much faster.
    try {
      const exports = await getMainThreadExports()
      const raw = exports.ZilfExports.Compile(source, version)
      const payload = JSON.parse(raw) as CompilePayload
      return buildResultFromPayload(payload, storyExt, started)
    } catch (err: unknown) {
      const msg = `ZILF runtime error (main-thread): ${String(err)}`
      return {
        ok: false,
        storyExt,
        diagnostics: [{ severity: 'error', message: msg }],
        rawStderr: msg,
        ms: Math.round(performance.now() - started),
        byteLength: 0,
      }
    }
  }

  return { compile }
}
