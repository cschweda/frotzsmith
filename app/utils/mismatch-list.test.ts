import { describe, expect, it } from 'vitest'
import { formatNameList, mismatchNames } from './mismatch-list'

describe('formatNameList', () => {
  it('lists every name when there are few', () => {
    expect(formatNameList(['a.h', 'b.h', 'c.h'])).toBe('a.h, b.h, c.h')
  })
  it('caps at 5 names and counts the rest', () => {
    const n = ['1', '2', '3', '4', '5', '6', '7', '8']
    expect(formatNameList(n)).toBe('1, 2, 3, 4, 5 and 3 more')
  })
  it('lists exactly 5 in full', () => {
    expect(formatNameList(['1', '2', '3', '4', '5'])).toBe('1, 2, 3, 4, 5')
  })
})

describe('mismatchNames (names come from an untrusted manifest)', () => {
  it('drops keys that are not safe paths', () => {
    expect(mismatchNames(['ok.h', '../etc/passwd', '/abs', 'a\u0000b', 'sub/fine.txt'])).toEqual(['ok.h', 'sub/fine.txt'])
  })
  it('neutralises bidi characters and shortens long names to 60 characters', () => {
    const [bidi] = mismatchNames(['evil‮h.txt'])
    expect(bidi).toBe('evil�h.txt')
    const [long] = mismatchNames([`${'a'.repeat(100)}.h`])
    expect(long).toBe(`${'a'.repeat(60)}…`)
  })
  it('keeps emoji intact', () => {
    expect(mismatchNames(['🐉.h'])).toEqual(['🐉.h'])
  })
})
