/// <reference lib="webworker" />
/**
 * ZILF compile worker — runs the .NET WASM ZILF+ZAPF bundle off the main thread.
 *
 * The .NET runtime is booted ONCE and cached across messages (the boot costs
 * seconds and must not be repeated per compile). Each compile (~5 s) then runs
 * off-thread, keeping the UI fully responsive.
 *
 * Message protocol:
 *   IN  → { source: string, version: number, requestId: number }
 *   OUT → { success, storyBase64, diagnostics, requestId }   (compile payload)
 *       | { error: string, requestId: number }               (boot/compile failure)
 *       | { stage: string }                                  (progress breadcrumb)
 *
 * ── CRITICAL: do NOT assign `self.onmessage = …` anywhere in this file ────────
 * dotnet.js treats the worker as a managed-pthread "deputy" — and deliberately
 * never resolves its asset-load promises, hanging create() forever — whenever
 * BOTH `importScripts` exists AND `globalThis.onmessage` is set
 * (dotnet/runtime#114918, a .NET 9 regression, still open). Registering the
 * handler with addEventListener leaves the `onmessage` IDL attribute null, so
 * the loader boots as a standalone runtime. This single line is why the worker
 * used to hang at `dotnet.create()` (see
 * docs/superpowers/notes/2026-07-01-zil-worker-followup.md).
 *
 * The dotnet.js entry is the productionized bundle committed to
 * public/zilf/_framework/ and served at /zilf/_framework/dotnet.js.
 * It is loaded lazily — the ~7.5 MB bundle downloads only when the first ZIL
 * compile is requested (this worker is only spawned for that first compile).
 *
 * SPA-fallback caveat (Nuxt dev): a missing _framework/* path returns a 200
 * text/html SPA shell rather than a 404.  If dotnet fails to boot (e.g. the
 * framework assets are absent), the error below will catch it and surface a
 * clear message rather than a silent hang.
 */

export type {} // Ensure this is treated as a module by TypeScript.

const post = (m: unknown) => self.postMessage(m)
/** Progress breadcrumbs — logged (debug level) by useZilfWasm; invaluable when
 *  diagnosing a boot stall, and inert otherwise. */
const stage = (s: string) => post({ stage: s })

/** Cached exports — booted once, reused for every compile message. */
let exportsCache: {
  ZilfExports: { Compile: (source: string, version: number) => string }
} | null = null

/** Resolves once the runtime is booted; shared across concurrent messages. */
let bootPromise: Promise<typeof exportsCache> | null = null

async function getExports() {
  if (exportsCache) return exportsCache

  if (!bootPromise) {
    bootPromise = (async () => {
      // Store in a variable so TypeScript treats this as an arbitrary dynamic
      // import (resolves as `any`) rather than a static module specifier that
      // it would try to resolve on disk (which causes TS2307).
      // The Function constructor hides the import from Vite's static analyzer
      // so it cannot rewrite the URL (?import) — the external, non-Vite
      // dotnet.js must load unprocessed in dev AND prod.  The app's CSP
      // already allows unsafe-eval (ZVM JIT).
      const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod = await dynamicImport('/zilf/_framework/dotnet.js')
      stage('dotnet.js imported')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const { dotnet } = mod as { dotnet: { withApplicationArguments(): { create(): Promise<unknown> } } }

      stage('calling dotnet.create()')
      const runtime = await (dotnet.withApplicationArguments() as { create(): Promise<Record<string, unknown>> }).create()
      stage('runtime created')
      const r = runtime as {
        getConfig(): { mainAssemblyName: string }
        getAssemblyExports(name: string): Promise<unknown>
      }
      const config = r.getConfig()
      exportsCache = (await r.getAssemblyExports(config.mainAssemblyName)) as typeof exportsCache
      stage('assembly exports ready')
      return exportsCache
    })()
    // A failed boot must not be cached forever — clear so the next message
    // retries (side-branch catch; callers still see the original rejection).
    bootPromise.catch(() => {
      bootPromise = null
    })
  }

  return bootPromise
}

async function handleCompile({ source, version, requestId }: { source: string; version: number; requestId: number }) {
  try {
    const exports = await getExports()
    if (!exports) throw new Error('ZILF runtime failed to boot (exports are null)')

    stage(`compiling (request ${requestId})`)
    const raw = exports.ZilfExports.Compile(source, version)
    const result = JSON.parse(raw) as {
      success: boolean
      storyBase64: string | null
      diagnostics: string[]
    }
    post({ ...result, requestId })
  } catch (err: unknown) {
    // Surface boot/compile failures as a structured error so useZilfWasm can
    // fall back to the main-thread path rather than hanging.
    post({ error: String(err), requestId })
  }
}

// addEventListener, never `self.onmessage =` — see the header comment (#114918).
self.addEventListener('message', (event: MessageEvent<{ source: string; version: number; requestId: number }>) => {
  void handleCompile(event.data)
})

// Kick the boot as soon as the worker spawns so it overlaps the first request's
// round-trip. Failures surface per-request via handleCompile's catch.
stage('worker spawned; booting runtime')
void getExports().catch(() => {
  /* reported per-request */
})
