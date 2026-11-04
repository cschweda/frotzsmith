import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { ifvmsThisFix, OPCODES_RE } from './ifvms-this-fix.mjs'

const require = createRequire(import.meta.url)
const transform = (code: string, id: string) =>
  (ifvmsThisFix().transform as (c: string, i: string) => { code: string } | null)(code, id)

describe('ifvmsThisFix', () => {
  it('rewrites the top-level this.e in the real installed opcodes.js', () => {
    const id = require.resolve('ifvms/src/zvm/opcodes.js')
    const src = readFileSync(id, 'utf8')
    expect(src).toContain('new Variable( this.e, 0 )')
    const out = transform(src, id)!
    expect(out.code).toContain('new Variable( undefined, 0 )')
    expect(out.code).not.toContain('new Variable( this.e, 0 )')
    // The in-method use (`this` = the opcode node) must survive untouched.
    expect(out.code).toContain('new Variable( this.e, op0isVar')
  })

  it('leaves every other module untouched', () => {
    expect(transform('new Variable( this.e, 0 )', '/x/ifvms/src/common/ast.js')).toBeNull()
    expect(transform('anything', '/app/foo.ts')).toBeNull()
  })

  it('fails the build loudly if an ifvms upgrade moves the line', () => {
    expect(() => transform('stack_var = new Variable( engine, 0 ),', '/n/ifvms/src/zvm/opcodes.js'))
      .toThrow(/ifvms/)
  })

  it('matches Windows-style and query-suffixed ids', () => {
    expect(OPCODES_RE.test('C:\\n\\ifvms\\src\\zvm\\opcodes.js')).toBe(true)
    expect(OPCODES_RE.test('/n/ifvms/src/zvm/opcodes.js?commonjs-module')).toBe(true)
  })
})
