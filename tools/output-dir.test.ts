/**
 * The postgenerate checks must find the generated site wherever Nitro wrote
 * it. On Netlify the netlify preset writes `dist/` and there is NO
 * `.output/public` — two checks that hardcoded `.output/public` failed every
 * Netlify build (2026-11-04: nothing deployed after commit 646e797) while
 * passing locally, where `dist` is only a symlink to `.output/public`.
 *
 * Each CLI is run from a temp project that has ONLY `dist/` (the Netlify
 * shape) and is expected to look inside `dist/`, not `.output/public`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const TOOLS = resolve(__dirname)

let root: string
beforeEach(() => {
  // realpath: macOS tmpdir is a /var → /private/var symlink; the CLIs print resolved paths.
  root = realpathSync(mkdtempSync(join(tmpdir(), 'netlify-shape-')))
  mkdirSync(join(root, 'dist'))
  writeFileSync(join(root, 'dist', 'index.html'), '<html><head></head><body></body></html>')
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function run(tool: string) {
  const r = spawnSync(process.execPath, [join(TOOLS, tool)], { cwd: root, encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('postgenerate checks find the Netlify-shaped output (dist/ only)', () => {
  it('check-sw looks in dist/, not .output/public', () => {
    const { status, out } = run('check-sw.mjs')
    expect(status).toBe(1) // no sw.js in the fixture — but it must say so about dist/
    expect(out).toContain(join(root, 'dist'))
    expect(out).not.toContain('.output/public')
  })

  it('smoke-replay-worker looks in dist/_nuxt, not .output/public', () => {
    const { status, out } = run('smoke-replay-worker.mjs')
    expect(status).toBe(1) // no worker chunk in the fixture
    expect(out).toContain(join(root, 'dist', '_nuxt'))
    expect(out).not.toContain('.output/public')
  })
})
