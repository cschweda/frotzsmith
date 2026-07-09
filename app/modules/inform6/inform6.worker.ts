/// <reference lib="webworker" />
/**
 * Inform 6 compile worker — runs inform6.wasm off the main thread so a
 * pathological source can't freeze the tab (the 2026-06-30 audit's tracked
 * Medium), paced by useI6Wasm's wall-clock timeout.
 *
 * This worker's chunk graph statically carries compile-main.ts — i.e. the
 * ~900 KB PROFILE_FILES library text and the Emscripten glue — which is
 * exactly where that weight belongs: fetched on first compile, never on page
 * load. The wasm module itself is still lazy-loaded inside useCompilerWasm.
 *
 * Message protocol:
 *   IN  → { source: string, opts: CompileOpts, requestId: number }
 *   OUT → { result: CompileResult, requestId }   (compile finished, ok or not)
 *       | { error: string, requestId }           (compile path itself threw)
 *
 * The handler is registered via addEventListener (house rule from the ZIL
 * worker — see zilf.worker.ts on dotnet/runtime#114918; no dotnet here, but
 * one convention keeps the guard test simple).
 */
import type { CompileOpts } from '~/modules/languages/types'
import { runI6Compile } from './compile-main'

export type {} // Ensure this is treated as a module by TypeScript.

self.addEventListener(
  'message',
  (event: MessageEvent<{ source: string; opts: CompileOpts; requestId: number }>) => {
    void (async () => {
      const { source, opts, requestId } = event.data
      try {
        // A fresh Emscripten instance per compile (the compiler holds global
        // state); runI6Compile never rejects for ordinary compile errors —
        // those come back as ok:false with diagnostics.
        const result = await runI6Compile(source, opts)
        self.postMessage({ result, requestId })
      } catch (err: unknown) {
        self.postMessage({ error: String(err), requestId })
      }
    })()
  },
)
