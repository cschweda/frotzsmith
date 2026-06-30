import { describe, it, expect } from 'vitest'
import { detectProfile, PROFILES, DEFAULT_PROFILE, buildSkeleton } from './profiles'

// ---------------------------------------------------------------------------
// detectProfile — pure string classification; no imports needed at runtime
// ---------------------------------------------------------------------------

describe('detectProfile – Standard Library detection', () => {
  it('detects std from Include "Parser"', () => {
    expect(detectProfile('Include "Parser";')).toBe('std')
  })

  it('detects std from Include "VerbLib" (case-insensitive)', () => {
    expect(detectProfile('Include "verblib";')).toBe('std')
  })

  it('detects std from Include "Grammar"', () => {
    expect(detectProfile('Constant Story "X";\nInclude "Grammar";')).toBe('std')
  })

  it('returns std (the default) when no recognizable marker is present', () => {
    expect(detectProfile('')).toBe('std')
    expect(detectProfile('Constant x = 1;')).toBe('std')
  })
})

describe('detectProfile – PunyInform detection', () => {
  it('detects puny from Include "puny.h"', () => {
    expect(detectProfile('Include "puny.h";')).toBe('puny')
  })

  it('detects puny from Include "globals.h"', () => {
    expect(detectProfile('Include "globals.h";')).toBe('puny')
  })

  it('detects puny from Include "puny.h" case-insensitively', () => {
    expect(detectProfile('Include "Puny.H";')).toBe('puny')
  })

  it('detects puny from INITIAL_LOCATION_VALUE (common PunyInform constant)', () => {
    const source = 'Constant INITIAL_LOCATION_VALUE = StartRoom;'
    expect(detectProfile(source)).toBe('puny')
  })

  it('does not mis-fire on a word that merely contains INITIAL_LOCATION_VALUE as a prefix', () => {
    // The regex uses \\b so "INITIAL_LOCATION_VALUE_EXTRA" is a different word
    expect(detectProfile('Constant INITIAL_LOCATION_VALUE_EXTRA = 0;')).toBe('std')
  })

  it('detects puny from $OMIT_UNUSED_ROUTINES in source code (not a !% comment)', () => {
    const source = 'Constant $OMIT_UNUSED_ROUTINES 1;'
    expect(detectProfile(source)).toBe('puny')
  })

  it('detects puny from $ZCODE_ constant', () => {
    const source = 'Constant $ZCODE_WANTED 5;'
    expect(detectProfile(source)).toBe('puny')
  })

  it('detects puny from OPTIONAL_ prefix constant', () => {
    const source = 'Constant OPTIONAL_EXTENDED_VERBSET 1;'
    expect(detectProfile(source)).toBe('puny')
  })
})

describe('detectProfile – comment stripping', () => {
  it('does not detect puny from a comment that mentions puny.h', () => {
    const source = '! This game DOES NOT use Include "puny.h"\nInclude "Parser";'
    expect(detectProfile(source)).toBe('std')
  })

  it('does not detect std from a comment that mentions Parser', () => {
    const source = '! Compare with Include "Parser" in the std library\nInclude "puny.h";'
    expect(detectProfile(source)).toBe('puny')
  })

  it('ignores !% compiler-option lines (they begin with ! and are stripped)', () => {
    // !% $OMIT_UNUSED_ROUTINES=1 is a comment-style directive, not code
    const source = '!% $OMIT_UNUSED_ROUTINES=1\nConstant Story "X";\nInclude "Parser";'
    expect(detectProfile(source)).toBe('std')
  })

  it('puny detection works even with inline comments on other lines', () => {
    const source = [
      '! This is a PunyInform game',
      'Constant Story "Foo"; ! set story title',
      'Include "globals.h"; ! PunyInform globals',
    ].join('\n')
    expect(detectProfile(source)).toBe('puny')
  })
})

describe('detectProfile – real skeleton sources', () => {
  it('detects std for the actual std-skeleton content', async () => {
    const { PROFILES: p } = await import('./profiles')
    expect(detectProfile(p.std.starter)).toBe('std')
  })

  it('detects puny for the actual puny-skeleton content', async () => {
    const { PROFILES: p } = await import('./profiles')
    expect(detectProfile(p.puny.starter)).toBe('puny')
  })
})

// ---------------------------------------------------------------------------
// DEFAULT_PROFILE
// ---------------------------------------------------------------------------

describe('DEFAULT_PROFILE', () => {
  it('is std', () => {
    expect(DEFAULT_PROFILE).toBe('std')
  })
})

// ---------------------------------------------------------------------------
// PROFILES map shape
// ---------------------------------------------------------------------------

describe('PROFILES shape – std', () => {
  it('has the correct id and labels', () => {
    expect(PROFILES.std.id).toBe('std')
    expect(typeof PROFILES.std.label).toBe('string')
    expect(PROFILES.std.label.length).toBeGreaterThan(0)
  })

  it('defaults to z5 and includes z5 and z8 targets', () => {
    expect(PROFILES.std.defaultExt).toBe('z5')
    expect(PROFILES.std.targets).toContain('z5')
    expect(PROFILES.std.targets).toContain('z8')
  })

  it('uses /lib/std as the include path', () => {
    expect(PROFILES.std.includePath).toBe('/lib/std')
  })

  it('has a non-empty files array', () => {
    expect(PROFILES.std.files.length).toBeGreaterThan(0)
  })

  it('contains capitalized Parser.h / VerbLib.h aliases', () => {
    const paths = PROFILES.std.files.map(f => f.path)
    expect(paths).toContain('/lib/std/Parser.h')
    expect(paths).toContain('/lib/std/VerbLib.h')
    expect(paths).toContain('/lib/std/Grammar.h')
    expect(paths).toContain('/lib/std/English.h')
  })

  it('all file entries have path and non-empty content', () => {
    for (const f of PROFILES.std.files) {
      expect(typeof f.path).toBe('string')
      expect(f.path.length).toBeGreaterThan(0)
      expect(typeof f.content).toBe('string')
      expect(f.content.length).toBeGreaterThan(0)
    }
  })
})

describe('PROFILES shape – puny', () => {
  it('has the correct id', () => {
    expect(PROFILES.puny.id).toBe('puny')
  })

  it('defaults to z5 and includes z3 target', () => {
    expect(PROFILES.puny.defaultExt).toBe('z5')
    expect(PROFILES.puny.targets).toContain('z3')
    expect(PROFILES.puny.targets).toContain('z5')
  })

  it('uses /lib/puny as the include path', () => {
    expect(PROFILES.puny.includePath).toBe('/lib/puny')
  })

  it('has a non-empty files array', () => {
    expect(PROFILES.puny.files.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// buildSkeleton
// ---------------------------------------------------------------------------

describe('buildSkeleton', () => {
  it('substitutes title and author in the std skeleton', () => {
    const out = buildSkeleton('std', 'My Adventure', 'Alice')
    expect(out).toContain('Constant Story "MY ADVENTURE"')
    expect(out).toContain('"^An interactive fiction by Alice.^"')
  })

  it('substitutes title and author in the puny skeleton', () => {
    const out = buildSkeleton('puny', 'Dungeon', 'Bob')
    expect(out).toContain('Constant Story "DUNGEON"')
    expect(out).toContain('"^An interactive fiction by Bob.^"')
  })

  it('defaults to MY GAME / Anonymous when title and author are blank', () => {
    const out = buildSkeleton('std', '', '')
    expect(out).toContain('Constant Story "MY GAME"')
    expect(out).toContain('"^An interactive fiction by Anonymous.^"')
  })

  it('trims whitespace from title and author', () => {
    const out = buildSkeleton('std', '  Zork  ', '  Infocom  ')
    expect(out).toContain('Constant Story "ZORK"')
    expect(out).toContain('"^An interactive fiction by Infocom.^"')
  })

  it('strips double-quotes from title and author', () => {
    const out = buildSkeleton('std', 'My "Game"', 'Au"thor')
    expect(out).toContain('Constant Story "MY GAME"')
    expect(out).toContain('"^An interactive fiction by Author.^"')
  })
})
