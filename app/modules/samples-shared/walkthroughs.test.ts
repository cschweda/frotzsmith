/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sampleWalkthrough } from './walkthroughs'
import { SAMPLES, sampleById } from '~/modules/inform6/samples'
import { ZIL_SAMPLES, sampleById as zilSampleById } from '~/modules/languages/zil/samples'

const architect = readFileSync(fileURLToPath(new URL('./architect-legacy.walkthrough.txt', import.meta.url)), 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0)

describe('sampleWalkthrough', () => {
  it("gives The Architect's Legacy walkthrough under both its I6 and ZIL sample ids", () => {
    expect(architect.length).toBeGreaterThan(10)
    expect(sampleWalkthrough('std-architect-legacy')).toEqual(architect)
    expect(sampleWalkthrough('zil-architect-legacy')).toEqual(architect)
  })

  it('every registered id is a real sample', () => {
    expect(sampleById('std-architect-legacy')).toBeTruthy()
    expect(zilSampleById('zil-architect-legacy')).toBeTruthy()
  })

  it('every bundled sample in both languages has a walkthrough', () => {
    for (const s of SAMPLES) expect(sampleWalkthrough(s.id), s.id).not.toBeNull()
    for (const s of ZIL_SAMPLES) expect(sampleWalkthrough(s.id), s.id).not.toBeNull()
  })

  it('Mingus I shares one walkthrough between its I6 and ZIL ids', () => {
    expect(sampleWalkthrough('std-mingus-1')).toEqual(sampleWalkthrough('zil-mingus-1'))
    expect(sampleWalkthrough('std-mingus-1')!.at(-1)).toBe('east')
  })

  it('Mingus II has a 74-command walkthrough ending with put plaque in chest', () => {
    expect(sampleWalkthrough('std-mingus-2')).toHaveLength(74)
    expect(sampleWalkthrough('std-mingus-2')!.at(-1)).toBe('put plaque in chest')
  })

  it('is null for an unknown id or a prototype name', () => {
    expect(sampleWalkthrough('no-such-sample')).toBeNull()
    expect(sampleWalkthrough('constructor')).toBeNull()
    expect(sampleWalkthrough('__proto__')).toBeNull()
  })

  it('hands out a copy, so a caller cannot change the registry', () => {
    sampleWalkthrough('std-architect-legacy')!.push('xyzzy')
    expect(sampleWalkthrough('std-architect-legacy')).toEqual(architect)
  })
})
