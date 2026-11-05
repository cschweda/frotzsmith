/**
 * useIde composable tests — happy-dom env (via environmentMatchGlobs).
 *
 * Tests orchestration/state logic: storyKey computation, activeStoryKey lifecycle,
 * sendToPlay side-effects, and runCompile clean-slate behavior.
 *
 * Stubbed globals:
 *   - useCompiler  → mock that avoids actual WASM compilation
 *   - useTranscript → mock that avoids the real replay Worker
 *   - useSourceDocument, useExtensions, useProjectFiles, useTestScripts,
 *     usePlayTranscript → real implementations provided as globals so
 *     useIde's orchestration is tested end-to-end
 *
 * Not tested here (e2e/live-only):
 *   - useReplay spawning a real Web Worker
 *   - useCompilerWasm / inform6.wasm
 *   - Parchment iframe interaction
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Import real composables to register them as globals (they use Nuxt auto-imports
// internally, which our setup file provides). They MUST be imported before useIde.
import { useSourceDocument } from './useSourceDocument'
import { useExtensions } from './useExtensions'
import { useProjectFiles } from './useProjectFiles'
import { useTestScripts } from './useTestScripts'
import { usePlayTranscript } from './usePlayTranscript'
import { useOutsideSource } from './outside-source'
import { useZilProjectFiles } from './useZilProjectFiles'
import { useLanguage } from './useLanguage'
import { loadSampleSource } from '~/modules/inform6/samples'
import { formatI6 } from '~/utils/format-i6'

// Stub usePlayTranscript global — usePlayTranscript calls useIde() inside
// if (import.meta.client), which would recurse into the composable tree when
// runCompile triggers it. We stub only the global reference so useIde gets
// a lightweight stand-in when runCompile calls usePlayTranscript().reset().
const _playTranscriptReset = vi.fn()
vi.stubGlobal('usePlayTranscript', () => ({
  commands: ref([]),
  count: ref(0),
  text: ref(''),
  record: vi.fn(),
  reset: _playTranscriptReset,
}))

// Provide real composables as globals so useIde's auto-import references resolve.
vi.stubGlobal('useSourceDocument', useSourceDocument)
vi.stubGlobal('useExtensions', useExtensions)
vi.stubGlobal('useProjectFiles', useProjectFiles)
vi.stubGlobal('useTestScripts', useTestScripts)
vi.stubGlobal('useZilProjectFiles', useZilProjectFiles)
vi.stubGlobal('useLanguage', useLanguage)

// Mock useCompiler to avoid WASM.
const _compileMock = vi.fn()
vi.stubGlobal('useCompiler', () => ({ compile: _compileMock }))

// Mock useTranscript to avoid the real replay Worker.
const _transcriptReset = vi.fn()
vi.stubGlobal('useTranscript', () => ({
  reset: _transcriptReset,
  run: vi.fn(),
  cancel: vi.fn(),
  turns: ref([]),
  running: ref(false),
  progress: ref(null),
  ms: ref(null),
  error: ref(null),
}))

// Stub useMap so runCompile can call useMap().reset() without a real graph.
const _mapReset = vi.fn()
vi.stubGlobal('useMap', () => ({ reset: _mapReset }))

// Toast sink for the storage-full cue (useStorageNotice → useToast().add).
const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

// Import AFTER globals are set up.
const { useIde } = await import('./useIde')

// ─── helpers ───────────────────────────────────────────────────────────────

/** Set up a success compile result so canPlay becomes true. */
function setupSuccessResult() {
  const ide = useIde()
  ide.result.value = {
    ok: true,
    storyFile: new Uint8Array([1, 2, 3]),
    storyExt: 'z5' as const,
    diagnostics: [],
    rawStderr: '',
    ms: 5,
    byteLength: 3,
    stats: undefined,
  }
  ide.status.value = 'success'
  return ide
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe('useIde — storyKey / storyTitle computation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('storyKey is "untitled" when source is empty', () => {
    const { source, storyKey } = useIde()
    source.value = ''
    expect(storyKey.value).toBe('untitled')
  })

  it('storyKey slugifies the Constant Story title', () => {
    const { source, storyKey, storyTitle } = useIde()
    source.value = 'Constant Story "My Adventure"\nObject room;'
    expect(storyTitle.value).toBe('My Adventure')
    expect(storyKey.value).toBe('my-adventure')
  })

  it('storyKey is "untitled" when no Constant Story line is present', () => {
    const { source, storyKey } = useIde()
    source.value = 'Object room;'
    expect(storyKey.value).toBe('untitled')
  })

  it('storyTitle is undefined when source has no Constant Story', () => {
    const { source, storyTitle } = useIde()
    source.value = ''
    expect(storyTitle.value).toBeUndefined()
  })
})

describe('useIde — activeStoryKey lifecycle (discrete load events)', () => {
  it('activeStoryKey starts as "untitled"', () => {
    const { activeStoryKey } = useIde()
    expect(activeStoryKey.value).toBe('untitled')
  })

  it('loadSource updates activeStoryKey to the slug of the new title', () => {
    const { loadSource, activeStoryKey } = useIde()
    loadSource('Constant Story "Zork"\nObject room;')
    expect(activeStoryKey.value).toBe('zork')
  })

  it('loadSource with no title sets activeStoryKey to "untitled"', () => {
    const { loadSource, activeStoryKey } = useIde()
    loadSource('')
    expect(activeStoryKey.value).toBe('untitled')
  })

  it('newProject resets activeStoryKey to "untitled"', () => {
    const { loadSource, newProject, activeStoryKey } = useIde()
    loadSource('Constant Story "Before"\nObject room;')
    expect(activeStoryKey.value).toBe('before')
    newProject('std')
    expect(activeStoryKey.value).toBe('untitled')
  })
})

describe('useIde — sendToPlay side-effects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Seed autosave entries into localStorage
    localStorage.setItem('autosave:abc', 'data1')
    localStorage.setItem('autosave:xyz', 'data2')
    localStorage.setItem('other-key', 'keep')
  })

  it('sendToPlay is a no-op when canPlay is false (no compiled story)', () => {
    const { sendToPlay, pendingScript, playNonce, activeTab } = useIde()
    const initialNonce = playNonce.value
    sendToPlay(['look'])
    expect(pendingScript.value).toBeNull()
    expect(playNonce.value).toBe(initialNonce)
    expect(activeTab.value).not.toBe('play')
  })

  it('sendToPlay clears autosave:* from localStorage', () => {
    const ide = setupSuccessResult()
    ide.sendToPlay(['look'])
    expect(localStorage.getItem('autosave:abc')).toBeNull()
    expect(localStorage.getItem('autosave:xyz')).toBeNull()
    expect(localStorage.getItem('other-key')).toBe('keep')
  })

  it('sendToPlay sets pendingScript to the supplied commands', () => {
    const { sendToPlay, pendingScript } = setupSuccessResult()
    sendToPlay(['look', 'north'])
    expect(pendingScript.value).toEqual(['look', 'north'])
  })

  it('sendToPlay bumps playNonce', () => {
    const { sendToPlay, playNonce } = setupSuccessResult()
    const before = playNonce.value
    sendToPlay(['look'])
    expect(playNonce.value).toBe(before + 1)
  })

  it('Play trusts an outside (package/link) source, so Skein auto-run resumes (F2)', () => {
    const ide = setupSuccessResult()
    useOutsideSource().markOutside()
    ide.playStory()
    expect(useOutsideSource().untrusted.value).toBe(false)
  })

  it('sendToPlay sets activeTab to "play"', () => {
    const { sendToPlay, activeTab } = setupSuccessResult()
    sendToPlay(['look'])
    expect(activeTab.value).toBe('play')
  })

  it('sendToPlay is a no-op when commands array is empty', () => {
    const { sendToPlay, pendingScript, playNonce } = setupSuccessResult()
    const nonceBefore = playNonce.value
    sendToPlay([])
    expect(pendingScript.value).toBeNull()
    expect(playNonce.value).toBe(nonceBefore)
  })
})

describe('useIde — runCompile clean-slate orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _compileMock.mockResolvedValue({
      ok: true,
      storyFile: new Uint8Array([1, 2, 3]),
      storyExt: 'z5' as const,
      diagnostics: [],
      rawStderr: '',
      ms: 10,
      byteLength: 3,
      stats: null,
    })
    localStorage.setItem('autosave:save1', 'data')
    localStorage.setItem('autosave:save2', 'data2')
  })

  it('runCompile clears autosave:* from localStorage', async () => {
    const { runCompile } = useIde()
    await runCompile()
    expect(localStorage.getItem('autosave:save1')).toBeNull()
    expect(localStorage.getItem('autosave:save2')).toBeNull()
  })

  it('runCompile resets the play transcript', async () => {
    const { runCompile } = useIde()
    await runCompile()
    expect(_playTranscriptReset).toHaveBeenCalled()
  })

  it('runCompile resets the test-run transcript', async () => {
    const { runCompile } = useIde()
    await runCompile()
    expect(_transcriptReset).toHaveBeenCalled()
  })

  it('runCompile sets activeTab to "results"', async () => {
    const { runCompile, activeTab } = useIde()
    activeTab.value = 'play'
    await runCompile()
    expect(activeTab.value).toBe('results')
  })

  it('runCompile updates status to "success" when compile succeeds', async () => {
    const { runCompile, status } = useIde()
    await runCompile()
    expect(status.value).toBe('success')
  })

  it('runCompile updates status to "error" when compile fails', async () => {
    _compileMock.mockResolvedValue({
      ok: false,
      storyFile: undefined,
      storyExt: 'z5' as const,
      diagnostics: [{ line: 1, severity: 'error', message: 'syntax error' }],
      rawStderr: 'Error',
      ms: 2,
      byteLength: 0,
      stats: undefined,
    })
    const { runCompile, status } = useIde()
    await runCompile()
    expect(status.value).toBe('error')
  })

  it('runCompile surfaces a thrown compile exception as a failed result', async () => {
    // Regression: a bare `catch {}` nulled the result, so ResultsPanel rendered
    // an "error" banner reading "0 errors" with empty diagnostics/raw-output
    // panes when the compiler module itself failed (e.g. a failed
    // inform6.mjs/wasm fetch on first compile).
    _compileMock.mockRejectedValue(new Error('wasm fetch failed'))
    const { runCompile, status, result } = useIde()
    await runCompile()
    expect(status.value).toBe('error')
    expect(result.value).not.toBeNull()
    expect(result.value!.ok).toBe(false)
    expect(result.value!.diagnostics[0]!.severity).toBe('fatal')
    expect(result.value!.diagnostics[0]!.message).toContain('wasm fetch failed')
    expect(result.value!.rawStderr).toContain('wasm fetch failed')
  })

  it('runCompile preserves the active test-script selection', async () => {
    // Regression: resetEphemeral used to select('') on every compile, which
    // persisted activeId='' — after a reload the panel reverted to "Script 1".
    const { add, scripts, select } = useTestScripts()
    add('My Script')
    select(scripts.value[0]!.id)
    const selected = useTestScripts().activeId.value
    expect(selected).not.toBe('')

    const { runCompile } = useIde()
    await runCompile()

    expect(useTestScripts().activeId.value).toBe(selected)
  })

  it('runCompile clears any queued Send-to-Play script', async () => {
    const ide = useIde()
    ide.pendingScript.value = ['look']
    await ide.runCompile()
    expect(ide.pendingScript.value).toBeNull()
  })

  it('runCompile ignores a second call within 500ms of completion (queued freeze click)', async () => {
    const { runCompile } = useIde()
    await runCompile()
    expect(_compileMock).toHaveBeenCalledTimes(1)
    await runCompile() // dispatched immediately after — e.g. a click queued during a main-thread freeze
    expect(_compileMock).toHaveBeenCalledTimes(1)
  })
})

describe('useIde — superseded compiles', () => {
  /** A compile the test resolves by hand. */
  function deferredCompile() {
    let resolve!: (v: unknown) => void
    _compileMock.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    return (ok = true) => resolve({
      ok,
      storyFile: ok ? new Uint8Array([9]) : undefined,
      storyExt: 'z5' as const,
      diagnostics: [],
      rawStderr: '',
      ms: 1,
      byteLength: 1,
    })
  }

  beforeEach(() => vi.clearAllMocks())

  it('a compile that finishes after a new source loads is discarded', async () => {
    const ide = useIde()
    const finish = deferredCompile()
    const pending = ide.runCompile()
    await new Promise(r => setTimeout(r, 150)) // past nextPaint, compile in flight
    ide.loadSource('Constant Story "Other Game";')
    finish()
    await pending
    expect(ide.result.value).toBeNull()
    expect(ide.status.value).toBe('idle')
    expect(ide.usedProfile.value).toBeNull()
  })

  it('a superseded compile does not swallow the next real compile click', async () => {
    const ide = useIde()
    const finish = deferredCompile()
    const pending = ide.runCompile()
    await new Promise(r => setTimeout(r, 150))
    ide.loadSource('Constant Story "Other Game";')
    finish()
    await pending
    _compileMock.mockResolvedValueOnce({
      ok: true, storyFile: new Uint8Array([1]), storyExt: 'z5', diagnostics: [], rawStderr: '', ms: 1, byteLength: 1,
    })
    await ide.runCompile() // immediately after — must NOT hit the 500 ms freeze-click debounce
    expect(ide.status.value).toBe('success')
  })
})

describe('useIde — loadSample (async, lazy sample bodies)', () => {
  it('loads a sample body, formats it into source, and resets to a clean slate', async () => {
    const ide = useIde()
    setupSuccessResult() // pre-existing compile artifacts must be blanked
    ide.activeTab.value = 'play'

    await ide.loadSample('std-skeleton')

    expect(ide.source.value.length).toBeGreaterThan(100)
    expect(ide.source.value).toContain('Include')
    expect(ide.status.value).toBe('idle')
    expect(ide.result.value).toBeNull()
    expect(ide.activeTab.value).toBe('results')
  })

  it('a bundled sample or New clears the outside-source mark; editing and plain loadSource do not (F2)', async () => {
    const ide = useIde()
    useOutsideSource().markOutside()
    ide.source.value += '\n! edited'
    ide.loadSource('Constant Story "X";')
    expect(useOutsideSource().untrusted.value).toBe(true)
    await ide.loadSample('std-skeleton')
    expect(useOutsideSource().untrusted.value).toBe(false)
    useOutsideSource().markOutside()
    ide.newProject('std')
    expect(useOutsideSource().untrusted.value).toBe(false)
  })

  // Ruling (fix round): a plain .inf/.zil opened from disk is delivered like
  // a package — outside source until the author presses Play or Run.
  it('opening a plain source file marks it as outside source', () => {
    const ide = useIde()
    ide.newProject('std')
    expect(useOutsideSource().untrusted.value).toBe(false)
    ide.loadOpenedFile('Constant Story "From Disk";\n')
    expect(ide.source.value).toBe('Constant Story "From Disk";\n')
    expect(useOutsideSource().untrusted.value).toBe(true)
    ide.newProject('std')
    expect(useOutsideSource().untrusted.value).toBe(false)
  })

  it('a sample that is unknown leaves the mark in place', async () => {
    const ide = useIde()
    useOutsideSource().markOutside()
    await ide.loadSample('no-such-sample')
    expect(useOutsideSource().untrusted.value).toBe(true)
  })

  it('a sample marked format: false loads byte-identical to its file', async () => {
    // The Architect's Legacy is hand-laid-out teaching material: the
    // formatter must not reflow it on load.
    const ide = useIde()
    const raw = await loadSampleSource('std-architect-legacy')
    expect(raw).not.toBeNull()
    expect(formatI6(raw!), 'precondition: the formatter would change it').not.toBe(raw)
    await ide.loadSample('std-architect-legacy')
    expect(ide.source.value).toBe(raw)
  })

  it('is a no-op for an unknown sample id', async () => {
    const ide = useIde()
    ide.source.value = 'KEEP ME'
    await ide.loadSample('no-such-sample')
    expect(ide.source.value).toBe('KEEP ME')
  })
})

describe('useIde — storage failures must not break the IDE', () => {
  // useIde was the one composable with unguarded localStorage access: restore()
  // threw during IdeLayout mount when storage is blocked (Chrome "Block all
  // cookies"), killing the whole IDE, and setProfileMode/setTargetMode threw
  // an uncaught QuotaExceededError mid-toolbar-click on a full quota.

  it('restore() survives blocked localStorage (getItem throws)', () => {
    const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    try {
      const ide = useIde()
      expect(() => ide.restore()).not.toThrow()
      expect(ide.profileMode.value).toBe('auto') // falls back to defaults
      expect(ide.targetMode.value).toBe('auto')
    } finally {
      spy.mockRestore()
    }
  })

  it('setProfileMode / setTargetMode survive a full quota (setItem throws)', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    try {
      const ide = useIde()
      expect(() => ide.setProfileMode('std')).not.toThrow()
      expect(() => ide.setTargetMode('z8')).not.toThrow()
      // The in-memory choice must still take effect for this session.
      expect(ide.profileMode.value).toBe('std')
      expect(ide.targetMode.value).toBe('z8')
    } finally {
      spy.mockRestore()
    }
  })

  it('a refused persist surfaces the storage-full cue (once, not per write)', async () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    try {
      // Earlier quota tests in this file may already have fired the
      // once-per-session cue — reset the latch to observe it cleanly.
      const { resetStorageNoticeForTests } = await import('./useStorageNotice')
      resetStorageNoticeForTests()
      _toastAdd.mockClear()
      const ide = useIde()
      ide.setProfileMode('std')
      ide.setTargetMode('z8')
      ide.setTargetMode('z5')
      expect(_toastAdd).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('useIde — language-switch artifact reset (restore)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useLanguage().setLanguage('i6')
  })

  it('same-language remount keeps compile artifacts (/technical round-trip)', () => {
    const ide = useIde()
    ide.restore()
    setupSuccessResult()
    ide.activeTab.value = 'play'
    ide.restore() // remount, same language
    expect(ide.status.value).toBe('success')
    expect(ide.result.value).not.toBeNull()
  })

  it('switching languages blanks status, result, tab, and queued script', () => {
    const ide = useIde()
    ide.restore() // i6 mount
    setupSuccessResult()
    ide.activeTab.value = 'play'
    ide.pendingScript.value = ['look']

    useLanguage().setLanguage('zil')
    ide.restore() // zil mount

    expect(ide.status.value).toBe('idle')
    expect(ide.result.value).toBeNull()
    expect(ide.activeTab.value).toBe('results')
    expect(ide.pendingScript.value).toBeNull()
  })

  it('switching languages resets an unforced profile/target to auto', () => {
    const ide = useIde()
    ide.restore()
    ide.targetMode.value = 'z4' // in-memory only; nothing persisted for zil
    useLanguage().setLanguage('zil')
    ide.restore()
    expect(ide.targetMode.value).toBe('auto')
  })
})

describe('useIde — the open ZIL project\'s extra files', () => {
  const seed = () => useZilProjectFiles().replaceAll([{ path: 'rooms.zil', text: 'R' }], 'main.zil')

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _compileMock.mockResolvedValue({
      ok: true, storyFile: new Uint8Array([1]), storyExt: 'z3' as const,
      diagnostics: [], rawStderr: '', ms: 1, byteLength: 1, stats: null,
    })
    useLanguage().setLanguage('zil')
    useZilProjectFiles().clear()
  })

  it('a ZIL compile passes the files and mainPath; an I6 compile passes neither', async () => {
    seed()
    await useIde().runCompile()
    expect(_compileMock.mock.calls.at(-1)![1]).toMatchObject({
      files: [{ path: 'rooms.zil', text: 'R' }], mainPath: 'main.zil',
    })
    useLanguage().setLanguage('i6')
    // let the 500 ms freeze-click debounce pass
    await new Promise(r => setTimeout(r, 520))
    await useIde().runCompile()
    const opts = _compileMock.mock.calls.at(-1)![1]
    expect(opts.files).toBeUndefined()
    expect(opts.mainPath).toBeUndefined()
    // switching language did not wipe the store
    expect(useZilProjectFiles().files.value).toHaveLength(1)
  })

  it('loadSample, newProject and loadOpenedFile clear them; editing the main source and loadSource do not', async () => {
    const ide = useIde()
    seed()
    ide.source.value += '\n; edited'
    expect(useZilProjectFiles().files.value).toHaveLength(1)
    ide.loadSource('<ROUTINE GO () <CRLF>>') // package open / restores use this
    expect(useZilProjectFiles().files.value).toHaveLength(1)
    ide.loadOpenedFile('<ROUTINE GO () <CRLF>>')
    expect(useZilProjectFiles().files.value).toEqual([])
    seed()
    ide.newProject('std')
    expect(useZilProjectFiles().files.value).toEqual([])
    expect(useZilProjectFiles().mainPath.value).toBe('story.zil')
    seed()
    await ide.loadSample('no-such-sample') // unknown sample: nothing loads, files kept
    expect(useZilProjectFiles().files.value).toHaveLength(1)
    await ide.loadSample('zil-skeleton')
    expect(useZilProjectFiles().files.value).toEqual([])
  })

  it('an edit typed in an extra file\'s tab is what the next compile receives', async () => {
    seed()
    const pf = useProjectFiles()
    pf.openFile('zil:rooms.zil')
    pf.writeActive('<ROOM KITCHEN>')
    await useIde().runCompile()
    expect(_compileMock.mock.calls.at(-1)![1].files).toEqual([{ path: 'rooms.zil', text: '<ROOM KITCHEN>' }])
  })

  it('jumpTo opens the file a diagnostic names and signals its line', () => {
    seed()
    const ide = useIde()
    const pf = useProjectFiles()
    ide.jumpTo(4, 'rooms.zil')
    expect(pf.activeId.value).toBe('zil:rooms.zil')
    expect(ide.jumpSignal.value).toMatchObject({ line: 4, fileId: 'zil:rooms.zil' })
    ide.jumpTo(3, 'main.zil')
    expect(ide.jumpSignal.value).toMatchObject({ line: 3, fileId: 'source' })
    expect(pf.activeId.value).toBe('source')
    ide.jumpTo(2)
    expect(ide.jumpSignal.value).toMatchObject({ line: 2, fileId: 'source' })
  })

  it('jumpTo a file outside the project (zillib) changes no tab and sends no jump', () => {
    seed()
    const ide = useIde()
    const pf = useProjectFiles()
    pf.openFile('zil:rooms.zil')
    const before = ide.jumpSignal.value
    ide.jumpTo(1, '/zillib/parser.zil')
    expect(pf.activeId.value).toBe('zil:rooms.zil')
    expect(ide.jumpSignal.value).toBe(before)
  })
})

describe('useIde — the loaded sample (Solutions)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useLanguage().setLanguage('i6')
  })

  it('loadSample sets loadedSampleId; edits flip sampleEdited, undoing them flips it back', async () => {
    const ide = useIde()
    ide.newProject('std')
    expect(ide.loadedSampleId.value).toBeNull()
    expect(ide.sampleEdited.value).toBe(false)
    await ide.loadSample('std-architect-legacy')
    expect(ide.loadedSampleId.value).toBe('std-architect-legacy')
    expect(ide.sampleEdited.value).toBe(false)
    const loaded = ide.source.value
    ide.source.value += '\n! a note'
    expect(ide.sampleEdited.value).toBe(true)
    ide.source.value = loaded
    expect(ide.sampleEdited.value).toBe(false)
  })

  it('an unknown sample leaves the loaded sample as it was', async () => {
    const ide = useIde()
    await ide.loadSample('std-architect-legacy')
    await ide.loadSample('no-such-sample')
    expect(ide.loadedSampleId.value).toBe('std-architect-legacy')
  })

  it('New, Open and loadSource (share link, package) clear it', async () => {
    const ide = useIde()
    await ide.loadSample('std-architect-legacy')
    ide.newProject('std')
    expect(ide.loadedSampleId.value).toBeNull()
    expect(ide.sampleEdited.value).toBe(false)

    await ide.loadSample('std-architect-legacy')
    ide.loadOpenedFile('Constant Story "From Disk";\n')
    expect(ide.loadedSampleId.value).toBeNull()

    await ide.loadSample('std-architect-legacy')
    ide.loadSource('Constant Story "Shared";\n') // share link and package apply both load through this
    expect(ide.loadedSampleId.value).toBeNull()
  })

  it('a ZIL sample sets it too, and a language switch clears it', async () => {
    const ide = useIde()
    ide.restore()
    useLanguage().setLanguage('zil')
    ide.restore()
    await ide.loadSample('zil-architect-legacy')
    expect(ide.loadedSampleId.value).toBe('zil-architect-legacy')
    expect(ide.sampleEdited.value).toBe(false)
    useLanguage().setLanguage('i6')
    ide.restore()
    expect(ide.loadedSampleId.value).toBeNull()
  })
})

describe('useIde — buildIsCurrent / ensureBuild (compile only when stale)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useLanguage().setLanguage('i6')
    _compileMock.mockResolvedValue({
      ok: true, storyFile: new Uint8Array([1, 2, 3]), storyExt: 'z5' as const,
      diagnostics: [], rawStderr: '', ms: 1, byteLength: 3, stats: null,
    })
  })

  it('is current after a compile, stale after an edit, and ensureBuild compiles only then', async () => {
    const ide = useIde()
    ide.loadSource('Constant Story "Fresh";\n')
    expect(ide.buildIsCurrent.value).toBe(false)
    expect(await ide.ensureBuild()).toBe(true)
    expect(_compileMock).toHaveBeenCalledTimes(1)
    expect(ide.buildIsCurrent.value).toBe(true)

    expect(await ide.ensureBuild()).toBe(true)
    expect(_compileMock).toHaveBeenCalledTimes(1) // already current: no compile

    ide.source.value += '\n! edit'
    expect(ide.buildIsCurrent.value).toBe(false)
    // straight after a compile: the click debounce must not block this one
    expect(await ide.ensureBuild()).toBe(true)
    expect(_compileMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the right-pane tab when it compiles, and reports a failed build', async () => {
    const ide = useIde()
    ide.loadSource('Constant Story "Tabbed";\n')
    ide.activeTab.value = 'map'
    expect(await ide.ensureBuild()).toBe(true)
    expect(ide.activeTab.value).toBe('map')

    _compileMock.mockResolvedValue({
      ok: false, storyExt: 'z5' as const, diagnostics: [{ severity: 'error', message: 'x' }],
      rawStderr: '', ms: 1, byteLength: 0,
    })
    ide.source.value += '\n! broken'
    expect(await ide.ensureBuild()).toBe(false)
    expect(ide.buildIsCurrent.value).toBe(false)
    expect(ide.activeTab.value).toBe('results') // the errors are shown
  })

  it('waits for a compile already running instead of starting another', async () => {
    const ide = useIde()
    ide.loadSource('Constant Story "Busy";\n')
    let finish!: (v: unknown) => void
    _compileMock.mockImplementationOnce(() => new Promise(r => { finish = r }))
    const first = ide.runCompile()
    await new Promise(r => setTimeout(r, 120)) // past nextPaint
    expect(ide.status.value).toBe('compiling')
    const ensured = ide.ensureBuild()
    finish({ ok: true, storyFile: new Uint8Array([9]), storyExt: 'z5', diagnostics: [], rawStderr: '', ms: 1, byteLength: 1 })
    await first
    expect(await ensured).toBe(true)
    expect(_compileMock).toHaveBeenCalledTimes(1)
  })
})
