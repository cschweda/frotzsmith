/**
 * On-disk paths into @frotzinc/inform6-wasm, for tests that boot the real
 * compiler under Node (the golden tests) instead of going through a Vite URL.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const PKG = dirname(createRequire(import.meta.url).resolve('@frotzinc/inform6-wasm/package.json'))

/** A file inside the package, e.g. `wasm/inform6.wasm` or `lib/std`. */
export const inform6Path = (rel: string): string => join(PKG, rel)
