import { describe, it, expect } from 'vitest'
import { canonicalLibraryFiles, buildProjectFileList, reconcileOpen, closeTabState, diagnosticFileId } from './project-files'

describe('canonicalLibraryFiles', () => {
  it('collapses case aliases to one canonical name, preferring the capitalized form', () => {
    const out = canonicalLibraryFiles([
      { path: '/lib/std/parser.h', content: 'P' },
      { path: '/lib/std/Parser.h', content: 'P' },
      { path: '/lib/std/infglk.h', content: 'I' },
    ])
    expect(out.map(f => f.name)).toEqual(['infglk.h', 'Parser.h'])
    expect(out.find(f => f.name === 'Parser.h')?.content).toBe('P')
  })

  it('passes through an already-unique lowercase set (PunyInform)', () => {
    const out = canonicalLibraryFiles([
      { path: '/lib/puny/puny.h', content: 'A' },
      { path: '/lib/puny/globals.h', content: 'B' },
    ])
    expect(out.map(f => f.name)).toEqual(['globals.h', 'puny.h'])
  })
})

describe('buildProjectFileList', () => {
  it('lists solution.txt last among the project files when asked, with its own editability', () => {
    const base = { sourceName: 'story.inf', enabledExtensions: [{ id: 'uploaded:mine', name: 'mine', origin: 'uploaded' as const }], libraryNames: ['Parser.h'] }
    expect(buildProjectFileList(base).some(f => f.id === 'solution')).toBe(false)
    const list = buildProjectFileList({ ...base, solution: { editable: false } })
    expect(list.map(f => f.id)).toEqual(['source', 'uploaded:mine', 'solution', 'lib:Parser.h'])
    expect(list[2]).toEqual({ id: 'solution', name: 'solution.txt', group: 'project', editable: false })
  })

  it('lists source first, then enabled extensions, then library files', () => {
    const list = buildProjectFileList({
      sourceName: 'story.inf',
      enabledExtensions: [
        { id: 'uploaded:mine', name: 'mine', origin: 'uploaded' },
        { id: 'bundled:ordinals', name: 'ordinals', origin: 'bundled' },
      ],
      libraryNames: ['Parser.h', 'VerbLib.h'],
    })
    expect(list).toEqual([
      { id: 'source', name: 'story.inf', group: 'project', editable: true },
      { id: 'uploaded:mine', name: 'mine.h', group: 'project', editable: true },
      { id: 'bundled:ordinals', name: 'ordinals.h', group: 'project', editable: false },
      { id: 'lib:Parser.h', name: 'Parser.h', group: 'library', editable: false },
      { id: 'lib:VerbLib.h', name: 'VerbLib.h', group: 'library', editable: false },
    ])
  })

  it('lists the main file, then the extra project files sorted by name (ZIL)', () => {
    const list = buildProjectFileList({
      sourceName: 'story.zil',
      enabledExtensions: [],
      libraryNames: [],
      projectFiles: [
        { id: 'zil:rooms.zil', name: 'rooms.zil' },
        { id: 'zil:Actions.zil', name: 'Actions.zil' },
        { id: 'zil:lib/items.zil', name: 'lib/items.zil' },
      ],
    })
    expect(list).toEqual([
      { id: 'source', name: 'story.zil', group: 'project', editable: true },
      { id: 'zil:Actions.zil', name: 'Actions.zil', group: 'project', editable: true },
      { id: 'zil:lib/items.zil', name: 'lib/items.zil', group: 'project', editable: true },
      { id: 'zil:rooms.zil', name: 'rooms.zil', group: 'project', editable: true },
    ])
  })
})

describe('diagnosticFileId', () => {
  const extras = ['rooms.zil', 'lib/items.zil']
  it('no file, or the main file (by pathKey), targets the source tab', () => {
    expect(diagnosticFileId(undefined, 'story.zil', extras)).toBe('source')
    expect(diagnosticFileId('story.zil', 'story.zil', extras)).toBe('source')
    expect(diagnosticFileId('STORY.ZIL', 'story.zil', extras)).toBe('source')
  })
  it('an extra file targets its zil: tab, keeping the stored spelling', () => {
    expect(diagnosticFileId('rooms.zil', 'story.zil', extras)).toBe('zil:rooms.zil')
    expect(diagnosticFileId('LIB/Items.zil', 'story.zil', extras)).toBe('zil:lib/items.zil')
  })
  it('anything else (a zillib file) targets no tab', () => {
    expect(diagnosticFileId('/zillib/parser.zil', 'story.zil', extras)).toBeNull()
  })
})

describe('reconcileOpen', () => {
  it('drops stale tabs, keeps source, and fixes a stale active', () => {
    const out = reconcileOpen(
      { activeId: 'lib:Gone.h', openTabs: ['source', 'uploaded:a', 'lib:Gone.h'] },
      new Set(['uploaded:a']),
    )
    expect(out.openTabs).toEqual(['source', 'uploaded:a'])
    expect(out.activeId).toBe('source')
  })

  it('always ensures source is present and selectable', () => {
    const out = reconcileOpen({ activeId: 'source', openTabs: [] }, new Set())
    expect(out.openTabs).toEqual(['source'])
    expect(out.activeId).toBe('source')
  })

  it('keeps a still-valid active untouched', () => {
    const out = reconcileOpen(
      { activeId: 'uploaded:a', openTabs: ['source', 'uploaded:a'] },
      new Set(['uploaded:a']),
    )
    expect(out.activeId).toBe('uploaded:a')
  })
})

describe('closeTabState', () => {
  it('closing the active tab selects the left neighbor', () => {
    const out = closeTabState(
      { activeId: 'lib:B.h', openTabs: ['source', 'uploaded:a', 'lib:B.h'] },
      'lib:B.h',
    )
    expect(out.openTabs).toEqual(['source', 'uploaded:a'])
    expect(out.activeId).toBe('uploaded:a')
  })

  it('closing an inactive tab leaves the active alone', () => {
    const out = closeTabState(
      { activeId: 'source', openTabs: ['source', 'uploaded:a'] },
      'uploaded:a',
    )
    expect(out).toEqual({ activeId: 'source', openTabs: ['source'] })
  })

  it('never closes source', () => {
    const out = closeTabState({ activeId: 'source', openTabs: ['source'] }, 'source')
    expect(out).toEqual({ activeId: 'source', openTabs: ['source'] })
  })
})
