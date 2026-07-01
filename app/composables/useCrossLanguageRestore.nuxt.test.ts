/**
 * restore() with EMPTY storage for the target language must reset in-memory
 * state to that language's defaults — not keep (and then persist) the previous
 * language's scripts / uploads / open tabs under the new language's keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLanguage } from './useLanguage'
import { useSourceDocument } from './useSourceDocument'
import { useExtensions } from './useExtensions'
import { useTestScripts } from './useTestScripts'
import { useProjectFiles } from './useProjectFiles'

vi.stubGlobal('useLanguage', useLanguage)
vi.stubGlobal('useSourceDocument', useSourceDocument)
vi.stubGlobal('useExtensions', useExtensions)

describe('cross-language restore with empty storage', () => {
  beforeEach(() => {
    localStorage.clear()
    useLanguage().setLanguage('i6')
  })

  it('scripts: zil restore does not inherit i6 buckets', () => {
    const i6 = useTestScripts()
    i6.restore()
    i6.addFromText('Playthrough 1', 'look\nnorth\n')
    expect(i6.scripts.value.some(s => s.name === 'Playthrough 1')).toBe(true)

    useLanguage().setLanguage('zil')
    const zil = useTestScripts()
    zil.restore()
    expect(zil.scripts.value.some(s => s.name === 'Playthrough 1')).toBe(false)
    // And nothing i6 was persisted under the zil key.
    const zilRaw = localStorage.getItem('frotzsmith:zil:scripts')
    expect(zilRaw ?? '').not.toContain('Playthrough 1')
  })

  it('extensions: zil restore does not inherit i6 uploads', () => {
    const i6 = useExtensions()
    i6.addUploaded('ordinals.h', '! ext')
    expect(i6.uploaded.value.length).toBe(1)

    useLanguage().setLanguage('zil')
    const zil = useExtensions()
    zil.restore()
    expect(zil.uploaded.value.length).toBe(0)
    expect(zil.enabledFiles.value.length).toBe(0)
  })

  it('project files: zil restore + persist does not write i6 tabs under the zil key', () => {
    const i6 = useProjectFiles()
    i6.openFile('lib:Parser.h')
    expect(i6.openTabs.value.some(t => t.id === 'lib:Parser.h')).toBe(true)

    useLanguage().setLanguage('zil')
    const zil = useProjectFiles()
    zil.restore()
    // The visible openTabs computed already filters invalid ids; the leak is the
    // RAW tab state, which any later persist writes under the zil key.
    zil.openFile('source')
    expect(zil.openTabs.value.map(t => t.id)).toEqual(['source'])
    expect(localStorage.getItem('frotzsmith:zil:explorer') ?? '').not.toContain('Parser.h')
  })
})
