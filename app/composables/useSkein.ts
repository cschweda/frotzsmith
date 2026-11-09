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
  parseSkeinFile,
  SKEIN_FILE_MAX_BYTES,
  type SkeinTree,
} from './skein-tree'
import { markRaw } from 'vue'
import { registerSessionOnce } from './session-once'
import { useOutsideSource } from './outside-source'
import { getSkeinStore } from './skein-store'
import { replayBudgetMs } from './useTranscript'
import { notifyStorageFull } from './useStorageNotice'
import { parseScript } from '~/modules/inform6/engine/parseScript'
import { safeGetItem, safeSetItem } from '@frotzinc/nuxt-base/utils/safe-storage'
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

// Module-level run/persistence bookkeeping: the skein is a session-wide
// singleton like the other state composables.

/** Debounced saves, one timer PER BUCKET — a save for game B must never
 *  cancel game A's still-pending save. */
const _saveTimers = new Map<string, { timer: ReturnType<typeof setTimeout>, run: () => Promise<void> }>()
/** Saves that have fired but not yet settled; `flushSaves` waits for these too. */
const _inFlight = new Set<Promise<void>>()
/** Bucket whose IndexedDB load is in flight: the in-memory tree still belongs
 *  to the previous game, so saving it under this key would clobber the
 *  stored skein. */
let _restoringKey: string | null = null
/** Bumped by every restore and by replaceTree: a restore whose load lands
 *  after a newer one (or after a replaceTree) drops its result. */
let _restoreGen = 0
/** Bucket whose tree replaceTree just set: the restore that the same load's
 *  story-key change triggers (its watcher runs a tick later) must not
 *  overwrite it with storage. Expires after that tick — a later restore of the
 *  bucket loads normally. */
let _replacedKey: string | null = null
/** Bumped on every successful compile; a replay started under an older
 *  build is superseded and its outputs are discarded. */
let _buildGen = 0
/** Cancels the replay in flight (worker terminate), if any. */
let _activeCancel: (() => void) | null = null
/** A compile landed mid-run: re-run blessed threads once the run unwinds. */
let _rerunPending = false
/** The user pressed Stop: end the batch and don't toast it as a failure. */
let _cancelRequested = false

type RunOutcome = 'ok' | 'failed' | 'cancelled'

export function useSkein() {
  const { profile } = useLanguage()
  const result = useState<{ ok: boolean; storyFile?: Uint8Array; storyExt?: string } | null>(
    'frotz:result',
    () => null,
  )
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')

  // Held raw (markRaw): every op returns a NEW tree, so a deep proxy buys
  // nothing — and a deep proxy is what let Vue-reserved keys in an imported
  // tree change what was shown and replayed (audit F3).
  const tree = useState<SkeinTree>('frotz:skein-tree', () => markRaw(createTree()))
  /** Where the live-play feed currently sits in the tree. */
  const playCursor = useState<string>('frotz:skein-cursor', () => tree.value.root)
  const running = useState<boolean>('frotz:skein-running', () => false)
  const progress = useState<{ done: number; total: number } | null>('frotz:skein-progress', () => null)
  const autoRun = useState<boolean>('frotz:skein-autorun', () => {
    if (!import.meta.client) return true
    return safeGetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.skeinAutoRun)) !== 'off'
  })

  // A package/share-link source doesn't auto-run until the author plays or
  // runs it once by hand (audit F2; see outside-source.ts).
  const outside = useOutsideSource()
  /** Auto-run may fire now: on, and the source isn't an untrusted outside one. */
  const mayAutoRun = () => autoRun.value && !outside.untrusted.value

  const bucketKey = () => `${profile.value.stateKey}:${activeStoryKey.value}`
  const nodeCount = computed(() => countNodes(tree.value))

  // ── persistence ───────────────────────────────────────────────────────────
  /** The write behind one bucket's debounced save; the timer and `flushSaves` both run it. */
  function persist(key: string, snapshot: SkeinTree): Promise<void> {
    return getSkeinStore()
      .save(key, snapshot)
      .then(ok => {
        if (!ok) notifyStorageFull()
      })
  }

  function scheduleSave() {
    const key = bucketKey()
    if (key === _restoringKey) return
    const pending = _saveTimers.get(key)
    if (pending) clearTimeout(pending.timer)
    const snapshot = tree.value
    const run = () => {
      _saveTimers.delete(key)
      const p = persist(key, snapshot).finally(() => _inFlight.delete(p))
      _inFlight.add(p)
      return p
    }
    _saveTimers.set(key, { timer: setTimeout(run, 500), run })
  }

  /** Run every pending debounced save now and wait for the stores (before a reload). */
  async function flushSaves(): Promise<void> {
    const pending = [..._saveTimers.values()]
    for (const p of pending) clearTimeout(p.timer)
    const started = pending.map(p => p.run())
    await Promise.allSettled([...started, ..._inFlight])
  }

  function setTree(next: SkeinTree) {
    tree.value = markRaw(next)
    scheduleSave()
  }

  /** Replace the whole tree for the current game (a `.skein` import, or
   *  opening a `.frotzsmith` project): the play cursor goes to the root, any
   *  in-flight or about-to-start restore of this bucket is superseded, and the
   *  new tree is saved. */
  function replaceTree(next: SkeinTree) {
    _restoreGen += 1
    _restoringKey = null
    const key = bucketKey()
    _replacedKey = key
    setTimeout(() => {
      if (_replacedKey === key) _replacedKey = null
    }, 0)
    tree.value = markRaw(next)
    playCursor.value = next.root
    scheduleSave()
  }

  /** Load the current game's bucket (fresh tree when none is stored). */
  async function restore() {
    const key = bucketKey()
    // replaceTree already put this bucket's tree in place (opening a project
    // changes the story key, whose watcher lands here a tick later).
    const replaced = _replacedKey === key
    _replacedKey = null
    if (replaced) return
    _restoringKey = key
    const gen = ++_restoreGen
    const stored = await getSkeinStore().load(key)
    // A newer switch (or a replaceTree) superseded this load — it owns the tree.
    if (bucketKey() !== key || gen !== _restoreGen) return
    _restoringKey = null
    tree.value = markRaw(stored ?? createTree())
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
    tree.value = markRaw(next)
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
  /** Replay root→leaf and write the outputs down the path. 'cancelled'
   *  covers both Stop and a recompile superseding the run — neither may
   *  write outputs (they'd be the old build's) or count as a failure. */
  async function replayPath(leafId: string): Promise<RunOutcome> {
    const story = result.value?.ok ? result.value.storyFile : undefined
    if (!story) return 'failed'
    const gen = _buildGen
    const commands = pathCommands(tree.value, leafId)
    const ctrl = useReplay().replay(new Uint8Array(story), 'zmachine', commands, {
      timeoutMs: replayBudgetMs(commands.length),
    })
    _activeCancel = ctrl.cancel
    try {
      const { turns } = await ctrl.promise
      if (gen !== _buildGen || _cancelRequested) return 'cancelled'
      setTree(applyRun(tree.value, leafId, turns))
      return 'ok'
    } catch (err: unknown) {
      if (gen !== _buildGen || _cancelRequested) return 'cancelled'
      // Engine failure/timeout: without a cue this looks like "nothing
      // happened" (found live — a story the ZVM replay chokes on produced
      // zero signal). Callers aggregate; runToNode toasts directly.
      lastRunError = String(err instanceof Error ? err.message : err)
      return 'failed'
    } finally {
      if (_activeCancel === ctrl.cancel) _activeCancel = null
    }
  }

  /** After any run unwinds: honour a compile that landed mid-run. */
  function afterRun() {
    if (!_rerunPending) return
    _rerunPending = false
    if (mayAutoRun()) void runStaleBatch()
  }
  let lastRunError = ''

  function toastRunFailure(prefix: string) {
    useToast().add({
      title: `${prefix} run failed`,
      description: `${lastRunError} — the headless replay engine could not play this game (the inline player may still work). Try Run again after a recompile, or report it (About → Report a problem).`,
      color: 'error',
      icon: 'i-lucide-octagon-x',
    })
  }

  /** Run the path to one node (the author's click — trusts an outside source). */
  async function runToNode(nodeId: string): Promise<void> {
    if (running.value) return
    outside.trust()
    running.value = true
    _cancelRequested = false
    progress.value = { done: 0, total: 1 }
    try {
      if ((await replayPath(nodeId)) === 'failed') toastRunFailure('Skein')
      progress.value = { done: 1, total: 1 }
    } finally {
      running.value = false
      progress.value = null
      afterRun()
    }
  }

  /** The author's Run: re-run every blessed leaf. Trusts an outside source. */
  async function runStale(): Promise<void> {
    if (running.value) return
    outside.trust()
    return runStaleBatch()
  }

  /** Re-run every blessed leaf (each run re-verifies its whole root path). */
  async function runStaleBatch(): Promise<void> {
    if (running.value) return
    const leaves = blessedLeaves(tree.value)
    if (!leaves.length) return
    running.value = true
    _cancelRequested = false
    progress.value = { done: 0, total: leaves.length }
    let failures = 0
    try {
      for (const [i, leaf] of leaves.entries()) {
        const outcome = await replayPath(leaf)
        if (outcome === 'cancelled') break
        if (outcome === 'failed') failures += 1
        progress.value = { done: i + 1, total: leaves.length }
      }
      if (failures) toastRunFailure(`Skein: ${failures} of ${leaves.length} thread`)
    } finally {
      running.value = false
      progress.value = null
      afterRun()
    }
  }

  /** Stop: terminate the replay in flight and end the batch. */
  function cancelRuns() {
    _cancelRequested = true
    _rerunPending = false
    _activeCancel?.()
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
  /** Put back a tree captured earlier this session (the panel's delete Undo). */
  function restoreSnapshot(snapshot: SkeinTree) {
    if (!snapshot.nodes[playCursor.value]) playCursor.value = snapshot.root
    setTree(snapshot)
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

  /** Import a .skein file. Rejects another language's skein (its commands
   *  can't replay against this compiler's games) and any structurally broken
   *  tree, which would otherwise throw later inside addPath/pathNodes. */
  function importSkein(json: string): boolean {
    const tree = readSkeinImport(json)
    if (!tree) return false
    replaceTree(tree)
    return true
  }

  /** The tree a `.skein` file would import — checked, rebuilt from known
   *  fields only, nothing applied — or null (too large, another language's,
   *  or broken). The panel uses it to ask before replacing a Skein. */
  function readSkeinImport(json: string): SkeinTree | null {
    // A UTF-16 length over the cap means more bytes than that too.
    if (json.length > SKEIN_FILE_MAX_BYTES) return null
    const data = parseSkeinFile(json)
    if (!data) return null
    if (data.lang !== undefined && data.lang !== profile.value.stateKey) return null
    return data.tree
  }

  // ── session watchers (once per app — see session-once.ts) ─────────────────
  registerSessionOnce('skein', () => {
    // A successful build invalidates every verdict; auto-run re-earns them.
    // A run already in flight is for the OLD build: cancel it, and re-run
    // once it unwinds (runStale would otherwise no-op while running).
    watch(result, (r) => {
      if (!r?.ok || !r.storyFile) return
      _buildGen += 1
      setTree(markAllStale(tree.value))
      if (autoRun.value && outside.untrusted.value) {
        // Held back: the panel shows a one-line note until Play or Run.
        outside.autoRunHeld.value = blessedLeaves(tree.value).length > 0
      }
      if (running.value) {
        _rerunPending = mayAutoRun()
        _activeCancel?.()
      } else if (mayAutoRun()) {
        void runStaleBatch()
      }
    })
    // Game switched → swap buckets (the debounced save of the old tree keys
    // by the OLD bucket because scheduleSave captured it — see closure above).
    watch(activeStoryKey, () => {
      void restore()
    })
  })

  return {
    tree,
    nodeCount,
    flushSaves,
    running,
    progress,
    autoRun,
    setAutoRun,
    /** Auto-run waited because the source came from a package or link. */
    autoRunHeld: outside.autoRunHeld,
    restore,
    replaceTree,
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
    restoreSnapshot,
    commandsTo,
    exportSkein,
    importSkein,
    readSkeinImport,
  }
}
