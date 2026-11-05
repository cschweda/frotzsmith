/**
 * useSolutionRecorder — record / pause / resume / stop / continue a solution
 * while the author plays (happy-dom env).
 *
 * The IDE is a small reactive fake (status, playNonce, sourceGen, sendToPlay,
 * playFromStart, ensureBuild) and the generator formats the commands it is
 * given, so these tests pin the recorder's own logic: what it captures, what
 * it feeds Play, what it saves and when it pauses or stops by itself.
 * The play transcript and the solution store are the real composables.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useLanguage } from './useLanguage'
import { formatSolution, solutionCommands } from './solution-text'
import { resetStorageNoticeForTests } from './useStorageNotice'

const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))
vi.stubGlobal('useLanguage', useLanguage)
const _openFile = vi.fn()
vi.stubGlobal('useProjectFiles', () => ({ openFile: _openFile }))

/** The generator: the game answers every command with "You <command>." */
const _generate = vi.fn(async (commands: string[]) => ({
  ok: true as const,
  text: formatSolution('Test Game', 'Opening.', commands.map(c => ({ command: c, output: `You ${c}.` }))),
}))
vi.stubGlobal('useSolutionGenerator', () => ({ generate: _generate }))

type FakeIde = ReturnType<typeof makeIde>
let ide: FakeIde
function makeIde() {
  const state = (globalThis as unknown as { useState: <T>(k: string, i?: () => T) => { value: T } }).useState
  const fake = {
    status: ref<'idle' | 'compiling' | 'success' | 'error'>('success'),
    result: ref({ ok: true, storyFile: new Uint8Array([1]), storyExt: 'z5' }),
    sourceGen: ref(0),
    playNonce: ref(0),
    buildIsCurrent: ref(true),
    activeTab: ref('results'),
    canPlay: ref(true),
    storyTitle: ref('Test Game'),
    storyBase: ref('test-game'),
    activeStoryKey: state<string>('frotz:story-key', () => 'game1'),
    ensureBuild: vi.fn(async () => true),
    sendToPlay: vi.fn((cmds: string[]) => {
      fake.activeTab.value = 'play'
      fake.playNonce.value += 1
      return cmds
    }),
    playFromStart: vi.fn(() => {
      fake.activeTab.value = 'play'
      fake.playNonce.value += 1
    }),
  }
  return fake
}
vi.stubGlobal('useIde', () => ide)

const { usePlayTranscript } = await import('./usePlayTranscript')
vi.stubGlobal('usePlayTranscript', usePlayTranscript)
const { useSolutions } = await import('./useSolutions')
vi.stubGlobal('useSolutions', useSolutions)
const { useSolutionRecorder } = await import('./useSolutionRecorder')

/** The play page reports a fresh game (the transcript resets), then the author types. */
function bootThenType(...cmds: string[]) {
  usePlayTranscript().reset()
  type(...cmds)
}
function type(...cmds: string[]) {
  for (const c of cmds) usePlayTranscript().record(c)
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await nextTick()
  await new Promise(r => setTimeout(r, 0))
}

describe('useSolutionRecorder', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetStorageNoticeForTests()
    _toastAdd.mockClear()
    _openFile.mockClear()
    _generate.mockClear()
    ide = makeIde()
    useLanguage().setLanguage('i6')
  })

  it('records from scratch: restarts Play, opens the solution and saves exactly the typed commands', async () => {
    const r = useSolutionRecorder()
    expect(r.state.value).toBe('stopped')
    expect(await r.record()).toEqual({ ok: true })
    expect(r.state.value).toBe('recording')
    expect(ide.playFromStart).toHaveBeenCalledTimes(1)
    expect(ide.activeTab.value).toBe('play')
    expect(_openFile).toHaveBeenCalledWith('solution')
    bootThenType('north', 'take lamp')
    const res = await r.stop()
    expect(res.ok).toBe(true)
    expect(r.state.value).toBe('stopped')
    expect(solutionCommands(useSolutions().text.value!)).toEqual(['north', 'take lamp'])
  })

  it('saves nothing when no commands were played', async () => {
    const r = useSolutionRecorder()
    await r.record()
    bootThenType()
    expect(await r.stop()).toEqual({ ok: true, empty: true })
    expect(useSolutions().has.value).toBe(false)
  })

  it('asks before Record replaces an existing solution', async () => {
    useSolutions().set(formatSolution('Test Game', 'Opening.', [{ command: 'look', output: '' }]))
    const r = useSolutionRecorder()
    const asked = await r.record()
    expect(asked.ok).toBe(false)
    expect(asked).toMatchObject({ needsConfirm: true })
    expect(r.state.value).toBe('stopped')
    expect(ide.playFromStart).not.toHaveBeenCalled()
    expect((await r.record({ confirmed: true })).ok).toBe(true)
    expect(r.state.value).toBe('recording')
  })

  it('Pause saves and allows edits; Resume feeds the edited commands and appends new ones', async () => {
    const r = useSolutionRecorder()
    await r.record()
    bootThenType('north', 'oops', 'take lamp')
    expect((await r.pause()).ok).toBe(true)
    expect(r.state.value).toBe('paused')
    const s = useSolutions()
    expect(s.readOnly.value).toBe(false)
    // The author deletes the mistaken command while paused.
    const edited = s.text.value!.split('\n').filter(l => l !== '> oops').join('\n')
    expect(s.edit(edited).ok).toBe(true)
    expect((await r.resume()).ok).toBe(true)
    expect(r.state.value).toBe('recording')
    expect(ide.sendToPlay).toHaveBeenLastCalledWith(['north', 'take lamp'])
    // Fed commands are not captured by the play page; only what is typed next.
    bootThenType('south')
    await r.stop()
    expect(solutionCommands(s.text.value!)).toEqual(['north', 'take lamp', 'south'])
  })

  it('Load a partial file, Continue, type two commands, Stop: the file’s commands plus the two', async () => {
    const s = useSolutions()
    s.set(formatSolution('Test Game', 'Opening.', [{ command: 'north', output: 'x' }, { command: 'open door', output: 'y' }]))
    const r = useSolutionRecorder()
    // Load file reveals what it loaded (useSolutionTab.load).
    ;(globalThis as unknown as { useState: <T>(k: string, i?: () => T) => { value: T } })
      .useState<string | null>('frotz:solution-revealed', () => null).value = 'game1'
    expect((await r.continueRecording()).ok).toBe(true)
    expect(ide.sendToPlay).toHaveBeenLastCalledWith(['north', 'open door'])
    bootThenType('west', 'xyzzy')
    await r.stop()
    expect(solutionCommands(s.text.value!)).toEqual(['north', 'open door', 'west', 'xyzzy'])
  })

  it('Record from scratch never shows the old solution, and reveals only new saved text', async () => {
    const old = formatSolution('Test Game', 'Opening.', [{ command: 'secret', output: 'Spoiler.' }])
    const s = useSolutions()
    s.set(old)
    const r = useSolutionRecorder()
    await r.record({ confirmed: true })
    expect(s.view.value).toBe('') // not the saved (hidden) text, before any live result
    expect(r.revealed.value).toBe(false)
    bootThenType()
    expect((await r.stop()).ok).toBe(true) // zero commands: nothing saved…
    expect(s.text.value).toBe(old)
    expect(r.revealed.value).toBe(false) // …and the old solution stays hidden
    await r.record({ confirmed: true })
    bootThenType('north')
    await r.stop()
    expect(r.revealed.value).toBe(true) // the author's new text
  })

  it('Continue is refused while the solution is hidden', async () => {
    useSolutions().set(formatSolution('Test Game', 'Opening.', [{ command: 'north', output: '' }]))
    const r = useSolutionRecorder()
    const res = await r.continueRecording()
    expect(res.ok).toBe(false)
    expect(ide.sendToPlay).not.toHaveBeenCalled()
  })

  it('from scratch, zero commands, Pause then Resume replays only that session (not the old solution)', async () => {
    useSolutions().set(formatSolution('Test Game', 'Opening.', [{ command: 'old', output: '' }]))
    const r = useSolutionRecorder()
    await r.record({ confirmed: true })
    bootThenType()
    expect(await r.pause()).toEqual({ ok: true, empty: true })
    expect((await r.resume()).ok).toBe(true)
    expect(ide.sendToPlay).not.toHaveBeenCalled()
    expect(ide.playFromStart).toHaveBeenCalledTimes(2)
    bootThenType('east')
    await r.stop()
    expect(solutionCommands(useSolutions().text.value!)).toEqual(['east'])
  })

  it('refuses to start a session while a save is still replaying', async () => {
    let release: (v: unknown) => void = () => {}
    const r = useSolutionRecorder()
    await r.record()
    bootThenType('north')
    _generate.mockImplementationOnce(() => new Promise(res => (release = res as (v: unknown) => void)) as never)
    const pausing = r.pause()
    expect(r.saving.value).toBe(true)
    const res = await r.resume()
    expect(res.ok).toBe(false)
    expect(r.state.value).toBe('paused')
    release({ ok: true, text: formatSolution('Test Game', 'Opening.', [{ command: 'north', output: '' }]) })
    await pausing
  })

  it('a failed save offers Retry save; loading a file drops the unsaved commands', async () => {
    const r = useSolutionRecorder()
    await r.record()
    bootThenType('north')
    _generate.mockResolvedValueOnce({ ok: false, message: 'Boom.' } as never)
    const res = await r.pause()
    expect(res.ok).toBe(false)
    expect(r.hasUnsaved.value).toBe(true)
    expect(r.notice.value).toMatch(/Retry save/)
    expect((await r.retrySave()).ok).toBe(true)
    expect(r.hasUnsaved.value).toBe(false)
    expect(solutionCommands(useSolutions().text.value!)).toEqual(['north'])
    // Fail again, then the author loads a file instead: Stop must not overwrite it.
    await r.resume()
    bootThenType('south')
    _generate.mockResolvedValueOnce({ ok: false, message: 'Boom.' } as never)
    await r.pause()
    expect(r.hasUnsaved.value).toBe(true)
    const loaded = formatSolution('Test Game', 'Opening.', [{ command: 'loaded', output: '' }])
    useSolutions().set(loaded)
    r.discardUnsaved()
    await r.stop()
    expect(useSolutions().text.value).toBe(loaded)
  })

  it('live regenerate never compiles: skipped while the build is stale', async () => {
    vi.useFakeTimers()
    try {
      const r = useSolutionRecorder()
      await r.record()
      _generate.mockClear()
      ide.buildIsCurrent.value = false
      bootThenType('north')
      await vi.advanceTimersByTimeAsync(400)
      expect(_generate).not.toHaveBeenCalled()
      expect(r.state.value).toBe('recording')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a same-language remount while recording gives no reload notice and keeps the mark', async () => {
    const r = useSolutionRecorder()
    await r.record()
    expect(r.noticeAfterReload()).toBe(false)
    expect(_toastAdd).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('frotzsmith:solution-recording')).toBe('1')
  })

  it('a recompile while recording pauses the session and keeps what was played', async () => {
    const r = useSolutionRecorder()
    await r.record()
    bootThenType('north', 'east')
    ide.status.value = 'compiling' // the author's Compile
    usePlayTranscript().reset() // …which blanks the play transcript at once
    expect(r.state.value).toBe('paused')
    expect(r.notice.value).toMatch(/recompiled/i)
    ide.status.value = 'success'
    await flush()
    expect(solutionCommands(useSolutions().text.value!)).toEqual(['north', 'east'])
  })

  it('a game switch stops the session without saving', async () => {
    const r = useSolutionRecorder()
    await r.record()
    bootThenType('north')
    ide.sourceGen.value += 1
    await flush()
    expect(r.state.value).toBe('stopped')
    expect(r.notice.value).toMatch(/different game/i)
    expect(useSolutions().has.value).toBe(false)
  })

  it('restarting Play by hand while recording pauses (and saves) the session', async () => {
    const r = useSolutionRecorder()
    await r.record()
    bootThenType('north')
    ide.playNonce.value += 1 // the author pressed Play
    expect(r.state.value).toBe('paused')
    await flush()
    expect(solutionCommands(useSolutions().text.value!)).toEqual(['north'])
  })

  it('the solution is read-only and regenerates live while recording', async () => {
    vi.useFakeTimers()
    try {
      const r = useSolutionRecorder()
      const s = useSolutions()
      await r.record()
      bootThenType('north')
      expect(s.readOnly.value).toBe(true)
      expect(s.edit('typed').ok).toBe(false)
      await vi.advanceTimersByTimeAsync(400)
      expect(solutionCommands(s.view.value ?? '')).toEqual(['north'])
      // Live text is shown, not saved: a reload would lose it.
      expect(s.has.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a reload while recording leaves a one-time notice', async () => {
    const r = useSolutionRecorder()
    await r.record()
    // Simulate a reload: memory is gone, the tab's session storage is not.
    const state = (globalThis as unknown as { __nuxtStateMap: Map<string, unknown> }).__nuxtStateMap
    state.clear()
    ide = makeIde()
    const after = useSolutionRecorder()
    expect(after.state.value).toBe('stopped')
    expect(after.noticeAfterReload()).toBe(true)
    expect(_toastAdd).toHaveBeenCalledTimes(1)
    expect(after.noticeAfterReload()).toBe(false)
  })

  it('refuses to start when the game does not compile', async () => {
    ide.ensureBuild.mockResolvedValueOnce(false)
    const r = useSolutionRecorder()
    const res = await r.record()
    expect(res.ok).toBe(false)
    expect(r.state.value).toBe('stopped')
  })
})
