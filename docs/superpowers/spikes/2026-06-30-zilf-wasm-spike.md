# ZILF → WebAssembly — Feasibility Spike

**Date:** 2026-06-30
**Type:** Throwaway spike. Goal is **learning, not production** — validate, record findings, discard the code.

## Why this spike

Running ZILF in the browser is **already proven** — [zilf.io](https://zilf.io) is a live, fully static Blazor-WASM site that compiles ZIL client-side, and ZILF is modern **C# / .NET 10** (no porting). The one genuine unknown is **integrating a .NET 10 WASM module into Frotzsmith's Nuxt / Vite / Web-Worker stack** — a different runtime from the Emscripten C `inform6.wasm`. This spike de-risks exactly that, and nothing more.

## Hypothesis to validate

> A .NET 10 WASM module wrapping **ZILF + ZAPF**, built offline and served as a static artifact, can be loaded in Frotzsmith's stack and compile a minimal `.zil` source to a valid **`.z5`** story (a `byte[]` + diagnostics) via a JS-callable `Compile` — and the `.z5` plays in the existing Parchment / ZVM player.

Green → the full feature is "just" wiring + the `/zil/` page. Red → we learn the blocker cheaply.

## Architecture this feeds (decided)

The full feature is a **separate `/zil/` route** that *reuses the existing IDE workspace component*, parameterized by a per-language **"profile"** `{ compiler backend, syntax/lint mode, samples, library/version controls, file extension }`:

- `/` → **Inform 6** profile (unchanged; keeps the Standard / PunyInform library toggle — same language, same `inform6.wasm`)
- `/zil/` → **ZIL** profile (zillib, `.zil`, `<VERSION>`→z3/z5, ZIL samples, ZIL highlighting)
- A **toggle in the title strip** switches the two (it's just route navigation). **A landing-page picker at `/` is deferred** — start with `/` = I6 unchanged.

**This spike builds ONLY the ZIL compiler backend**, shaped to drop into the language-profile: a `compileZil(source, version) → { storyBytes, diagnostics }` that mirrors the existing I6 seam (`useCompiler().compile`). Everything downstream — ▶️ play, 🗺️ auto-map, 🧪 Test Scripts, 📜 Transcript — is already shared and needs no spike, because ZIL emits Z-code.

## Explicitly OUT of scope (these are the FEATURE, after a green spike)

The `/zil/` page + the title-strip toggle, the language-profile abstraction, ZIL syntax highlighting / lint, ZIL samples, **Web-Worker** offloading, **lazy-loading** the .NET bundle, **namespaced localStorage** (so an I6 project and a ZIL project coexist), and the **GPLv3 licensing decision**. The spike runs on the **main thread**, on a throwaway test surface, with a hard-coded one-room `.zil`.

## Step 0 — Prerequisites (the SDK is NOT installed on this machine)

- **.NET 10 SDK** + the wasm workload. macOS / Apple-Silicon supported. Install via the official `dotnet-install` script or Homebrew, then `dotnet workload install wasm-tools`. Verify `dotnet --version` reports `10.x`. *(This is a real system install — get a go-ahead before running it.)*
- **ZILF source** (for project references + zillib): `git clone https://github.com/taradinoc/zilf` (GitHub mirror) or `hg clone https://foss.heptapod.net/zilf/zilf`. Confirm `Zilf.csproj`, `Zapf.csproj`, and `zillib/` exist.
- **Read `src/Zilf.Playground/**/BuildService.cs`** — the canonical example of calling ZILF as a library (`Zilf.Compiler.FrontEnd` + `Zapf` against an `InMemoryFileSystem`). The spike replicates this behind `[JSExport]` instead of Blazor.

## Phase 1 — Build a JS-callable ZILF compile to WASM

1. `dotnet new wasmbrowser -o zilf-wasm-spike` — the **non-Blazor** .NET-WASM browser app (runtime + `[JSExport]`/`[JSImport]` interop; no Blazor UI — we only want the compiler).
2. `<ProjectReference>` ZILF's `Zilf.csproj` + `Zapf.csproj` (and their deps: `Zilf.Common`, `Zilf.Emit`, `Zapf.Parsing`).
3. Expose the compile behind `[JSExport]`, mirroring `BuildService.cs`:
   ```csharp
   [JSExport]
   internal static byte[] Compile(string source, int version) {
     var fs = new InMemoryFileSystem();
     fs.Write("/game.zil", source);
     // mount zillib/*.zil into fs (embedded resources or copied at build)
     var fe = new Zilf.Compiler.FrontEnd { FileSystem = fs, /* Logger */ };
     // ZIL -> ZAP (FrontEnd) -> story (Zapf), targeting `version`; collect diagnostics
     return storyBytes; // surface diagnostics via a second JSExport or a JSON side-channel
   }
   ```
   (The real API names in `BuildService.cs` are the source of truth — match them.)
4. Bundle `zillib` into the in-memory FS (embed as resources, or copy at build).
5. `dotnet publish -c Release` → the `_framework/` output (`dotnet.js` + runtime `.wasm` + assembly DLLs + zillib).

**✅ Checkpoint 1 (go/no-go):** Does it BUILD to WASM (wasm-tools + the ZILF refs)? Record any reference/trimming error.

## Phase 2 — Validate the compile in Node (fastest signal, before the browser)

The `dotnet.js` runtime runs under Node — validate the compile *logic* without the browser (mirrors how the existing golden-compile test runs `inform6.wasm` in Node).
1. Tiny Node script: load the published `dotnet.js`, get the exports, call `Compile(oneRoomZil, 5)`.
2. Assert valid Z-code: **byte 0 == 5** (z5), a sane header/length field, non-empty. Repeat with `version=3` (**z3 — the Infocom-authentic target**).
3. Pass a deliberately broken `.zil` → confirm diagnostics surface (no silent crash).

**✅ Checkpoint 2 (go/no-go):** Valid z5 **and** z3 bytes out; errors surfaced. *(Strongest single signal — the compiler works under the .NET WASM runtime.)*

## Phase 3 — Load + compile inside Frotzsmith (the real integration unknown)

1. Copy `_framework/` into `public/zilf/` (static — Netlify serves it, exactly like `inform6.wasm`).
2. Throwaway test surface — a temporary `app/pages/zil-spike.vue` (or a scratch script) — that loads `public/zilf/dotnet.js`, bootstraps the runtime, calls `Compile(oneRoomZil, 5)`, gets the `byte[]`. *Confirm Vite serves the `_framework/` assets and the dotnet loader resolves the runtime/DLLs by path (may need a `base` tweak).*
3. Hand the bytes to the **existing** player path (blob URL → the Parchment/ZVM iframe, same as an I6 story) and confirm the one-room ZIL game **boots and is playable**.

**✅ Checkpoint 3 (go/no-go):** Loads cleanly in the Vite/Nuxt stack; the compiled `.z5` plays in the existing player.

## Phase 4 — Measure + decide

Record: build OK? z3 + z5 bytes valid? plays? **bundle size** (`_framework/` total, raw + brotli), **first-load time**, **compile time** (interpreter; AOT is a later optimization).

- **All green →** write the full **ZILF design spec**: the `/zil/` route + title-strip toggle, the language-profile abstraction, namespaced state, lazy-loading the .NET bundle, ZIL syntax/samples, and the **GPLv3** call (shipping ZILF's WASM = distribution → the app likely must be GPLv3, or private).
- **Yellow** (works but heavy/slow) → the spec weighs it (lazy-load + worker + AOT mitigations).
- **Red** (a real blocker) → document it + reassess (alternate .NET-WASM packaging, etc.).

## The throwaway rule

Delete `zilf-wasm-spike` + the scratch test surface afterward. The durable outputs are: **the findings** (update this doc with the answers) and **the validated build recipe**. The production feature re-does the integration properly (Worker, lazy-load, the page).
