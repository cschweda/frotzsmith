import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { parseZilDiagnostics } from '~/modules/zil/zil-diagnostics'

/**
 * Lazily spawns a `zilf.worker.ts` Web Worker on the first ZIL compile request,
 * then reuses it for all subsequent compiles.  The 7.5 MB .NET WASM bundle is
 * downloaded only when the user first triggers a ZIL compile — not at page load.
 *
 * Returns the same `CompileResult` shape used by the Inform 6 path so all
 * downstream consumers (play, results panel, auto-map, test scripts) work
 * unchanged.
 *
 * Failure modes:
 * - Worker/boot error → `ok: false` with a clear error `Diagnostic`, no throw.
 * - Compile error (success: false) → `ok: false` with parsed ZILF diagnostics.
 * - Success with diagnostics → `ok: true`, `storyFile` set, warnings surfaced.
 */

/** Map numeric Z-machine version to the file extension used by CompileResult. */
function versionToExt(version: number): StoryExt {
  if (version === 3) return 'z3'
  if (version === 8) return 'z8'
  return 'z5'  // Default; z5 is the most common target.
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

/** Module-level worker instance — created on first compile, reused thereafter. */
let _worker: Worker | null = null

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
 * Composable that wraps the ZILF Web Worker and returns a `CompileResult`.
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

    return new Promise<CompileResult>((resolve) => {
      let worker: Worker
      try {
        worker = getWorker()
      } catch (spawnErr: unknown) {
        // Worker construction failed (e.g. not in a browser context).
        resolve({
          ok: false,
          storyExt,
          diagnostics: [
            {
              severity: 'error',
              message: `Failed to spawn ZILF worker: ${String(spawnErr)}`,
            },
          ],
          rawStderr: String(spawnErr),
          ms: Math.round(performance.now() - started),
          byteLength: 0,
        })
        return
      }

      const handler = (event: MessageEvent) => {
        worker.removeEventListener('message', handler)
        const data = event.data as
          | { success: boolean; storyBase64: string | null; diagnostics: string[] }
          | { error: string }

        if ('error' in data) {
          // Worker surfaced a boot or runtime error.
          const msg = `ZILF runtime error: ${data.error}`
          resolve({
            ok: false,
            storyExt,
            diagnostics: [{ severity: 'error', message: msg }],
            rawStderr: msg,
            ms: Math.round(performance.now() - started),
            byteLength: 0,
          })
          return
        }

        const diagnostics = parseZilDiagnostics(data.diagnostics ?? [])
        const rawStderr = (data.diagnostics ?? []).join('\n')

        if (!data.success || !data.storyBase64) {
          resolve({
            ok: false,
            storyExt,
            diagnostics,
            rawStderr,
            ms: Math.round(performance.now() - started),
            byteLength: 0,
          })
          return
        }

        let storyFile: Uint8Array
        try {
          storyFile = base64ToUint8Array(data.storyBase64)
        } catch (decodeErr: unknown) {
          const msg = `Failed to decode ZILF story bytes: ${String(decodeErr)}`
          resolve({
            ok: false,
            storyExt,
            diagnostics: [{ severity: 'error', message: msg }],
            rawStderr: msg,
            ms: Math.round(performance.now() - started),
            byteLength: 0,
          })
          return
        }

        resolve({
          ok: true,
          storyFile,
          storyExt,
          diagnostics,
          rawStderr,
          ms: Math.round(performance.now() - started),
          byteLength: storyFile.length,
        })
      }

      worker.addEventListener('message', handler)
      worker.postMessage({ source, version })
    })
  }

  return { compile }
}
