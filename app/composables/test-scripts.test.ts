import { describe, it, expect } from 'vitest'
import { upsertScript, renameScript, deleteScript, setScriptText, nextActiveId, migrateScriptStore, bucketOf, withBucket, emptyBuckets } from './test-scripts'
import { storyKeyOf } from '~/utils/story-title'

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

// F7: a game called "Constructor" (or a stored key like toString/__proto__)
// must get its own bucket, never one of Object.prototype's members.
describe('bucket maps are prototype-free (F7)', () => {
  const PROTO_KEYS = ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__', '__defineGetter__']

  it.each(PROTO_KEYS)('bucketOf(%j) on an empty map is undefined', (key) => {
    expect(bucketOf(emptyBuckets(), key)).toBeUndefined()
    expect(bucketOf({}, key)).toBeUndefined()
  })

  it.each(PROTO_KEYS)('withBucket(%j) stores an own bucket and reads it back', (key) => {
    const b = withBucket(emptyBuckets(), key, { scripts: [{ id: 'x', name: 'S', text: '' }], activeId: 'x' })
    expect(Object.hasOwn(b, key)).toBe(true)
    expect(bucketOf(b, key)!.scripts).toHaveLength(1)
    expect(Object.getPrototypeOf(b)).toBeNull()
    // Nothing leaked onto the global prototype.
    expect(({} as Record<string, unknown>).scripts).toBeUndefined()
  })

  it('withBucket keeps the other buckets and never mutates the input', () => {
    const a = withBucket(emptyBuckets(), 'zork', { scripts: [], activeId: '' })
    const b = withBucket(a, 'constructor', { scripts: [], activeId: '' })
    expect(Object.keys(b).sort()).toEqual(['constructor', 'zork'])
    expect(Object.keys(a)).toEqual(['zork'])
  })

  it('a stored "constructor" / "__proto__" bucket survives migration as an own, prototype-free entry', () => {
    const raw = JSON.parse('{"v":2,"buckets":{"zork":{"scripts":[],"activeId":""},"__proto__":{"scripts":[{"id":"p","name":"P","text":""}],"activeId":"p"},"constructor":{"scripts":[],"activeId":""}}}')
    const { buckets } = migrateScriptStore(raw, 'zork')
    expect(Object.getPrototypeOf(buckets)).toBeNull()
    expect(Object.keys(buckets).sort()).toEqual(['__proto__', 'constructor', 'zork'])
    expect(bucketOf(buckets, '__proto__')!.scripts[0]!.name).toBe('P')
  })

  it('migration drops buckets that are not bucket-shaped, and v1 lands under a prototype key', () => {
    const raw = JSON.parse('{"v":2,"buckets":{"zork":{"scripts":[],"activeId":""},"bad":5,"worse":{"scripts":"no"}}}')
    expect(Object.keys(migrateScriptStore(raw, 'zork').buckets)).toEqual(['zork'])
    const v1 = migrateScriptStore({ scripts: [{ id: 'a', name: 'A', text: '' }], activeId: 'a' }, 'constructor')
    expect(bucketOf(v1.buckets, 'constructor')!.scripts).toHaveLength(1)
    expect(Object.getPrototypeOf(v1.buckets)).toBeNull()
  })

  it('the redteam probe: a game titled "Constructor" can be seeded and added to', () => {
    const key = storyKeyOf('i6', 'Constant Story "Constructor";')
    expect(key).toBe('constructor')
    const { buckets } = migrateScriptStore(JSON.parse('{"v":2,"buckets":{"zork":{"scripts":[],"activeId":""}}}'), key)
    expect(bucketOf(buckets, key)).toBeUndefined() // → ensureBucket seeds it
    const next = withBucket(buckets, key, { scripts: upsertScript([], { id: 'x', name: 'S', text: '' }), activeId: 'x' })
    expect(bucketOf(next, key)!.scripts).toHaveLength(1)
  })
})
