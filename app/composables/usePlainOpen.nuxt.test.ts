/**
 * usePlainOpen — opening a plain source file (happy-dom env).
 *
 * It asks first when the open would replace real work: the author's source,
 * or a ZIL project's other .zil files (a plain file brings none, so they go).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

const _source = ref('')
const _profile = ref({ id: 'zil', route: '/zil', stateKey: 'zil' })
vi.stubGlobal('useLanguage', () => ({ profile: _profile }))

const { useZilProjectFiles } = await import('./useZilProjectFiles')
const _loadOpenedFile = vi.fn((text: string) => {
  _source.value = text
  if (_profile.value.id === 'zil') useZilProjectFiles().clear() // as useIde.loadOpenedFile
})
vi.stubGlobal('useIde', () => ({ source: _source, loadOpenedFile: _loadOpenedFile }))

const { usePlainOpen } = await import('./usePlainOpen')

const MAIN = '<ROUTINE GO () <CRLF>>'

describe('usePlainOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _profile.value = { id: 'zil', route: '/zil', stateKey: 'zil' }
    useZilProjectFiles().clear()
    _source.value = ''
  })

  it('opens at once over a pristine editor with no extra files', () => {
    const p = usePlainOpen()
    expect(p.request('story.zil', MAIN)).toBe('opened')
    expect(_loadOpenedFile).toHaveBeenCalledWith(MAIN)
    expect(p.confirm.value).toBe(false)
  })

  it('asks over a pristine editor when the ZIL project has extra files, and says they go', () => {
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }, { path: 'items.zil', text: 'I' }], 'story.zil')
    const p = usePlainOpen()
    expect(p.request('story.zil', MAIN)).toBe('asking')
    expect(_loadOpenedFile).not.toHaveBeenCalled()
    expect(p.confirm.value).toBe(true)
    expect(p.description.value).toBe('Opening this file removes the project’s 2 other .zil files.')
  })

  it('asks when the main file is reopened unchanged after an extra file was edited', () => {
    _source.value = MAIN
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    useZilProjectFiles().update('rooms.zil', 'R edited')
    const p = usePlainOpen()
    expect(p.request('story.zil', MAIN)).toBe('asking')
    expect(p.description.value).toBe('Opening this file removes the project’s other .zil file.')
  })

  it('names both the source and the extra files when both would go', () => {
    _source.value = '<ROUTINE GO () <TELL "my work">>'
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    const p = usePlainOpen()
    p.request('story.zil', MAIN)
    expect(p.description.value).toBe('Opening this file replaces the source in the editor and removes the project’s other .zil file.')
  })

  it('cancel keeps the extra files and the source', () => {
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    const p = usePlainOpen()
    p.request('story.zil', MAIN)
    p.cancel()
    expect(p.confirm.value).toBe(false)
    expect(_loadOpenedFile).not.toHaveBeenCalled()
    expect(useZilProjectFiles().files.value).toEqual([{ path: 'rooms.zil', text: 'R' }])
  })

  it('confirm opens the file and clears the extra files', () => {
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    const p = usePlainOpen()
    p.request('story.zil', MAIN)
    p.replace()
    expect(_loadOpenedFile).toHaveBeenCalledWith(MAIN)
    expect(useZilProjectFiles().files.value).toEqual([])
    expect(p.confirm.value).toBe(false)
  })

  it('in the Inform 6 editor the ZIL store does not count', () => {
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    _profile.value = { id: 'i6', route: '/', stateKey: 'i6' }
    const p = usePlainOpen()
    expect(p.request('game.inf', 'Constant Story "X";')).toBe('opened')
  })

  it('keeps the plain wording when there are no extra files', () => {
    _source.value = '<ROUTINE GO () <TELL "my work">>'
    const p = usePlainOpen()
    expect(p.request('story.zil', MAIN)).toBe('asking')
    expect(p.heading.value).toBe('Replace the source in the editor?')
    expect(p.description.value).toBe('Opening this file replaces the source in the editor.')
  })
})
