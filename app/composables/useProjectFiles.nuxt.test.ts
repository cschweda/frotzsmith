/**
 * useProjectFiles — the explorer and tabs for a ZIL project's extra files
 * (happy-dom env). I6 behaviour is pinned by project-files.test.ts and the
 * existing suites; this file covers the zil: file ids.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useLanguage } from './useLanguage'
import { useSourceDocument } from './useSourceDocument'
import { useExtensions } from './useExtensions'
import { useZilProjectFiles } from './useZilProjectFiles'
import { resetStorageNoticeForTests } from './useStorageNotice'
import { ZIL_FILE_MAX_CHARS } from '~/modules/zil/zil-project'

vi.stubGlobal('useLanguage', useLanguage)
vi.stubGlobal('useSourceDocument', useSourceDocument)
vi.stubGlobal('useExtensions', useExtensions)
vi.stubGlobal('useZilProjectFiles', useZilProjectFiles)
const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

const { useProjectFiles } = await import('./useProjectFiles')
const KEY = 'frotzsmith:zil:project-files'

describe('useProjectFiles — a ZIL project\'s extra files', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStorageNoticeForTests()
    useLanguage().setLanguage('zil')
    useZilProjectFiles().clear()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists the main file, then the extra files sorted by path; no zillib entries', () => {
    useZilProjectFiles().replaceAll(
      [{ path: 'rooms.zil', text: 'R' }, { path: 'actions.zil', text: 'A' }],
      'story.zil',
    )
    const pf = useProjectFiles()
    expect(pf.files.value.map(f => [f.id, f.name, f.group, f.editable])).toEqual([
      ['source', 'story.zil', 'project', true],
      ['zil:actions.zil', 'actions.zil', 'project', true],
      ['zil:rooms.zil', 'rooms.zil', 'project', true],
    ])
  })

  it('the I6 explorer shows no ZIL files', () => {
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    useLanguage().setLanguage('i6')
    const pf = useProjectFiles()
    expect(pf.files.value.some(f => f.id.startsWith('zil:'))).toBe(false)
    expect(pf.files.value[0]!.name).toBe('story.inf')
  })

  it('reads a zil: tab, and an edit reaches the store at once while storage waits for the debounce', () => {
    vi.useFakeTimers()
    const zil = useZilProjectFiles()
    zil.replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    const pf = useProjectFiles()
    pf.openFile('zil:rooms.zil')
    expect(pf.activeId.value).toBe('zil:rooms.zil')
    expect(pf.readFile('zil:rooms.zil')).toBe('R')
    pf.writeActive('R2')
    expect(zil.files.value).toEqual([{ path: 'rooms.zil', text: 'R2' }])
    // not yet written: one write per pause in typing, not per keystroke
    expect(JSON.parse(localStorage.getItem(KEY)!).files[0].text).toBe('R')
    pf.writeActive('R3')
    vi.advanceTimersByTime(1000)
    expect(JSON.parse(localStorage.getItem(KEY)!).files[0].text).toBe('R3')
    // a simulated reload brings the edit back
    zil.files.value = []
    zil.restore()
    expect(zil.files.value).toEqual([{ path: 'rooms.zil', text: 'R3' }])
  })

  it('a pending edit is written before a restore replaces the files (language switch)', () => {
    vi.useFakeTimers()
    const zil = useZilProjectFiles()
    zil.replaceAll([{ path: 'rooms.zil', text: 'R' }], 'story.zil')
    const pf = useProjectFiles()
    pf.openFile('zil:rooms.zil')
    pf.writeActive('typed')
    zil.restore()
    expect(zil.files.value).toEqual([{ path: 'rooms.zil', text: 'typed' }])
  })

  it('adding a file over a limit returns the planZilFiles message and adds nothing', () => {
    const pf = useProjectFiles()
    const res = pf.addZilFile('big.zil', 'x'.repeat(ZIL_FILE_MAX_CHARS + 1))
    expect(res).toEqual({
      ok: false,
      message: '“big.zil” is larger than the 1 MB the browser editor can keep for one ZIL file.',
    })
    expect(useZilProjectFiles().files.value).toEqual([])
  })

  it('a file named like the main file is refused with its message', () => {
    const res = useProjectFiles().addZilFile('story.zil', 'x')
    expect(res).toEqual({ ok: false, message: '“story.zil” has the same name as the main file.' })
  })

  it('a file with a NUL in it is refused with one sentence', () => {
    const res = useProjectFiles().addZilFile('bin.zil', 'a\u0000b')
    expect(res.ok).toBe(false)
    expect(res.ok ? '' : res.message).toBe('“bin.zil” isn’t a text file, so it can’t be added.')
    expect(useZilProjectFiles().files.value).toEqual([])
  })

  it('hasZilFile and removeZilFile; removing an open file closes its tab', async () => {
    const pf = useProjectFiles()
    expect(pf.addZilFile('rooms.zil', 'R')).toEqual({ ok: true })
    expect(pf.hasZilFile('rooms.zil')).toBe(true)
    expect(pf.hasZilFile('other.zil')).toBe(false)
    pf.openFile('zil:rooms.zil')
    pf.removeZilFile('rooms.zil')
    await nextTick()
    expect(useZilProjectFiles().files.value).toEqual([])
    expect(pf.activeId.value).toBe('source')
    expect(pf.openTabs.value.map(t => t.id)).toEqual(['source'])
  })

  it('findZilFile matches a stored file ignoring case (by pathKey)', () => {
    const pf = useProjectFiles()
    pf.addZilFile('rooms.zil', 'R')
    expect(pf.findZilFile('Rooms.zil')).toBe('rooms.zil')
    expect(pf.findZilFile('ROOMS.ZIL')).toBe('rooms.zil')
    expect(pf.findZilFile('other.zil')).toBeNull()
    expect(pf.hasZilFile('Rooms.zil')).toBe(true)
  })

  it('a case variant replaces the stored file and takes the new spelling; its open tab and diagnostics follow', async () => {
    const pf = useProjectFiles()
    pf.addZilFile('rooms.zil', 'R')
    pf.openFile('zil:rooms.zil')
    await nextTick()
    expect(pf.addZilFile('Rooms.zil', 'R2')).toEqual({ ok: true })
    await nextTick()
    expect(useZilProjectFiles().files.value).toEqual([{ path: 'Rooms.zil', text: 'R2' }])
    expect(pf.activeId.value).toBe('zil:Rooms.zil')
    expect(pf.openTabs.value.map(t => t.id)).toEqual(['source', 'zil:Rooms.zil'])
    expect(pf.readFile('zil:Rooms.zil')).toBe('R2')
    // A diagnostic from the last compile still names the old spelling.
    expect(pf.diagnosticTarget('rooms.zil')).toBe('zil:Rooms.zil')
  })

  it('diagnosticTarget maps a diagnostic file to a tab id', () => {
    useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'main.zil')
    const pf = useProjectFiles()
    expect(pf.diagnosticTarget('main.zil')).toBe('source')
    expect(pf.diagnosticTarget(undefined)).toBe('source')
    expect(pf.diagnosticTarget('rooms.zil')).toBe('zil:rooms.zil')
    expect(pf.diagnosticTarget('/zillib/parser.zil')).toBeNull()
  })
})
