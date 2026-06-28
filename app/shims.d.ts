/** Minimal type for the Emscripten-built Inform 6 module (see app/modules/inform6/wasm). */
declare module '*/inform6.mjs' {
  interface Inform6FS {
    mkdir(path: string): void
    writeFile(path: string, data: string | Uint8Array): void
    readFile(path: string): Uint8Array
    chdir(path: string): void
  }
  interface Inform6Module {
    FS: Inform6FS
    callMain(args: string[]): number
  }
  type Inform6Factory = (opts?: Record<string, unknown>) => Promise<Inform6Module>
  const factory: Inform6Factory
  export default factory
}
