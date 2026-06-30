import { describe, it, expect } from 'vitest'
import { upsertScript, renameScript, deleteScript, setScriptText, nextActiveId, migrateScriptStore } from './test-scripts'

const s = (id: string, name = id, text = '') => ({ id, name, text })

describe('test-scripts pure helpers', () => {
  it('upsert adds a new script and replaces an existing one by id', () => {
    expect(upsertScript([s('a')], s('b'))).toEqual([s('a'), s('b')])
    expect(upsertScript([s('a', 'A')], s('a', 'A2'))).toEqual([s('a', 'A2')])
  })

  it('rename changes only the matching script name', () => {
    expect(renameScript([s('a', 'A'), s('b', 'B')], 'b', 'Bee')).toEqual([s('a', 'A'), s('b', 'Bee')])
  })

  it('delete removes the matching script', () => {
    expect(deleteScript([s('a'), s('b')], 'a')).toEqual([s('b')])
  })

  it('setScriptText updates only the matching script text', () => {
    expect(setScriptText([s('a', 'A', 'x')], 'a', 'y')).toEqual([s('a', 'A', 'y')])
  })

  it('nextActiveId keeps a still-valid active, else picks the first, else ""', () => {
    expect(nextActiveId([s('a'), s('b')], 'b')).toBe('b')
    expect(nextActiveId([s('a'), s('b')], 'gone')).toBe('a')
    expect(nextActiveId([], 'gone')).toBe('')
  })
})

describe('migrateScriptStore', () => {
  it('migrates old flat v1 shape to v2 under currentKey', () => {
    const old = { scripts: [s('a')], activeId: 'a' }
    expect(migrateScriptStore(old, 'my-game')).toEqual({
      v: 2,
      buckets: { 'my-game': { scripts: [s('a')], activeId: 'a' } },
    })
  })

  it('passes through existing v2 data unchanged', () => {
    const v2 = { v: 2, buckets: { 'my-game': { scripts: [s('a')], activeId: 'a' } } }
    expect(migrateScriptStore(v2, 'other-key')).toEqual(v2)
  })

  it('returns empty v2 for null input', () => {
    expect(migrateScriptStore(null, 'key')).toEqual({ v: 2, buckets: {} })
  })

  it('returns empty v2 for string input', () => {
    expect(migrateScriptStore('bad', 'key')).toEqual({ v: 2, buckets: {} })
  })

  it('returns empty v2 for empty object (no scripts array, no v:2)', () => {
    expect(migrateScriptStore({}, 'key')).toEqual({ v: 2, buckets: {} })
  })

  it('v1 without activeId defaults activeId to empty string', () => {
    const old = { scripts: [s('b')] }
    const result = migrateScriptStore(old, 'zork')
    expect(result.buckets['zork']?.activeId).toBe('')
  })
})
