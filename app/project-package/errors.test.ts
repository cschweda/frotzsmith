import { describe, expect, it } from 'vitest'
import { displayPath, quotedPath } from './errors'

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

// F10: a name must not be able to hide text, fake a line break, or smear
// over the sentence it is quoted in.
describe('displayPath — deceptive text (F10)', () => {
  it.each([
    ['Arabic letter mark U+061C', '؜'],
    ['line separator U+2028', ' '],
    ['paragraph separator U+2029', ' '],
    ['soft hyphen U+00AD', '­'],
    ['word joiner U+2060', '⁠'],
    ['invisible times U+2062', '⁢'],
    ['tag U+E0041', '\u{e0041}'],
    ['interlinear annotation U+FFF9', '￹'],
    ['Hangul filler U+3164', 'ㅤ'],
    ['Hangul choseong filler U+115F', 'ᅟ'],
    ['Hangul jungseong filler U+1160', 'ᅠ'],
    ['halfwidth Hangul filler U+FFA0', 'ﾠ'],
    ['Mongolian vowel separator U+180E', '᠎'],
    ['private use U+E000', ''],
    ['supplementary private use U+F0000', '\u{f0000}'],
    ['unassigned U+0378', '͸'],
    ['noncharacter U+FFFF', '￿'],
  ])('replaces %s', (_label, ch) => {
    expect(displayPath(`a${ch}b`)).toBe('a�b')
  })

  it('caps combining marks at 2 per character (no "zalgo" smear)', () => {
    expect(displayPath(`x${'̶'.repeat(79)}y`)).toBe('x̶̶y')
    expect(displayPath('é̂̃.h')).toBe('é̂.h')
  })

  it('keeps ordinary accents, emoji and emoji presentation selectors', () => {
    expect(displayPath('café.h')).toBe('café.h')
    expect(displayPath('ok❤️.txt')).toBe('ok❤️.txt')
    expect(displayPath('🐉.h')).toBe('🐉.h')
  })

  it('shortens names to 60 characters by default', () => {
    expect(displayPath('a'.repeat(60))).toBe('a'.repeat(60))
    expect(displayPath('a'.repeat(61))).toBe(`${'a'.repeat(60)}…`)
  })
})

// Review m-2: a ZWJ joining two pictographs is part of one emoji, not a
// hidden character. Anywhere else it is still replaced (and paths refuse it).
describe('displayPath — emoji ZWJ sequences', () => {
  it.each([
    ['technologist', '\u{1f469}\u200d\u{1f4bb} Quest'],
    ['family', '\u{1f468}\u200d\u{1f469}\u200d\u{1f467}.h'],
    ['heart on fire (VS16 before the joiner)', '\u2764\ufe0f\u200d\u{1f525}.txt'],
    ['skin tone before the joiner', '\u{1f469}\u{1f3fd}\u200d\u{1f4bb}'],
  ])('keeps the joiner in a %s emoji', (_label, s) => {
    expect(displayPath(s)).toBe(s)
  })

  it.each([
    ['between letters', 'a\u200db', 'a\ufffdb'],
    ['after a pictograph only', '\u{1f469}\u200dx', '\u{1f469}\ufffdx'],
    ['before a pictograph only', 'x\u200d\u{1f4bb}', 'x\ufffd\u{1f4bb}'],
    ['doubled', '\u{1f469}\u200d\u200d\u{1f4bb}', '\u{1f469}\ufffd\ufffd\u{1f4bb}'],
    ['at the start', '\u200d\u{1f4bb}', '\ufffd\u{1f4bb}'],
  ])('still replaces a joiner %s', (_label, s, want) => {
    expect(displayPath(s)).toBe(want)
  })
})

describe('quotedPath', () => {
  it('quotes the display-safe name', () => {
    expect(quotedPath('a‮b.h')).toBe('“a�b.h”')
    expect(quotedPath('a'.repeat(70), 10)).toBe(`“${'a'.repeat(10)}…”`)
  })
})
