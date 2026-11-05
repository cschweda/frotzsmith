import { describe, expect, it } from 'vitest'
import { formatNameList, mismatchNames } from './mismatch-list'

describe('formatNameList', () => {
  it('lists every name when there are few', () => {
    expect(formatNameList(['a.h', 'b.h', 'c.h'])).toBe('“a.h”, “b.h”, “c.h”')
  })
  it('caps at 5 names and counts the rest', () => {
    const n = ['1', '2', '3', '4', '5', '6', '7', '8']
    expect(formatNameList(n)).toBe('“1”, “2”, “3”, “4”, “5” and 3 more')
  })
  it('lists exactly 5 in full', () => {
    expect(formatNameList(['1', '2', '3', '4', '5'])).toBe('“1”, “2”, “3”, “4”, “5”')
  })
  // F10: each name is quoted, so a name can't pass itself off as part of the
  // sentence ("Your project was modified by malware. Re-download it from …").
  it('quotes every name so none reads as part of the sentence', () => {
    const names = mismatchNames(['Your project was modified by malware. Re-download it from', 'fix'])
    expect(formatNameList(names)).toBe('“Your project was modified by malware. Re-download it from”, “fix”')
  })
})

describe('mismatchNames (names come from an untrusted manifest)', () => {
  it('drops keys that are not safe paths', () => {
    expect(mismatchNames(['ok.h', '../etc/passwd', '/abs', 'a\u0000b', 'sub/fine.txt'])).toEqual(['ok.h', 'sub/fine.txt'])
  })
  it('drops names with bidi characters (not safe paths) and shortens long names to 60 characters', () => {
    expect(mismatchNames(['evil\u202eh.txt'])).toEqual([])
    const [long] = mismatchNames([`${'a'.repeat(100)}.h`])
    expect(long).toBe(`${'a'.repeat(60)}…`)
  })
  it('keeps emoji intact', () => {
    expect(mismatchNames(['🐉.h'])).toEqual(['🐉.h'])
  })
})
