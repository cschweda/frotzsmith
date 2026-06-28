import wasmUrl from '~/modules/inform6/wasm/inform6.wasm?url'

interface CaptureHooks {
  print: (line: string) => void
  printErr: (line: string) => void
}

// The factory is loaded once (lazily) and cached; instances are created per compile.
let factoryPromise: Promise<(opts?: Record<string, unknown>) => Promise<Inform6Instance>> | null =
  null

/** The subset of the Emscripten module Frotzsmith uses. */
export interface Inform6Instance {
  FS: {
    mkdir(path: string): void
    writeFile(path: string, data: string | Uint8Array): void
    readFile(path: string): Uint8Array
    chdir(path: string): void
  }
  callMain(args: string[]): number
}

/**
 * Lazy-loads the Inform 6 WASM compiler (a few MB, fetched on first compile, not
 * at page load) and hands out a FRESH instance per compile — the compiler holds
 * global state and is not safe to run `main()` twice.
 */
export function useCompilerWasm() {
  async function getFactory() {
    if (!factoryPromise) {
      factoryPromise = import('~/modules/inform6/wasm/inform6.mjs').then(m => m.default)
    }
    return factoryPromise
  }

  async function createInstance(hooks: CaptureHooks): Promise<Inform6Instance> {
    const factory = await getFactory()
    return factory({
      print: hooks.print,
      printErr: hooks.printErr,
      // Point the module at the Vite-emitted .wasm asset.
      locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
    })
  }

  return { createInstance }
}
