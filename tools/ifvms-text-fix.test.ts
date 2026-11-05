import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { ifvmsTextFix, JIT_NEEDLE, patchIfvmsText, TABLE_NEEDLE, TEXT_RE } from './ifvms-text-fix.mjs'

const require = createRequire(import.meta.url)
const transform = (code: string, id: string) =>
  (ifvmsTextFix().transform as (c: string, i: string) => { code: string } | null)(code, id)

describe('ifvmsTextFix (F2: abbreviation-JIT injection)', () => {
  it('patches both lines of the real installed text.js', () => {
    const id = require.resolve('ifvms/src/zvm/text.js')
    const src = readFileSync(id, 'utf8')
    expect(src).toContain(TABLE_NEEDLE)
    expect(src).toContain(JIT_NEEDLE)
    const out = transform(src, id)!.code
    expect(out).not.toContain(TABLE_NEEDLE)
    expect(out).not.toContain(JIT_NEEDLE)
    expect(out).toContain("data[i] === 0xE000 || ( data[i] < 32 && data[i] !== 13 ) ? 0xFFFD : data[i]")
    expect(out).toContain(".replace( /\\n/g, '\\\\n' ).replace( /\\u2028/g, '\\\\u2028' ).replace( /\\u2029/g, '\\\\u2029' ).replace( /\\uE000/g, '\"' )")
    // Still a valid module.
    expect(() => new Function('module', 'exports', 'require', out)).not.toThrow()
  })

  it('leaves every other module untouched', () => {
    expect(transform(TABLE_NEEDLE, '/x/ifvms/src/zvm/io.js')).toBeNull()
    expect(transform('anything', '/app/foo.ts')).toBeNull()
  })

  it('fails the build loudly if an ifvms upgrade changes either line', () => {
    expect(() => transform(TABLE_NEEDLE, '/n/ifvms/src/zvm/text.js')).toThrow(/ifvms-text-fix/)
    expect(() => transform(JIT_NEEDLE, '/n/ifvms/src/zvm/text.js')).toThrow(/ifvms-text-fix/)
    expect(() => patchIfvmsText(TABLE_NEEDLE + JIT_NEEDLE + JIT_NEEDLE)).toThrow(/exactly one/)
    expect(() => patchIfvmsText(TABLE_NEEDLE + JIT_NEEDLE)).not.toThrow()
  })

  it('matches Windows-style and query-suffixed ids', () => {
    expect(TEXT_RE.test('C:\\n\\ifvms\\src\\zvm\\text.js')).toBe(true)
    expect(TEXT_RE.test('/n/ifvms/src/zvm/text.js?commonjs-module')).toBe(true)
  })
})

// Review (fix B) minor 7: a bundle that has ifvms but never saw text.js fails.
describe('ifvmsTextFix — the build fails if text.js was never patched', () => {
  type Hooks = {
    buildStart(): void
    transform(c: string, i: string): unknown
    generateBundle(o: unknown, b: Record<string, unknown>): void
  }
  const plugin = () => ifvmsTextFix() as unknown as Hooks
  const chunk = (...moduleIds: string[]) => ({ type: 'chunk', moduleIds })

  it('throws when ifvms Z-machine modules are bundled but text.js was not seen', () => {
    const p = plugin()
    p.buildStart()
    expect(() => p.generateBundle({}, { 'replay.js': chunk('/n/ifvms/src/zvm/io.js', '/app/x.ts') })).toThrow(/never passed through the F2 fix/)
    // Rollup's older `modules` map is read too.
    expect(() => p.generateBundle({}, { 'r.js': { type: 'chunk', modules: { 'C:\\n\\ifvms\\src\\zvm\\vm.js': {} } } })).toThrow(/F2/)
  })

  it('passes when text.js was patched, or the bundle has no ifvms (another worker)', () => {
    const src = readFileSync(require.resolve('ifvms/src/zvm/text.js'), 'utf8')
    const p = plugin()
    p.buildStart()
    p.transform(src, '/n/ifvms/src/zvm/text.js')
    expect(() => p.generateBundle({}, { 'replay.js': chunk('/n/ifvms/src/zvm/io.js', '/n/ifvms/src/zvm/text.js') })).not.toThrow()
    const other = plugin()
    other.buildStart()
    expect(() => other.generateBundle({}, { 'inform6.js': chunk('/app/inform6.worker.ts'), 'a.css': { type: 'asset' } })).not.toThrow()
  })

  it('forgets what it saw at the start of the next build', () => {
    const src = readFileSync(require.resolve('ifvms/src/zvm/text.js'), 'utf8')
    const p = plugin()
    p.buildStart()
    p.transform(src, '/n/ifvms/src/zvm/text.js')
    p.buildStart()
    expect(() => p.generateBundle({}, { 'r.js': chunk('/n/ifvms/src/zvm/io.js') })).toThrow(/F2/)
  })
})
