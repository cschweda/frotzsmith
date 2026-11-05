import { describe, expect, it } from 'vitest'
import { PackageError } from '~/project-package/errors'
import { ZipLimitError } from '~/utils/zip-limits'
import { DOWNLOAD_FAILED, OPEN_FAILED, downloadedNote, renamedNote, joinPhrases, libraryNamedNote, openDialogNotes, openedNotes, refusalSentence } from './package-messages'

describe('refusalSentence', () => {
  it('shows a PackageError sentence as is (download)', () => {
    const err = new PackageError('too-large', 'This project is too large to save as a package (the limit is 32 MB).')
    expect(refusalSentence(err, DOWNLOAD_FAILED)).toBe(err.message)
  })
  it('shows a ZipLimitError sentence as is', () => {
    const err = new ZipLimitError('Uploaded extensions are over the 4 MB limit.')
    expect(refusalSentence(err, OPEN_FAILED)).toBe(err.message)
  })
  it('hides anything else behind the generic sentence', () => {
    expect(refusalSentence(new TypeError('x is undefined'), DOWNLOAD_FAILED)).toBe(DOWNLOAD_FAILED)
    expect(refusalSentence('boom', OPEN_FAILED)).toBe(OPEN_FAILED)
  })
})

describe('openedNotes', () => {
  it('names the source files a ZIL package added', () => {
    expect(openedNotes({ hiddenCount: 0, ignored: [], skeinNotOpened: null, sourceFiles: ['rooms.zil', 'lib/a.zil'] })).toEqual([
      'It added 2 source files: “rooms.zil”, “lib/a.zil”.',
    ])
  })
  const none = { hiddenCount: 0, ignored: [], skeinNotOpened: null }
  it('says nothing when there is nothing to say', () => {
    expect(openedNotes(none)).toEqual([])
  })
  it('uses the singular for one hidden file and the plural otherwise', () => {
    expect(openedNotes({ ...none, hiddenCount: 1 })).toEqual([
      "1 file in this project isn't shown here — it's kept and included when you download it.",
    ])
    expect(openedNotes({ ...none, hiddenCount: 3 })).toEqual([
      "3 files in this project aren't shown here — they're kept and included when you download it.",
    ])
  })
  it('reports an unopened Skein on its own line, never as compiled story files', () => {
    const notes = openedNotes({ hiddenCount: 1, ignored: [], skeinNotOpened: 'g.skein' })
    expect(notes).toContain("The project's Skein couldn't be opened; it was kept and will be included when you download.")
    expect(notes.join(' ')).not.toMatch(/[Cc]ompiled/)
    // The unopened Skein is the hidden file, so it isn't counted twice.
    expect(notes.some(n => /isn't shown here/.test(n))).toBe(false)
  })
  it('reports ignored compiled story files', () => {
    expect(openedNotes({ ...none, ignored: ['g.z5'] })).toEqual([
      'Compiled story files in the package were ignored — compile to rebuild them.',
    ])
  })
})

describe('joinPhrases (the confirmation names what an open replaces)', () => {
  it('joins one, two and many', () => {
    expect(joinPhrases(['the source in the editor'])).toBe('the source in the editor')
    expect(joinPhrases(['a', 'b'])).toBe('a and b')
    expect(joinPhrases(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

// F1 / F15: the open dialog, the opened toast and the download toast name
// the extensions a package brings and the hidden files it carries — quoted,
// display-safe and capped.
describe('openDialogNotes', () => {
  it('names the source files a ZIL package adds, capped at 5', () => {
    expect(openDialogNotes({ extensions: [], hiddenNames: [], sourceFiles: ['rooms.zil'] })).toEqual([
      'It adds a source file: “rooms.zil”.',
    ])
    const many = ['a.zil', 'b.zil', 'c.zil', 'd.zil', 'e.zil', 'f.zil', 'g.zil']
    expect(openDialogNotes({ extensions: [], hiddenNames: [], sourceFiles: many })).toEqual([
      'It adds 7 source files: “a.zil”, “b.zil”, “c.zil”, “d.zil”, “e.zil” and 2 more.',
    ])
    expect(openDialogNotes({ extensions: [], hiddenNames: [], sourceFiles: ['x\u202e.zil'] })[0]).not.toContain('\u202e')
  })
  it('names the extensions, saying they reach every Inform 6 game', () => {
    expect(openDialogNotes({ extensions: ['ext/lamp.h'], hiddenNames: [] })).toEqual([
      'It adds an extension used by every Inform 6 game in this browser: “ext/lamp.h”.',
    ])
    expect(openDialogNotes({ extensions: ['a.h', 'ordinals'], hiddenNames: [] })).toEqual([
      'It adds 2 extensions used by every Inform 6 game in this browser: “a.h”, “ordinals”.',
    ])
  })
  it('names the hidden files', () => {
    expect(openDialogNotes({ extensions: [], hiddenNames: ['notes/a.md'] })).toEqual([
      'It carries a file Frotzsmith doesn’t show, kept and included when you download: “notes/a.md”.',
    ])
  })
  it('is empty when there is nothing to name', () => {
    expect(openDialogNotes({ extensions: [], hiddenNames: [] })).toEqual([])
  })
  it('caps the list and makes names display-safe', () => {
    const names = ['a‮b.h', 'x'.repeat(100), '3', '4', '5', '6', '7']
    const [note] = openDialogNotes({ extensions: names, hiddenNames: [] })
    expect(note).toContain('“a�b.h”')
    expect(note).toContain(`“${'x'.repeat(60)}…”`)
    expect(note).toMatch(/and 2 more\.$/)
    expect(note).not.toContain('‮')
  })
})

describe('openedNotes with names', () => {
  const none = { hiddenCount: 0, ignored: [], skeinNotOpened: null }
  it('lists hidden file names', () => {
    expect(openedNotes({ ...none, hiddenCount: 2, hiddenNames: ['a.md', 'b.bin'] })).toEqual([
      "2 files in this project aren't shown here — they're kept and included when you download it: “a.md”, “b.bin”.",
    ])
  })
  it('names the extensions it added', () => {
    expect(openedNotes({ ...none, extensions: ['lamp.h'] })).toEqual([
      'Extensions added for every Inform 6 game in this browser: “lamp.h”.',
    ])
  })
})

describe('downloadedNote', () => {
  it('names the hidden files a download carries, or says nothing', () => {
    expect(downloadedNote([])).toBeNull()
    expect(downloadedNote(['notes/a.md'])).toBe('It includes a file Frotzsmith doesn’t show: “notes/a.md”.')
    expect(downloadedNote(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('It includes 6 files Frotzsmith doesn’t show: “a”, “b”, “c”, “d”, “e” and 1 more.')
  })

  // Review I-2/m-6: what the package can't hold is named, display-safe and capped.
  it('names the files left out (kept in this browser)', () => {
    expect(downloadedNote([], [])).toBeNull()
    expect(downloadedNote([], ['VerbLib.h'])).toBe(
      'It leaves out a file whose name a project can’t hold, kept in this browser: “VerbLib.h”.',
    )
    expect(downloadedNote(['n.md'], ['a:b.txt', 'x\u202etxt.exe'])).toBe(
      'It includes a file Frotzsmith doesn’t show: “n.md”. It leaves out 2 files whose names a project can’t hold, kept in this browser: “a:b.txt”, “x\ufffdtxt.exe”.',
    )
    expect(downloadedNote([], ['1', '2', '3', '4', '5', '6', '7'])).toMatch(/“5” and 2 more\.$/)
  })
})

describe('libraryNamedNote', () => {
  it('says once that a library-named upload no longer replaces the library', () => {
    expect(libraryNamedNote([])).toBeNull()
    expect(libraryNamedNote(['VerbLib.h'])).toBe(
      '“VerbLib.h” has the same name as a library file, so it no longer replaces the standard library and isn’t used when you compile. It stays in this browser but is left out of project downloads; to use it, upload it again under another name.',
    )
    expect(libraryNamedNote(['VerbLib.h', 'Parser.h'])).toBe(
      '“VerbLib.h”, “Parser.h” have the same names as library files, so they no longer replace the standard library and aren’t used when you compile. They stay in this browser but are left out of project downloads; to use them, upload them again under other names.',
    )
  })
})

// Re-review N-2: a device-named upload saved under another name is said so.
describe('renamedNote', () => {
  it('names each rename in one plain sentence, capped', () => {
    expect(renamedNote([])).toBeNull()
    expect(renamedNote([{ from: 'aux.h', to: 'aux_.h' }])).toBe(
      '“aux.h” is saved as “aux_.h” — Windows can’t hold that name; update its Include line after reopening.',
    )
    expect(renamedNote([{ from: 'aux.h', to: 'aux_.h' }, { from: 'nul', to: 'nul_.h' }])).toBe(
      '2 extensions are saved under names Windows can hold (“aux.h” as “aux_.h”, “nul” as “nul_.h”); update their Include lines after reopening.',
    )
    const many = Array.from({ length: 7 }, (_, i) => ({ from: `com${i}.h`, to: `com${i}_.h` }))
    expect(renamedNote(many)).toMatch(/“com4\.h” as “com4_\.h” and 2 more\);/)
    expect(renamedNote([{ from: 'a\u202eb.h', to: 'x_.h' }])).toContain('“a\ufffdb.h”')
  })
})
