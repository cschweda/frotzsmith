/**
 * line-diff — LCS line diff for the Skein's blessed-vs-current view
 * (node env). Presentation only: status equality is exact string compare in
 * skein-tree; this just renders WHERE outputs diverge.
 */
import { describe, it, expect } from 'vitest'
import { lineDiff } from './line-diff'

describe('lineDiff', () => {
  it('identical text is all same-lines', () => {
    expect(lineDiff('a\nb', 'a\nb')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
    ])
  })

  it('pure insertion', () => {
    expect(lineDiff('a\nc', 'a\nb\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'same', text: 'c' },
    ])
  })

  it('pure deletion', () => {
    expect(lineDiff('a\nb\nc', 'a\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'same', text: 'c' },
    ])
  })

  it('replacement = del of blessed + add of current', () => {
    const d = lineDiff('You see a lamp.', 'You see a sword.')
    expect(d).toEqual([
      { type: 'del', text: 'You see a lamp.' },
      { type: 'add', text: 'You see a sword.' },
    ])
  })

  it('empty vs text', () => {
    expect(lineDiff('', 'a\nb')).toEqual([
      { type: 'add', text: 'a' },
      { type: 'add', text: 'b' },
    ])
    expect(lineDiff('a', '')).toEqual([{ type: 'del', text: 'a' }])
  })

  it('is insensitive to a single trailing newline', () => {
    expect(lineDiff('a\nb\n', 'a\nb')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
    ])
  })
})
