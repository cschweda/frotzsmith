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
  const seen = new Set<string>() // a malformed (cyclic) tree must never loop
  let cur: SkeinNode | undefined = tree.nodes[nodeId]
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.push(cur)
    cur = cur.parentId === null ? undefined : tree.nodes[cur.parentId]
  }
  return path.reverse()
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
  const seen = new Set<string>()
  while (stack.length) {
    const id = stack.pop()!
    const node = tree.nodes[id]
    if (!node || seen.has(id)) continue
    seen.add(id)
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

/** A fresh build invalidates every verdict: blessed nodes go stale, and every
 *  last output is dropped — it was produced by the PREVIOUS build, so keeping
 *  it would let a later "bless" certify old text as this build's output. */
export function markAllStale(tree: SkeinTree): SkeinTree {
  const nodes = { ...tree.nodes }
  for (const [id, node] of Object.entries(nodes)) {
    if (node.blessedOutput === undefined && node.lastOutput === undefined) continue
    const { lastOutput: _old, ...rest } = node
    nodes[id] = { ...rest, status: node.blessedOutput !== undefined ? 'stale' : 'unblessed' }
  }
  return { ...tree, nodes }
}

const STATUSES: ReadonlySet<string> = new Set<SkeinStatus>(['unblessed', 'match', 'diff', 'stale', 'error'])

/** Caps on an imported (untrusted) tree. A real Skein is hundreds of nodes; a
 *  60,000-node chain fits in a 600 KB package and would otherwise be accepted,
 *  saved, and break the panel on every reload. Node count includes the root;
 *  depth is edges from the root. */
export const MAX_SKEIN_NODES = 10_000
export const MAX_SKEIN_DEPTH = 10_000

/** Structural check for an imported (untrusted) tree: every node well-formed,
 *  every link resolvable, exactly one root, within the size caps — so later
 *  ops can't throw on it. */
export function isValidTree(value: unknown): value is SkeinTree {
  if (!value || typeof value !== 'object') return false
  const t = value as Partial<SkeinTree>
  if (typeof t.root !== 'string' || !t.nodes || typeof t.nodes !== 'object') return false
  const nodes = t.nodes as Record<string, Partial<SkeinNode>>
  if (!Object.hasOwn(nodes, t.root)) return false
  if (Object.keys(nodes).length > MAX_SKEIN_NODES) return false
  for (const [id, n] of Object.entries(nodes)) {
    if (!n || typeof n !== 'object' || n.id !== id || typeof n.command !== 'string') return false
    if (!Array.isArray(n.childIds) || !n.childIds.every(c => typeof c === 'string' && Object.hasOwn(nodes, c) && nodes[c]?.parentId === id)) return false
    if (typeof n.status !== 'string' || !STATUSES.has(n.status)) return false
    if (n.blessedOutput !== undefined && typeof n.blessedOutput !== 'string') return false
    if (n.lastOutput !== undefined && typeof n.lastOutput !== 'string') return false
    if (id === t.root ? n.parentId !== null : typeof n.parentId !== 'string' || !Object.hasOwn(nodes, n.parentId)) return false
  }
  // One tree: walking down from the root reaches every node exactly once. This
  // rejects cycles (even ones disjoint from the root) and orphans, which would
  // otherwise make parent-walks loop forever.
  const visited = new Set<string>()
  const stack: [string, number][] = [[t.root, 0]]
  while (stack.length) {
    const [id, depth] = stack.pop()!
    if (visited.has(id) || depth > MAX_SKEIN_DEPTH) return false
    visited.add(id)
    for (const c of nodes[id]!.childIds!) stack.push([c, depth + 1])
  }
  return visited.size === Object.keys(nodes).length
}

export interface SkeinRow {
  node: SkeinNode
  depth: number
  hasChildren: boolean
  expanded: boolean
}

/** Depth-first flatten for the panel (root hidden, its children at depth 0),
 *  honoring collapse state. Iterative — a deep chain must never overflow the
 *  call stack — and visits each id once, so even a malformed tree terminates. */
export function flattenRows(tree: SkeinTree, collapsed: ReadonlySet<string>): SkeinRow[] {
  const out: SkeinRow[] = []
  const seen = new Set<string>()
  const stack: [string, number][] = [[tree.root, -1]]
  while (stack.length) {
    const [id, depth] = stack.pop()!
    const node = tree.nodes[id]
    if (!node || seen.has(id)) continue
    seen.add(id)
    if (id !== tree.root) {
      const expanded = !collapsed.has(id)
      out.push({ node, depth, hasChildren: node.childIds.length > 0, expanded })
      if (!expanded) continue
    }
    for (let i = node.childIds.length - 1; i >= 0; i--) stack.push([node.childIds[i]!, depth + 1])
  }
  return out
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
    const seen = new Set<string>()
    while (stack.length) {
      const id = stack.pop()!
      const child = tree.nodes[id]
      if (!child || seen.has(id)) continue
      seen.add(id)
      if (child.blessedOutput !== undefined) return true
      stack.push(...child.childIds)
    }
    return false
  }
  return blessed.filter(n => !hasBlessedDescendant(n)).map(n => n.id)
}
