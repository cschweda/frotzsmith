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
import {
  createTree,
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
