/**
 * useSkein — feeds, runs, compile hook, persistence (happy-dom env).
 *
 * The replay seam is a scripted fake (real worker runs are covered by the
 * replay golden tests); the store is the in-memory impl via vi.mock. What's
 * pinned here: script import builds the tree, a successful compile marks
 * blessed nodes stale and auto-runs them (toggle off → stale stays), play
 * capture walks/extends a cursor that resets on session start, buckets are
 * per game, and export/import round-trips.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createMemorySkeinStore } from './skein-store'
import { pathNodes, type SkeinTree } from './skein-tree'

// One shared memory store across useSkein instances (per-file module mock).
const _memStore = createMemorySkeinStore()
vi.mock('~/composables/skein-store', async (orig) => {
  const mod = (await orig()) as object
  return { ...mod, getSkeinStore: () => _memStore }
})

// Toast sink (storage notice path).
const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

// Language profile (real composable pattern would drag the registry — stub).
const _profile = ref({ id: 'i6', stateKey: 'i6', route: '/' })
vi.stubGlobal('useLanguage', () => ({ profile: _profile }))

// Active test script for importActiveScript().
const _activeScript = ref<{ id: string; name: string; text: string } | undefined>({
  id: 't1',
  name: 'Walkthrough',
  text: 'north. take lamp',
})
vi.stubGlobal('useTestScripts', () => ({ activeScript: _activeScript }))

// Scripted replay fake: output per command comes from _outputs; set
// _failNextReplay to make the next run reject (engine failure path).
let _outputs: Record<string, string> = {}
let _failNextReplay: string | null = null
const _replayCalls: string[][] = []
function fakeReplay(_story: Uint8Array, _target: string, commands: string[]) {
  _replayCalls.push(commands)
  if (_failNextReplay) {
    const message = _failNextReplay
    _failNextReplay = null
    return { promise: Promise.reject(new Error(message)), cancel: vi.fn() }
  }
  const turns = [
    { command: '', output: 'BANNER' },
    ...commands.map(c => ({ command: c, output: _outputs[c] ?? `out:${c}` })),
  ]
  return { promise: Promise.resolve({ turns, ms: 1 }), cancel: vi.fn() }
}
vi.stubGlobal('useReplay', () => ({ replay: fakeReplay }))

const { useSkein } = await import('./useSkein')

/** Fresh shared state per test (the setup harness clears useState between tests). */
function bootIde(storyKey = 'zork') {
  const result = useState<{ ok: boolean; storyFile?: Uint8Array; storyExt: string } | null>(
    'frotz:result',
    () => null,
  )
  const key = useState<string>('frotz:story-key', () => storyKey)
  key.value = storyKey
  return { result, key }
}

function compileSuccess(result: ReturnType<typeof bootIde>['result']) {
  result.value = { ok: true, storyFile: new Uint8Array([1, 2, 3]), storyExt: 'z5' }
}

async function flush(ms = 700) {
  await new Promise(r => setTimeout(r, ms))
}

describe('useSkein', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _outputs = {}
    _failNextReplay = null
    _replayCalls.length = 0
    _profile.value = { id: 'i6', stateKey: 'i6', route: '/' }
  })

  it('importActiveScript builds a thread from the active script', async () => {
    bootIde('game-a')
    const skein = useSkein()
    await skein.restore()
    const added = skein.importActiveScript()
    expect(added).toBe(2)
    expect(Object.keys(skein.tree.value.nodes)).toHaveLength(3) // root + 2
  })

  it('runToNode replays the root path and writes outputs down it', async () => {
    const { result } = bootIde('game-b')
    compileSuccess(result)
    const skein = useSkein()
    await skein.restore()
    skein.importActiveScript()
    const leaf = leafOf(skein.tree.value)
    await skein.runToNode(leaf)
    expect(_replayCalls.at(-1)).toEqual(['north', 'take lamp'])
    expect(pathNodes(skein.tree.value, leaf).at(-1)!.lastOutput).toBe('out:take lamp')
  })

  it('a successful compile marks blessed nodes stale, then auto-runs them green', async () => {
    const { result } = bootIde('game-c')
    compileSuccess(result)
    const skein = useSkein()
    await skein.restore()
    skein.importActiveScript()
    const leaf = leafOf(skein.tree.value)
    await skein.runToNode(leaf)
    skein.blessTo(leaf)

    // New build, same outputs → straight back to match via auto-run.
    compileSuccess(result)
    await flush()
    expect(pathNodes(skein.tree.value, leaf).at(-1)!.status).toBe('match')

    // New build, changed output → diff.
    _outputs['take lamp'] = 'CHANGED'
    compileSuccess(result)
    await flush()
    expect(pathNodes(skein.tree.value, leaf).at(-1)!.status).toBe('diff')
  })

  it('autoRun=false leaves blessed nodes stale after a compile', async () => {
    const { result } = bootIde('game-d')
    compileSuccess(result)
    const skein = useSkein()
    await skein.restore()
    skein.importActiveScript()
    const leaf = leafOf(skein.tree.value)
    await skein.runToNode(leaf)
    skein.blessTo(leaf)
    skein.setAutoRun(false)

    compileSuccess(result)
    await flush()
    expect(pathNodes(skein.tree.value, leaf).at(-1)!.status).toBe('stale')
  })

  it('play capture walks/extends a cursor path; session reset returns to root', async () => {
    bootIde('game-e')
    const skein = useSkein()
    await skein.restore()
    skein.recordPlayCommand('north')
    skein.recordPlayCommand('east')
    expect(Object.keys(skein.tree.value.nodes)).toHaveLength(3)
    skein.resetPlayCursor()
    skein.recordPlayCommand('north') // dedupes into the existing node
    skein.recordPlayCommand('west') // branches at the divergence
    expect(Object.keys(skein.tree.value.nodes)).toHaveLength(4)
  })

  it('a failing run surfaces a toast instead of dying silently', async () => {
    // Found live: a story the replay engine chokes on produced NO signal at
    // all — unblessed dots and nothing else. Run failures must be visible.
    const { result } = bootIde('game-err')
    compileSuccess(result)
    const skein = useSkein()
    await skein.restore()
    skein.importActiveScript()
    const leaf = leafOf(skein.tree.value)

    _failNextReplay = 'GlkOte error: boom'
    await skein.runToNode(leaf)
    expect(_toastAdd).toHaveBeenCalledTimes(1)
    const arg = _toastAdd.mock.calls[0]![0] as { title: string; description: string }
    expect(arg.title).toContain('run failed')
    expect(arg.description).toContain('boom')
  })

  it('buckets are per game: switching story keys swaps trees', async () => {
    const { key } = bootIde('game-f')
    const skein = useSkein()
    await skein.restore()
    skein.recordPlayCommand('only-in-f')
    await flush() // let the debounced save land

    key.value = 'game-g'
    await flush()
    expect(Object.keys(skein.tree.value.nodes)).toHaveLength(1) // fresh bucket

    key.value = 'game-f'
    await flush()
    const commands = Object.values(skein.tree.value.nodes).map(n => n.command)
    expect(commands).toContain('only-in-f')
  })

  it('export/import round-trips a tree', async () => {
    bootIde('game-h')
    const skein = useSkein()
    await skein.restore()
    skein.recordPlayCommand('north')
    const json = skein.exportSkein()
    skein.recordPlayCommand('east')
    expect(skein.importSkein(json)).toBe(true)
    expect(Object.keys(skein.tree.value.nodes)).toHaveLength(2) // back to root + north
    expect(skein.importSkein('{"not":"a skein"}')).toBe(false)
  })
})

function leafOf(tree: SkeinTree): string {
  const leaf = Object.values(tree.nodes).find(n => n.id !== tree.root && n.childIds.length === 0)
  return leaf!.id
}
