/// <reference types="node" />
// Single import seam for the Glk (glkapi) layer. Kept here so the source — the
// npm `glkote-term` Glk vs a vendored glkapi.js — can change in one place if the
// worker build (Task 5) needs a browser-only variant.
//
// glkapi.js is a *module-level singleton*: its event-generation counter and
// window list live in module scope and are never reset between games (`init()`
// re-points `VM` but leaves `event_generation`/`gli_windowlist` intact). So a
// process that boots more than one story — the golden test's two cases, or
// reset() — must hand each engine a FRESH Glk, or the second boot's init event
// is rejected with a "wrong generation number" and the VM never starts.
//
// In Node (the headless replay / vitest path) we get a fresh instance by
// re-evaluating the module with a busted require cache. glkapi.js has no
// top-level requires of its own, so re-requiring just re-runs its IIFE with
// clean closure state. Task 5's worker build will provide a browser factory
// here (e.g. a vendored glkapi wrapped in a function).
import { createRequire } from 'node:module'

/** The Glk (glkapi) surface the engine touches. Untyped beyond `init`. */
export interface Glk {
  init(options: unknown): void
  [key: string]: unknown
}

const nodeRequire = createRequire(import.meta.url)
const GLKAPI_PATH = nodeRequire.resolve('glkote-term/src/glkapi.js')

/** A fresh, isolated Glk instance with its own module state. */
export function createGlk(): Glk {
  delete nodeRequire.cache[GLKAPI_PATH]
  return nodeRequire(GLKAPI_PATH) as Glk
}
