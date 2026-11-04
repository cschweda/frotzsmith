/**
 * useProjectPackage — Download / Open a `.frotzsmith` project (happy-dom env).
 *
 * Runs against the REAL state composables (source, extensions, test scripts,
 * Skein, language) with real localStorage and fake-indexeddb, so a "page
 * reload" is: drop the in-memory state, then restore from storage. Stubbed
 * seams: the compiler and the replay engine (spied — opening a package must
 * never start either), transcripts/map (no worker), and toasts.
 *
 * Pinned (plan Task 4, Review Focus 2–5):
 *   - open → download keeps every file, unknown field, script, Skein node and setting
 *   - … and still does after a page reload (hidden files live in IndexedDB)
 *   - a package for the other language is refused by inspect, nothing changes
 *   - includes over the 4 MiB extension budget are refused by inspect, nothing changes
 *   - needsConfirm() is false on the language seed, true after an edit
 *   - apply compiles, plays and replays nothing
 */
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

import { useSourceDocument } from './useSourceDocument'
import { useExtensions } from './useExtensions'
import { useProjectFiles } from './useProjectFiles'
import { useTestScripts } from './useTestScripts'
import { useLanguage } from './useLanguage'
import { useSkein } from './useSkein'
import { resetStorageNoticeForTests } from './useStorageNotice'
import { addPath, blessThread, createTree, type SkeinTree } from './skein-tree'
import { readProjectPackage, writeProjectPackage, type ProjectSnapshot } from '~/project-package/project'
import { PackageError } from '~/project-package/errors'
import { ZipLimitError, EXTENSIONS_TOTAL_MAX_BYTES } from '~/utils/zip-limits'
import demoSource from '~/modules/inform6/samples/demo.inf?raw'
import zilSkeletonSource from '~/modules/languages/zil/samples/skeleton.zil?raw'

vi.stubGlobal('useSourceDocument', useSourceDocument)
vi.stubGlobal('useExtensions', useExtensions)
vi.stubGlobal('useProjectFiles', useProjectFiles)
vi.stubGlobal('useTestScripts', useTestScripts)
vi.stubGlobal('useLanguage', useLanguage)
vi.stubGlobal('useSkein', useSkein)

// The two things opening a package must never start.
const _compile = vi.fn()
vi.stubGlobal('useCompiler', () => ({ compile: _compile }))
const _replay = vi.fn(() => ({ promise: new Promise(() => {}), cancel: vi.fn() }))
vi.stubGlobal('useReplay', () => ({ replay: _replay }))

const _transcriptRun = vi.fn()
vi.stubGlobal('useTranscript', () => ({ reset: vi.fn(), run: _transcriptRun, cancel: vi.fn() }))
vi.stubGlobal('usePlayTranscript', () => ({ reset: vi.fn(), commands: ref([]), record: vi.fn() }))
vi.stubGlobal('useMap', () => ({ reset: vi.fn() }))
const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

const { useIde } = await import('./useIde')
vi.stubGlobal('useIde', useIde)
const { useProjectPackage } = await import('./useProjectPackage')

const stateMap = (window as unknown as { __nuxtStateMap: Map<string, unknown> }).__nuxtStateMap

/** Let watchers, debounced saves and IndexedDB settle. */
async function settle(ms = 20) {
  await new Promise(r => setTimeout(r, ms))
  await useSkein().flushSaves()
  await new Promise(r => setTimeout(r, ms))
}

/** A page load for `lang`: fresh in-memory state, then restore from storage. */
async function boot(lang: 'i6' | 'zil' = 'i6') {
  // A real reload kills the autosave timer; here it is module-level and would
  // fire into the NEXT page's state — write it out under the old state first.
  if (stateMap.size) useSourceDocument().flushPendingSave()
  stateMap.clear()
  useLanguage().setLanguage(lang)
  const ide = useIde()
  ide.restore()
  await useSkein().restore()
  await settle()
  return ide
}

const HAUNTED = 'Constant Story "Haunted House";\nConstant Headline "^A test.^";\nInclude "Parser";\n[ Initialise; ];\n'

function skeinOf(...threads: string[][]): SkeinTree {
  let t = createTree()
  for (const th of threads) t = addPath(t, th).tree
  return t
}

/** A snapshot that exercises every field — including all the ones the IDE can't show. */
function richSnapshot(): ProjectSnapshot {
  return {
    language: 'i6',
    main: { name: 'haunted.inf', text: HAUNTED },
    includes: [
      { path: 'ext/lamp.h', text: '! lamp\n[ Lamp; ];\n' },
      { path: 'Rope.h', text: '! rope\n' },
    ],
    extensions: ['ordinals', 'ext/lamp.h', 'com.other:thing'],
    tests: [
      { name: 'Walkthrough', text: 'north\ntake lamp\n', extra: { 'com.example.note': 'fast' } },
      { name: 'Death', text: 'jump\n' },
    ],
    skein: skeinOf(['north', 'take lamp'], ['south']),
    skeinPath: 'skeins/main.skein',
    settings: { target: 'z5', library: 'puny' },
    title: 'Haunted House',
    opaque: [
      { path: 'notes/ideas.md', bytes: new TextEncoder().encode('# ideas\n') },
      { path: 'art/cover.png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255]) },
    ],
    manifestExtra: { 'com.example.color': 'teal', author: 'A. Writer' },
    created: '2026-01-02T03:04:05.000Z',
  }
}

async function fileOf(p: ProjectSnapshot, name = 'haunted.frotzsmith'): Promise<File> {
  const bytes = await writeProjectPackage(p, { generator: 'test', now: new Date('2026-02-02T00:00:00Z') })
  return new File([bytes as Uint8Array<ArrayBuffer>], name)
}

/** Everything a refused open must leave untouched. */
function ideState() {
  const ide = useIde()
  const ext = useExtensions()
  return JSON.parse(JSON.stringify({
    source: ide.source.value,
    key: ide.activeStoryKey.value,
    target: ide.targetMode.value,
    profile: ide.profileMode.value,
    uploaded: ext.uploaded.value,
    enabled: ext.enabledFiles.value.map(f => f.name),
    scripts: useTestScripts().scripts.value,
    tree: useSkein().tree.value,
    storage: { ...localStorage },
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('indexedDB', new IDBFactory())
  resetStorageNoticeForTests()
})

describe('useProjectPackage — round trip (RF 2)', () => {
  it('open → download keeps every file, unknown field, script, Skein node and setting', async () => {
    await boot()
    const original = richSnapshot()
    const pkg = useProjectPackage()
    const pending = await pkg.inspect(await fileOf(original))
    expect(pending.hiddenCount).toBe(2)
    await pkg.apply(pending)
    await settle()

    // The IDE shows what it can…
    const ide = useIde()
    expect(ide.source.value).toBe(HAUNTED)
    expect(ide.activeStoryKey.value).toBe('haunted-house')
    expect(ide.targetMode.value).toBe('z5')
    expect(ide.profileMode.value).toBe('puny')
    expect(useTestScripts().scripts.value.map(s => s.name)).toEqual(['Walkthrough', 'Death'])
    expect(useSkein().tree.value).toEqual(original.skein)
    expect(useExtensions().enabledFiles.value.map(f => f.name).sort()).toEqual(['lamp', 'ordinals'])

    // …and the next download gives back everything.
    const { bytes, filename } = await pkg.buildPackage()
    expect(filename).toBe('haunted-house-puny.frotzsmith')
    const back = await readProjectPackage(bytes)
    expect(back.project).toEqual(original)
    expect(back.hashMismatches).toEqual([])
  })

  it('a download built from scratch reopens to the same project', async () => {
    const ide = await boot()
    ide.loadSource(HAUNTED)
    useExtensions().addUploaded('lamp.h', '[ Lamp; ];\n')
    useTestScripts().addFromText('Walk', 'north\n')
    useSkein().addCommand(useSkein().tree.value.root, 'xyzzy')
    ide.setTargetMode('z8')
    await settle()

    const pkg = useProjectPackage()
    const first = await readProjectPackage((await pkg.buildPackage()).bytes)
    expect(first.project.includes).toEqual([{ path: 'lamp.h', text: '[ Lamp; ];\n' }])
    expect(first.project.extensions).toEqual(['lamp.h'])
    expect(first.project.settings).toEqual({ target: 'z8', library: 'auto' })

    await boot() // somewhere else
    await pkg.apply(await pkg.inspect(await fileOf(first.project)))
    await settle()
    const second = await readProjectPackage((await pkg.buildPackage()).bytes)
    expect(second.project).toEqual(first.project)
  })

  it('hidden files survive a page reload and go back into the next download', async () => {
    await boot()
    const original = richSnapshot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(original)))
    await settle()

    await boot() // reload: memory gone, storage kept
    expect(useIde().source.value).toBe(HAUNTED)
    const back = await readProjectPackage((await useProjectPackage().buildPackage()).bytes)
    expect(back.project).toEqual(original)
  })

  it("the package's Skein wins over one already stored for that game", async () => {
    // A stale Skein under the key the package will land on.
    let ide = await boot()
    ide.loadSource(HAUNTED)
    await settle()
    useSkein().addCommand(useSkein().tree.value.root, 'stale')
    await settle()

    // Elsewhere: the open moves the story key, and the key watcher's restore
    // of the stale bucket must not overwrite the package's Skein.
    ide = await boot()
    ide.loadSource('Constant Story "Other";\n')
    await settle()
    const original = richSnapshot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(original)))
    expect(ide.activeStoryKey.value).toBe('haunted-house')
    await settle(50)
    expect(useSkein().tree.value).toEqual(original.skein)
    await boot()
    expect(useSkein().tree.value).toEqual(original.skein)
  })
})

describe('useProjectPackage — refusals change nothing', () => {
  it('a ZIL package on the Inform 6 editor is refused by inspect (RF 4)', async () => {
    const ide = await boot()
    ide.source.value = `${demoSource}\n! my edit\n`
    await settle()
    const before = ideState()
    const zil: ProjectSnapshot = {
      ...richSnapshot(),
      language: 'zil',
      main: { name: 'g.zil', text: zilSkeletonSource },
      includes: [],
      settings: { target: 'z3' },
    }
    const pkg = useProjectPackage()
    const err = await pkg.inspect(await fileOf(zil)).catch(e => e)
    expect(err).toBeInstanceOf(PackageError)
    expect(err.message).toBe('This is a ZIL project — open it from the ZIL editor.')
    await settle()
    expect(ideState()).toEqual(before)
  })

  it('an Inform 6 package on the ZIL editor is refused by inspect', async () => {
    await boot('zil')
    const before = ideState()
    const err = await useProjectPackage().inspect(await fileOf(richSnapshot())).catch(e => e)
    expect(err).toBeInstanceOf(PackageError)
    expect(err.message).toBe('This is an Inform 6 project — open it from the Inform 6 editor.')
    await settle()
    expect(ideState()).toEqual(before)
  })

  it('includes over the uploaded-extension budget are refused by inspect (RF 5)', async () => {
    await boot()
    const before = ideState()
    const half = 'x'.repeat(Math.ceil(EXTENSIONS_TOTAL_MAX_BYTES / 2) + 1)
    const big: ProjectSnapshot = {
      ...richSnapshot(),
      includes: [{ path: 'a.h', text: half }, { path: 'b.h', text: half }],
    }
    const err = await useProjectPackage().inspect(await fileOf(big)).catch(e => e)
    expect(err).toBeInstanceOf(ZipLimitError)
    expect(err.message).toMatch(/4 MB/)
    await settle()
    expect(ideState()).toEqual(before)
  })

  it('apply re-checks before writing anything — a hand-made over-budget open throws, nothing changes', async () => {
    await boot()
    const before = ideState()
    const half = 'x'.repeat(Math.ceil(EXTENSIONS_TOTAL_MAX_BYTES / 2) + 1)
    const project = { ...richSnapshot(), includes: [{ path: 'a.h', text: half }, { path: 'b.h', text: half }] }
    await expect(
      useProjectPackage().apply({ project, ignored: [], hashMismatches: [], hiddenCount: 2 }),
    ).rejects.toBeInstanceOf(ZipLimitError)
    await settle()
    expect(ideState()).toEqual(before)
  })

  it('two includes the browser would mount under one name are refused whole', async () => {
    await boot()
    const before = ideState()
    const clash = { ...richSnapshot(), includes: [{ path: 'a/lamp.h', text: '1' }, { path: 'b/lamp.h', text: '2' }] }
    const err = await useProjectPackage().inspect(await fileOf(clash)).catch(e => e)
    expect(err).toBeInstanceOf(PackageError)
    await settle()
    expect(ideState()).toEqual(before)
  })

  it('a renamed plain file is refused with the reader sentence', async () => {
    await boot()
    const err = await useProjectPackage().inspect(new File(['hello'], 'x.frotzsmith')).catch(e => e)
    expect(err).toBeInstanceOf(PackageError)
  })
})

describe('useProjectPackage — needsConfirm (RF 3)', () => {
  it('is false on the Inform 6 demo seed and true after an edit', async () => {
    const ide = await boot()
    expect(ide.source.value.trim()).toBe(demoSource.trim())
    const pkg = useProjectPackage()
    expect(pkg.needsConfirm()).toBe(false)
    ide.source.value += '\n! edited\n'
    expect(pkg.needsConfirm()).toBe(true)
  })

  it('is false on the ZIL skeleton and an empty editor', async () => {
    const ide = await boot('zil')
    const pkg = useProjectPackage()
    expect(pkg.needsConfirm()).toBe(false)
    ide.source.value = '  \n'
    expect(pkg.needsConfirm()).toBe(false)
  })
})

describe('useProjectPackage — nothing runs', () => {
  it('apply starts no compile, Play or replay — even with blessed Skein threads', async () => {
    const ide = await boot()
    const p = richSnapshot()
    p.skein = blessThread(p.skein!, Object.keys(p.skein!.nodes).find(id => p.skein!.nodes[id]!.command === 'take lamp')!)
    const pkg = useProjectPackage()
    const nonce = ide.playNonce.value
    await pkg.apply(await pkg.inspect(await fileOf(p)))
    await settle(50)
    expect(_compile).not.toHaveBeenCalled()
    expect(_replay).not.toHaveBeenCalled()
    expect(_transcriptRun).not.toHaveBeenCalled()
    expect(ide.status.value).toBe('idle')
    expect(ide.result.value).toBeNull()
    expect(ide.playNonce.value).toBe(nonce)
    expect(ide.pendingScript.value).toBeNull()
  })
})

describe('useExtensions.replaceUploaded', () => {
  it('throws ZipLimitError over the budget and changes nothing', async () => {
    await boot()
    const ext = useExtensions()
    ext.addUploaded('keep.h', 'k')
    const before = JSON.stringify([ext.uploaded.value, ext.enabledFiles.value])
    const half = 'x'.repeat(Math.ceil(EXTENSIONS_TOTAL_MAX_BYTES / 2) + 1)
    expect(() => ext.replaceUploaded([{ path: 'a.h', text: half }, { path: 'b.h', text: half }], [])).toThrow(ZipLimitError)
    expect(JSON.stringify([ext.uploaded.value, ext.enabledFiles.value])).toBe(before)
  })
})
