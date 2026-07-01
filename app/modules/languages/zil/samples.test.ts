import { describe, it, expect } from 'vitest'
import { ZIL_SAMPLES, sampleById } from './samples'

// ---------------------------------------------------------------------------
// sampleById
// ---------------------------------------------------------------------------

describe('sampleById', () => {
  it('returns the sample for a known id', () => {
    const s = sampleById('zil-skeleton')
    expect(s).toBeDefined()
    expect(s!.id).toBe('zil-skeleton')
  })

  it('returns the cloak sample', () => {
    const s = sampleById('zil-cloak')
    expect(s).toBeDefined()
    expect(s!.name).toBe('Cloak of Darkness')
  })

  it('returns undefined for an unknown id', () => {
    expect(sampleById('nonexistent')).toBeUndefined()
  })

  it('returns undefined for an empty string', () => {
    expect(sampleById('')).toBeUndefined()
  })

  it('is case-sensitive (uppercase id does not match)', () => {
    expect(sampleById('ZIL-SKELETON')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// ZIL_SAMPLES registry integrity
// ---------------------------------------------------------------------------

describe('ZIL_SAMPLES registry', () => {
  it('has exactly 7 samples', () => {
    expect(ZIL_SAMPLES).toHaveLength(7)
  })

  it('all IDs are unique', () => {
    const ids = ZIL_SAMPLES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all IDs use the zil- prefix', () => {
    for (const s of ZIL_SAMPLES) {
      expect(s.id).toMatch(/^zil-/)
    }
  })

  it('every sample has required string fields: id, name, description, source', () => {
    for (const s of ZIL_SAMPLES) {
      expect(typeof s.id).toBe('string')
      expect(s.id.length).toBeGreaterThan(0)
      expect(typeof s.name).toBe('string')
      expect(s.name.length).toBeGreaterThan(0)
      expect(typeof s.description).toBe('string')
      expect(s.description.length).toBeGreaterThan(0)
      expect(typeof s.source).toBe('string')
      expect(s.source.length).toBeGreaterThan(0)
    }
  })

  it('every sample has target z3', () => {
    for (const s of ZIL_SAMPLES) {
      expect(s.target).toBe('z3')
    }
  })

  it('zil-skeleton is the first sample', () => {
    expect(ZIL_SAMPLES[0]!.id).toBe('zil-skeleton')
  })

  it('zil-cloak is the second sample', () => {
    expect(ZIL_SAMPLES[1]!.id).toBe('zil-cloak')
  })

  it('sample sources are non-trivially long (at least 200 chars)', () => {
    for (const s of ZIL_SAMPLES) {
      expect(s.source.length).toBeGreaterThan(200)
    }
  })

  it('all sources contain INSERT-FILE parser (single-file zillib pattern)', () => {
    for (const s of ZIL_SAMPLES) {
      expect(s.source).toContain('<INSERT-FILE "parser">')
    }
  })

  it('no source contains a bare <VERSION> directive (injected by Compile API)', () => {
    for (const s of ZIL_SAMPLES) {
      // A bare <VERSION ZIP> or <VERSION 3> in the source would conflict with
      // the VERSION prepended by ZilfExports.Compile().
      expect(s.source).not.toMatch(/<VERSION\s+(ZIP|zip|\d+)\s*>/)
    }
  })
})

// ---------------------------------------------------------------------------
// Concept-specific spot checks
// ---------------------------------------------------------------------------

describe('ZIL_SAMPLES concept checks', () => {
  it('zil-cloak contains the Cloak of Darkness key objects', () => {
    const s = sampleById('zil-cloak')!
    expect(s.source).toContain('FOYER')
    expect(s.source).toContain('BAR')
    expect(s.source).toContain('CLOAKROOM')
    expect(s.source).toContain('CLOAK')
  })

  it('zil-two-rooms contains two room definitions', () => {
    const s = sampleById('zil-two-rooms')!
    expect(s.source).toContain('HALL')
    expect(s.source).toContain('GARDEN')
    expect(s.source).toContain('TAKEBIT')
  })

  it('zil-npc contains PERSONBIT and an action handler', () => {
    const s = sampleById('zil-npc')!
    expect(s.source).toContain('PERSONBIT')
    expect(s.source).toContain('ACTION')
  })

  it('zil-puzzle contains LOCKEDBIT and TOOLBIT', () => {
    const s = sampleById('zil-puzzle')!
    expect(s.source).toContain('LOCKEDBIT')
    expect(s.source).toContain('TOOLBIT')
    expect(s.source).toContain('UNLOCK')
  })

  it('zil-light contains DEVICEBIT and NOW-LIT?', () => {
    const s = sampleById('zil-light')!
    expect(s.source).toContain('DEVICEBIT')
    expect(s.source).toContain('NOW-LIT?')
    expect(s.source).toContain('NOW-DARK?')
  })

  it('zil-daemon contains QUEUE and DEQUEUE', () => {
    const s = sampleById('zil-daemon')!
    expect(s.source).toContain('QUEUE')
    expect(s.source).toContain('DEQUEUE')
    expect(s.source).toContain('CANDLE-LIFE')
  })
})
