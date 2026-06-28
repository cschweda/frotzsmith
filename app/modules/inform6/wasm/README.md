# Inform 6 → WebAssembly build

Pinned, single-threaded Emscripten build of the Inform 6 compiler used by
Frotzsmith: `inform6.mjs` (ES-module glue) + `inform6.wasm`.

## Pinned versions

- **Compiler:** [DavidKinder/Inform6](https://github.com/DavidKinder/Inform6) tag `v6.44` (11 Sep 2025) — Artistic License 2.0.
- **Emscripten:** 6.0.1.

## Native sanity build

```sh
git clone https://github.com/DavidKinder/Inform6.git
cd Inform6 && git checkout v6.44
cc -O2 -o inform *.c
printf '[ Main; print "Hi^"; @ quit; ];\n' > hello.inf
./inform hello.inf                # -> hello.z5
```

## Emscripten build

```sh
source ~/emsdk/emsdk_env.sh
emcc -O2 *.c -o inform6.mjs \
  -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sINVOKE_RUN=0 -sEXIT_RUNTIME=1 \
  -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 \
  -sSTACK_SIZE=8MB \
  -sEXPORTED_RUNTIME_METHODS=FS,callMain
```

**`-sSTACK_SIZE=8MB` is required.** Emscripten's default stack (64 KB) overflows
when compiling a full standard-library game — native macOS silently tolerates the
over-read, but WASM traps it as `memory access out of bounds`, which under `-O2`
manifests as an apparent infinite loop. 8 MB compiles the standard library
comfortably; raise it for very large games.

`-sENVIRONMENT` is left at the default so the module also runs under Node for
verification; tighten to `web,worker` later if trimming size matters.

## Invocation — re-instantiate per compile

The compiler holds global state and is **not** safe to run `main()` twice. Create
a fresh module instance for every compile (Doc 01 §2.2):

```js
const inform6 = await createInform6({ print, printErr });
inform6.FS.mkdir('/work');
inform6.FS.writeFile('/work/story.inf', source);
inform6.FS.chdir('/work');                       // output is written relative to CWD
inform6.callMain(['-v8', 'story.inf', 'story.z8']);
const bytes = inform6.FS.readFile('/work/story.z8');   // Uint8Array
```

**Verified (Node):** a minimal `.inf` compiles to a 2560-byte `.z8`, and the
two-room standard-library demo compiles to an 89,600-byte `.z8` — byte-identical
to the native build. Three things are required and are easy to miss:

1. `FS.chdir('/work')` + explicit output filename (Inform writes relative to CWD).
2. `-sSTACK_SIZE=8MB` (above).
3. Capitalized library aliases (`Parser.h`, `VerbLib.h`, `Grammar.h`, `English.h`)
   in the include dir — the library's own includes are mixed-case but the files
   ship lowercase, and MEMFS is case-sensitive (unlike macOS).

## Provenance (clean-room)

Frotzsmith is a clean-room implementation. **No code from Borogove** (or any other
IF IDE) is used; Borogove served only as proof that client-side Inform 6
compilation is feasible. This Emscripten recipe was derived from the Emscripten
docs and first-principles debugging (the `-sSTACK_SIZE` fix was diagnosed locally,
not copied). The only third-party code bundled is the upstream Inform 6 compiler
and standard library — both canonical community sources under the Artistic
License 2.0.
