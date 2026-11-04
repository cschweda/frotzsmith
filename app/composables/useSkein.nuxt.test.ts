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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, isProxy } from 'vue'
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
/** When true, runs hang until released — lets a test recompile mid-run. */
let _holdReplays = false
const _held: { release: () => void; cancel: ReturnType<typeof vi.fn> }[] = []
function fakeReplay(_story: Uint8Array, _target: string, commands: string[]) {
  _replayCalls.push(commands)
  if (_holdReplays) {
    const outputs = { ..._outputs }
    let resolve!: (v: unknown) => void
    let reject!: (e: unknown) => void
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    const cancel = vi.fn(() => reject(new Error('Replay cancelled')))
    _held.push({
      release: () => resolve({
        turns: [{ command: '', output: 'BANNER' }, ...commands.map(c => ({ command: c, output: outputs[c] ?? `out:${c}` }))],
        ms: 1,
      }),
      cancel,
    })
    return { promise, cancel }
  }
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
    localStorage.clear() // setAutoRun persists 'off' — must not leak across tests
    _outputs = {}
    _failNextReplay = null
    _replayCalls.length = 0
    _holdReplays = false
    _held.length = 0
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

  it('several callers register the session watchers ONCE (one run per compile)', async () => {
    // Real Nuxt useState hands every caller a new ref wrapper; a per-ref guard
    // re-registered for IdeLayout, PlayPanel and SkeinPanel alike.
    const { result } = bootIde('game-once')
    compileSuccess(result)
    const skein = useSkein()
    useSkein()
    useSkein()
    await skein.restore()
    skein.importActiveScript()
    const leaf = leafOf(skein.tree.value)
    await skein.runToNode(leaf)
    skein.blessTo(leaf)
    _replayCalls.length = 0

    compileSuccess(result)
    await flush()
    expect(_replayCalls).toHaveLength(1)
  })

  it('a recompile mid-run cancels the in-flight replay and re-runs against the new build', async () => {
    const { result } = bootIde('game-recompile')
    compileSuccess(result)
    const skein = useSkein()
    await skein.restore()
    skein.importActiveScript()
    const leaf = leafOf(skein.tree.value)
    await skein.runToNode(leaf)
    skein.blessTo(leaf)

    _holdReplays = true
    compileSuccess(result) // build 2 → auto-run starts and hangs
    await flush(50)
    expect(_held).toHaveLength(1)

    _outputs['take lamp'] = 'CHANGED'
    compileSuccess(result) // build 3 while build 2's run is in flight
    await flush(50)
    expect(_held[0]!.cancel).toHaveBeenCalled()
    // The stale verdict from build 2 must NOT land; build 3 re-runs.
    _holdReplays = false
    for (const h of _held) h.release()
    await flush()
    expect(pathNodes(skein.tree.value, leaf).at(-1)!.status).toBe('diff')
    expect(skein.running.value).toBe(false)
  })

  it('cancelRuns stops the in-flight replay and does not toast a failure', async () => {
    const { result } = bootIde('game-cancel')
    compileSuccess(result)
    const skein = useSkein()
    await skein.restore()
    skein.importActiveScript()
    const leaf = leafOf(skein.tree.value)
    _holdReplays = true
    const run = skein.runToNode(leaf)
    await flush(10)
    skein.cancelRuns()
    await run
    expect(_held[0]!.cancel).toHaveBeenCalled()
    expect(_toastAdd).not.toHaveBeenCalled()
    expect(skein.running.value).toBe(false)
  })

  it('importSkein rejects another language\'s skein and malformed nodes', async () => {
    bootIde('game-import')
    const skein = useSkein()
    await skein.restore()
    skein.recordPlayCommand('north')
    const good = JSON.parse(skein.exportSkein())
    expect(skein.importSkein(JSON.stringify({ ...good, lang: 'zil' }))).toBe(false)
    const broken = structuredClone(good)
    const child = Object.keys(broken.tree.nodes).find((id: string) => id !== broken.tree.root)!
    delete broken.tree.nodes[child].childIds
    expect(skein.importSkein(JSON.stringify(broken))).toBe(false)
    const dangling = structuredClone(good)
    dangling.tree.nodes[dangling.tree.root].childIds.push('nope')
    expect(skein.importSkein(JSON.stringify(dangling))).toBe(false)
    expect(skein.importSkein(JSON.stringify(good))).toBe(true)
  })

  // F3: a .skein import is rebuilt from known fields; reserved ids refuse it.
  it('importSkein refuses Vue-reserved node ids and drops unknown fields', async () => {
    bootIde('game-import-f3')
    const skein = useSkein()
    await skein.restore()
    const bad = { v: 1, lang: 'i6', tree: { root: 'r', nodes: {
      r: { id: 'r', command: '', parentId: null, childIds: ['__v_isReactive'], status: 'unblessed' },
      __v_isReactive: { id: '__v_isReactive', command: 'look', parentId: 'r', childIds: [], status: 'unblessed' },
    } } }
    expect(skein.importSkein(JSON.stringify(bad))).toBe(false)
    const withRef = { v: 1, lang: 'i6', tree: { root: 'r', nodes: {
      r: { id: 'r', command: '', parentId: null, childIds: ['a'], status: 'unblessed' },
      a: { id: 'a', command: 'look', parentId: 'r', childIds: [], status: 'unblessed', __v_isRef: true, value: { command: 'quit' } },
    } } }
    expect(skein.importSkein(JSON.stringify(withRef))).toBe(true)
    expect(skein.tree.value.nodes.a).toEqual({ id: 'a', command: 'look', parentId: 'r', childIds: [], status: 'unblessed' })
    expect(skein.commandsTo('a')).toEqual(['look'])
  })

  it('the tree is held raw (never a deep reactive proxy)', async () => {
    bootIde('game-raw')
    const skein = useSkein()
    await skein.restore()
    expect(isProxy(skein.tree.value)).toBe(false)
    skein.recordPlayCommand('north')
    expect(isProxy(skein.tree.value)).toBe(false)
    expect(isProxy(Object.values(skein.tree.value.nodes)[0])).toBe(false)
  })

  it('restore of a poisoned stored tree starts a fresh tree', async () => {
    bootIde('game-poison')
    await _memStore.save('i6:game-poison', { root: 'r', nodes: {
      r: { id: 'r', command: '', parentId: null, childIds: ['__v_skip'], status: 'unblessed' },
      __v_skip: { id: '__v_skip', command: 'look', parentId: 'r', childIds: [], status: 'unblessed' },
    } } as never)
    const skein = useSkein()
    await skein.restore()
    expect(Object.keys(skein.tree.value.nodes)).toHaveLength(1)
  })
})

function leafOf(tree: SkeinTree): string {
  const leaf = Object.values(tree.nodes).find(n => n.id !== tree.root && n.childIds.length === 0)
  return leaf!.id
}

describe('useSkein — flushSaves', () => {
  it('writes every pending bucket save now, without advancing timers', async () => {
    bootIde('game-flush')
    const skein = useSkein()
    await skein.restore()
    skein.recordPlayCommand('north')
    await skein.flushSaves()
    const saved = await _memStore.load(`${_profile.value.stateKey}:game-flush`)
    expect(Object.values(saved!.nodes).map(n => n.command)).toContain('north')
  })
})

describe('useSkein — flushSaves (timers)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('saves each pending bucket exactly once and cancels the timers', async () => {
    vi.useFakeTimers()
    const save = vi.spyOn(_memStore, 'save')
    const { key } = bootIde('flush-a')
    const skein = useSkein()
    skein.recordPlayCommand('north')
    key.value = 'flush-b'
    skein.recordPlayCommand('east')
    save.mockClear()
    await skein.flushSaves()
    const keys = save.mock.calls.map(c => c[0])
    expect(keys.filter(k => k.endsWith(':flush-a'))).toHaveLength(1)
    expect(keys.filter(k => k.endsWith(':flush-b'))).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('waits for a save that already fired', async () => {
    vi.useFakeTimers()
    let release!: (ok: boolean) => void
    vi.spyOn(_memStore, 'save').mockImplementation(
      () => new Promise<boolean>((r) => { release = r }),
    )
    bootIde('flush-inflight')
    const skein = useSkein()
    skein.recordPlayCommand('north')
    await vi.advanceTimersByTimeAsync(500) // timer fires; save hangs
    let done = false
    const p = skein.flushSaves().then(() => { done = true })
    await vi.advanceTimersByTimeAsync(10)
    expect(done).toBe(false)
    release(true)
    await p
    expect(done).toBe(true)
  })
})
