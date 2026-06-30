import { describe, it, expect } from 'vitest'
import { SAMPLES, sampleById } from './samples'

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
  it('has exactly 21 samples (11 std + 10 puny)', () => {
    expect(SAMPLES).toHaveLength(21)
  })

  it('has 11 std samples', () => {
    expect(SAMPLES.filter(s => s.group === 'std')).toHaveLength(11)
  })

  it('has 10 puny samples', () => {
    expect(SAMPLES.filter(s => s.group === 'puny')).toHaveLength(10)
  })

  it('all IDs are unique', () => {
    const ids = SAMPLES.map(s => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('every sample has required string fields: id, name, description, source', () => {
    for (const s of SAMPLES) {
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

  it('every sample group is "std" or "puny"', () => {
    for (const s of SAMPLES) {
      expect(['std', 'puny']).toContain(s.group)
    }
  })

  it('std-skeleton is the first sample', () => {
    expect(SAMPLES[0]!.id).toBe('std-skeleton')
  })

  it('puny-skeleton is the 12th sample (first puny entry)', () => {
    expect(SAMPLES[11]!.id).toBe('puny-skeleton')
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

  it('only puny-haunted-house has an explicit target; all others are undefined', () => {
    const withTarget = SAMPLES.filter(s => s.target !== undefined)
    expect(withTarget).toHaveLength(1)
    expect(withTarget[0]!.id).toBe('puny-haunted-house')
  })

  it('each std sample has a matching puny counterpart (except std-list-exits)', () => {
    const stdIds = SAMPLES.filter(s => s.group === 'std').map(s => s.id)
    for (const id of stdIds) {
      if (id === 'std-list-exits') continue
      const punyId = id.replace(/^std-/, 'puny-')
      expect(sampleById(punyId)).toBeDefined()
    }
  })

  it('sample sources are non-trivially long (at least 100 chars)', () => {
    for (const s of SAMPLES) {
      expect(s.source.length).toBeGreaterThan(100)
    }
  })
})
