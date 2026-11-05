/** useZilProjectFiles: the open ZIL project's extra files (happy-dom env). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetStorageNoticeForTests } from './useStorageNotice'

const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

const { useZilProjectFiles } = await import('./useZilProjectFiles')
const KEY = 'frotzsmith:zil:project-files'

describe('useZilProjectFiles', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    _toastAdd.mockClear()
    localStorage.clear()
    resetStorageNoticeForTests()
    useZilProjectFiles().clear()
    localStorage.clear()
  })

  it('round-trips through a simulated reload', () => {
    const s = useZilProjectFiles()
    s.replaceAll([{ path: 'rooms.zil', text: 'R' }], 'main.zil')
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      v: 1, mainPath: 'main.zil', files: [{ path: 'rooms.zil', text: 'R' }],
    })
    // reload: in-memory state gone
    s.files.value = []
    s.mainPath.value = 'story.zil'
    s.restore()
    expect(s.files.value).toEqual([{ path: 'rooms.zil', text: 'R' }])
    expect(s.mainPath.value).toBe('main.zil')
  })

  it('add / update / remove / clear', () => {
    const s = useZilProjectFiles()
    expect(s.add({ path: 'a.zil', text: '1' })).toEqual({ ok: true })
    expect(s.add({ path: 'a.zil', text: '2' })).toEqual({ ok: true }) // replaces
    expect(s.files.value).toEqual([{ path: 'a.zil', text: '2' }])
    s.update('a.zil', '3')
    expect(s.files.value[0]!.text).toBe('3')
    expect(s.add({ path: '../b.zil', text: '' }).ok).toBe(false)
    expect(s.files.value).toHaveLength(1)
    s.remove('a.zil')
    expect(s.files.value).toEqual([])
    s.replaceAll([{ path: 'a.zil', text: '' }], 'm.zil')
    s.clear()
    expect(s.files.value).toEqual([])
    expect(s.mainPath.value).toBe('story.zil')
  })

  it('replaceAll refuses a bad set and changes nothing', () => {
    const s = useZilProjectFiles()
    s.replaceAll([{ path: 'a.zil', text: '' }], 'story.zil')
    s.replaceAll([{ path: 'story.zil', text: '' }], 'story.zil')
    expect(s.files.value).toEqual([{ path: 'a.zil', text: '' }])
  })

  it('drops an invalid stored record with one notice, never half-loading it', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, mainPath: 'story.zil', files: [{ path: 'ok.zil', text: '' }, { path: 'bad.h', text: '' }] }))
    const s = useZilProjectFiles()
    s.restore()
    expect(s.files.value).toEqual([])
    expect(s.mainPath.value).toBe('story.zil')
    expect(_toastAdd).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('corrupt JSON is dropped quietly', () => {
    localStorage.setItem(KEY, '{nope')
    const s = useZilProjectFiles()
    s.restore()
    expect(s.files.value).toEqual([])
  })

  it('storage full: files stay in memory and the cue fires once', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const s = useZilProjectFiles()
    expect(s.add({ path: 'a.zil', text: '1' })).toEqual({ ok: true })
    s.update('a.zil', '2')
    expect(s.files.value).toEqual([{ path: 'a.zil', text: '2' }])
    expect(_toastAdd).toHaveBeenCalledTimes(1)
  })
})
