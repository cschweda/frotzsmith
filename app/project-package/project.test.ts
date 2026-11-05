import { describe, expect, it } from 'vitest'
import { createTree, addPath } from '../composables/skein-tree'
import { writeContainer, readContainer, LIMITS } from './container'
import { PackageError } from './errors'
import { TEST_LIMITS, readProjectPackage, splitPackable, writeProjectPackage, type ProjectSnapshot } from './project'

const enc = new TextEncoder()
const now = new Date('2026-11-09T09:41:12.000Z')
const o = { generator: 'Frotzsmith test', now }

function snapshot(): ProjectSnapshot {
  const { tree } = addPath(createTree(), ['north', 'take lamp'])
  return {
    language: 'i6',
    main: { name: 'haunted-house.inf', text: 'Constant Story "Haunted";\r\n! héllo ✓\n' },
    includes: [{ path: 'ext/lamp.h', text: '! lamp\n' }],
    extensions: ['ext/lamp.h', 'bundled.h'],
    tests: [
      { name: "Walk to the cellar", text: 'north\ndown\n' },
      { name: 'Win!', text: 'win\n' },
      { name: 'win', text: 'win again\n' },
      { name: '???', text: 'a\n' },
      { name: '!!!', text: 'b\n' },
    ],
    skein: tree,
    settings: { target: 'z5', library: 'puny' },
    title: 'Haunted House',
    opaque: [
      { path: 'notes/readme.md', bytes: enc.encode('# hi') },
      { path: 'art/cover.bin', bytes: new Uint8Array([0, 1, 2, 255]) },
    ],
    manifestExtra: { 'com.example.color': 'teal', author: 'A. Writer' },
    created: '2026-11-04T14:05:00Z',
  }
}

/** Build a package from raw named entries (manifest as an object or raw bytes). */
function pkg(manifest: unknown | Uint8Array | null, files: Record<string, string | Uint8Array> = {}) {
  const entries = Object.entries(files).map(([path, v]) => ({ path, bytes: typeof v === 'string' ? enc.encode(v) : v }))
  if (manifest !== null) {
    entries.unshift({
      path: 'frotzsmith.json',
      bytes: manifest instanceof Uint8Array ? manifest : enc.encode(JSON.stringify(manifest)),
    })
  }
  return writeContainer(entries)
}
const m = (extra: Record<string, unknown> = {}) => ({
  format: 'frotzsmith-package', version: '0.1', language: 'i6', main: 'g.inf', ...extra,
})
const refusal = async (bytes: Uint8Array) => {
  try {
    await readProjectPackage(bytes)
  } catch (e) {
    expect(e).toBeInstanceOf(PackageError)
    return (e as PackageError).message
  }
  throw new Error('expected a PackageError')
}

describe('round trip', () => {
  it('loses nothing', async () => {
    const p = snapshot()
    const { project, ignored, hashMismatches } = await readProjectPackage(await writeProjectPackage(p, o))
    expect(ignored).toEqual([])
    expect(hashMismatches).toEqual([])
    // Test names are display names; the colliding ones keep theirs.
    expect(project).toEqual(p)
    expect(project.manifestExtra['com.example.color']).toBe('teal')
  })

  it('is stable on a second pass', async () => {
    const first = await readProjectPackage(await writeProjectPackage(snapshot(), o))
    const again = await readProjectPackage(await writeProjectPackage(first.project, o))
    expect(again.project).toEqual(first.project)
  })

  it('names colliding tests -2, -3 and falls back to script', async () => {
    const bytes = await writeProjectPackage(snapshot(), o)
    const paths = [...readContainer(bytes).keys()]
    expect(paths).toEqual(expect.arrayContaining([
      'tests/walk-to-the-cellar.txt', 'tests/win.txt', 'tests/win-2.txt', 'tests/script.txt', 'tests/script-2.txt',
    ]))
  })

  // Review I-1: a slug can be a Windows device name, which the path rules
  // refuse — the writer steps around it instead of failing the download.
  it('names a test whose slug is a Windows device name with a "_", and it reopens', async () => {
    const p = {
      ...snapshot(),
      tests: [
        { name: 'Con', text: 'a\n' }, { name: 'nul', text: 'b\n' }, { name: 'COM1', text: 'c\n' }, { name: 'Aux!', text: 'd\n' },
      ],
    }
    const bytes = await writeProjectPackage(p, o)
    expect([...readContainer(bytes).keys()]).toEqual(expect.arrayContaining([
      'tests/con_.txt', 'tests/nul_.txt', 'tests/com1_.txt', 'tests/aux_.txt',
    ]))
    const { project } = await readProjectPackage(bytes)
    expect(project.tests).toEqual(p.tests)
  })

  it('sets created to the write time when the snapshot has none, and keeps it', async () => {
    const p = { ...snapshot(), created: undefined }
    const { project } = await readProjectPackage(await writeProjectPackage(p, o))
    expect(project.created).toBe('2026-11-09T09:41:12.000Z')
    const later = await writeProjectPackage(project, { ...o, now: new Date('2027-01-01T00:00:00Z') })
    expect((await readProjectPackage(later)).project.created).toBe('2026-11-09T09:41:12.000Z')
  })

  it('records hashes for every entry but mimetype and the manifest, and sets skein', async () => {
    const files = readContainer(await writeProjectPackage(snapshot(), o))
    const man = JSON.parse(new TextDecoder().decode(files.get('frotzsmith.json')!))
    expect(Object.keys(man.files).sort()).toEqual([...files.keys()].filter(k => k !== 'frotzsmith.json').sort())
    expect(man.files['haunted-house.inf']).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(man.skein).toBe('haunted-house.skein')
    expect(man.modified).toBe('2026-11-09T09:41:12.000Z')
  })

  it('never writes compiled stories', async () => {
    const p = { ...snapshot(), opaque: [{ path: 'out/g.Z5', bytes: new Uint8Array([1]) }] }
    expect([...readContainer(await writeProjectPackage(p, o)).keys()]).not.toContain('out/g.Z5')
  })

  it('treats .h as opaque in a ZIL project', async () => {
    const bytes = pkg(m({ language: 'zil', main: 'g.zil' }), { 'g.zil': '<ROUTINE GO ()>', 'x.h': 'hi' })
    const { project } = await readProjectPackage(bytes)
    expect(project.includes).toEqual([])
    expect(project.opaque.map(f => f.path)).toEqual(['x.h'])
  })
})

describe('skein path and test extras', () => {
  const treeA = () => addPath(createTree(), ['a']).tree
  const sk = (tree: unknown) => JSON.stringify({ v: 1, lang: 'i6', storyKey: 'k', tree })

  it('keeps a manifest skein path and survives a stray <stem>.skein (open, save, reopen)', async () => {
    const first = await readProjectPackage(
      pkg(m({ skein: 'other.skein' }), { 'g.inf': 'x', 'g.skein': 'junk', 'other.skein': sk(treeA()) }),
    )
    expect(first.project.skeinPath).toBe('other.skein')
    const again = await readProjectPackage(await writeProjectPackage(first.project, o))
    expect(again.project.skein).toEqual(first.project.skein)
    expect(again.project.opaque.map(f => f.path)).toEqual(['g.skein'])
    expect(again.project.opaque[0]!.bytes).toEqual(enc.encode('junk'))
  })

  it('steps around an invalid G.skein kept as opaque when a Skein is recorded', async () => {
    const first = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'G.skein': '{"tree":{}}' }))
    const withSkein = { ...first.project, skein: treeA() }
    const bytes = await writeProjectPackage(withSkein, o)
    expect([...readContainer(bytes).keys()]).toEqual(expect.arrayContaining(['G.skein', 'g-2.skein']))
    const again = await readProjectPackage(bytes)
    expect(again.project.skein).toEqual(withSkein.skein)
    expect(again.project.opaque.map(f => f.path)).toEqual(['G.skein'])
    const third = await readProjectPackage(await writeProjectPackage(again.project, o))
    expect(third.project.skein).toEqual(withSkein.skein)
  })

  it('keeps unknown fields inside tests[] entries', async () => {
    const man = m({ tests: [{ name: 'T', path: 'tests/t.txt', 'com.example.note': 'keep me' }] })
    const first = await readProjectPackage(pkg(man, { 'g.inf': 'x', 'tests/t.txt': 'go\n' }))
    expect(first.project.tests[0]!.extra).toEqual({ 'com.example.note': 'keep me' })
    const again = await readProjectPackage(await writeProjectPackage(first.project, o))
    expect(again.project.tests).toEqual(first.project.tests)
    const files = readContainer(await writeProjectPackage(first.project, o))
    const out = JSON.parse(new TextDecoder().decode(files.get('frotzsmith.json')!))
    expect(out.tests[0]['com.example.note']).toBe('keep me')
  })
})

describe('writer limits', () => {
  it('refuses a project the reader would refuse', async () => {
    const big = 'x'.repeat(LIMITS.entryBytes + 1)
    const p = { ...snapshot(), main: { name: 'a.inf', text: big } }
    await expect(writeProjectPackage(p, o)).rejects.toThrow(/too large to save as a package/)
  })

  it('refuses when the total is over 32 MB', async () => {
    const opaque = Array.from({ length: 5 }, (_, i) => {
      const b = new Uint8Array(7 * 1024 * 1024)
      crypto.getRandomValues(b.subarray(0, 65536))
      return { path: `f${i}.bin`, bytes: b }
    })
    await expect(writeProjectPackage({ ...snapshot(), opaque }, o)).rejects.toThrow(/limit is 32 MB/)
  })

  it('refuses too many entries', async () => {
    const opaque = Array.from({ length: 2000 }, (_, i) => ({ path: `f${i}.bin`, bytes: new Uint8Array([1]) }))
    await expect(writeProjectPackage({ ...snapshot(), opaque }, o)).rejects.toThrow(/too large to save as a package/)
  })

  it('refuses NUL in a text file', async () => {
    const p = { ...snapshot(), main: { name: 'a.inf', text: 'a\u0000b' } }
    await expect(writeProjectPackage(p, o)).rejects.toThrow(/NUL/)
  })
})

describe('reading hostile or odd packages', () => {
  it('lists a .z5 as ignored and does not keep it', async () => {
    const { project, ignored } = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'build/G.Z5': 'zzz', 'a.ulx': 'u' }))
    expect(ignored.sort()).toEqual(['a.ulx', 'build/G.Z5'])
    expect(project.opaque).toEqual([])
  })

  it('refuses a missing manifest', async () => {
    expect(await refusal(pkg(null, { 'g.inf': 'x' }))).toMatch(/no frotzsmith\.json/)
  })

  it('refuses a wrong format', async () => {
    expect(await refusal(pkg(m({ format: 'nope' }), { 'g.inf': 'x' }))).toMatch(/format isn't "frotzsmith-package"/)
  })

  it('refuses a missing main with the exact sentence', async () => {
    expect(await refusal(pkg(m(), {}))).toBe("The project's manifest points at a file that isn't in it: “g.inf”.")
  })

  it('refuses a .zil main for an i6 project', async () => {
    expect(await refusal(pkg(m({ main: 'g.zil' }), { 'g.zil': 'x' }))).toMatch(/must end \.inf/)
  })

  it('refuses invalid UTF-8 in main', async () => {
    expect(await refusal(pkg(m(), { 'g.inf': new Uint8Array([0xff, 0xfe, 0x41]) }))).toMatch(/“g\.inf” isn't valid UTF-8/)
  })

  it('refuses NUL in a test', async () => {
    const bytes = pkg(m(), { 'g.inf': 'x', 'tests/a.txt': 'a\u0000' })
    expect(await refusal(bytes)).toMatch(/“tests\/a\.txt” contains a NUL/)
  })

  it('refuses a newer major version with the exact sentence', async () => {
    expect(await refusal(pkg(m({ version: '1.0' }), { 'g.inf': 'x' })))
      .toBe('This project was made by a newer Frotzsmith (format 1.0). Update Frotzsmith to open it.')
  })

  it('accepts a higher 0.minor', async () => {
    await expect(readProjectPackage(pkg(m({ version: '0.9' }), { 'g.inf': 'x' }))).resolves.toBeTruthy()
  })

  it('refuses a manifest path that is unsafe or missing', async () => {
    expect(await refusal(pkg(m({ skein: '../x' }), { 'g.inf': 'x' }))).toMatch(/unsafe name/)
    expect(await refusal(pkg(m({ tests: [{ name: 'a', path: 'tests/a.txt' }] }), { 'g.inf': 'x' })))
      .toBe("The project's manifest points at a file that isn't in it: “tests/a.txt”.")
  })

  it('refuses wrong field types without crashing', async () => {
    for (const bad of [{ main: 5 }, { title: 3 }, { tests: 'x' }, { tests: [null] }, { extensions: [1] },
      { files: [] }, { language: 'c' }, { target: 'z6' }, { version: 1 }, { skein: {} }]) {
      expect(await refusal(pkg(m(bad), { 'g.inf': 'x' }))).toMatch(/\.$/)
    }
  })

  it('refuses a manifest that is not an object, not JSON, has a BOM, or is over 1 MB', async () => {
    const files = { 'g.inf': 'x' }
    expect(await refusal(pkg(enc.encode('[]'), files))).toMatch(/isn't a JSON object/)
    expect(await refusal(pkg(enc.encode('{nope'), files))).toMatch(/isn't valid JSON/)
    expect(await refusal(pkg(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), files))).toMatch(/byte-order mark/)
    const big = enc.encode(JSON.stringify(m({ pad: 'a'.repeat(1024 * 1024) })))
    expect(await refusal(pkg(big, files))).toMatch(/larger than 1 MB/)
  })

  it('refuses one file used for two purposes', async () => {
    expect(await refusal(pkg(m({ skein: 'g.inf' }), { 'g.inf': 'x' }))).toMatch(/one file for two purposes/)
  })

  it('reports a tampered entry and a missing listed file, without refusing', async () => {
    const good = await writeProjectPackage(snapshot(), o)
    const files = readContainer(good)
    const tampered = [...files].map(([path, bytes]) =>
      ({ path, bytes: path === 'ext/lamp.h' ? enc.encode('! evil\n') : bytes }))
      .filter(e => e.path !== 'notes/readme.md')
    const { hashMismatches } = await readProjectPackage(writeContainer(tampered))
    expect(hashMismatches.sort()).toEqual(['ext/lamp.h', 'notes/readme.md'])
  })

  it('opens unlisted tests/*.txt named from the file stem', async () => {
    const { project } = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'tests/Smoke Test.txt': 'go\n' }))
    expect(project.tests).toEqual([{ name: 'Smoke Test', text: 'go\n' }])
  })

  it('uses <stem>.skein when the manifest has no skein field', async () => {
    const tree = snapshot().skein
    const skein = JSON.stringify({ v: 1, lang: 'i6', storyKey: 'k', tree })
    const { project } = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'g.skein': skein }))
    expect(project.skein).toEqual(tree)
  })

  it('prefers the manifest skein over <stem>.skein', async () => {
    const mk = (cmd: string) => JSON.stringify({ v: 1, lang: 'i6', storyKey: 'k', tree: addPath(createTree(), [cmd]).tree })
    const { project } = await readProjectPackage(
      pkg(m({ skein: 'other.skein' }), { 'g.inf': 'x', 'g.skein': mk('a'), 'other.skein': mk('b') }),
    )
    expect(Object.values(project.skein!.nodes).map(n => n.command)).toContain('b')
    expect(project.opaque.map(f => f.path)).toEqual(['g.skein'])
  })

  it('keeps an invalid Skein as opaque and reports it as not opened (not as an ignored story file)', async () => {
    const { project, ignored, skeinNotOpened } = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'g.skein': '{"tree":{}}' }))
    expect(project.skein).toBeNull()
    expect(ignored).toEqual([])
    expect(skeinNotOpened).toBe('g.skein')
    expect(project.opaque.map(f => f.path)).toEqual(['g.skein'])
  })

  it('a valid Skein is not reported; no Skein at all is not reported', async () => {
    const skein = JSON.stringify({ v: 1, lang: 'i6', storyKey: 'k', tree: snapshot().skein })
    expect((await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'g.skein': skein }))).skeinNotOpened).toBeNull()
    expect((await readProjectPackage(pkg(m(), { 'g.inf': 'x' }))).skeinNotOpened).toBeNull()
  })

  it('a Skein over 10,000 nodes is not opened but is kept (the package still opens)', async () => {
    const root = { id: 'r', command: '', parentId: null, childIds: [] as string[], status: 'unblessed' }
    const nodes: Record<string, unknown> = { r: root }
    for (let i = 0; i < 10_000; i++) {
      root.childIds.push(`n${i}`)
      nodes[`n${i}`] = { id: `n${i}`, command: 'z', parentId: 'r', childIds: [], status: 'unblessed' }
    }
    const big = JSON.stringify({ v: 1, tree: { root: 'r', nodes } })
    const { project, skeinNotOpened } = await readProjectPackage(pkg(m({ skein: 'big.skein' }), { 'g.inf': 'x', 'big.skein': big }))
    expect(project.skein).toBeNull()
    expect(skeinNotOpened).toBe('big.skein')
    expect(project.opaque.map(f => f.path)).toEqual(['big.skein'])
  })

  it('keeps a __proto__ manifest field as plain data', async () => {
    const raw = enc.encode('{"format":"frotzsmith-package","version":"0.1","language":"i6","main":"g.inf","__proto__":{"x":1}}')
    const { project } = await readProjectPackage(pkg(raw, { 'g.inf': 'x' }))
    expect(Object.keys(project.manifestExtra)).toEqual(['__proto__'])
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })
})

// F3 / F4: a package's Skein is rebuilt from known fields only.
describe('a package Skein is sanitized (F3, F4)', () => {
  const doc = (tree: unknown) => JSON.stringify({ v: 1, lang: 'i6', storyKey: 'k', tree })

  // vue-keys2.ts: these ids crashed the Skein panel and every later open.
  it.each(['__v_isReactive', '__v_isShallow', '__v_skip', '__proto__'])('a node id %j: not opened, kept as a hidden file', async (bad) => {
    const tree = { root: 'r', nodes: {
      r: { id: 'r', command: '', parentId: null, childIds: [bad], status: 'unblessed' },
      [bad]: { id: bad, command: 'look', parentId: 'r', childIds: [], status: 'unblessed' },
    } }
    const r = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'g.skein': doc(tree) }))
    expect(r.project.skein).toBeNull()
    expect(r.skeinNotOpened).toBe('g.skein')
    expect(r.project.opaque.map(f => f.path)).toEqual(['g.skein'])
  })

  // vref.ts
  it('a __v_isRef/value pair is dropped: the opened node is the checked one', async () => {
    const tree = { root: 'r', nodes: {
      r: { id: 'r', command: '', parentId: null, childIds: ['a'], status: 'unblessed' },
      a: { id: 'a', command: 'look', parentId: 'r', childIds: [], status: 'unblessed', __v_isRef: true, value: { command: 'quit' } },
    } }
    const r = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'g.skein': doc(tree) }))
    expect(r.project.skein!.nodes.a).toEqual({ id: 'a', command: 'look', parentId: 'r', childIds: [], status: 'unblessed' })
  })

  // deep.ts: the victim could no longer download their project.
  it('20,000-deep junk in a node field is dropped, and the project downloads', async () => {
    const D = 20_000
    const sk = `{"v":1,"tree":{"root":"r","nodes":{"r":{"id":"r","command":"","parentId":null,"childIds":[],"status":"unblessed","x":${'['.repeat(D)}${']'.repeat(D)}}}}}`
    const r = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'g.skein': sk }))
    // Nested past 64 levels: the document is not opened (kept), as for the manifest.
    expect(r.project.skein).toBeNull()
    expect(r.skeinNotOpened).toBe('g.skein')
    const bytes = await writeProjectPackage(r.project, o)
    expect(readContainer(bytes).get('g.skein')).toBeDefined()
  })

  it('shallow unknown node fields are dropped', async () => {
    const tree = { root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [], status: 'unblessed', x: [[1]] } } }
    const r = await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'g.skein': doc(tree) }))
    expect(r.project.skein).toEqual({ root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [], status: 'unblessed' } } })
  })
})

// F13: a package's test scripts land in localStorage, so they are capped.
describe('test-script caps (F13)', () => {
  it('the caps are 200 scripts and 1 MiB of script text', () => {
    expect(TEST_LIMITS).toEqual({ scripts: 200, totalBytes: 1024 * 1024 })
  })

  const many = (n: number, listed: boolean) => {
    const files: Record<string, string> = { 'g.inf': 'x' }
    const tests: { name: string; path: string }[] = []
    for (let i = 0; i < n; i++) {
      files[`tests/t${i}.txt`] = 'look\n'
      if (listed) tests.push({ name: `T${i}`, path: `tests/t${i}.txt` })
    }
    return pkg(m(listed ? { tests } : {}), files)
  }

  it.each([true, false])('opens exactly 200 scripts (listed in the manifest: %s)', async (listed) => {
    expect((await readProjectPackage(many(200, listed))).project.tests).toHaveLength(200)
  })

  it.each([true, false])('refuses 201 scripts whole (listed in the manifest: %s)', async (listed) => {
    expect(await refusal(many(201, listed))).toBe('This project has more test scripts than Frotzsmith can open (200).')
  })

  it('refuses 1,997 scripts (the audit probe)', async () => {
    expect(await refusal(many(1997, false))).toMatch(/more test scripts/)
  })

  it('refuses more than 1 MiB of script text in all', async () => {
    const big = 'look\n'.repeat(Math.ceil((512 * 1024 + 1) / 5)) // > 512 KiB each
    expect(await refusal(pkg(m(), { 'g.inf': 'x', 'tests/a.txt': big, 'tests/b.txt': big })))
      .toBe('This project’s test scripts are larger than Frotzsmith can keep (1 MB in all).')
    // 1 MiB exactly is fine.
    const half = 'x'.repeat(512 * 1024)
    expect((await readProjectPackage(pkg(m(), { 'g.inf': 'x', 'tests/a.txt': half, 'tests/b.txt': half }))).project.tests).toHaveLength(2)
  })

  it('the writer refuses the same, so a download always reopens', async () => {
    const s = snapshot()
    const tests = Array.from({ length: 201 }, (_, i) => ({ name: `T${i}`, text: 'look\n' }))
    await expect(writeProjectPackage({ ...s, tests }, o)).rejects.toThrow(/more than 200 test scripts/)
    await expect(writeProjectPackage({ ...s, tests: tests.slice(0, 200) }, o)).resolves.toBeInstanceOf(Uint8Array)
    const big = [{ name: 'a', text: 'x'.repeat(1024 * 1024 + 1) }]
    await expect(writeProjectPackage({ ...s, tests: big }, o)).rejects.toThrow(/1 MB/)
  })
})

// Review I-2/m-6: files an older Frotzsmith kept under names the reader now
// refuses are left out of a download (and stay in the browser), never fail it.
describe('splitPackable', () => {
  const items = (...paths: string[]) => paths.map(path => ({ path }))
  it('keeps safe, distinct paths in order', () => {
    const r = splitPackable(items('notes/a.md', 'art/b.png'), ['g.inf'])
    expect(r.kept.map(i => i.path)).toEqual(['notes/a.md', 'art/b.png'])
    expect(r.leftOut).toEqual([])
  })
  it.each([
    ['a Windows character', 'a:b.txt'],
    ['a device name', 'CON.txt'],
    ['a bidi control', 'x\u202etxt.exe'],
    ['a trailing dot', 'notes.'],
  ])('leaves out a path with %s', (_label, path) => {
    expect(splitPackable(items(path, 'ok.md')).leftOut.map(i => i.path)).toEqual([path])
  })
  it('leaves out a later path that collides ignoring case, with a taken path too', () => {
    const r = splitPackable(items('Notes.md', 'notes.MD', 'G.INF', 'Frotzsmith.json'), ['g.inf'])
    expect(r.kept.map(i => i.path)).toEqual(['Notes.md'])
    expect(r.leftOut.map(i => i.path)).toEqual(['notes.MD', 'G.INF', 'Frotzsmith.json'])
  })
  it('leaves out a file where a folder is needed, and the reverse', () => {
    const r = splitPackable(items('art', 'art/x.png', 'tests', 'g.inf/z'), ['g.inf'], ['tests'])
    expect(r.kept.map(i => i.path)).toEqual(['art'])
    expect(r.leftOut.map(i => i.path)).toEqual(['art/x.png', 'tests', 'g.inf/z'])
  })
})
