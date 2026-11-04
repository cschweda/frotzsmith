import { describe, expect, it } from 'vitest'
import { formatNameList } from './mismatch-list'

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
