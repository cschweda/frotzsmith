/** addZilUploads: the explorer's multi-file "Add .zil files" batch (pure). */
import { describe, it, expect, vi } from 'vitest'
import { addZilUploads, type ZilUploadDeps } from './zil-uploads'

const file = (name: string, text: string | Error) => ({
  name,
  text: () => (text instanceof Error ? Promise.reject(text) : Promise.resolve(text)),
})

function deps(over: Partial<ZilUploadDeps> = {}) {
  const stored: Record<string, string> = {}
  const d: ZilUploadDeps = {
    findZilFile: (p) => Object.keys(stored).find(k => k.toLowerCase() === p.toLowerCase()) ?? null,
    addZilFile: (p, text) => {
      if (p.startsWith('bad')) return { ok: false, message: `“${p}” isn’t a text file, so it can’t be added.` }
      for (const k of Object.keys(stored)) if (k.toLowerCase() === p.toLowerCase()) delete stored[k]
      stored[p] = text
      return { ok: true }
    },
    ask: vi.fn(async () => true),
    ...over,
  }
  return { d, stored }
}

describe('addZilUploads', () => {
  it('adds every file and says how to compile them', async () => {
    const { d, stored } = deps()
    const note = await addZilUploads([file('a.zil', 'A'), file('b.zil', 'B')], d)
    expect(Object.keys(stored)).toEqual(['a.zil', 'b.zil'])
    expect(note).toBe('Added 2 ZIL files. Use <INSERT-FILE "name"> in the main file to compile them.')
  })

  it('keeps going past a refused file and summarizes both', async () => {
    const { d, stored } = deps()
    const note = await addZilUploads([file('bad1.zil', ''), file('a.zil', 'A'), file('b.zil', 'B')], d)
    expect(Object.keys(stored)).toEqual(['a.zil', 'b.zil'])
    expect(note).toBe('Added 2 ZIL files; couldn’t add 1: “bad1.zil” isn’t a text file, so it can’t be added.')
  })

  it('a single refusal on its own is its own sentence', async () => {
    const { d } = deps()
    expect(await addZilUploads([file('bad.zil', '')], d)).toBe('“bad.zil” isn’t a text file, so it can’t be added.')
  })

  it('caps the refusals it names at 3', async () => {
    const { d } = deps()
    const names = ['bad1.zil', 'bad2.zil', 'bad3.zil', 'bad4.zil', 'bad5.zil']
    const note = await addZilUploads([...names.map(n => file(n, '')), file('a.zil', 'A')], d)
    expect(note).toBe(
      'Added 1 ZIL file; couldn’t add 5: “bad1.zil” isn’t a text file, so it can’t be added; '
      + '“bad2.zil” isn’t a text file, so it can’t be added; “bad3.zil” isn’t a text file, so it can’t be added; and 2 more.',
    )
  })

  it('a file the browser can’t read is refused in one sentence and the batch goes on', async () => {
    const { d, stored } = deps()
    const note = await addZilUploads([file('gone.zil', new Error('NotReadableError')), file('a.zil', 'A')], d)
    expect(Object.keys(stored)).toEqual(['a.zil'])
    expect(note).toBe('Added 1 ZIL file; couldn’t add 1: “gone.zil” couldn’t be read, so it wasn’t added.')
  })

  it('a case variant of a stored file asks to replace it, naming both spellings', async () => {
    const { d, stored } = deps()
    stored['rooms.zil'] = 'old'
    const note = await addZilUploads([file('Rooms.zil', 'new')], d)
    expect(d.ask).toHaveBeenCalledWith('Rooms.zil', 'rooms.zil')
    expect(stored).toEqual({ 'Rooms.zil': 'new' })
    expect(note).toContain('Added 1 ZIL file')
  })

  it('declining a replace skips that file only', async () => {
    const { d, stored } = deps({ ask: vi.fn(async () => false) })
    stored['rooms.zil'] = 'old'
    const note = await addZilUploads([file('rooms.zil', 'new'), file('a.zil', 'A')], d)
    expect(stored).toEqual({ 'rooms.zil': 'old', 'a.zil': 'A' })
    expect(note).toBe('Added 1 ZIL file. Use <INSERT-FILE "name"> in the main file to compile it.')
  })

  it('names are shown display-safe', async () => {
    const { d } = deps()
    const evil = 'gone‮.zil'
    const note = await addZilUploads([file(evil, new Error('x'))], d)
    expect(note).not.toContain('‮')
  })
})
