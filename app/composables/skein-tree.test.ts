/**
 * skein-tree — pure tree core (node env).
 *
 * The Skein: each node is a command, each root→node path is a playthrough,
 * the synthetic root is the boot banner (command ''). Outputs are
 * normalizeTurnOutput-ed text; status comes from exact string equality
 * between lastOutput and blessedOutput. See
 * docs/superpowers/specs/2026-07-09-skein-design.md.
 */
import { describe, it, expect } from 'vitest'
import { ref, isReactive } from 'vue'
import {
  sanitizeTree,
  parseSkeinFile,
  SKEIN_FILE_MAX_DEPTH,
  createTree,
  isValidTree,
  addPath,
  pathNodes,
  pathCommands,
  applyRun,
  blessThread,
  unblessSubtree,
  removeSubtree,
  markAllStale,
  blessedLeaves,
  countNodes,
  flattenRows,
  MAX_SKEIN_NODES,
  type SkeinTree,
} from './skein-tree'

/** Build a tree from one script and return the leaf too. */
function treeWith(commands: string[]): { tree: SkeinTree; leafId: string } {
  return addPath(createTree(), commands)
}

/** TurnRecords for a path: banner + one output per command. */
function turnsFor(commands: string[], out: (c: string, i: number) => string) {
  return [
    { command: '', output: 'BANNER' },
    ...commands.map((c, i) => ({ command: c, output: out(c, i) })),
  ]
}

describe('createTree / addPath', () => {
  it('starts with only the synthetic root (banner, command "")', () => {
    const tree = createTree()
    expect(tree.nodes[tree.root]!.command).toBe('')
    expect(tree.nodes[tree.root]!.parentId).toBeNull()
    expect(countNodes(tree)).toBe(0)
  })

  it('addPath creates a chain under the root', () => {
    const { tree, leafId } = treeWith(['north', 'take lamp', 'south'])
    expect(countNodes(tree)).toBe(3)
    expect(pathCommands(tree, leafId)).toEqual(['north', 'take lamp', 'south'])
  })

  it('dedupes a shared prefix and branches at the divergence', () => {
    const a = treeWith(['north', 'take lamp', 'south'])
    const b = addPath(a.tree, ['north', 'take lamp', 'east'])
    // north + take lamp shared; south and east are siblings.
    expect(countNodes(b.tree)).toBe(4)
    const lamp = pathNodes(b.tree, b.leafId)[2]!
    expect(lamp.command).toBe('take lamp')
    expect(lamp.childIds).toHaveLength(2)
  })

  it('dedupe compares trimmed commands', () => {
    const a = treeWith(['north'])
    const b = addPath(a.tree, ['  north  '])
    expect(countNodes(b.tree)).toBe(1)
    expect(b.leafId).toBe(a.leafId)
  })

  it('is immutable — the input tree is not touched', () => {
    const a = treeWith(['north'])
    const before = JSON.stringify(a.tree)
    addPath(a.tree, ['north', 'south'])
    expect(JSON.stringify(a.tree)).toBe(before)
  })

  it('sibling order is creation order', () => {
    const a = treeWith(['x'])
    const b = addPath(a.tree, ['y'])
    const c = addPath(b.tree, ['z'])
    const rootKids = c.tree.nodes[c.tree.root]!.childIds.map(id => c.tree.nodes[id]!.command)
    expect(rootKids).toEqual(['x', 'y', 'z'])
  })
})

describe('applyRun', () => {
  it('aligns turn 0 to the root banner and turn i to path node i', () => {
    const { tree, leafId } = treeWith(['north', 'south'])
    const run = applyRun(tree, leafId, turnsFor(['north', 'south'], c => `saw ${c}`))
    const nodes = pathNodes(run, leafId)
    expect(nodes[0]!.lastOutput).toBe('BANNER')
    expect(nodes[1]!.lastOutput).toBe('saw north')
    expect(nodes[2]!.lastOutput).toBe('saw south')
    expect(nodes[2]!.status).toBe('unblessed')
  })

  it('blessed nodes go match on equal output and diff on change', () => {
    const { tree, leafId } = treeWith(['north'])
    let t = applyRun(tree, leafId, turnsFor(['north'], () => 'out-1'))
    t = blessThread(t, leafId)
    expect(pathNodes(t, leafId)[1]!.status).toBe('match')

    t = applyRun(t, leafId, turnsFor(['north'], () => 'out-2'))
    expect(pathNodes(t, leafId)[1]!.status).toBe('diff')
    expect(pathNodes(t, leafId)[1]!.blessedOutput).toBe('out-1')
    expect(pathNodes(t, leafId)[1]!.lastOutput).toBe('out-2')
  })

  it('a short run (VM quit early) marks unreached BLESSED nodes error', () => {
    const { tree, leafId } = treeWith(['a', 'b', 'c'])
    let t = applyRun(tree, leafId, turnsFor(['a', 'b', 'c'], c => c))
    t = blessThread(t, leafId)
    // Re-run only reaches turn 1 of 3.
    t = applyRun(t, leafId, [
      { command: '', output: 'BANNER' },
      { command: 'a', output: 'a' },
    ])
    const nodes = pathNodes(t, leafId)
    expect(nodes[1]!.status).toBe('match')
    expect(nodes[2]!.status).toBe('error')
    expect(nodes[3]!.status).toBe('error')
  })
})

describe('bless / unbless / stale', () => {
  it('blessThread copies lastOutput only where one exists', () => {
    const { tree, leafId } = treeWith(['a', 'b'])
    const t = blessThread(tree, leafId) // never run — nothing to bless
    expect(pathNodes(t, leafId)[1]!.blessedOutput).toBeUndefined()
    expect(pathNodes(t, leafId)[1]!.status).toBe('unblessed')
  })

  it('markAllStale touches only blessed nodes', () => {
    const a = treeWith(['a', 'b'])
    const b = addPath(a.tree, ['x'])
    let t = applyRun(b.tree, a.leafId, turnsFor(['a', 'b'], c => c))
    t = blessThread(t, a.leafId)
    t = markAllStale(t)
    expect(pathNodes(t, a.leafId)[1]!.status).toBe('stale')
    expect(pathNodes(t, b.leafId)[1]!.status).toBe('unblessed')
  })

  it('markAllStale drops every last output — they belong to the previous build', () => {
    const { tree, leafId } = treeWith(['a', 'b'])
    let t = applyRun(tree, leafId, turnsFor(['a', 'b'], c => c))
    t = markAllStale(t)
    expect(pathNodes(t, leafId).every(n => n.lastOutput === undefined)).toBe(true)
  })

  it('blessing after a recompile cannot bless the previous build\'s output', () => {
    const { tree, leafId } = treeWith(['a', 'b'])
    let t = applyRun(tree, leafId, turnsFor(['a', 'b'], c => `old:${c}`))
    const aId = pathNodes(t, leafId)[1]!.id
    t = blessThread(t, aId) // 'a' blessed with old:a
    t = markAllStale(t)
    t = blessThread(t, leafId) // nothing has run on the new build yet
    const [, a, b] = pathNodes(t, leafId)
    expect(a!.status).toBe('stale')
    expect(b!.blessedOutput).toBeUndefined()
  })

  it('unblessSubtree clears blessing for the node and its descendants', () => {
    const { tree, leafId } = treeWith(['a', 'b'])
    let t = applyRun(tree, leafId, turnsFor(['a', 'b'], c => c))
    t = blessThread(t, leafId)
    const aId = pathNodes(t, leafId)[1]!.id
    t = unblessSubtree(t, aId)
    expect(pathNodes(t, leafId)[1]!.blessedOutput).toBeUndefined()
    expect(pathNodes(t, leafId)[2]!.blessedOutput).toBeUndefined()
    expect(pathNodes(t, leafId)[2]!.status).toBe('unblessed')
  })
})

describe('blessedLeaves', () => {
  it('returns the deepest blessed node per blessed path', () => {
    // Path a-b blessed fully; sibling branch a-x blessed at x.
    const p1 = treeWith(['a', 'b'])
    const p2 = addPath(p1.tree, ['a', 'x'])
    let t = applyRun(p2.tree, p1.leafId, turnsFor(['a', 'b'], c => c))
    t = applyRun(t, p2.leafId, turnsFor(['a', 'x'], c => c))
    t = blessThread(t, p1.leafId)
    t = blessThread(t, p2.leafId)
    const leaves = blessedLeaves(t)
    expect(new Set(leaves)).toEqual(new Set([p1.leafId, p2.leafId]))
  })

  it('a blessed ancestor with no blessed descendants IS a blessed leaf', () => {
    const { tree, leafId } = treeWith(['a', 'b'])
    let t = applyRun(tree, leafId, turnsFor(['a', 'b'], c => c))
    const aId = pathNodes(t, leafId)[1]!.id
    t = blessThread(t, aId) // bless only up to 'a'
    expect(blessedLeaves(t)).toEqual([aId])
  })

  it('is empty for an unblessed tree', () => {
    expect(blessedLeaves(treeWith(['a']).tree)).toEqual([])
  })
})

describe('removeSubtree', () => {
  it('removes a branch and its descendants', () => {
    const a = treeWith(['a', 'b'])
    const b = addPath(a.tree, ['x'])
    const aId = pathNodes(b.tree, a.leafId)[1]!.id
    const t = removeSubtree(b.tree, aId)
    expect(countNodes(t)).toBe(1) // only x remains
    expect(t.nodes[a.leafId]).toBeUndefined()
  })

  it('refuses to remove the root', () => {
    const { tree } = treeWith(['a'])
    expect(removeSubtree(tree, tree.root)).toBe(tree)
  })
})

describe('isValidTree: prototype keys are not nodes', () => {
  for (const root of ['constructor', '__proto__', 'toString']) {
    it(`rejects root "${root}" with no own nodes`, () => {
      expect(isValidTree(JSON.parse(`{"root":"${root}","nodes":{}}`))).toBe(false)
    })
  }
})

describe('isValidTree: shape is a single tree (no cycles, no orphans)', () => {
  const node = (id: string, parentId: string | null, childIds: string[] = []) =>
    ({ id, command: id, parentId, childIds, status: 'unblessed' })
  const tree = (nodes: Record<string, unknown>) => ({ root: 'r', nodes })

  it('rejects a two-node cycle off the root', () => {
    expect(isValidTree(tree({ r: node('r', null), X: node('X', 'Y', ['Y']), Y: node('Y', 'X', ['X']) }))).toBe(false)
  })
  it('rejects a self-parent node', () => {
    expect(isValidTree(tree({ r: node('r', null), X: node('X', 'X', ['X']) }))).toBe(false)
  })
  it('rejects a cycle through the root', () => {
    expect(isValidTree({ root: 'r', nodes: { r: node('r', 'a', ['a']), a: node('a', 'r', ['r']) } })).toBe(false)
  })
  it('rejects an orphan unreachable from the root', () => {
    expect(isValidTree(tree({ r: node('r', null), O: node('O', 'r') }))).toBe(false)
  })
  it('rejects a node listed as a child twice', () => {
    expect(isValidTree(tree({ r: node('r', null, ['a', 'a']), a: node('a', 'r') }))).toBe(false)
  })
  it('accepts a 1,000-node chain, and pathNodes walks it quickly', () => {
    const nodes: Record<string, unknown> = { r: node('r', null, ['n0']) }
    for (let i = 0; i < 1000; i++) nodes[`n${i}`] = node(`n${i}`, i === 0 ? 'r' : `n${i - 1}`, i < 999 ? [`n${i + 1}`] : [])
    const t = tree(nodes)
    expect(isValidTree(t)).toBe(true)
    const start = Date.now()
    expect(pathNodes(t as never, 'n999')).toHaveLength(1001)
    expect(Date.now() - start).toBeLessThan(500)
  })
  it('pathNodes and subtree operations terminate on a hand-built cyclic tree', () => {
    const t = { root: 'r', nodes: { r: node('r', null, ['X']), X: node('X', 'Y', ['Y']), Y: node('Y', 'X', ['X']) } } as never
    expect(pathNodes(t, 'X').length).toBeLessThanOrEqual(2)
    expect(() => unblessSubtree(t, 'X')).not.toThrow()
    expect(() => removeSubtree(t, 'X')).not.toThrow()
    expect(() => blessedLeaves(t)).not.toThrow()
  })
})

describe('isValidTree: size caps (a huge Skein must not break the panel forever)', () => {
  const node = (id: string, parentId: string | null, childIds: string[] = []) =>
    ({ id, command: id, parentId, childIds, status: 'unblessed' })
  /** Root + `n` chained nodes. */
  const chain = (n: number) => {
    const nodes: Record<string, unknown> = { r: node('r', null, n > 0 ? ['n0'] : []) }
    for (let i = 0; i < n; i++) nodes[`n${i}`] = node(`n${i}`, i === 0 ? 'r' : `n${i - 1}`, i < n - 1 ? [`n${i + 1}`] : [])
    return { root: 'r', nodes }
  }
  /** Root + `n` children directly under it (wide, shallow). */
  const wide = (n: number) => {
    const ids = Array.from({ length: n }, (_, i) => `w${i}`)
    const nodes: Record<string, unknown> = { r: node('r', null, ids) }
    for (const id of ids) nodes[id] = node(id, 'r')
    return { root: 'r', nodes }
  }

  it('the cap is 10,000 nodes', () => {
    expect(MAX_SKEIN_NODES).toBe(10_000)
  })
  it('accepts exactly 10,000 nodes (root included)', () => {
    expect(isValidTree(wide(9_999))).toBe(true)
  })
  it('rejects a 10,001-node tree', () => {
    expect(isValidTree(wide(10_000))).toBe(false)
  })
  it('rejects a 60,000-node chain (the reviewer\'s 598 KB package)', () => {
    expect(isValidTree(chain(60_000))).toBe(false)
  })
  it('accepts the deepest chain within the cap', () => {
    expect(isValidTree(chain(9_999))).toBe(true)
  })
})

describe('flattenRows: the panel\'s row list (iterative, root hidden)', () => {
  const node = (id: string, parentId: string | null, childIds: string[] = []) =>
    ({ id, command: id, parentId, childIds, status: 'unblessed' as const })

  it('is depth-first, in sibling order, with depths relative to the root\'s children', () => {
    const t: SkeinTree = { root: 'r', nodes: {
      r: node('r', null, ['a', 'b']), a: node('a', 'r', ['a1']), a1: node('a1', 'a'), b: node('b', 'r'),
    } }
    expect(flattenRows(t, new Set()).map(r => [r.node.id, r.depth, r.hasChildren, r.expanded]))
      .toEqual([['a', 0, true, true], ['a1', 1, false, true], ['b', 0, false, true]])
  })
  it('hides the children of a collapsed node', () => {
    const t: SkeinTree = { root: 'r', nodes: {
      r: node('r', null, ['a', 'b']), a: node('a', 'r', ['a1']), a1: node('a1', 'a'), b: node('b', 'r'),
    } }
    expect(flattenRows(t, new Set(['a'])).map(r => [r.node.id, r.expanded])).toEqual([['a', false], ['b', true]])
  })
  it('walks a 100,000-deep chain without recursion (no stack overflow)', () => {
    const nodes: Record<string, SkeinTree['nodes'][string]> = { r: node('r', null, ['n0']) }
    const N = 100_000
    for (let i = 0; i < N; i++) nodes[`n${i}`] = node(`n${i}`, i === 0 ? 'r' : `n${i - 1}`, i < N - 1 ? [`n${i + 1}`] : [])
    const rows = flattenRows({ root: 'r', nodes }, new Set())
    expect(rows).toHaveLength(N)
    expect(rows[N - 1]!.depth).toBe(N - 1)
  })
  it('terminates on a hand-built cyclic tree', () => {
    const t = { root: 'r', nodes: { r: node('r', null, ['X']), X: node('X', 'Y', ['Y']), Y: node('Y', 'X', ['X']) } }
    expect(flattenRows(t, new Set()).length).toBeLessThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// F3 / F4: every tree that comes from outside (a package, a .skein import,
// IndexedDB) is REBUILT into fresh objects holding only the known fields.
// ---------------------------------------------------------------------------

describe('sanitizeTree: rebuilds an untrusted tree from known fields only', () => {
  const node = (id: string, parentId: string | null, childIds: string[] = [], extra: object = {}) =>
    ({ id, command: id === 'r' ? '' : `cmd-${id}`, parentId, childIds, status: 'unblessed', ...extra })
  const mk = (bad: string) => JSON.parse(JSON.stringify({
    root: 'r',
    nodes: { r: node('r', null, [bad, 'k']), [bad]: node(bad, 'r'), k: node('k', 'r') },
  }))

  it('keeps a good tree, as fresh objects equal to the input', () => {
    const { tree } = addPath(createTree(), ['north', 'take lamp'])
    const out = sanitizeTree(tree)!
    expect(out).toEqual(tree)
    expect(out).not.toBe(tree)
    expect(out.nodes).not.toBe(tree.nodes)
    for (const id of Object.keys(tree.nodes)) {
      expect(out.nodes[id]).not.toBe(tree.nodes[id])
      expect(out.nodes[id]!.childIds).not.toBe(tree.nodes[id]!.childIds)
    }
  })

  it('keeps blessed and last outputs', () => {
    const t = mk('a')
    Object.assign(t.nodes.a, { status: 'match', blessedOutput: 'ok', lastOutput: 'ok' })
    expect(sanitizeTree(t)!.nodes.a).toEqual({ id: 'a', command: 'cmd-a', parentId: 'r', childIds: [], status: 'match', blessedOutput: 'ok', lastOutput: 'ok' })
  })

  // vue-keys.ts / vue-keys2.ts: Vue-reserved and prototype names as node ids.
  it.each(['__v_raw', '__v_isReactive', '__v_skip', '__v_isRef', '__v_isReadonly', '__v_isShallow', '__proto__', '__anything'])(
    'refuses the reserved node id %j',
    (bad) => {
      expect(sanitizeTree(mk(bad))).toBeNull()
    },
  )

  it.each(['a b', 'a/b', 'é', 'x'.repeat(65), '', 'a.b', '<script>'])('refuses the node id %j', (bad) => {
    expect(sanitizeTree(mk(bad))).toBeNull()
  })

  it('refuses a reserved root id', () => {
    expect(sanitizeTree({ root: '__v_skip', nodes: { __v_skip: node('__v_skip', null) } })).toBeNull()
  })

  it.each(['constructor', 'toString', 'hasOwnProperty', 'x'.repeat(64), 'A-b_9'])('accepts the ordinary id %j', (id) => {
    const t = sanitizeTree(mk(id))!
    expect(t).not.toBeNull()
    expect(Object.hasOwn(t.nodes, id)).toBe(true)
  })

  // vref.ts: a node that validates as `look` but, made reactive, showed and
  // replayed `quit`.
  it('drops a __v_isRef / value pair, so the reactive tree shows and replays the checked command', () => {
    const raw = JSON.parse(JSON.stringify({ root: 'r', nodes: {
      r: { id: 'r', command: '', parentId: null, childIds: ['a'], status: 'unblessed' },
      a: { id: 'a', command: 'look', parentId: 'r', childIds: [], status: 'match', blessedOutput: 'ok', lastOutput: 'ok',
        __v_isRef: true, value: { id: 'a', command: 'quit', parentId: 'a', childIds: ['a'], status: 'match' } },
    } }))
    const t = sanitizeTree(raw)!
    expect(Object.keys(t.nodes.a!).sort()).toEqual(['blessedOutput', 'childIds', 'command', 'id', 'lastOutput', 'parentId', 'status'])
    const st = ref<SkeinTree | null>(null)
    st.value = t
    expect(flattenRows(st.value!, new Set()).map(r => r.node.command)).toEqual(['look'])
    expect(pathCommands(st.value!, 'a')).toEqual(['look'])
  })

  // deep.ts: 20,000-deep junk under an unknown node field broke download,
  // JSON save and structuredClone.
  it('drops unknown fields, however deep, so the tree stays serialisable', () => {
    const deep = '['.repeat(20_000) + ']'.repeat(20_000)
    const raw = JSON.parse(`{"root":"r","nodes":{"r":{"id":"r","command":"","parentId":null,"childIds":[],"status":"unblessed","x":${deep}}}}`)
    const t = sanitizeTree(raw)!
    expect(t).toEqual({ root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [], status: 'unblessed' } } })
    expect(() => JSON.stringify(t)).not.toThrow()
    expect(() => structuredClone(t)).not.toThrow()
  })

  it.each([
    ['not an object', 'tree'],
    ['null', null],
    ['an array', []],
    ['no root', { nodes: {} }],
    ['nodes an array', { root: 'r', nodes: [] }],
    ['a node that is not an object', { root: 'r', nodes: { r: 'x' } }],
    ['a non-string command', { root: 'r', nodes: { r: { id: 'r', command: 1, parentId: null, childIds: [], status: 'unblessed' } } }],
    ['a non-string output', { root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [], status: 'unblessed', lastOutput: {} } } }],
    ['an unknown status', { root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [], status: 'bogus' } } }],
    ['a child id that is not a string', { root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [1], status: 'unblessed' } } }],
    ['a cycle', { root: 'r', nodes: { r: node('r', null, ['X']), X: node('X', 'Y', ['Y']), Y: node('Y', 'X', ['X']) } }],
  ])('refuses %s', (_label, raw) => {
    expect(sanitizeTree(raw)).toBeNull()
  })

  it('refuses more than MAX_SKEIN_NODES nodes before rebuilding them', () => {
    const nodes: Record<string, unknown> = {}
    for (let i = 0; i <= MAX_SKEIN_NODES; i++) nodes[`n${i}`] = 0
    expect(sanitizeTree({ root: 'n0', nodes })).toBeNull()
  })

  it('a sanitized tree held in a ref is the same plain tree (markRaw-friendly)', () => {
    const t = sanitizeTree(mk('a'))!
    expect(isReactive(t)).toBe(false)
    expect(JSON.parse(JSON.stringify(t))).toEqual(t)
  })
})

describe('parseSkeinFile: a .skein document', () => {
  const good = () => {
    const { tree } = addPath(createTree(), ['north'])
    return { v: 1, lang: 'i6', storyKey: 'k', tree }
  }

  it('parses a good file into a sanitized tree and its lang', () => {
    const doc = good()
    const out = parseSkeinFile(JSON.stringify(doc))!
    expect(out.tree).toEqual(doc.tree)
    expect(out.lang).toBe('i6')
  })

  it('refuses JSON that does not parse, is not an object, or has a bad tree', () => {
    expect(parseSkeinFile('{')).toBeNull()
    expect(parseSkeinFile('[]')).toBeNull()
    expect(parseSkeinFile('{"v":1}')).toBeNull()
  })

  it(`refuses a document nested deeper than ${64} levels, even outside the tree`, () => {
    expect(SKEIN_FILE_MAX_DEPTH).toBe(64)
    const at = (depth: number) => JSON.stringify({ ...good(), junk: JSON.parse('['.repeat(depth) + ']'.repeat(depth)) })
    expect(parseSkeinFile(at(63))).not.toBeNull() // the document (1) + 63 nested arrays = 64 levels
    expect(parseSkeinFile(at(64))).toBeNull()
    const huge = JSON.stringify(good()).replace(/}$/, `,"junk":${'['.repeat(200_000)}${']'.repeat(200_000)}}`)
    expect(parseSkeinFile(huge)).toBeNull()
  })
})
