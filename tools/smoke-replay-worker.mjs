#!/usr/bin/env node
// Post-build smoke test: run the GENERATED replay worker chunk (the exact file
// production serves) against the bundled demo story and require a real
// transcript back.
//
// Why this exists: the Node golden tests import ifvms as genuine CommonJS and
// Vite dev wraps it with esbuild — neither reproduces Rollup's production
// CommonJS transform, which once broke EVERY headless replay in production
// while all tests stayed green (see tools/ifvms-this-fix.mjs). Only executing
// the built artifact catches that class of bug.
//
// Usage: node tools/smoke-replay-worker.mjs [publicDir=.output/public]
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const publicDir = resolve(process.argv[2] ?? '.output/public')
const nuxtDir = join(publicDir, '_nuxt')
const chunks = readdirSync(nuxtDir).filter(f => /^replay\.worker-.*\.js$/.test(f))
if (chunks.length !== 1) {
  console.error(`smoke-replay-worker: expected exactly one replay.worker-*.js in ${nuxtDir}, found ${chunks.length}`)
  process.exit(1)
}
const story = new Uint8Array(readFileSync(join(publicDir, 'play', 'demo.z5')))

// Pose as a browser module worker: glk.ts picks its loader by `Worker`
// existing (browser) vs not (Node); the worker posts via self.postMessage.
globalThis.Worker = function Worker() {}
globalThis.self = globalThis
const reply = new Promise((resolveReply) => {
  globalThis.postMessage = (msg) => {
    if (msg?.type === 'result' || msg?.type === 'error') resolveReply(msg)
  }
})
const timer = setTimeout(() => {
  console.error('smoke-replay-worker: no result within 30 s')
  process.exit(1)
}, 30_000)

await import(pathToFileURL(join(nuxtDir, chunks[0])).href)
if (typeof globalThis.onmessage !== 'function') {
  console.error('smoke-replay-worker: the worker chunk did not install an onmessage handler')
  process.exit(1)
}
globalThis.onmessage({ data: { story, target: 'zmachine', commands: ['look', 'inventory'] } })
const msg = await reply
clearTimeout(timer)

if (msg.type === 'error') {
  console.error(`smoke-replay-worker: built replay worker FAILED — ${msg.message}`)
  process.exit(1)
}
// Expect the intro turn plus one turn per command, each with real text.
const turns = msg.turns ?? []
const texts = turns.map(t => String(t.output ?? '').trim())
if (turns.length < 3 || texts.some(t => t.length === 0)) {
  console.error(`smoke-replay-worker: unexpected transcript shape: ${JSON.stringify(turns).slice(0, 500)}`)
  process.exit(1)
}
console.log(`smoke-replay-worker: OK — ${chunks[0]} replayed ${turns.length} turns of demo.z5 in ${msg.ms} ms`)
process.exit(0)
