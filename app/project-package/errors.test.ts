import { describe, expect, it } from 'vitest'
import { displayPath } from './errors'

describe('displayPath', () => {
  it('keeps a valid emoji (a surrogate PAIR) intact', () => {
    expect(displayPath('🐉.h')).toBe('🐉.h')
  })
  it('replaces lone surrogates', () => {
    expect(displayPath('a\ud800b')).toBe('a�b')
    expect(displayPath('a\udc00b')).toBe('a�b')
    expect(displayPath('\udc00\ud800')).toBe('��')
  })
  it('replaces control, bidi, zero-width and BOM characters', () => {
    for (const ch of ['\u0000', '\u001f', '\u007f', '\u0085', '​', '‏', '‪', '‮', '⁦', '⁩', '﻿']) {
      expect(displayPath(`x${ch}y`)).toBe('x�y')
    }
  })
  it('leaves ordinary non-ASCII alone and shortens by code point', () => {
    expect(displayPath('café/naïve.h')).toBe('café/naïve.h')
    expect(displayPath('🐉🐉🐉', 2)).toBe('🐉🐉…')
  })
})
