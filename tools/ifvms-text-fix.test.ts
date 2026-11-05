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
