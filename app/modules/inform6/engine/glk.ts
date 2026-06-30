/// <reference types="node" />
// Single import seam for the Glk (glkapi) layer. Kept here so the source can
// change in one place; it must work in BOTH the Vitest Node process and a real
// browser Web Worker (Task 5), so it picks the loader at runtime.
//
// glkapi.js is a *module-level singleton*: its event-generation counter and
// window list live in module scope and are never reset between games (`init()`
// re-points `VM` but leaves `event_generation`/`gli_windowlist` intact). So a
// process that boots more than one story must hand each engine a FRESH Glk, or
// the second boot's init event is rejected with a "wrong generation number" and
// the VM never starts.
//
// - Node (vitest / headless replay): ONE process boots many stories (the golden
//   test's two `it` blocks, reset()). We get a fresh instance per boot by
//   re-evaluating glkapi.js with a busted require cache. glkapi.js has no
//   top-level requires of its own, so re-requiring just re-runs its IIFE with
//   clean closure state. To avoid Vite statically bundling a Node builtin into
//   the worker, `node:module` is imported *dynamically* and `@vite-ignore`d, and
//   the branch is taken only under Node.
// - Browser worker (Task 5): `useReplay` spawns a fresh Worker per run and
//   terminates it, so exactly ONE engine boot happens per worker lifetime. The
//   glkapi module singleton is therefore never reused — a singleton import is
//   safe. We import the pure Glk-API file (`glkote-term/src/glkapi.js`) directly,
//   NOT the package entry, which pulls Node-only terminal deps (readline /
//   mute-stream) that will not bundle.

/** The Glk (glkapi) surface the engine touches. Untyped beyond `init`. */
export interface Glk {
  init(options: unknown): void
  [key: string]: unknown
}

// Detect Node WITHOUT a static `node:*` import (which would break the worker
// bundle). In a browser Web Worker `process` is undefined and `Worker` exists;
// in Node `Worker` is not a global.
const isNode =
  typeof process !== 'undefined' && !!process?.versions?.node && typeof Worker === 'undefined'

// Browser/worker singleton — one boot per worker lifetime (see header).
let browserGlk: Glk | null = null

/** A Glk instance for the engine to drive. Fresh-per-boot under Node; a safely
 *  reused singleton inside the browser worker. */
export async function createGlk(): Promise<Glk> {
  if (isNode) {
    const { createRequire } = await import(/* @vite-ignore */ 'node:module')
    const nodeRequire = createRequire(import.meta.url)
    const GLKAPI_PATH = nodeRequire.resolve('glkote-term/src/glkapi.js')
    delete nodeRequire.cache[GLKAPI_PATH]
    return nodeRequire(GLKAPI_PATH) as Glk
  }
  if (!browserGlk) {
    // @ts-expect-error — glkote-term ships no types.
    const mod = await import('glkote-term/src/glkapi.js')
    browserGlk = ((mod as { default?: Glk }).default ?? (mod as unknown)) as Glk
  }
  return browserGlk
}
