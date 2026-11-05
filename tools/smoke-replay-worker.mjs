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
// It also replays tools/fixtures/f2-unicode-jit.z5 (audit 2026-11-04, F2) in a
// second process: a story whose Unicode table maps a character to U+E000, the
// abbreviation-JIT placeholder, so it can break out of ZVM's generated
// Function('return"…"') and run JavaScript. The built worker must print the
// text with U+FFFD instead and must NOT set globalThis.__frotzPwned — proof
// that tools/ifvms-text-fix.mjs reached the production bundle.
//
// Usage: node tools/smoke-replay-worker.mjs [publicDir]
//   publicDir defaults to wherever this generate wrote the site: dist/ on
//   Netlify (its preset), .output/public elsewhere — see resolveOutDir.
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveOutDir } from './inject-preloads.mjs'

const publicDir = process.argv[2] ? resolve(process.argv[2]) : resolveOutDir(process.cwd())
const nuxtDir = join(publicDir, '_nuxt')
const chunks = readdirSync(nuxtDir).filter(f => /^replay\.worker-.*\.js$/.test(f))
if (chunks.length !== 1) {
  console.error(`smoke-replay-worker: expected exactly one replay.worker-*.js in ${nuxtDir}, found ${chunks.length}`)
  process.exit(1)
}
const F2 = process.env.FROTZSMITH_SMOKE_F2 === '1'
const story = new Uint8Array(readFileSync(F2
  ? fileURLToPath(new URL('./fixtures/f2-unicode-jit.z5', import.meta.url))
  : join(publicDir, 'play', 'demo.z5')))

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
globalThis.onmessage({ data: { story, target: 'zmachine', commands: F2 ? [] : ['look', 'inventory'] } })
const msg = await reply
clearTimeout(timer)

if (F2) {
  const out = String(msg.turns?.[0]?.output ?? '')
  if (globalThis.__frotzPwned !== undefined) {
    console.error('smoke-replay-worker: F2 — the story RAN JavaScript in the built replay worker (ifvms-text-fix missing)')
    process.exit(1)
  }
  if (msg.type === 'error' || !out.includes('Into the X\uFFFD+(globalThis.__frotzPwned=1)+\uFFFDY')) {
    console.error(`smoke-replay-worker: F2 — unexpected result: ${JSON.stringify(msg).slice(0, 500)}`)
    process.exit(1)
  }
  process.exit(0)
}

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
const f2 = spawnSync(process.execPath, [fileURLToPath(import.meta.url), publicDir], {
  env: { ...process.env, FROTZSMITH_SMOKE_F2: '1' },
  stdio: 'inherit',
})
if (f2.status !== 0) {
  console.error('smoke-replay-worker: F2 Unicode-table injection check FAILED')
  process.exit(1)
}
console.log(`smoke-replay-worker: OK — ${chunks[0]} replayed ${turns.length} turns of demo.z5 in ${msg.ms} ms; F2 injection story stayed inert`)
process.exit(0)
