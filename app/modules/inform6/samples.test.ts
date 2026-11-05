import { describe, it, expect } from 'vitest'
import { SAMPLES, sampleById, loadSampleSource } from './samples'

// ---------------------------------------------------------------------------
// sampleById
// ---------------------------------------------------------------------------

describe('sampleById', () => {
  it('returns the sample for a known id', () => {
    const s = sampleById('std-skeleton')
    expect(s).toBeDefined()
    expect(s!.id).toBe('std-skeleton')
    expect(s!.group).toBe('std')
  })

  it('returns the puny-skeleton sample', () => {
    const s = sampleById('puny-skeleton')
    expect(s).toBeDefined()
    expect(s!.group).toBe('puny')
  })

  it('returns undefined for an unknown id', () => {
    expect(sampleById('nonexistent')).toBeUndefined()
  })

  it('returns undefined for an empty string', () => {
    expect(sampleById('')).toBeUndefined()
  })

  it('is case-sensitive (uppercase id does not match)', () => {
    expect(sampleById('STD-SKELETON')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// SAMPLES registry integrity
// ---------------------------------------------------------------------------

describe('SAMPLES registry', () => {
  it('has exactly 24 samples (14 std + 10 puny)', () => {
    expect(SAMPLES).toHaveLength(24)
  })

  it('has 14 std samples', () => {
    expect(SAMPLES.filter(s => s.group === 'std')).toHaveLength(14)
  })

  it('has 10 puny samples', () => {
    expect(SAMPLES.filter(s => s.group === 'puny')).toHaveLength(10)
  })

  it('all IDs are unique', () => {
    const ids = SAMPLES.map(s => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('every sample has required string fields: id, name, description, file', () => {
    for (const s of SAMPLES) {
      expect(typeof s.id).toBe('string')
      expect(s.id.length).toBeGreaterThan(0)
      expect(typeof s.name).toBe('string')
      expect(s.name.length).toBeGreaterThan(0)
      expect(typeof s.description).toBe('string')
      expect(s.description.length).toBeGreaterThan(0)
      expect(s.file).toMatch(/\.inf$/)
    }
  })

  it('every sample group is "std" or "puny"', () => {
    for (const s of SAMPLES) {
      expect(['std', 'puny']).toContain(s.group)
    }
  })

  it('std-skeleton is the first sample', () => {
    expect(SAMPLES[0]!.id).toBe('std-skeleton')
  })

  it('puny-skeleton is the 15th sample (first puny entry)', () => {
    expect(SAMPLES[14]!.id).toBe('puny-skeleton')
  })
})

describe('SAMPLES – special cases', () => {
  it('std-list-exits has no puny counterpart in the registry', () => {
    expect(sampleById('std-list-exits')).toBeDefined()
    expect(sampleById('puny-list-exits')).toBeUndefined()
  })

  it('puny-haunted-house carries an explicit z3 target', () => {
    const s = sampleById('puny-haunted-house')
    expect(s).toBeDefined()
    expect(s!.target).toBe('z3')
  })

  // The longer games: Std-only, z5, and loaded byte-for-byte.
  const LONGER_GAMES = ['std-architect-legacy', 'std-mingus-1', 'std-mingus-2']

  it('the longer games carry an explicit z5 target', () => {
    for (const id of LONGER_GAMES) expect(sampleById(id)!.target, id).toBe('z5')
  })

  it('only the longer games opt out of load-time formatting', () => {
    const unformatted = SAMPLES.filter(s => s.format === false).map(s => s.id)
    expect(unformatted).toEqual(LONGER_GAMES)
  })

  it('only puny-haunted-house and the longer games have an explicit target', () => {
    const withTarget = SAMPLES.filter(s => s.target !== undefined).map(s => s.id)
    expect(withTarget.sort()).toEqual(['puny-haunted-house', ...LONGER_GAMES].sort())
  })

  it('each std sample has a matching puny counterpart (except std-list-exits and the longer games)', () => {
    const stdIds = SAMPLES.filter(s => s.group === 'std').map(s => s.id)
    for (const id of stdIds) {
      if (id === 'std-list-exits' || LONGER_GAMES.includes(id)) continue
      const punyId = id.replace(/^std-/, 'puny-')
      expect(sampleById(punyId)).toBeDefined()
    }
  })

  it('every sample body loads lazily and is non-trivially long (file ↔ id sync)', async () => {
    // Bodies moved behind loadSampleSource (per-sample lazy chunks). Loading
    // every one here guards the `file:` field against typos/renames — a
    // mismatch returns null and fails loudly.
    for (const s of SAMPLES) {
      const src = await loadSampleSource(s.id)
      expect(src, `body for ${s.id} (${s.file})`).not.toBeNull()
      expect(src!.length).toBeGreaterThan(100)
    }
  })

  it('loadSampleSource returns null for an unknown id', async () => {
    expect(await loadSampleSource('nonexistent')).toBeNull()
  })
})
