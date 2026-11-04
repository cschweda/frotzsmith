import { describe, expect, test } from 'vitest'
import { pathProblem, pathKey } from './paths'

describe('pathProblem', () => {
  test.each([
    'story.inf',
    'tests/walk.txt',
    'frotzsmith.json',
    'lib/deep/nested/file.h',
    'café.h',
    'a'.repeat(255),
    'C/x.h',
    'x/C:/y.h',
    'with space.h',
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
})
