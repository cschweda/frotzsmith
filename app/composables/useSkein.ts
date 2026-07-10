import {
  createTree,
  addPath,
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
import { getSkeinStore } from './skein-store'
import { replayBudgetMs } from './useTranscript'
import { notifyStorageFull } from './useStorageNotice'
import { parseScript } from '~/modules/inform6/engine/parseScript'
import { safeGetItem, safeSetItem } from '~/utils/safe-storage'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

/**
 * The Skein: a branching tree of commands with blessed-output regression
 * diffing (spec: docs/superpowers/specs/2026-07-09-skein-design.md).
 *
 * Tree STRUCTURE comes from two feeds — importing the active test script and
 * live play (PlayPanel forwards captured commands) — while OUTPUTS come only
 * from headless worker replays, so blessed text stays normalized and
 * deterministic. On a successful compile every blessed node goes stale, then
 * (auto-run on) the blessed leaves re-run and statuses resolve green/red.
 *
 * Reads the shared compile result / story key directly (useMap pattern) —
 * NOT via useIde() — to avoid a circular composable chain.
 */

/** Refs already carrying our session watchers. A WeakSet (not a module flag)
 *  so tests — where the state map is rebuilt per test — re-register cleanly. */
const _watched = new WeakSet<object>()

/** Debounced-save timer + cancel flag for a batch run (module-level: the
 *  skein is a session-wide singleton like the other state composables). */
let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _batchAbort = false

export function useSkein() {
  const { profile } = useLanguage()
  const result = useState<{ ok: boolean; storyFile?: Uint8Array; storyExt?: string } | null>(
    'frotz:result',
    () => null,
  )
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')

  const tree = useState<SkeinTree>('frotz:skein-tree', () => createTree())
  /** Where the live-play feed currently sits in the tree. */
  const playCursor = useState<string>('frotz:skein-cursor', () => tree.value.root)
  const running = useState<boolean>('frotz:skein-running', () => false)
  const progress = useState<{ done: number; total: number } | null>('frotz:skein-progress', () => null)
  const autoRun = useState<boolean>('frotz:skein-autorun', () => {
    if (!import.meta.client) return true
    return safeGetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.skeinAutoRun)) !== 'off'
  })

  const bucketKey = () => `${profile.value.stateKey}:${activeStoryKey.value}`
  const nodeCount = computed(() => countNodes(tree.value))

  // ── persistence ───────────────────────────────────────────────────────────
  function scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer)
    const key = bucketKey()
    const snapshot = tree.value
    _saveTimer = setTimeout(() => {
      void getSkeinStore()
        .save(key, snapshot)
        .then(ok => {
          if (!ok) notifyStorageFull()
        })
    }, 500)
  }

  function setTree(next: SkeinTree) {
    tree.value = next
    scheduleSave()
  }

  /** Load the current game's bucket (fresh tree when none is stored). */
  async function restore() {
    const stored = await getSkeinStore().load(bucketKey())
    tree.value = stored ?? createTree()
    playCursor.value = tree.value.root
  }

  // ── feeds ─────────────────────────────────────────────────────────────────
  /** Import the active test script as a thread. Returns commands added-or-walked. */
  function importActiveScript(): number {
    const script = useTestScripts().activeScript.value
    if (!script?.text) return 0
    const commands = parseScript(script.text)
    if (!commands.length) return 0
    const { tree: next } = addPath(tree.value, commands)
    setTree(next)
    return commands.length
  }

  /** Live play walks/extends the tree from the cursor (PlayPanel forwards
   *  each captured command). Outputs never come from play — runs only. */
  function recordPlayCommand(cmd: string) {
    const command = cmd.trim()
    if (!command) return
    const base = pathCommands(tree.value, playCursor.value)
    const { tree: next, leafId } = addPath(tree.value, [...base, command])
    tree.value = next
    playCursor.value = leafId
    scheduleSave()
  }

  /** A fresh game boot (session-start) starts from the top of the tree. */
  function resetPlayCursor() {
    playCursor.value = tree.value.root
  }

  /** Add a single command as a child of `parentId` (inline editor action). */
  function addCommand(parentId: string, cmd: string) {
    const command = cmd.trim()
    if (!command) return
    const { tree: next } = addPath(tree.value, [...pathCommands(tree.value, parentId), command])
    setTree(next)
  }

  // ── runs ──────────────────────────────────────────────────────────────────
  async function replayPath(leafId: string): Promise<void> {
    const story = result.value?.ok ? result.value.storyFile : undefined
    if (!story) return
    const commands = pathCommands(tree.value, leafId)
    const ctrl = useReplay().replay(new Uint8Array(story), 'zmachine', commands, {
      timeoutMs: replayBudgetMs(commands.length),
    })
    try {
      const { turns } = await ctrl.promise
      setTree(applyRun(tree.value, leafId, turns))
    } catch {
      // Timeout/cancel/VM error: statuses below the last completed turn stay
      // stale/error — visible in the tree rather than thrown at the UI.
    }
  }

  /** Run the path to one node. */
  async function runToNode(nodeId: string): Promise<void> {
    if (running.value) return
    running.value = true
    progress.value = { done: 0, total: 1 }
    try {
      await replayPath(nodeId)
      progress.value = { done: 1, total: 1 }
    } finally {
      running.value = false
      progress.value = null
    }
  }

  /** Re-run every blessed leaf (each run re-verifies its whole root path). */
  async function runStale(): Promise<void> {
    if (running.value) return
    const leaves = blessedLeaves(tree.value)
    if (!leaves.length) return
    running.value = true
    _batchAbort = false
    progress.value = { done: 0, total: leaves.length }
    try {
      for (const [i, leaf] of leaves.entries()) {
        if (_batchAbort) break
        await replayPath(leaf)
        progress.value = { done: i + 1, total: leaves.length }
      }
    } finally {
      running.value = false
      progress.value = null
    }
  }

  function cancelRuns() {
    _batchAbort = true
  }

  // ── blessing / editing ────────────────────────────────────────────────────
  function blessTo(nodeId: string) {
    setTree(blessThread(tree.value, nodeId))
  }
  function unblessAt(nodeId: string) {
    setTree(unblessSubtree(tree.value, nodeId))
  }
  function removeAt(nodeId: string) {
    if (playCursor.value !== tree.value.root) playCursor.value = tree.value.root
    setTree(removeSubtree(tree.value, nodeId))
  }
  /** Commands root→node — feeds Send-to-Play ("Play to here") in the panel. */
  function commandsTo(nodeId: string): string[] {
    return pathCommands(tree.value, nodeId)
  }

  function setAutoRun(on: boolean) {
    autoRun.value = on
    if (import.meta.client)
      safeSetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.skeinAutoRun), on ? 'on' : 'off')
  }

  // ── export / import (.skein JSON — the canonical backup, per D10) ─────────
  function exportSkein(): string {
    return JSON.stringify(
      { v: 1, lang: profile.value.stateKey, storyKey: activeStoryKey.value, tree: tree.value },
      null,
      2,
    )
  }

  function importSkein(json: string): boolean {
    try {
      const data = JSON.parse(json) as { v?: number; tree?: SkeinTree }
      const t = data.tree
      if (!t || typeof t.root !== 'string' || !t.nodes?.[t.root]) return false
      setTree(t)
      playCursor.value = t.root
      return true
    } catch {
      return false
    }
  }

  // ── session watchers (per-ref, so test-rebuilt state re-registers) ────────
  if (import.meta.client && !_watched.has(result)) {
    _watched.add(result)
    // A successful build invalidates every verdict; auto-run re-earns them.
    watch(result, (r) => {
      if (!r?.ok || !r.storyFile) return
      setTree(markAllStale(tree.value))
      if (autoRun.value) void runStale()
    })
  }
  if (import.meta.client && !_watched.has(activeStoryKey)) {
    _watched.add(activeStoryKey)
    // Game switched → swap buckets (the debounced save of the old tree keys
    // by the OLD bucket because scheduleSave captured it — see closure above).
    watch(activeStoryKey, () => {
      void restore()
    })
  }

  return {
    tree,
    nodeCount,
    running,
    progress,
    autoRun,
    setAutoRun,
    restore,
    importActiveScript,
    recordPlayCommand,
    resetPlayCursor,
    addCommand,
    runToNode,
    runStale,
    cancelRuns,
    blessTo,
    unblessAt,
    removeAt,
    commandsTo,
    exportSkein,
    importSkein,
  }
}
