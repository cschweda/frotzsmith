/// <reference lib="webworker" />
/**
 * ZILF compile worker — runs the .NET WASM ZILF+ZAPF bundle off the main thread.
 *
 * The .NET runtime is booted ONCE and cached across messages: the boot takes
 * ~200 ms and must not be repeated per compile.  Each compile call (~5 s) is
 * also off-thread, keeping the UI fully responsive.
 *
 * Message protocol:
 *   IN  → { source: string, version: number }
 *   OUT → { success: boolean, storyBase64: string | null, diagnostics: string[] }
 *       | { error: string }   (worker/boot failure)
 *
 * The dotnet.js entry is the productionized bundle committed to
 * public/zilf/_framework/ and served at /zilf/_framework/dotnet.js.
 * It is loaded lazily — the ~7.5 MB bundle downloads only when the first ZIL
 * compile is requested.
 *
 * SPA-fallback caveat (Nuxt dev): a missing _framework/* path returns a 200
 * text/html SPA shell rather than a 404.  If dotnet fails to boot (e.g. the
 * framework assets are absent), the error below will catch it and surface a
 * clear message rather than a silent hang.
 */

export type {}  // Ensure this is treated as a module by TypeScript.

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
    // The @vite-ignore comment prevents Vite's bundler from trying to bundle
    // the .NET runtime as a local module — it's a static public asset served
    // at /zilf/_framework/dotnet.js.
    // Bypass Vite's import-analysis URL rewriting (?import) so the external,
    // non-Vite dotnet.js loads unprocessed in dev AND prod.  The Function
    // constructor hides the import from Vite's static analyzer so it cannot
    // rewrite the URL.  The app's CSP already allows unsafe-eval (ZVM JIT).
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod = await dynamicImport('/zilf/_framework/dotnet.js')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const { dotnet } = mod as { dotnet: { withApplicationArguments(): { create(): Promise<unknown> } } }

      const runtime = await (dotnet.withApplicationArguments() as { create(): Promise<Record<string, unknown>> }).create()
      const r = runtime as {
        getConfig(): { mainAssemblyName: string }
        getAssemblyExports(name: string): Promise<unknown>
      }
      const config = r.getConfig()
      exportsCache = (await r.getAssemblyExports(config.mainAssemblyName)) as typeof exportsCache
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

self.onmessage = async (
  event: MessageEvent<{ source: string; version: number }>,
) => {
  const { source, version } = event.data

  try {
    const exports = await getExports()
    if (!exports) throw new Error('ZILF runtime failed to boot (exports are null)')

    const raw = exports.ZilfExports.Compile(source, version)
    const result = JSON.parse(raw) as {
      success: boolean
      storyBase64: string | null
      diagnostics: string[]
    }

    self.postMessage(result)
  } catch (err: unknown) {
    // Surface boot/compile failures as a structured error so useZilfWasm can
    // produce a CompileResult with a clear diagnostic rather than hanging.
    self.postMessage({ error: String(err) })
  }
}
