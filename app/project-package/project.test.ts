import { describe, expect, it } from 'vitest'
import { createTree, addPath } from '../composables/skein-tree'
import { writeContainer, readContainer, LIMITS } from './container'
import { PackageError } from './errors'
import { readProjectPackage, writeProjectPackage, type ProjectSnapshot } from './project'

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
