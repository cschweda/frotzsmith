import { describe, it, expect } from 'vitest'
import { canonicalLibraryFiles, buildProjectFileList } from './project-files'

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
