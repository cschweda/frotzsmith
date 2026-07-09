import { describe, it, expect } from 'vitest'
import { PROFILE_FILES } from './profile-files'
import { PROFILES, type ProfileId } from './profiles'
import { canonicalLibraryFiles } from '~/composables/project-files'

// ---------------------------------------------------------------------------
// PROFILE_FILES — the heavy library bodies, split out of the profiles metadata
// module so the ~900 KB of .h text stays off the critical-path chunk.
// (Shape assertions migrated from profiles.test.ts.)
// ---------------------------------------------------------------------------

describe('PROFILE_FILES – std', () => {
  it('has a non-empty files array', () => {
    expect(PROFILE_FILES.std.length).toBeGreaterThan(0)
  })

  it('contains capitalized Parser.h / VerbLib.h aliases', () => {
    const paths = PROFILE_FILES.std.map(f => f.path)
    expect(paths).toContain('/lib/std/Parser.h')
    expect(paths).toContain('/lib/std/VerbLib.h')
    expect(paths).toContain('/lib/std/Grammar.h')
    expect(paths).toContain('/lib/std/English.h')
  })

  it('all file entries have path and non-empty content', () => {
    for (const f of PROFILE_FILES.std) {
      expect(typeof f.path).toBe('string')
      expect(f.path.length).toBeGreaterThan(0)
      expect(typeof f.content).toBe('string')
      expect(f.content.length).toBeGreaterThan(0)
    }
  })
})

describe('PROFILE_FILES – puny', () => {
  it('has a non-empty files array mounted under /lib/puny', () => {
    expect(PROFILE_FILES.puny.length).toBeGreaterThan(0)
    expect(PROFILE_FILES.puny.map(f => f.path)).toContain('/lib/puny/puny.h')
  })
})

// ---------------------------------------------------------------------------
// Manifest sync — PROFILES[id].libraryFileNames is the light, curated list the
// file explorer shows WITHOUT loading the bodies. It must stay in lockstep
// with what the compile path actually mounts.
// ---------------------------------------------------------------------------

describe('libraryFileNames manifest stays in sync with PROFILE_FILES', () => {
  for (const pid of ['std', 'puny'] as ProfileId[]) {
    it(`${pid}: curated names equal the canonical names derived from the real files`, () => {
      const canonical = new Set(canonicalLibraryFiles(PROFILE_FILES[pid]).map(f => f.name))
      const curated = new Set(PROFILES[pid].libraryFileNames)
      expect(curated).toEqual(canonical)
    })
  }
})
