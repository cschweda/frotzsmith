import { describe, it, expect } from 'vitest'
import { canonicalLibraryFiles, buildProjectFileList, reconcileOpen, closeTabState } from './project-files'

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
