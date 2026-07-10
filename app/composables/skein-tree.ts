/**
 * skein-tree — the Skein's pure core (no Vue, no storage, no engine).
 *
 * Each node is one command; each root→node path is a playthrough. The
 * synthetic root represents the boot banner (command ''). Every operation is
 * immutable: callers get a new tree, inputs are never mutated.
 *
 * Outputs stored here are ALWAYS normalizeTurnOutput-ed text (TurnRecord
 * .output); status is decided by exact string equality between lastOutput
 * and blessedOutput — the normalization contract is what keeps blessing
 * VM-agnostic (Doc 10 §1.2). Spec:
 * docs/superpowers/specs/2026-07-09-skein-design.md.
 */

export type SkeinStatus = 'unblessed' | 'match' | 'diff' | 'stale' | 'error'

export interface SkeinNode {
  id: string
  command: string
  parentId: string | null
  /** Sibling order = creation order. */
  childIds: string[]
  /** Normalized output blessed as correct. */
  blessedOutput?: string
  /** Normalized output from the most recent run. */
  lastOutput?: string
  status: SkeinStatus
}

export interface SkeinTree {
  root: string
  nodes: Record<string, SkeinNode>
}

let _seq = 0
function newId(): string {
  _seq += 1
  return `s${_seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createTree(): SkeinTree {
  const root: SkeinNode = { id: newId(), command: '', parentId: null, childIds: [], status: 'unblessed' }
  return { root: root.id, nodes: { [root.id]: root } }
}

/** Nodes excluding the synthetic root. */
export function countNodes(tree: SkeinTree): number {
  return Object.keys(tree.nodes).length - 1
}

/**
 * Walk from the root creating only what's new: an existing child with the
 * same (trimmed) command is reused, so shared prefixes dedupe and branching
 * happens exactly where commands diverge (siblings = alternatives).
 */
export function addPath(tree: SkeinTree, commands: string[]): { tree: SkeinTree; leafId: string } {
  const nodes = { ...tree.nodes }
  let cursor = tree.root
  for (const raw of commands) {
    const command = raw.trim()
    if (!command) continue
    const parent = nodes[cursor]!
    const existing = parent.childIds.find(id => nodes[id]!.command === command)
    if (existing) {
      cursor = existing
      continue
    }
    const child: SkeinNode = { id: newId(), command, parentId: cursor, childIds: [], status: 'unblessed' }
    nodes[child.id] = child
    nodes[cursor] = { ...parent, childIds: [...parent.childIds, child.id] }
    cursor = child.id
  }
  return { tree: { ...tree, nodes }, leafId: cursor }
}

/** Root..node inclusive. */
export function pathNodes(tree: SkeinTree, nodeId: string): SkeinNode[] {
  const path: SkeinNode[] = []
  let cur: SkeinNode | undefined = tree.nodes[nodeId]
  while (cur) {
    path.unshift(cur)
    cur = cur.parentId === null ? undefined : tree.nodes[cur.parentId]
  }
  return path
}

/** Commands root→node, EXCLUDING the root's '' — feeds replay()/Send-to-Play. */
export function pathCommands(tree: SkeinTree, nodeId: string): string[] {
  return pathNodes(tree, nodeId)
    .map(n => n.command)
    .filter(c => c !== '')
}

function statusFor(node: SkeinNode): SkeinStatus {
  if (node.blessedOutput === undefined) return 'unblessed'
  if (node.lastOutput === undefined) return 'stale'
  return node.lastOutput === node.blessedOutput ? 'match' : 'diff'
}

/**
 * Write a run's outputs down the path (turn 0 → root banner, turn i → path
 * node i) and recompute statuses. Path nodes the run never reached (the VM
 * quit early) become `error` when blessed — a regression signal in itself.
 */
export function applyRun(
  tree: SkeinTree,
  leafId: string,
  turns: { command: string; output: string }[],
): SkeinTree {
  const nodes = { ...tree.nodes }
  const path = pathNodes(tree, leafId)
  path.forEach((node, i) => {
    if (i < turns.length) {
      const next = { ...node, lastOutput: turns[i]!.output }
      next.status = statusFor(next)
      nodes[node.id] = next
    } else {
      nodes[node.id] = {
        ...node,
        lastOutput: undefined,
        status: node.blessedOutput !== undefined ? 'error' : 'unblessed',
      }
    }
  })
  return { ...tree, nodes }
}

/** Bless every path node that HAS a lastOutput (never-run nodes stay as-is). */
export function blessThread(tree: SkeinTree, nodeId: string): SkeinTree {
  const nodes = { ...tree.nodes }
  for (const node of pathNodes(tree, nodeId)) {
    if (node.lastOutput === undefined) continue
    nodes[node.id] = { ...node, blessedOutput: node.lastOutput, status: 'match' }
  }
  return { ...tree, nodes }
}

function subtreeIds(tree: SkeinTree, nodeId: string): string[] {
  const out: string[] = []
  const stack = [nodeId]
  while (stack.length) {
    const id = stack.pop()!
    const node = tree.nodes[id]
    if (!node) continue
    out.push(id)
    stack.push(...node.childIds)
  }
  return out
}

/** Clear blessing (and status) for a node and all its descendants. */
export function unblessSubtree(tree: SkeinTree, nodeId: string): SkeinTree {
  const nodes = { ...tree.nodes }
  for (const id of subtreeIds(tree, nodeId)) {
    const node = nodes[id]!
    const { blessedOutput: _drop, ...rest } = node
    nodes[id] = { ...rest, status: 'unblessed' }
  }
  return { ...tree, nodes }
}

/** Remove a node and its descendants. Refuses the root (returns the input). */
export function removeSubtree(tree: SkeinTree, nodeId: string): SkeinTree {
  if (nodeId === tree.root) return tree
  const node = tree.nodes[nodeId]
  if (!node) return tree
  const nodes = { ...tree.nodes }
  for (const id of subtreeIds(tree, nodeId)) delete nodes[id]
  const parent = nodes[node.parentId!]
  if (parent) nodes[parent.id] = { ...parent, childIds: parent.childIds.filter(id => id !== nodeId) }
  return { ...tree, nodes }
}

/** A fresh build invalidates every verdict: blessed nodes go stale. */
export function markAllStale(tree: SkeinTree): SkeinTree {
  const nodes = { ...tree.nodes }
  for (const [id, node] of Object.entries(nodes)) {
    if (node.blessedOutput !== undefined) nodes[id] = { ...node, status: 'stale' }
  }
  return { ...tree, nodes }
}

/**
 * The auto-rerun set: every blessed node with no blessed descendant. Running
 * each of these replays its full root path, which re-verifies every blessed
 * ancestor for free.
 */
export function blessedLeaves(tree: SkeinTree): string[] {
  const blessed = Object.values(tree.nodes).filter(n => n.blessedOutput !== undefined)
  const hasBlessedDescendant = (node: SkeinNode): boolean => {
    const stack = [...node.childIds]
    while (stack.length) {
      const id = stack.pop()!
      const child = tree.nodes[id]
      if (!child) continue
      if (child.blessedOutput !== undefined) return true
      stack.push(...child.childIds)
    }
    return false
  }
  return blessed.filter(n => !hasBlessedDescendant(n)).map(n => n.id)
}
