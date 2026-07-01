import { describe, it, expect } from 'vitest'
import { makeZipEntryFilter, ZipLimitError } from './zip-limits'

const h = (name: string, originalSize: number) => ({ name, originalSize })

describe('makeZipEntryFilter', () => {
  it('admits .h entries and rejects everything else', () => {
    const filter = makeZipEntryFilter()
    expect(filter(h('ext.h', 100))).toBe(true)
    expect(filter(h('README.md', 100))).toBe(false)
    expect(filter(h('nested/dir/other.H', 100))).toBe(true)
  })

  it('throws past the entry cap', () => {
    const filter = makeZipEntryFilter({ maxEntries: 2 })
    expect(filter(h('a.h', 1))).toBe(true)
    expect(filter(h('b.h', 1))).toBe(true)
    expect(() => filter(h('c.h', 1))).toThrow(ZipLimitError)
  })

  it('throws past the total-uncompressed-size cap', () => {
    const filter = makeZipEntryFilter({ maxTotalBytes: 1000 })
    expect(filter(h('a.h', 600))).toBe(true)
    expect(() => filter(h('b.h', 600))).toThrow(ZipLimitError)
  })

  it('non-.h entries do not count toward the caps', () => {
    const filter = makeZipEntryFilter({ maxEntries: 1, maxTotalBytes: 100 })
    expect(filter(h('huge.png', 999_999))).toBe(false)
    expect(filter(h('a.h', 50))).toBe(true)
  })
})
