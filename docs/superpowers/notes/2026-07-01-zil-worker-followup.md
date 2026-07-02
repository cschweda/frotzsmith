# ZIL compile — Web Worker follow-up

**Date:** 2026-07-01
**Status:** ~~Worker **disabled**~~ → **RESOLVED 2026-07-02 — worker enabled and shipping.** See the resolution section below; the rest of this note is preserved as the diagnostic history.

---

## ✅ Resolution (2026-07-02)

**Root cause: [dotnet/runtime#114918](https://github.com/dotnet/runtime/issues/114918)** — a
.NET 9 regression (worked in .NET 8, still open, repros through .NET 11 previews). The loader
sets `ENVIRONMENT_IS_WORKER` only when **both** `importScripts` exists **and
`globalThis.onmessage` is truthy**; when it's true, `assets.ts` deliberately skips resolving the
asset-instantiation promises (the managed-pthread "deputy" path — it expects a main-thread .NET
host to feed it assets), so `dotnet.create()` blocks forever.

**Our trigger was one line of our own code:** `zilf.worker.ts` did `self.onmessage = async … `
and booted the runtime inside that handler — so at `create()` time `onmessage` was set. **That's
why the window/document/rAF shims never helped** (the "ruled out" list below was right that shims
don't fix it, but wrong about why): the detection reads `onmessage`, not the DOM.

**The fix (JS-only, no rebuild):**
1. Register the handler with `self.addEventListener('message', …)` — this never sets the
   `onmessage` IDL attribute, so `ENVIRONMENT_IS_WORKER` stays false and the runtime boots
   standalone. This matches Microsoft's official
   [".NET on Web Workers"](https://learn.microsoft.com/en-us/aspnet/core/client-side/dotnet-on-webworkers?view=aspnetcore-10.0)
   pattern (plain `wasmbrowser` + `[JSExport]`, .NET 8–10; .NET 11 adds a
   `dotnet new blazorwebworker` template).
2. Boot eagerly at module scope (`void getExports()`) so the boot overlaps the first request;
   keep stage breadcrumbs (`{ stage }` messages, logged at debug level by `useZilfWasm`).
3. `WORKER_ENABLED = true`; `WORKER_TIMEOUT_MS` 4 s → **60 s** (the old value was shorter than
   the compile itself and would have timed out every first attempt); add a `requestId` to the
   message protocol so a stale response can't satisfy the wrong compile.

**Verified:** the stage log now passes the old stall point
(`calling dotnet.create()` → `runtime created` → `assembly exports ready`), Cloak of Darkness
compiles to the identical `story.z3` (27.7 KB) and plays, warm compiles run ~5 s **fully
off-thread** (main-thread poller gaps stayed ≤ ~1 s during the whole compile, vs a solid 6 s+
freeze on the main-thread path), and the main-thread fallback still engages on worker failure
(unit-tested).

---

## TL;DR

The ZIL compiler (ZILF/ZAPF → `.NET` WASM, `wasmbrowser` bundle in `public/zilf/_framework/`) works on the main thread. We tried to run it in a Web Worker to keep the UI responsive during the ~5–9 s compile, but **`dotnet.create()` never completes inside a plain Worker** — it hangs at boot. After diagnosis we disabled the worker and ship the main-thread path. Re-enabling is a **focused sub-project**, captured here.

## The one-line diagnosis

`dotnet.js` detects it's running in a Worker (its pthread/`importScripts` machinery), takes its **managed-pthread/deputy-worker boot path**, and waits for a **main-thread .NET host** to coordinate it over the message channel. Our standalone worker provides no such host, so `create()` blocks forever.

Confirmed by stage logging — the worker printed:
```
[zilf-worker] stage: message received; booting runtime
[zilf-worker] stage: dotnet.js imported
[zilf-worker] stage: shims installed; calling dotnet.create()
   ← hangs here; "dotnet runtime created" is NEVER reached
```

## What we ruled out (don't re-try these)

- **`window`/`document`/`requestAnimationFrame` shims** in the worker before `create()` — added them, **did not help** (still hangs at `create()`).
- **SharedArrayBuffer / COOP / COEP headers** — **not the cause.** The bundle is **single-threaded** (`WasmEnableThreads` is unset in `tools/zilf-wasm/ZilfWasm.csproj`), so it doesn't use shared memory. `crossOriginIsolated` is irrelevant here. (The main thread also boots fine *without* those headers, further proof.)
- **The boot code being wrong** — it's correct. `dotnet.withApplicationArguments().create()` → `getConfig()` → `getAssemblyExports()` matches the official non-Blazor pattern (Andrew Lock's article, and the wasmbrowser template). The article covers **main-thread only** — zero Worker/threading guidance.

## Where the code is

- **`app/composables/useZilfWasm.ts`**
  - `WORKER_ENABLED` (currently `false`) — **flip to `true`** to re-attempt the worker. Typed `boolean` so the worker code stays reachable.
  - `WORKER_TIMEOUT_MS` (4 s) — the worker-give-up timeout (only used when enabled).
  - `getWorker()` / `tryWorkerCompile()` — the (dormant) worker path.
  - `getMainThreadExports()` + the `compile()` fallback block — the **working** main-thread path (same boot recipe, no worker).
- **`app/modules/zil/zilf.worker.ts`** — the worker itself: `import dotnet.js` (via a `new Function` Vite-bypass), `dotnet…create()`, `getAssemblyExports`, `ZilfExports.Compile`, `postMessage`.
- **`app/composables/useZilfWasm.lazy.test.ts`** — tests around worker/lazy behavior (update when re-enabling).
- Bundle: `public/zilf/_framework/` (committed); built by `tools/zilf-wasm/build.sh`.

## Diagnostic recipe (re-instrument for testing)

1. In `zilf.worker.ts`, add `self.postMessage({ stage: '…' })` markers after the import, before/after `create()`, after `getAssemblyExports`, and before/after `ZilfExports.Compile`.
2. In `useZilfWasm.ts` → `tryWorkerCompile`'s message handler, log `stage` messages (`console.log('[zilf-worker] stage:', data.stage)`) and **keep waiting** on them (only resolve on `success`/`error`).
3. Set `WORKER_ENABLED = true` and bump `WORKER_TIMEOUT_MS` to ~25 s (so the worker isn't killed before it reveals its stall).
4. Restart `yarn dev`, hard-reload `/zil/`, open the console, compile a sample. **The last `[zilf-worker] stage:` line before silence is the stall point.**

(Worker + composable changes don't HMR cleanly — restart the dev server and hard-reload.)

## Next steps to try (in order of promise)

1. **Force standalone-runtime boot in the worker.** Find the switch that tells `dotnet.js` "I'm the main runtime, not a managed pthread worker." Inspect `public/zilf/_framework/dotnet.js` (and `dotnet.runtime.js`) for the worker/pthread **environment check** (search `importScripts`, `pThread`, `ENVIRONMENT_IS_`, `is_thread`, `deputy`, `mono_wasm`). Look for a `dotnet.withConfig({...})` / builder option or a boot-config field that disables the worker/thread path. This is the most surgical fix if it exists.
2. **Adopt the official .NET "run in a Web Worker" pattern.** Microsoft has guidance for .NET WASM in a worker (the multi-project / worker-configured build + host↔worker messaging). This likely means a **different build** in `tools/zilf-wasm/` (or an added worker entrypoint) rather than importing the main-thread `dotnet.js` into an ad-hoc worker. Start from the Microsoft Web Worker guide for .NET WASM.
3. **Multithreaded build (only if #1/#2 need it).** If the supported worker path requires threads, rebuild with `<WasmEnableThreads>true</WasmEnableThreads>` in `ZilfWasm.csproj`, and then add **COOP/COEP** headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`) in `nuxt.config.ts` (dev, `vite.server.headers`) **and** `netlify.toml` (prod). Caveat: `require-corp` would block the cross-origin Plausible script; use `credentialless` (Plausible is cookieless). Bundle grows.
4. **Native background thread instead of a raw worker.** Investigate whether ZILF's `[JSExport] Compile` can be invoked such that the .NET side runs it on a background `Task`/thread, keeping the main JS thread free — possibly simpler than managing a raw Worker, if the runtime supports it single-threaded.

## Success criteria

The worker posts a compile result (all stages print + a `{ success, storyBase64, diagnostics }` payload comes back) → the compile no longer blocks the main thread. Then: set `WORKER_ENABLED = true` permanently, restore a sane `WORKER_TIMEOUT_MS`, remove the diagnostic markers, and update `useZilfWasm.lazy.test.ts`.

## References

- Andrew Lock, "Running .NET in the browser without Blazor" — confirms the boot API; main-thread only.
- Microsoft Learn — .NET WASM Web Worker guide (the official off-main-thread pattern).
- `docs/superpowers/spikes/2026-06-30-zilf-wasm-spike.md` — the original spike (ran on the main thread; the worker was never spike-tested — that's the gap this note closes).
