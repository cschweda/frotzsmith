/**
 * useExtensions — an extension can never silently stand in for a library
 * file (audit F1). A package include or an uploaded `.h` whose Include name
 * or file name is a library file of ANY profile (Standard Library or
 * PunyInform), ignoring case, is refused; a manual upload may override only
 * when the caller passes an explicit flag, and that choice is recorded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLanguage } from './useLanguage'
import { PackageError } from '~/project-package/errors'
import { PROFILES } from '~/modules/inform6/profiles'

vi.stubGlobal('useLanguage', useLanguage)
const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

const { useExtensions, libraryFileFor, planUploaded } = await import('./useExtensions')

const ALL_LIBRARY_FILES = [...PROFILES.std.libraryFileNames, ...PROFILES.puny.libraryFileNames]

describe('libraryFileFor', () => {
  it.each(ALL_LIBRARY_FILES)('recognises %s by file name and by Include name, in any case', (file) => {
    const stem = file.replace(/\.h$/, '')
    for (const n of [file, stem, file.toUpperCase(), stem.toLowerCase(), `ext/${file}`, `deep/er/${stem.toUpperCase()}.H`]) {
      expect(libraryFileFor(n)?.toLowerCase()).toBe(file.toLowerCase())
    }
  })
  it('names both profiles, whichever is active', () => {
    expect(libraryFileFor('VerbLib.h')).toBe('VerbLib.h') // std
    expect(libraryFileFor('puny.h')).toBe('puny.h') // PunyInform
    expect(libraryFileFor('globals')).toBe('globals.h')
  })
  it.each(['lamp.h', 'ordinals', 'VerbLib2.h', 'myparser.h', 'Verb-Lib.h', 'parser.inf.h'])('lets %j through', (n) => {
    expect(libraryFileFor(n)).toBeNull()
  })
})

describe('planUploaded refuses a package include named like a library file', () => {
  it.each(['VerbLib.h', 'ext/Parser.h', 'grammar.h', 'ENGLISH.h', 'puny.h', 'lib/globals.h', 'messages.h'])('%j', (path) => {
    let err: unknown
    try {
      planUploaded([{ path: 'ok.h', text: '' }, { path, text: '! evil' }], [path])
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(PackageError)
    expect((err as PackageError).code).toBe('library-name-clash')
    expect((err as PackageError).message).toMatch(/^This project has an include file named like a library file, which could replace it for every game: “.+”\.$/)
  })
})

describe('addUploaded and library names', () => {
  beforeEach(() => {
    localStorage.clear()
    useExtensions().restore() // nothing stored → no uploads, nothing enabled
  })

  it('refuses a manual upload named like a library file, adding nothing', () => {
    const ext = useExtensions()
    for (const name of ['VerbLib.h', 'parser.h', 'PUNY.H']) {
      let err: unknown
      try {
        ext.addUploaded(name, '! evil')
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(PackageError)
      expect((err as PackageError).code).toBe('library-name-clash')
      expect((err as PackageError).message).toMatch(/has the same name as a library file/)
    }
    expect(ext.uploaded.value).toHaveLength(0)
    expect(ext.enabledFiles.value).toHaveLength(0)
  })

  it('accepts it with the explicit override flag, records the choice, and keeps it across a reload', () => {
    const ext = useExtensions()
    ext.addUploaded('VerbLib.h', '! mine', { overrideLibrary: true })
    expect(ext.uploaded.value[0]!.overridesLibrary).toBe(true)
    expect(ext.enabledFiles.value).toEqual([{ name: 'VerbLib', content: '! mine', overridesLibrary: true }])
    ext.uploaded.value = []
    ext.restore()
    expect(ext.uploaded.value[0]!.overridesLibrary).toBe(true)
  })

  it('an ordinary upload carries no override, and a stored clash without one never overrides', () => {
    const ext = useExtensions()
    ext.addUploaded('lamp.h', '! lamp')
    expect(ext.enabledFiles.value).toEqual([{ name: 'lamp', content: '! lamp' }])
    // An entry stored before this fix (e.g. from a package): no flag, so the
    // compile writes the library after it.
    localStorage.setItem('frotzsmith:i6:extensions', JSON.stringify({
      uploaded: [{ id: 'uploaded:VerbLib', name: 'VerbLib', title: 'VerbLib.h', content: '! evil', overridesLibrary: 'yes' }],
      enabled: ['uploaded:VerbLib'],
    }))
    ext.restore()
    // Never mounted at all: it isn't used when compiling (review I-2).
    expect(ext.enabledFiles.value).toEqual([])
  })
})

// Review I-2: an upload stored before audit F1 and named like a library file
// is kept, but the author is told once that it no longer replaces the library.
describe('restore — library-named uploads stored before the fix', () => {
  const KEY = 'frotzsmith:i6:extensions'
  beforeEach(() => {
    localStorage.clear()
    _toastAdd.mockClear()
    localStorage.setItem(KEY, JSON.stringify({
      uploaded: [
        { id: 'uploaded:VerbLib', name: 'VerbLib', title: 'VerbLib.h', content: '! patched' },
        { id: 'uploaded:lamp', name: 'lamp', title: 'lamp.h', content: '! lamp' },
      ],
      enabled: ['uploaded:VerbLib', 'uploaded:lamp'],
    }))
  })

  it('keeps it, leaves it out of the compile, and says so once', () => {
    const ext = useExtensions()
    ext.restore()
    expect(ext.uploaded.value.map(u => u.title)).toEqual(['VerbLib.h', 'lamp.h'])
    expect(ext.enabledFiles.value).toEqual([{ name: 'lamp', content: '! lamp' }])
    expect(_toastAdd).toHaveBeenCalledTimes(1)
    expect(_toastAdd.mock.calls[0]![0].description).toMatch(/^“VerbLib\.h” has the same name as a library file, so it no longer replaces the standard library/)
    // Kept in storage, content and all.
    expect(localStorage.getItem(KEY)).toContain('! patched')
    // A reload: no second notice.
    ext.restore()
    expect(_toastAdd).toHaveBeenCalledTimes(1)
  })

  it('an explicit override is not affected', () => {
    localStorage.setItem(KEY, JSON.stringify({
      uploaded: [{ id: 'uploaded:VerbLib', name: 'VerbLib', title: 'VerbLib.h', content: '! mine', overridesLibrary: true }],
      enabled: ['uploaded:VerbLib'],
    }))
    const ext = useExtensions()
    ext.restore()
    expect(ext.enabledFiles.value).toEqual([{ name: 'VerbLib', content: '! mine', overridesLibrary: true }])
    expect(_toastAdd).not.toHaveBeenCalled()
  })
})
