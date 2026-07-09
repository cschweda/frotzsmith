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
import { useLanguage } from './useLanguage'

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
