# tools/zilf-wasm — offline ZILF→WASM build

Builds a `.NET 10 WebAssembly` bundle that exposes **ZILF + ZAPF** to JavaScript
via `[JSExport]`. The output (`public/zilf/<zilfBundle>/_framework/`, versioned; see
`versions.zilfBundle` and `ZILF_FRAMEWORK_BASE` in `frotzsmith.config.ts`) is **committed** and
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
2. Empty `publish/`, then run `dotnet publish -c Release -p:WasmFingerprintAssets=false`
   (`dotnet publish` never deletes, so a stale `publish/` would leak old files into the bundle).
3. Copy the `_framework/` bundle to **`public/zilf/<zilfBundle>/`**, where `<zilfBundle>` is
   `versions.zilfBundle` in `frotzsmith.config.ts` (replacing only that directory; other
   `public/zilf/*` bundles stay, so open tabs on an older build keep loading theirs).

Expected output: 48 files, ~11 MB raw.

### Rebuilding: bump the bundle path

The bundle is served `immutable` under its versioned path, so **every rebuild needs a new
path**. Before running `build.sh`, bump `versions.zilfBundle` (`r5262550-w2` → `r5262550-w3`).
`versions.zilf` stays the ZILF source revision (shown to users). Keep the previous bundle
directory for one release, then delete it.

| Bundle | What changed |
|--------|--------------|
| `r5262550` | `Compile(source, version)` only |
| `r5262550-w2` | `CompileProject(filesJson, mainPath, version)`; exact main-file line numbers |

## Exports

| Export | Purpose |
|--------|---------|
| `Compile(source, version)` | One file; same as `CompileProject({"game.zil": source}, "game.zil", version)` |
| `CompileProject(filesJson, mainPath, version)` | A set of files: `filesJson` is `{ "<relative path>": "<text>" }` including the main file |
| `ListResources()` | Embedded resource names (debugging) |

Both compile exports return `{ success, storyBase64, diagnostics }`. How `CompileProject` works:

- Each file is placed at `/project/<path>`; the include paths are `/project` then `/zillib`, so
  a project's own `parser.zil` shadows the library's. The compile runs on `/project/<mainPath>`.
- A key that is empty, absolute, has a drive letter, an empty / `.` / `..` segment, a backslash or a
  control character, isn't `.zil`, or differs from another key only by case is refused: one
  diagnostic naming it, no compile. So is a `mainPath` that isn't a key.
- `<VERSION n> ` (a space, no newline) is prepended to the main file only, so its line numbers
  are exact. (Bundle `r5262550` prepended `<VERSION n>\n`: every main-file line was reported one too high.)
- Reads go through `CaseInsensitiveFileSystem`, so `<INSERT-FILE "Rooms">` finds `rooms.zil`, as on
  a macOS or Windows disk. It also ends a circular `INSERT-FILE`: a file opened more than 50 times in
  one compile gives `“a.zil” is inserted too many times — is there a circular INSERT-FILE?`.
- `/project/` is stripped from the start of every diagnostic (`rooms.zil:12: error …`); `/zillib/…`
  names stay.

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

Loads the bundle named by `versions.zilfBundle` (or `ZILF_BUNDLE=<dir>`). Compiles a one-room
`.zil` to z5 and z3, asserts valid headers, confirms that a broken `.zil` surfaces diagnostics,
then checks `CompileProject`: a multi-file game, `INSERT-FILE` name case, line numbers in extra and
main files, path refusal, a circular `INSERT-FILE`, and one file inserted twice. Expected output:
- `z5 OK: <N> bytes, header[0]=5`
- `z3 OK: <N> bytes, header[0]=3`
- `Broken ZIL correctly failed, diagnostics: [...]`
- an `OK` line per `CompileProject` check, then `ALL TESTS PASSED`

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
| `ZilfExports.cs` | `[JSExport] Compile` / `CompileProject` → JSON |
| `CaseInsensitiveFileSystem.cs` | `IFileSystem` decorator: case-insensitive reads, circular-insert guard |
| `Program.cs` | Minimal entry-point (keeps runtime alive for JS calls) |
| `build.sh` | One-shot build + copy script |
| `test-smoke.mjs` | Node smoke-check for the produced bundle |
| `wwwroot/` | Required by `wasmbrowser` template |
| `zilf/` | **gitignored** ZILF clone (created by `build.sh`) |
| `bin/`, `obj/`, `publish/` | **gitignored** .NET build artefacts |
