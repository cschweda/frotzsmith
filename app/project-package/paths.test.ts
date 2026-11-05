import { describe, expect, test } from 'vitest'
import { pathProblem, pathKey, safeStem } from './paths'

describe('pathProblem', () => {
  test.each([
    'story.inf',
    'tests/walk.txt',
    'frotzsmith.json',
    'lib/deep/nested/file.h',
    'café.h',
    'a'.repeat(255),
    'C/x.h',
    'with space.h',
    // Near-misses of the Windows device names are ordinary names.
    'CONSOLE.h',
    'icon.h',
    'com10.h',
    'lpt.h',
    'auxiliary/x.h',
    'notes/nul-hypothesis.txt',
    // Emoji (a surrogate pair, a variation selector) and accented letters are fine.
    '🐉.h',
    'ok\u2764\ufe0f.txt',
    '.hidden',
    'a b/c d.h',
  ])('accepts %j', (p) => {
    expect(pathProblem(p)).toBeNull()
  })

  test.each([
    ['empty', ''],
    ['parent segment', '../x.h'],
    ['inner parent', 'a/../b'],
    ['trailing parent', 'a/..'],
    ['absolute', '/abs.h'],
    ['backslash', 'a\\b.h'],
    ['drive letter', 'C:/x'],
    ['bare drive letter', 'c:x.h'],
    ['empty segment', 'a//b'],
    ['trailing slash', 'a/'],
    ['dot segment', './a'],
    ['inner dot', 'a/./b'],
    ['NUL', 'a\u0000b'],
    ['C0 control', 'a\u001fb'],
    ['tab', 'a\tb'],
    ['DEL', 'a\u007fb'],
    ['C1 control', 'a\u0085b'],
    ['C1 control (last)', 'a\u009fb'],
    ['lone surrogate', 'a\ud800b'],
    ['256-byte segment', 'a'.repeat(256)],
    ['256-byte multibyte segment', 'é'.repeat(128)],
    ['1025-byte path', `${'a'.repeat(200)}/`.repeat(5) + 'a'.repeat(20)],
    // Windows can't hold these (F9): reserved device names in any segment,
    // with or without an extension, in any case.
    ['CON', 'CON'],
    ['con.txt', 'con.txt'],
    ['AUX in a folder', 'notes/AUX.h'],
    ['NUL', 'NUL'],
    ['PRN', 'prn.inf'],
    ['COM1', 'COM1.inf'],
    ['COM0', 'com0'],
    ['LPT9', 'LPT9'],
    ['COM superscript one', 'COM\u00b9'],
    ['LPT superscript three', 'lpt\u00b3.h'],
    ['CONIN$', 'CONIN$'],
    ['CONOUT$', 'conout$.txt'],
    ['device name as a folder', 'CON/x.h'],
    ['device name with spaces before the dot', 'CON .h'],
    ['device name with two extensions', 'nul.tar.gz'],
    // Trailing dot / space, leading space, in any segment.
    ['trailing dot', 'file.'],
    ['trailing space', 'file '],
    ['trailing dot in a folder', 'dir./x'],
    ['leading space', ' lead'],
    ['leading space in a folder', 'a/ b'],
    // Characters Windows forbids.
    ['colon', 'notes/a:b'],
    ['stream syntax', 'x:stream'],
    ['colon in a folder', 'x/C:/y.h'],
    ['less-than', 'a<b'],
    ['greater-than', 'a>b'],
    ['pipe', 'a|b'],
    ['question mark', 'a?b'],
    ['asterisk', 'a*b'],
    ['double quote', 'a"b'],
    // Invisible / bidi / format / private-use / separator characters.
    ['right-to-left override', '\u202eexe.txt'],
    ['zero-width space', 'file\u200b.inf'],
    ['zero-width joiner', 'a\u200db'],
    ['zero-width joiner in an emoji (display keeps it; paths refuse it)', '\u{1f469}\u200d\u{1f4bb}.h'],
    ['BOM', '\ufeffx'],
    ['soft hyphen', 'a\u00adb'],
    ['word joiner', 'a\u2060b'],
    ['invisible times', 'a\u2062b'],
    ['Arabic letter mark', 'a\u061cb'],
    ['line separator', 'a\u2028b'],
    ['paragraph separator', 'a\u2029b'],
    ['tag character', 'a\u{e0041}b'],
    ['interlinear annotation', 'a\ufff9b'],
    ['Mongolian vowel separator', 'a\u180eb'],
    ['private use', 'a\ue000b'],
    ['supplementary private use', 'a\u{f0000}b'],
    ['Hangul filler', 'a\u3164b'],
    ['Hangul choseong filler', 'a\u115fb'],
    ['Hangul jungseong filler', 'a\u1160b'],
    ['halfwidth Hangul filler', 'a\uffa0b'],
    // Slash and backslash lookalikes.
    ['division slash', '\u2215etc\u2215passwd'],
    ['fullwidth solidus', 'a\uff0fb'],
    ['big solidus', 'a\u29f8b'],
    ['fraction slash', 'a\u2044b'],
    ['fullwidth reverse solidus', 'a\uff3cb'],
    ['reverse solidus operator', 'a\u29f5b'],
  ])('refuses %s', (_label, p) => {
    const reason = pathProblem(p)
    expect(typeof reason).toBe('string')
    expect(reason!.length).toBeGreaterThan(0)
  })

  test('1,024 bytes is accepted and 1,025 is refused', () => {
    const p1024 = `${'a'.repeat(200)}/`.repeat(5) + 'a'.repeat(19)
    expect(new TextEncoder().encode(p1024).length).toBe(1024)
    expect(pathProblem(p1024)).toBeNull()
    const p1025 = p1024 + 'a'
    expect(pathProblem(p1025)).not.toBeNull()
  })
})

describe('pathKey', () => {
  test('folds case after NFC normalization', () => {
    expect(pathKey('A.h')).toBe(pathKey('a.h'))
    expect(pathKey('Cafe\u0301.h')).toBe(pathKey('café.h'))
    expect(pathKey('a.h')).not.toBe(pathKey('b.h'))
  })

  // F9: names that a case-insensitive, normalizing file system (APFS, NTFS)
  // or another unzipper treats as one must collide here too.
  test.each([
    ['long s', 's.h', '\u017f.h'],
    ['final sigma', '\u03c3.h', '\u03c2.h'],
    ['dotless i', 'i.h', '\u0131.h'],
    ['sharp s', 'ss.h', '\u00df.h'],
    ['Kelvin sign', 'k.h', '\u212a.h'],
    ['titlecase digraph', '\u01c5.h', '\u01c6.h'],
    ['ligature ff', '\ufb00.h', 'ff.h'],
    ['ligature fi', '\ufb01le', 'file'],
    ['ohm sign', '\u03a9.h', '\u2126.h'],
    ['fullwidth letters', '\uff21.h', 'a.h'],
    ['decomposed accent', 'e\u0301.h', '\u00e9.h'],
    // A single upper-then-lower fold sends ẞ to ß but ß to ss (review m-1).
    ['capital sharp s and sharp s', '\u1e9e.h', '\u00df.h'],
    ['capital sharp s and SS', '\u1e9e.h', 'SS.h'],
    ['capital sharp s and ss', '\u1e9e.h', 'ss.h'],
  ])('%s collides', (_label, a, b) => {
    expect(pathKey(a)).toBe(pathKey(b))
  })

  test('different names still differ', () => {
    expect(pathKey('s.h')).not.toBe(pathKey('t.h'))
    expect(pathKey('story.inf')).not.toBe(pathKey('story.h'))
  })
})

describe('safeStem (review I-1)', () => {
  test.each(['con', 'Con', 'AUX', 'nul', 'prn', 'COM1', 'lpt9', 'com\u00b9', 'CONIN$', 'conout$'])(
    'a Windows device name %s gets a "_"', (stem) => {
      expect(safeStem(stem)).toBe(`${stem}_`)
      expect(pathProblem(`${safeStem(stem)}.txt`)).toBeNull()
      expect(pathProblem(`tests/${safeStem(stem)}.txt`)).toBeNull()
    })

  test.each(['console', 'story', 'com', 'com10', 'lpt', 'auxiliary', 'nul_', ''])('%s is left alone', (stem) => {
    expect(safeStem(stem)).toBe(stem)
  })
})
