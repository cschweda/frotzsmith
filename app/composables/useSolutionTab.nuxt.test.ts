/**
 * useSolutionTab — the Solution tab's logic: the spoiler guard, the sample's
 * solution, and the actions on the game's own solution (happy-dom env).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useLanguage } from './useLanguage'
import { formatSolution, solutionCommands, SOLUTION_MAX } from './solution-text'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('useLanguage', useLanguage)
vi.stubGlobal('useProjectFiles', () => ({ openFile: vi.fn() }))

const _generate = vi.fn(async (commands: string[]) => ({
  ok: true as const,
  text: formatSolution('Test Game', 'Opening.', commands.map(c => ({ command: c, output: `You ${c}.` }))),
}))
vi.stubGlobal('useSolutionGenerator', () => ({ generate: _generate }))

let ide: ReturnType<typeof makeIde>
function makeIde() {
  const state = (globalThis as unknown as { useState: <T>(k: string, i?: () => T) => { value: T } }).useState
  return {
    status: ref('success'),
    result: ref({ ok: true, storyFile: new Uint8Array([1]), storyExt: 'z5' }),
    sourceGen: ref(0),
    playNonce: ref(0),
    buildIsCurrent: ref(true),
    activeTab: ref('solution'),
    storyTitle: ref('Test Game'),
    storyBase: ref('test-game'),
    activeStoryKey: state<string>('frotz:story-key', () => 'game1'),
    loadedSampleId: ref<string | null>(null),
    sampleEdited: ref(false),
    ensureBuild: vi.fn(async () => true),
    sendToPlay: vi.fn(),
    playFromStart: vi.fn(),
  }
}
vi.stubGlobal('useIde', () => ide)

const { usePlayTranscript } = await import('./usePlayTranscript')
vi.stubGlobal('usePlayTranscript', usePlayTranscript)
const { useSolutions } = await import('./useSolutions')
vi.stubGlobal('useSolutions', useSolutions)
const { useSolutionRecorder } = await import('./useSolutionRecorder')
vi.stubGlobal('useSolutionRecorder', useSolutionRecorder)
const { useSolutionTab } = await import('./useSolutionTab')

const own = () => formatSolution('Test Game', 'Opening.', [
  { command: 'north', output: 'You north.' },
  { command: 'oops', output: 'You oops.' },
  { command: 'south', output: 'You south.' },
])

describe('useSolutionTab', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    _generate.mockClear()
    ide = makeIde()
    useLanguage().setLanguage('i6')
  })

  it('shows nothing before Show solution', async () => {
    useSolutions().set(own())
    ide.loadedSampleId.value = 'std-architect-legacy'
    const t = useSolutionTab()
    expect(t.revealed.value).toBe(false)
    expect(t.ownText.value).toBeNull()
    expect(t.sampleText.value).toBeNull()
    expect(_generate).not.toHaveBeenCalled()
    await t.showSolution()
    expect(t.revealed.value).toBe(true)
    expect(t.ownText.value).toBe(own())
    expect(t.sampleText.value).not.toBeNull()
    expect(_generate).toHaveBeenCalledTimes(1)
  })

  it('the spoiler guard comes back for another game', async () => {
    const t = useSolutionTab()
    await t.showSolution()
    ide.activeStoryKey.value = 'game2'
    expect(t.revealed.value).toBe(false)
  })

  it('Make it my solution asks when the game already has one', async () => {
    ide.loadedSampleId.value = 'std-architect-legacy'
    const t = useSolutionTab()
    await t.showSolution()
    expect(t.adoptSample().ok).toBe(true) // nothing to replace: no question
    useSolutions().set(own())
    const asked = t.adoptSample()
    expect(asked).toMatchObject({ ok: false, needsConfirm: true })
    expect(useSolutions().text.value).toBe(own())
    expect(t.adoptSample({ confirmed: true }).ok).toBe(true)
    expect(useSolutions().text.value).toBe(t.sampleText.value)
  })

  it('Regenerate asks first, then drops a deleted > line', async () => {
    const s = useSolutions()
    s.set(own())
    const t = useSolutionTab()
    t.reveal() // only a shown solution can be edited
    s.edit(own().split('\n').filter(l => l !== '> oops').join('\n'))
    expect(await t.regenerate()).toMatchObject({ ok: false, needsConfirm: true })
    expect((await t.regenerate({ confirmed: true })).ok).toBe(true)
    expect(solutionCommands(s.text.value!)).toEqual(['north', 'south'])
    expect(s.text.value).not.toContain('You oops.')
  })

  it('Clear asks first', () => {
    useSolutions().set(own())
    const t = useSolutionTab()
    expect(t.clear()).toMatchObject({ ok: false, needsConfirm: true })
    expect(useSolutions().has.value).toBe(true)
    expect(t.clear({ confirmed: true }).ok).toBe(true)
    expect(useSolutions().has.value).toBe(false)
  })

  it('Copy writes the text to the clipboard', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    useSolutions().set(own())
    const t = useSolutionTab()
    expect((await t.copy()).ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith(own())
  })

  it('Load file reads a .txt, asks before replacing, and refuses one over 1 MiB', async () => {
    const t = useSolutionTab()
    const file = new File([own()], 'mine.txt', { type: 'text/plain' })
    const read = await t.readFile(file)
    expect(read).toEqual({ ok: true, text: own() })
    expect(t.load(own()).ok).toBe(true)
    expect(useSolutions().text.value).toBe(own())
    expect(t.load('other')).toMatchObject({ ok: false, needsConfirm: true })
    expect(t.load('other', { confirmed: true }).ok).toBe(true)
    const big = new File(['x'.repeat(SOLUTION_MAX + 1)], 'big.txt', { type: 'text/plain' })
    const refused = await t.readFile(big)
    expect(refused.ok).toBe(false)
  })

  it('Load file and Clear drop commands a failed save kept', async () => {
    const r = useSolutionRecorder()
    const t = useSolutionTab()
    await r.record()
    usePlayTranscript().reset()
    usePlayTranscript().record('north')
    _generate.mockResolvedValueOnce({ ok: false, message: 'Boom.' } as never)
    await r.stop()
    expect(r.hasUnsaved.value).toBe(true)
    expect(t.load(own()).ok).toBe(true)
    expect(r.hasUnsaved.value).toBe(false)
    expect(t.clear({ confirmed: true }).ok).toBe(true)
    expect(useSolutions().has.value).toBe(false)
  })

  it('Download is named <storyBase>-solution.txt', () => {
    useSolutions().set(own())
    const t = useSolutionTab()
    expect(t.downloadName.value).toBe('test-game-solution.txt')
  })

  describe('what the tab presents (mode)', () => {
    it('sample + no own solution: the sample is the game’s solution; Copy and Download use its text', async () => {
      const writeText = vi.fn(async () => {})
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      ide.loadedSampleId.value = 'std-architect-legacy'
      const t = useSolutionTab()
      expect(t.mode.value).toBe('sample')
      await t.showSolution()
      expect(t.mode.value).toBe('sample')
      expect(t.sampleText.value).not.toBeNull()
      expect((await t.copy()).ok).toBe(true)
      expect(writeText).toHaveBeenCalledWith(t.sampleText.value)
      expect(useSolutions().has.value).toBe(false) // nothing was adopted
    })

    it('sample + own solution: the own solution wins', async () => {
      ide.loadedSampleId.value = 'std-architect-legacy'
      useSolutions().set(own())
      const t = useSolutionTab()
      await t.showSolution()
      expect(t.mode.value).toBe('own')
      expect(t.ownText.value).toBe(own())
    })

    it('non-sample + none: nothing to show', async () => {
      const t = useSolutionTab()
      await t.showSolution()
      expect(t.mode.value).toBe('none')
      expect((await t.copy()).ok).toBe(false)
    })

    it('Make it my solution turns the mode to own', async () => {
      ide.loadedSampleId.value = 'std-architect-legacy'
      const t = useSolutionTab()
      await t.showSolution()
      expect(t.adoptSample().ok).toBe(true)
      expect(t.mode.value).toBe('own')
    })

    it('a sample with an unknown walkthrough falls back to none', () => {
      ide.loadedSampleId.value = 'no-such-sample'
      expect(useSolutionTab().mode.value).toBe('none')
    })

    it('every sample in both languages is the sample mode and makes a non-empty solution', async () => {
      const { SAMPLES } = await import('~/modules/inform6/samples')
      const { ZIL_SAMPLES } = await import('~/modules/languages/zil/samples')
      for (const s of [...SAMPLES, ...ZIL_SAMPLES]) {
        localStorage.clear()
        ide = makeIde()
        ide.loadedSampleId.value = s.id
        const t = useSolutionTab()
        expect(t.mode.value, s.id).toBe('sample')
        await t.showSolution()
        expect(t.sampleText.value, s.id).toBeTruthy()
      }
    })
  })
})
