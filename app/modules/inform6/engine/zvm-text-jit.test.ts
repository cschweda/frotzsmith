/// <reference types="node" />
/**
 * Security regression (audit 2026-11-04, F2): ZVM's abbreviation JIT.
 *
 * Both Z-machine interpreters we ship (ifvms 1.1.6 in the headless replay
 * worker, and the vendored Parchment bundle public/play/web/zvm.js) turn any
 * string that uses an abbreviation into
 *     Function('return"' + escaped text with U+E000 → '"' + '"')
 * U+E000 is the interpreter's own placeholder around `+this.abbr(N)+`. A story
 * whose custom Unicode table maps a character to U+E000 puts a bare `"` into
 * that source and can run any JavaScript it likes; a table entry of U+000A
 * gives a SyntaxError.
 *
 * This test compiles such a story with the repo's own inform6.wasm, runs it in
 * BOTH interpreters, and checks the payload does not run. It also runs the
 * story in the UNPATCHED ifvms to prove the PoC is live (if an ifvms upgrade
 * fixes the bug upstream, that case fails and the patch can be retired).
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire, Module } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGlk } from './glk'
import { HeadlessGlkOte } from './headless-glkote'
import { HeadlessDialog } from './headless-dialog'
import { patchIfvmsText, TEXT_RE } from '../../../../tools/ifvms-text-fix.mjs'
import { unpatchVendoredZvm } from '../../../../tools/vendored-zvm-patch.mjs'

const require = createRequire(import.meta.url)
const WASM_PATH = fileURLToPath(new URL('../wasm/inform6.wasm', import.meta.url))
const VENDORED_ZVM = fileURLToPath(new URL('../../../../public/play/web/zvm.js', import.meta.url))

type G = typeof globalThis & { __frotzPwned?: number }
const g = globalThis as G

/** Compile a bare (no library) story with -e so `Abbreviate` is used. */
async function compile(source: string): Promise<Uint8Array> {
  type Inform = {
    FS: { mkdir(p: string): void; chdir(p: string): void; writeFile(p: string, d: string): void; readFile(p: string): Uint8Array }
    callMain(args: string[]): number
  }
  const mod = (await import('../wasm/inform6.mjs')) as unknown as { default: (o: Record<string, unknown>) => Promise<Inform> }
  const out: string[] = []
  const m = await mod.default({
    print: (l: string) => out.push(l),
    printErr: (l: string) => out.push(l),
    locateFile: (p: string) => (p.endsWith('.wasm') ? WASM_PATH : p),
  })
  m.FS.mkdir('/work')
  m.FS.chdir('/work')
  m.FS.writeFile('/work/story.inf', source)
  const code = m.callMain(['-e', '-Cu', '-v5', 'story.inf', 'story.z5'])
  if (code !== 0) throw new Error(`compile failed:\n${out.join('\n')}`)
  return m.FS.readFile('/work/story.z5')
}

// `Zcharacter table +` adds U+E000 (ZSCII 155+n) and U+000A to the story's
// Unicode table. "the " is abbreviated, so ZVM JIT-compiles each string.
const INJECT = `\
Abbreviate "the ";
Zcharacter table + '@{E000}';
[ Main;
  print "Into the X@{E000}+(globalThis.__frotzPwned=1)+@{E000}Y^";
];
`
/** The story with its LAST Unicode-table entry (our U+E000) replaced by `ch`.
 *  Inform 6 won't put a control character into the table itself (it encodes
 *  @{A} as ZSCII 10), but a hand-edited or other-compiler story can. */
function withLastTableEntry(story: Uint8Array, ch: number): Uint8Array {
  const b = story.slice()
  const v = new DataView(b.buffer)
  const ext = v.getUint16(0x36)
  const utab = v.getUint16(ext + 6)
  const n = b[utab]!
  expect(v.getUint16(utab + 1 + 2 * (n - 1))).toBe(0xE000)
  v.setUint16(utab + 1 + 2 * (n - 1), ch)
  return b
}

/** Boot `story` in ZVM class `ZVM`; return the text printed before it quits. */
async function run(ZVM: new () => unknown, story: Uint8Array): Promise<string> {
  const glkote = new HeadlessGlkOte()
  const Glk = await createGlk()
  const vm = new ZVM() as { prepare(data: Uint8Array, opts: unknown): void }
  const options = { vm, Dialog: new HeadlessDialog(), Glk, GlkOte: glkote }
  vm.prepare(story, options)
  Glk.init(options)
  return (await glkote.nextTurn()).buffer
}

/** ifvms exactly as npm ships it (no build transform). */
function unpatchedIfvms(): new () => unknown {
  for (const k of Object.keys(require.cache)) if (/[\\/]ifvms[\\/]/.test(k)) delete require.cache[k]
  return (require('ifvms') as { ZVM: new () => unknown }).ZVM
}

/** ifvms with text.js run through the same transform the Vite build applies. */
function patchedIfvms(): new () => unknown {
  for (const k of Object.keys(require.cache)) if (/[\\/]ifvms[\\/]/.test(k)) delete require.cache[k]
  const textPath = require.resolve('ifvms/src/zvm/text.js')
  expect(TEXT_RE.test(textPath)).toBe(true)
  const m = new Module(textPath) as Module & { _compile(code: string, file: string): void; filename: string; paths: string[]; loaded: boolean }
  m.filename = textPath
  m.paths = (Module as unknown as { _nodeModulePaths(d: string): string[] })._nodeModulePaths(dirname(textPath))
  m._compile(patchIfvmsText(readFileSync(textPath, 'utf8')), textPath)
  m.loaded = true
  require.cache[textPath] = m
  const ZVM = (require('ifvms') as { ZVM: new () => unknown }).ZVM
  for (const k of Object.keys(require.cache)) if (/[\\/]ifvms[\\/]/.test(k)) delete require.cache[k]
  return ZVM
}

async function vendoredZvm(): Promise<new () => unknown> {
  return (await import(/* @vite-ignore */ VENDORED_ZVM)).ZVM
}

/** The vendored zvm.js with its two F2 edits undone, loaded from a temp copy. */
async function unpatchedVendoredZvm(): Promise<new () => unknown> {
  const dir = mkdtempSync(join(tmpdir(), 'frotz-zvm-'))
  try {
    const file = join(dir, 'zvm-unpatched.mjs')
    writeFileSync(file, unpatchVendoredZvm(readFileSync(VENDORED_ZVM, 'utf8')))
    return (await import(/* @vite-ignore */ pathToFileURL(file).href)).ZVM
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('ZVM abbreviation JIT — custom Unicode table injection (F2)', () => {
  it('PoC is live: unpatched ifvms runs the story\'s JavaScript', async () => {
    const story = await compile(INJECT)
    delete g.__frotzPwned
    await run(unpatchedIfvms(), story).catch(() => '')
    expect(g.__frotzPwned).toBe(1)
    delete g.__frotzPwned
  })

  it('patched ifvms (replay worker) does not run it, and still prints the text', async () => {
    const story = await compile(INJECT)
    delete g.__frotzPwned
    const out = await run(patchedIfvms(), story)
    expect(g.__frotzPwned).toBeUndefined()
    expect(out).toContain('Into the X�+(globalThis.__frotzPwned=1)+�Y')
  })

  // Review (fix B) minor 3: without this control the "vendored is inert" case
  // below could pass vacuously (e.g. if the bundle stopped using the JIT).
  it('PoC is live: the vendored zvm.js with its F2 edits undone runs the story\'s JavaScript', async () => {
    const story = await compile(INJECT)
    delete g.__frotzPwned
    await run(await unpatchedVendoredZvm(), story).catch(() => '')
    expect(g.__frotzPwned).toBe(1)
    delete g.__frotzPwned
  })

  it('vendored Play zvm.js does not run it, and still prints the text', async () => {
    const story = await compile(INJECT)
    delete g.__frotzPwned
    const out = await run(await vendoredZvm(), story)
    expect(g.__frotzPwned).toBeUndefined()
    expect(out).toContain('Into the X�+(globalThis.__frotzPwned=1)+�Y')
  })

  it('the smoke-test fixture (tools/fixtures/f2-unicode-jit.z5) is a live PoC too', async () => {
    const fixture = new Uint8Array(readFileSync(fileURLToPath(new URL('../../../../tools/fixtures/f2-unicode-jit.z5', import.meta.url))))
    delete g.__frotzPwned
    await run(unpatchedIfvms(), fixture).catch(() => '')
    expect(g.__frotzPwned).toBe(1)
    delete g.__frotzPwned
    await run(patchedIfvms(), fixture)
    expect(g.__frotzPwned).toBeUndefined()
  })

  it('PoC is live: a raw newline in the table breaks unpatched ifvms (SyntaxError)', async () => {
    const story = withLastTableEntry(await compile(INJECT), 0x0A)
    await expect(run(unpatchedIfvms(), story)).rejects.toThrow(/SyntaxError|Invalid or unexpected token/)
  })

  it('a newline or U+2028 in the table no longer breaks the JIT (both copies)', async () => {
    const base = await compile(INJECT)
    for (const ZVM of [patchedIfvms(), await vendoredZvm()]) {
      delete g.__frotzPwned
      expect(await run(ZVM, withLastTableEntry(base, 0x0A))).toContain('Into the X\uFFFD+(globalThis')
      expect(await run(ZVM, withLastTableEntry(base, 0x2028))).toContain('Into the X\u2028+(globalThis')
      expect(g.__frotzPwned).toBeUndefined()
    }
  })
})
