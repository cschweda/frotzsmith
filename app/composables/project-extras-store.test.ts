/**
 * project-extras-store — what an opened package carries that the IDE can't
 * show (node env, fake-indexeddb). Bytes survive as bytes; save never throws.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createIdbExtrasStore, createMemoryExtrasStore, getExtrasStore, type ProjectExtras } from './project-extras-store'

afterEach(() => vi.unstubAllGlobals())

function sample(): ProjectExtras {
  return {
    entries: [{ path: 'art/cover.png', bytes: new Uint8Array([0, 1, 254, 255]) }],
    manifestExtra: { 'com.example.color': 'teal' },
    created: '2026-01-01T00:00:00.000Z',
    skeinPath: 'x.skein',
    main: 'g.inf',
    testExtras: [{ name: 'Walk', extra: { note: 1 } }],
    extensions: { order: ['a', 'b'], unknown: ['b'] },
  }
}

describe('extras store', () => {
  it('IndexedDB round-trips bytes and fields across instances', async () => {
    expect(await createIdbExtrasStore().save('i6:g', sample())).toBe(true)
    const back = await createIdbExtrasStore().load('i6:g')
    expect(back).toEqual(sample())
    expect(back!.entries[0]!.bytes).toBeInstanceOf(Uint8Array)
    expect(await createIdbExtrasStore().load('i6:missing')).toBeNull()
  })

  it('memory store copies, so later edits to the caller data do not leak in', async () => {
    const store = createMemoryExtrasStore()
    const x = sample()
    await store.save('k', x)
    x.entries[0]!.bytes[0] = 99
    expect((await store.load('k'))!.entries[0]!.bytes[0]).toBe(0)
  })

  it('save resolves false (never throws) when indexedDB is broken', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('denied') } })
    await expect(createIdbExtrasStore().save('k', sample())).resolves.toBe(false)
    await expect(createIdbExtrasStore().load('k')).resolves.toBeNull()
  })

  it('falls back to one session-wide memory store without indexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await getExtrasStore().save('k', sample())
    expect(await getExtrasStore().load('k')).toEqual(sample())
  })
})

describe('extras store keeps ONE record per language', () => {
  for (const [name, make] of [['IndexedDB', createIdbExtrasStore], ['memory', createMemoryExtrasStore]] as const) {
    it(`${name}: saving a game removes the language's other records, not other languages'`, async () => {
      const store = make()
      expect(await store.save('i6:a', sample())).toBe(true)
      expect(await store.save('zil:z', sample())).toBe(true)
      expect(await store.save('i6:b', sample())).toBe(true)
      expect(await store.load('i6:a')).toBeNull()
      expect(await store.load('i6:b')).toEqual(sample())
      expect(await store.load('zil:z')).toEqual(sample())
    })
    it(`${name}: clear(lang) removes that language's record only`, async () => {
      const store = make()
      await store.save('i6:a', sample())
      await store.save('zil:z', sample())
      await store.clear('i6')
      expect(await store.load('i6:a')).toBeNull()
      expect(await store.load('zil:z')).toEqual(sample())
    })
  }

  it('operations run in call order, so a clear issued before a save never deletes it', async () => {
    const store = createIdbExtrasStore()
    const cleared = store.clear('i6')
    const saved = store.save('i6:a', sample())
    await Promise.all([cleared, saved])
    expect(await store.load('i6:a')).toEqual(sample())
  })
})
