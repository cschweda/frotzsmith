import { describe, expect, it } from 'vitest'
import { acceptPlayMessage } from './play-message'

const ORIGIN = 'https://frotzsmith.com'
const frame = {} as Window
const other = {} as Window
const data = { source: 'frotzsmith-play', type: 'command', value: 'look' }

describe('acceptPlayMessage (postMessage boundary, audit F17)', () => {
  it('accepts our play page’s tagged message from the play iframe', () => {
    expect(acceptPlayMessage({ origin: ORIGIN, source: frame, data }, frame, ORIGIN)).toEqual(data)
  })

  it('ignores another origin', () => {
    expect(acceptPlayMessage({ origin: 'https://evil.example', source: frame, data }, frame, ORIGIN)).toBeNull()
  })

  it('ignores a same-origin message from a different window (e.source check)', () => {
    expect(acceptPlayMessage({ origin: ORIGIN, source: other, data }, frame, ORIGIN)).toBeNull()
    expect(acceptPlayMessage({ origin: ORIGIN, source: null, data }, frame, ORIGIN)).toBeNull()
  })

  it('ignores everything while no play iframe is mounted', () => {
    expect(acceptPlayMessage({ origin: ORIGIN, source: null, data }, null, ORIGIN)).toBeNull()
    expect(acceptPlayMessage({ origin: ORIGIN, source: frame, data }, undefined, ORIGIN)).toBeNull()
  })

  it('ignores untagged or non-object data', () => {
    for (const d of [null, 'frotzsmith-play', 42, { type: 'command', value: 'x' }, { source: 'other' }]) {
      expect(acceptPlayMessage({ origin: ORIGIN, source: frame, data: d }, frame, ORIGIN)).toBeNull()
    }
  })
})
