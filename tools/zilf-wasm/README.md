# tools/zilf-wasm — offline ZILF→WASM build

Builds a `.NET 10 WebAssembly` bundle that exposes **ZILF + ZAPF** to JavaScript
via `[JSExport]`. The output (`public/zilf/_framework/`) is **committed** and
shipped as a static artifact — the same offline model as `inform6.wasm`. Netlify
never builds this; it simply serves the pre-committed files.

## Requirements

- **.NET 10 SDK** at `~/.dotnet/dotnet` (version `10.0.301` or later)
- `wasm-tools` workload: `~/.dotnet/dotnet workload install wasm-tools`
- Internet access (first run only — to clone ZILF)

Install the SDK if absent:
```sh
curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --version 10.0.301
~/.dotnet/dotnet workload install wasm-tools
```

## Build

From the **repo root**:
```sh
bash tools/zilf-wasm/build.sh
```

This will:
1. Clone `https://github.com/taradinoc/zilf` into `tools/zilf-wasm/zilf/` and
   check out rev **`5262550`** (idempotent — skips if already present at that rev).
2. Run `dotnet publish -c Release -p:WasmFingerprintAssets=false`.
3. Copy the `_framework/` bundle to **`public/zilf/`** (replacing any prior output).

Expected output: ~201 files, ~20 MB raw / ~7.5 MB gzipped (trimmed; Task 6).

## Bundle size

| State | Raw | Gzipped |
|-------|-----|---------|
| Untrimmed (Task 5 baseline) | ~28 MB | ~10.1 MB |
| Trimmed (Task 6, `TrimMode=full`) | ~20 MB | ~7.5 MB |

**Trim strategy:** `PublishTrimmed=true`, `TrimMode=full`. All ZILF/ZAPF assemblies are
preserved wholesale via `ZilfRoots.xml` (`preserve="all"` for `zilf`, `Zilf.Common`,
`Zilf.Emit`, `zapf`, `Zapf.Parsing`, `FastHashSet`, `ReadLine`, `ZilfWasm`). The BCL is
aggressively trimmed. `ZilfExports.cs` uses source-generated JSON (`ZilfJsonContext`) to
stay trim-safe — avoids `JsonSerializerIsReflectionDisabled` at runtime.

## Smoke-check

```sh
node tools/zilf-wasm/test-smoke.mjs
```

Compiles a one-room `.zil` to z5 and z3, asserts valid headers, and confirms
that a broken `.zil` surfaces diagnostics. Expected output:
- `z5 OK: <N> bytes, header[0]=5`
- `z3 OK: <N> bytes, header[0]=3`
- `Broken ZIL correctly failed, diagnostics: [...]`

## ZILF provenance

| Item | Value |
|------|-------|
| Source | <https://github.com/taradinoc/zilf> |
| Pinned rev | `5262550` |
| License | **GPLv3** |
| Build model | offline; artifact committed; Netlify serves static files only |

**GPLv3 note:** Distributing the compiled WASM bundle constitutes distribution
of a GPLv3-covered work. The Frotzsmith project must comply with GPLv3 § 6
(provide Corresponding Source or a written offer). See repo `LICENSE` and the
project's licensing decision document for the chosen compliance path.

## Files

| File | Purpose |
|------|---------|
| `ZilfWasm.csproj` | .NET wasmbrowser project (all validated csproj fixes) |
| `ZilfExports.cs` | `[JSExport] Compile(source, version)` → JSON |
| `Program.cs` | Minimal entry-point (keeps runtime alive for JS calls) |
| `build.sh` | One-shot build + copy script |
| `test-smoke.mjs` | Node smoke-check for the produced bundle |
| `wwwroot/` | Required by `wasmbrowser` template |
| `zilf/` | **gitignored** ZILF clone (created by `build.sh`) |
| `bin/`, `obj/`, `publish/` | **gitignored** .NET build artefacts |
