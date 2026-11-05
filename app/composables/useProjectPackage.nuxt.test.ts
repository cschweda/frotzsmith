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
import { useZilProjectFiles } from './useZilProjectFiles'
import { useLanguage } from './useLanguage'
import { useSkein } from './useSkein'
import { useOutsideSource } from './outside-source'
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
vi.stubGlobal('useZilProjectFiles', useZilProjectFiles)
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
    // Outside source: no Skein auto-run until the author plays or runs it (F2).
    expect(useOutsideSource().untrusted.value).toBe(true)

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

  it('a Skein with a single command is downloaded (only a root-only tree is "no Skein")', async () => {
    const ide = await boot()
    ide.loadSource(HAUNTED)
    await settle() // the story-key switch restores this game's (empty) Skein first
    useSkein().addCommand(useSkein().tree.value.root, 'xyzzy')
    await settle()
    expect(Object.keys(useSkein().tree.value.nodes)).toHaveLength(2)
    const back = await readProjectPackage((await useProjectPackage().buildPackage()).bytes)
    expect(back.project.skein).toEqual(useSkein().tree.value)
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

describe('useProjectPackage — hidden files belong to the opened game only', () => {
  async function openRich(p = richSnapshot()) {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(p)))
    await settle()
    return pkg
  }
  function expectNoExtras(project: ProjectSnapshot) {
    expect(project.opaque).toEqual([])
    expect(project.manifestExtra).toEqual({})
    expect(project.created).not.toBe('2026-01-02T03:04:05.000Z')
    expect(project.skeinPath).toBeUndefined()
    expect(project.main.name).not.toBe('haunted.inf')
    expect(project.extensions).not.toContain('com.other:thing')
    expect(project.tests.some(t => t.extra)).toBe(false)
  }

  it('open → edit → download still keeps them', async () => {
    const pkg = await openRich()
    useIde().source.value += '! an edit\n'
    await settle()
    const back = await readProjectPackage((await pkg.buildPackage()).bytes)
    expect(back.project.opaque).toEqual(richSnapshot().opaque)
    expect(back.project.manifestExtra).toEqual(richSnapshot().manifestExtra)
  })

  it('a same-titled .inf loaded afterwards does not inherit them', async () => {
    const pkg = await openRich()
    useIde().loadSource(`${HAUNTED}! another game, same title\n`)
    await settle()
    expect(useIde().activeStoryKey.value).toBe('haunted-house')
    expectNoExtras((await readProjectPackage((await pkg.buildPackage()).bytes)).project)
    await boot() // nor after a reload
    expectNoExtras((await readProjectPackage((await useProjectPackage().buildPackage()).bytes)).project)
  })

  it('an untitled package does not leak into New Project (same "untitled" key)', async () => {
    const p = { ...richSnapshot(), main: { name: 'haunted.inf', text: '[ Main; ];\n' } }
    delete p.title
    const pkg = await openRich(p)
    expect(useIde().activeStoryKey.value).toBe('untitled')
    useIde().newProject('std')
    await settle()
    expect(useIde().activeStoryKey.value).toBe('untitled')
    expectNoExtras((await readProjectPackage((await pkg.buildPackage()).bytes)).project)
  })

  it('a same-titled sample loaded afterwards does not inherit them', async () => {
    const pkg = await openRich()
    await useIde().loadSample('std-haunted-house')
    await settle()
    expect(useIde().activeStoryKey.value).toBe('haunted-house')
    expectNoExtras((await readProjectPackage((await pkg.buildPackage()).bytes)).project)
  })
})

describe('useProjectPackage — a package with no test scripts', () => {
  it("downloads with none, though the IDE shows its starter script", async () => {
    await boot()
    const p = { ...richSnapshot(), tests: [] }
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(p)))
    await settle()
    expect(useTestScripts().scripts.value.map(s => s.name)).toEqual(['Script 1'])
    expect((await readProjectPackage((await pkg.buildPackage()).bytes)).project.tests).toEqual([])
    await boot()
    expect((await readProjectPackage((await useProjectPackage().buildPackage()).bytes)).project.tests).toEqual([])
  })

  it('a script the author adds afterwards is downloaded', async () => {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf({ ...richSnapshot(), tests: [] })))
    await settle()
    useTestScripts().addFromText('Mine', 'look\n')
    expect((await readProjectPackage((await pkg.buildPackage()).bytes)).project.tests.map(t => t.name)).toEqual(['Script 1', 'Mine'])
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
      useProjectPackage().apply({ project, ignored: [], hashMismatches: [], skeinNotOpened: null, hiddenCount: 2, hiddenNames: [], extensions: [] }),
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
    expect(err.code).toBe('include-name-clash')
    expect(err.message).toBe("This project has two include files the browser editor can't keep apart: “a/lamp.h” and “b/lamp.h”.")
    await settle()
    expect(ideState()).toEqual(before)
  })

  // F1 (redteam i6override.mjs): a package could replace VerbLib.h, Parser.h…
  // for every later game.
  it.each(['VerbLib.h', 'ext/parser.h', 'Grammar.H', 'puny.h', 'globals.h'])('an include named like a library file (%s) is refused whole', async (path) => {
    await boot()
    const before = ideState()
    const evil = { ...richSnapshot(), includes: [{ path, text: '! evil' }], extensions: [path] }
    const err = await useProjectPackage().inspect(await fileOf(evil)).catch(e => e)
    expect(err).toBeInstanceOf(PackageError)
    expect(err.code).toBe('library-name-clash')
    await settle()
    expect(ideState()).toEqual(before)
  })

  it('apply re-checks the library names too', async () => {
    await boot()
    const before = ideState()
    const pkg = useProjectPackage()
    const p = await pkg.inspect(await fileOf(richSnapshot()))
    const tampered = { ...p, project: { ...p.project, includes: [{ path: 'VerbLib.h', text: '! evil' }] } }
    await expect(pkg.apply(tampered)).rejects.toBeInstanceOf(PackageError)
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
    expect(await pkg.needsConfirm()).toBe(false)
    ide.source.value += '\n! edited\n'
    expect(await pkg.needsConfirm()).toBe(true)
  })

  it('is false on the ZIL skeleton and an empty editor', async () => {
    const ide = await boot('zil')
    const pkg = useProjectPackage()
    expect(await pkg.needsConfirm()).toBe(false)
    ide.source.value = '  \n'
    expect(await pkg.needsConfirm()).toBe(false)
  })
})

describe('useProjectPackage — needsConfirm with uploaded extensions (RF 3)', () => {
  async function pending(includes: { path: string; text: string }[]) {
    return useProjectPackage().inspect(await fileOf({ ...richSnapshot(), includes, extensions: [] }))
  }

  it('asks over a pristine source when the open would replace different uploads', async () => {
    await boot()
    useExtensions().addUploaded('keep.h', 'mine')
    const pkg = useProjectPackage()
    expect(await pkg.needsConfirm()).toBe(false) // source alone is pristine
    expect(await pkg.needsConfirm(await pending([{ path: 'lamp.h', text: 'x' }]))).toBe(true)
    expect(await pkg.needsConfirm(await pending([{ path: 'keep.h', text: 'changed' }]))).toBe(true)
    expect(await pkg.needsConfirm(await pending([]))).toBe(true) // zero includes vs uploads
    expect(await pkg.needsConfirm(await pending([{ path: 'keep.h', text: 'mine' }, { path: 'b.h', text: '' }]))).toBe(true)
  })

  it('does not name the uploads as replaced when they are the same', async () => {
    await boot()
    const pkg = useProjectPackage()
    expect(await pkg.whatOpenReplaces(await pending([{ path: 'lamp.h', text: 'x' }]))).toEqual([])
    useExtensions().addUploaded('keep.h', 'mine')
    expect(await pkg.whatOpenReplaces(await pending([{ path: 'sub/keep.h', text: 'mine' }]))).toEqual([])
  })

  // F1: a package that installs or enables any extension always asks first —
  // extensions are used by every Inform 6 game in this browser.
  it('always asks when the package installs or enables an extension, even over nothing', async () => {
    await boot()
    const pkg = useProjectPackage()
    const p = await pending([{ path: 'lamp.h', text: 'x' }])
    expect(p.extensions).toEqual(['lamp.h'])
    expect(await pkg.needsConfirm(p)).toBe(true)
    // Enabling a bundled one counts too.
    const bundled = await pkg.inspect(await fileOf({ ...richSnapshot(), includes: [], extensions: ['ordinals'] }))
    expect(bundled.extensions).toEqual(['ordinals'])
    expect(await pkg.needsConfirm(bundled)).toBe(true)
    // No extensions at all: nothing to ask about.
    const none = await pkg.inspect(await fileOf({ ...richSnapshot(), includes: [], extensions: ['com.other:thing'] }))
    expect(none.extensions).toEqual([])
    expect(await pkg.needsConfirm(none)).toBe(false)
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

describe('useProjectPackage — needsConfirm for the game the package opens under (item 4)', () => {
  /** Leave work under the 'haunted-house' bucket, then move to a pristine editor. */
  async function workUnderHaunted(make: () => void | Promise<void>) {
    const ide = await boot()
    ide.loadSource(HAUNTED)
    await settle()
    await make()
    await settle()
    ide.newProject('std') // blank source: pristine
    await settle()
    expect(ide.activeStoryKey.value).toBe('untitled')
  }

  it('asks when that game already has test scripts of its own', async () => {
    await workUnderHaunted(() => { useTestScripts().addFromText('Mine', 'xyzzy\n') })
    const pkg = useProjectPackage()
    const p = await pkg.inspect(await fileOf(richSnapshot()))
    expect(await pkg.needsConfirm(p)).toBe(true)
    expect(await pkg.whatOpenReplaces(p)).toEqual(['the test scripts saved for “Haunted House”'])
  })

  it('asks when that game already has a Skein of its own', async () => {
    await workUnderHaunted(() => { useSkein().addCommand(useSkein().tree.value.root, 'stale') })
    const pkg = useProjectPackage()
    const p = await pkg.inspect(await fileOf(richSnapshot()))
    expect(await pkg.needsConfirm(p)).toBe(true)
    expect(await pkg.whatOpenReplaces(p)).toEqual(['the Skein saved for “Haunted House”'])
  })

  it('names everything an open replaces', async () => {
    await workUnderHaunted(() => {
      useTestScripts().addFromText('Mine', 'xyzzy\n')
      useSkein().addCommand(useSkein().tree.value.root, 'stale')
    })
    useIde().source.value = '! my work\n'
    useExtensions().addUploaded('keep.h', 'mine')
    const pkg = useProjectPackage()
    const p = await pkg.inspect(await fileOf(richSnapshot()))
    expect(await pkg.whatOpenReplaces(p)).toEqual([
      'the source in the editor',
      'your uploaded extensions',
      'the test scripts saved for “Haunted House”',
      'the Skein saved for “Haunted House”',
    ])
  })

  it('does not ask when that game only has the starter script and no Skein', async () => {
    await workUnderHaunted(() => {})
    const pkg = useProjectPackage()
    expect(await pkg.needsConfirm(await pkg.inspect(await fileOf({ ...richSnapshot(), includes: [], extensions: [] })))).toBe(false)
  })

  it('does not ask when reopening the same package (its scripts and Skein are what is stored)', async () => {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(richSnapshot())))
    await settle()
    useIde().newProject('std')
    useExtensions().replaceUploaded([], []) // only the game-scoped stores are under test here
    await settle()
    expect(await pkg.whatOpenReplaces(await pkg.inspect(await fileOf({ ...richSnapshot(), includes: [], extensions: [] })))).toEqual([])
  })

  it('a display-unsafe title is neutralised in the description', async () => {
    const title = 'Evil\u202Egnp.exe'
    const src = `Constant Story "${title}";\n`
    const ide = await boot()
    ide.loadSource(src)
    await settle()
    useTestScripts().addFromText('Mine', 'xyzzy\n')
    await settle()
    ide.newProject('std')
    await settle()
    const pkg = useProjectPackage()
    const p = await pkg.inspect(await fileOf({ ...richSnapshot(), main: { name: 'e.inf', text: src }, title, includes: [], extensions: [] }))
    expect(await pkg.whatOpenReplaces(p)).toEqual(['the test scripts saved for “Evil\ufffdgnp.exe”'])
  })
})

/** Every key in the extras IndexedDB store. */
function extrasKeys(): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('frotzsmith-extras', 1)
    open.onupgradeneeded = () => { open.result.createObjectStore('opaque') }
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const req = open.result.transaction('opaque', 'readonly').objectStore('opaque').getAllKeys()
      req.onsuccess = () => { open.result.close(); resolve(req.result) }
      req.onerror = () => reject(req.error)
    }
  })
}

describe('useProjectPackage — the extras store holds only the opened project (item 5)', () => {
  it('opening A then B (different titles) leaves only B’s record', async () => {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(richSnapshot())))
    await settle()
    expect(await extrasKeys()).toEqual(['i6:haunted-house'])
    const other = { ...richSnapshot(), main: { name: 'o.inf', text: 'Constant Story "Other Game";\n' }, title: 'Other Game' }
    await pkg.apply(await pkg.inspect(await fileOf(other)))
    await settle()
    expect(await extrasKeys()).toEqual(['i6:other-game'])
  })

  it('loading another source deletes the record', async () => {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(richSnapshot())))
    await settle()
    useIde().loadSource('Constant Story "Plain";\n')
    await settle()
    expect(await extrasKeys()).toEqual([])
  })

  it('a failed save leaves the download without extras (never an older record)', async () => {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(richSnapshot())))
    await settle()
    // Reopen the same game, but the extras write fails.
    const realPut = IDBObjectStore.prototype.put
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'opaque') throw new DOMException('quota', 'QuotaExceededError')
      return realPut.apply(this, args)
    })
    const changed = { ...richSnapshot(), opaque: [{ path: 'notes/new.md', bytes: new TextEncoder().encode('new') }] }
    await pkg.apply(await pkg.inspect(await fileOf(changed)))
    await settle()
    put.mockRestore()
    const back = (await readProjectPackage((await pkg.buildPackage()).bytes)).project
    expect(back.opaque).toEqual([])
    expect(back.manifestExtra).toEqual({})
  })
})

// F1 + F15: what the open dialog and the toasts can name.
describe('useProjectPackage — the extensions and hidden files an open brings', () => {
  it('inspect lists the extensions it installs or enables, and the hidden files it carries', async () => {
    await boot()
    const p = await useProjectPackage().inspect(await fileOf(richSnapshot()))
    expect(p.extensions).toEqual(['ext/lamp.h', 'Rope.h', 'ordinals'])
    expect(p.hiddenNames).toEqual(['notes/ideas.md', 'art/cover.png'])
    expect(p.hiddenCount).toBe(2)
  })

  it('an unopened Skein is not listed as a hidden file (it has its own line)', async () => {
    await boot()
    const snap = { ...richSnapshot(), skein: null, skeinPath: undefined, opaque: [{ path: 'haunted.skein', bytes: new TextEncoder().encode('{') }] }
    const p = await useProjectPackage().inspect(await fileOf(snap))
    expect(p.skeinNotOpened).toBe('haunted.skein')
    expect(p.hiddenNames).toEqual([])
  })

  it('buildPackage reports the hidden files it wrote back', async () => {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(richSnapshot())))
    await settle()
    expect((await pkg.buildPackage()).hidden).toEqual(['notes/ideas.md', 'art/cover.png'])
    await boot()
    useIde().loadSource(HAUNTED + '! other\n')
    await settle()
    expect((await useProjectPackage().buildPackage()).hidden).toEqual([])
  })
})

// Review I-1: names the writer builds itself never hit the device-name rule.
describe('useProjectPackage — generated names that are Windows device names', () => {
  it('a title, a test and uploads named like devices download with a "_" and reopen', async () => {
    const ide = await boot()
    ide.loadSource('Constant Story "Aux";\n[ Initialise; ];\n')
    await settle()
    const ext = useExtensions()
    ext.addUploaded('aux.h', '! a\n')
    ext.addUploaded('COM1.h', '! c\n')
    ext.addUploaded('nul', '! n\n')
    useTestScripts().addFromText('Con', 'look\n')
    await settle()

    const { bytes } = await useProjectPackage().buildPackage()
    const back = await readProjectPackage(bytes)
    expect(back.project.main.name).toBe('aux_.inf')
    expect(back.project.includes.map(i => i.path).sort()).toEqual(['COM1_.h', 'aux_.h', 'nul_.h'])
    expect(back.project.tests.map(t => t.name)).toContain('Con')
    // …and the browser editor opens it too.
    await boot()
    const pending = await useProjectPackage().inspect(new File([bytes as Uint8Array<ArrayBuffer>], 'aux.frotzsmith'))
    expect(pending.project.main.text).toContain('"Aux"')
  })
})

// Review I-2 + m-6: what an older Frotzsmith stored under names the reader now
// refuses is left out of the download — and stays in the browser.
describe('useProjectPackage — files the reader would refuse are left out, not lost', () => {
  const LEGACY = 'frotzsmith:i6:extensions'
  async function withLegacy() {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(richSnapshot())))
    await settle()
    // A record an older version wrote: hidden files with names now refused.
    const { getExtrasStore } = await import('./project-extras-store')
    const rec = (await getExtrasStore().load('i6:haunted-house'))!
    rec.entries = [
      ...rec.entries,
      { path: 'a:b.txt', bytes: new TextEncoder().encode('colon') },
      { path: 'CON.txt', bytes: new TextEncoder().encode('device') },
      { path: 'x‮txt.exe', bytes: new TextEncoder().encode('bidi') },
    ]
    expect(await getExtrasStore().save('i6:haunted-house', rec)).toBe(true)
    // …and a library-named upload stored before audit F1.
    const stored = JSON.parse(localStorage.getItem(LEGACY)!)
    stored.uploaded.push({ id: 'uploaded:VerbLib', name: 'VerbLib', title: 'VerbLib.h', content: '! patched\n' })
    stored.enabled.push('uploaded:VerbLib')
    localStorage.setItem(LEGACY, JSON.stringify(stored))
    await boot()
    return getExtrasStore
  }

  it('the download leaves them out, names them, and reopens', async () => {
    const getExtrasStore = await withLegacy()
    const pkg = useProjectPackage()
    const { bytes, hidden, leftOut } = await pkg.buildPackage()
    expect(leftOut).toEqual(['VerbLib.h', 'a:b.txt', 'CON.txt', 'x‮txt.exe'])
    expect(hidden).toEqual(['notes/ideas.md', 'art/cover.png'])
    const back = await readProjectPackage(bytes)
    expect(back.project.includes.map(i => i.path)).toEqual(['ext/lamp.h', 'Rope.h'])
    expect(back.project.extensions).not.toContain('VerbLib.h')
    await boot()
    await expect(useProjectPackage().inspect(new File([bytes as Uint8Array<ArrayBuffer>], 'h.frotzsmith'))).resolves.toBeTruthy()
    // Nothing was deleted from the browser.
    expect(localStorage.getItem(LEGACY)).toContain('! patched')
    expect((await getExtrasStore().load('i6:haunted-house'))!.entries.map(e => e.path)).toContain('a:b.txt')
  })
})

// Invariant (review I-1/I-2): whatever the browser holds, a download reopens.
describe('useProjectPackage — every download reopens', () => {
  it.each([
    ['a device-name title', 'Constant Story "nul";\n'],
    ['an untitled source', '[ Initialise; ];\n'],
    ['a title that slugs to nothing', 'Constant Story "???";\n'],
  ])('%s', async (_label, src) => {
    const ide = await boot()
    ide.loadSource(src)
    await settle()
    useExtensions().addUploaded('prn.h', '! p\n')
    useExtensions().addUploaded('Lamp.h', '! l\n')
    for (const n of ['aux', 'CON', 'Script', 'lpt1']) useTestScripts().addFromText(n, 'x\n')
    await settle()
    const { bytes } = await useProjectPackage().buildPackage()
    const back = await readProjectPackage(bytes)
    expect(back.project.main.text).toBe(src)
    await boot()
    await expect(useProjectPackage().inspect(new File([bytes as Uint8Array<ArrayBuffer>], 'p.frotzsmith'))).resolves.toBeTruthy()
  })
})

// Re-review N-1/N-2/N-3: legacy stored data in colliding combinations.
describe('useProjectPackage — every download reopens, whatever the browser holds', () => {
  const KEY = 'frotzsmith:i6:extensions'
  const up = (name: string, title: string) => ({ id: `uploaded:${name}`, name, title, content: `! ${name}\n` })

  it('device names, library names, duplicate paths and include-name twins', async () => {
    await boot()
    const pkg = useProjectPackage()
    await pkg.apply(await pkg.inspect(await fileOf(richSnapshot())))
    await settle()
    const { getExtrasStore } = await import('./project-extras-store')
    const rec = (await getExtrasStore().load('i6:haunted-house'))!
    const b = (s: string) => new TextEncoder().encode(s)
    rec.entries = [
      ...rec.entries,
      { path: 'CON.txt', bytes: b('device') },
      { path: 'Notes/Ideas.MD', bytes: b('twin of notes/ideas.md') },
      { path: 'haunted.inf/x', bytes: b('file as folder') },
      { path: 'tests', bytes: b('file where tests/ goes') },
    ]
    expect(await getExtrasStore().save('i6:haunted-house', rec)).toBe(true)
    localStorage.setItem(KEY, JSON.stringify({
      uploaded: [
        up('aux', 'aux.h'), // written aux_.h (renamed)
        up('aux_', 'sub/aux_.h'), // Include name aux_ again → left out (N-1)
        up('con', 'con.h'), // written con_.h (renamed)
        up('con_', 'con_.h'), // same path → left out
        up('VerbLib', 'VerbLib.h'), // library name → left out
        up('Lamp', 'Lamp.h'),
        up('lamp', 'lamp.h'), // same path ignoring case → left out
      ],
      // Only left-out twins enabled (and Lamp): the kept files must not come back enabled (N-3).
      enabled: ['uploaded:aux_', 'uploaded:con_', 'uploaded:Lamp'],
    }))
    await boot()

    const { bytes, leftOut, renamed } = await useProjectPackage().buildPackage()
    expect(leftOut).toEqual(['VerbLib.h', 'sub/aux_.h', 'con_.h', 'lamp.h', 'CON.txt', 'Notes/Ideas.MD', 'haunted.inf/x', 'tests'])
    expect(renamed).toEqual([{ from: 'aux.h', to: 'aux_.h' }, { from: 'con.h', to: 'con_.h' }])
    const back = await readProjectPackage(bytes)
    expect(back.project.includes.map(i => i.path)).toEqual(['aux_.h', 'con_.h', 'Lamp.h'])
    expect(back.project.includes.find(i => i.path === 'con_.h')!.text).toBe('! con\n')
    expect(back.project.extensions).toContain('Lamp.h')
    expect(back.project.extensions).not.toContain('aux_.h')
    expect(back.project.extensions).not.toContain('con_.h')
    await boot()
    await expect(useProjectPackage().inspect(new File([bytes as Uint8Array<ArrayBuffer>], 'h.frotzsmith'))).resolves.toBeTruthy()
    expect(localStorage.getItem(KEY)).toContain('sub/aux_.h') // nothing deleted
  })
})
