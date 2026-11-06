import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { formatI6 } from '~/utils/format-i6'
import { storyTitleOf } from '~/utils/story-title'
import { getExtrasStore } from '~/composables/project-extras-store'
import { SOLUTION_ID } from '~/composables/project-files'
import { formatZil } from '~/utils/format-zil'
import { safeGetItem, safeRemoveItem, safeSetItem } from '@frotzinc/nuxt-base/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { useOutsideSource } from '~/composables/outside-source'
import { PROFILES, detectProfile, type ProfileId } from '~/modules/inform6/profiles'
import { sampleById, loadSampleSource } from '~/modules/inform6/samples'
import { sampleById as zilSampleById } from '~/modules/languages/zil/samples'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'
export type RightTab = 'results' | 'play' | 'transcript' | 'testscript' | 'skein' | 'map' | 'solution'
export type ProfileMode = 'auto' | ProfileId

/** The bundled sample a language's editor holds: its id, the game it is, and
 *  a fingerprint of the source as loaded (so an edit shows without keeping a
 *  second copy of a large sample in storage). */
interface LoadedSample {
  id: string
  storyKey: string
  length: number
  hash: string
}

function readLoadedSample(raw: string | null): LoadedSample | null {
  if (raw === null) return null
  try {
    const v = JSON.parse(raw) as Partial<LoadedSample> | null
    if (v && typeof v.id === 'string' && typeof v.storyKey === 'string' && typeof v.length === 'number' && typeof v.hash === 'string')
      return { id: v.id, storyKey: v.storyKey, length: v.length, hash: v.hash }
  } catch { /* corrupt: no sample */ }
  return null
}

/** cyrb53: a fast 53-bit string hash (not cryptographic; edit detection only). */
function sourceHash(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Central IDE state and actions (composables, no Pinia). Library selection is
 * fuzzily auto-detected from the source by default, so the compiler chooses
 * Standard Library vs PunyInform automatically; the user can still force one.
 */
export function useIde() {
  const { source, savedAt, restore: restoreSource } = useSourceDocument()
  const { compile } = useCompiler()
  const { profile } = useLanguage()
  const { enabledFiles, restore: restoreExtensions } = useExtensions()
  const { activeFile, readFile, writeActive, openFile, diagnosticTarget, restore: restoreProjectFiles } = useProjectFiles()
  const { restore: restoreScripts } = useTestScripts()
  const zilFiles = useZilProjectFiles()

  const status = useState<CompileStatus>('frotz:status', () => 'idle')
  const result = useState<CompileResult | null>('frotz:result', () => null)
  const activeTab = useState<RightTab>('frotz:tab', () => 'results')
  /** A clicked diagnostic: the line, and the tab it is in (`'source'` or `zil:<path>`). */
  const jumpSignal = useState<{ line: number; fileId: string; nonce: number } | null>('frotz:jump', () => null)
  /** Which pane the single-pane (mobile) layout shows. Shared so actions
   *  elsewhere can bring the right pane forward — e.g. tapping a diagnostic
   *  must show the editor it scrolls. Ignored by the desktop two-pane layout. */
  const mobileView = useState<'editor' | 'output'>('frotz:mobile-view', () => 'editor')

  const profileMode = useState<ProfileMode>('frotz:profile-mode', () => 'auto')
  const detectedProfile = computed(() => detectProfile(source.value))
  const effectiveProfile = computed<ProfileId>(() =>
    profileMode.value === 'auto' ? detectedProfile.value : profileMode.value,
  )
  const activeProfile = computed(() => PROFILES[effectiveProfile.value])

  // Story-file version: 'auto' uses the profile default, or force z3 / z5 / z8.
  const targetMode = useState<'auto' | StoryExt>('frotz:target', () => 'auto')
  const effectiveExt = computed<StoryExt>(() => {
    // ZIL: auto → first versionTarget (z3); forced → validate against versionTargets.
    if (profile.value.id === 'zil') {
      if (targetMode.value === 'auto') return profile.value.versionTargets[0]!
      return (profile.value.versionTargets as string[]).includes(targetMode.value)
        ? targetMode.value
        : profile.value.versionTargets[0]!
    }
    // I6 path — unchanged.
    if (targetMode.value === 'auto') return activeProfile.value.defaultExt
    // Fall back to the profile default if the forced target isn't valid for it.
    return activeProfile.value.targets.includes(targetMode.value)
      ? targetMode.value
      : activeProfile.value.defaultExt
  })

  /** The story title from the source, used for Save-As filenames — language-aware. */
  const storyTitle = computed(() => storyTitleOf(profile.value.id === 'zil' ? 'zil' : 'i6', source.value))
  /** Filename stem for Save-As / Download: slug of the title (or 'story'), '-puny' for PunyInform. */
  const storyBase = computed(() => storyBaseName(storyTitle.value, effectiveProfile.value === 'puny'))

  /** Slug of the current story title, or 'untitled' when there is none.
   *  Recomputes live as the source changes, but only used as the SEED for activeStoryKey. */
  const storyKey = computed(() => slugify(storyTitle.value || '') || 'untitled')

  /** Stable per-game identity for scoping test scripts and transcript.
   *  Updated only on discrete load events (restore / loadSample / loadSource / newProject),
   *  NOT on every title keystroke, so bucket switches are intentional. */
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')

  /** The profile the most recent compile actually used. */
  const usedProfile = useState<ProfileId | null>('frotz:used-profile', () => null)

  const canPlay = computed(() => status.value === 'success' && !!result.value?.storyFile)
  const playNonce = useState<number>('frotz:play-nonce', () => 0)

  /** Language of the most recent IdeLayout mount — restore() compares against it
   *  so a language switch (and only a language switch) blanks run artifacts. */
  const lastLang = useState<string | null>('frotz:last-lang', () => null)

  /** performance.now() at the end of the last compile — debounces clicks that
   *  were queued during a main-thread compile freeze (they dispatch AFTER the
   *  freeze, when status is no longer 'compiling', and would otherwise trigger
   *  a second full freeze). */
  const lastCompileEnd = useState<number>('frotz:last-compile-end', () => 0)

  /** Bumped whenever the editor moves to a different source (sample, opened
   *  file, new project, language switch). An in-flight compile or sample load
   *  captures it and drops its result if it changed — otherwise a slow ZIL
   *  compile (5-9 s) would land its story into the NEXT game and Play / the
   *  Skein would run the wrong build. */
  const sourceGen = useState<number>('frotz:source-gen', () => 0)

  // Send-to-Play: a parsed script queued to feed into the live Parchment game.
  const pendingScript = useState<string[] | null>('frotz:pending-script', () => null)

  /** Per language (profile stateKey): the bundled sample the editor holds, as
   *  `loadSample` put it in. Persisted, so it survives a reload and a language
   *  round trip; cleared only by New, Open, a share link or a package (all of
   *  which load through newProject / loadSource). `null` in the map means
   *  "cleared this session"; a missing entry falls back to storage. */
  const loadedSamples = useState<Record<string, LoadedSample | null>>('frotz:loaded-samples', () => ({}))
  function loadedSampleKey(stateKey: string): string {
    return buildStorageKey(stateKey, frotzsmith.storageKeys.loadedSample)
  }
  const loadedSample = computed<LoadedSample | null>(() => {
    const stateKey = profile.value.stateKey
    const s = Object.hasOwn(loadedSamples.value, stateKey)
      ? loadedSamples.value[stateKey]!
      : import.meta.client ? readLoadedSample(safeGetItem(loadedSampleKey(stateKey))) : null
    // A different game in the editor (e.g. the recovery snapshot was lost
    // and the seed came back) is not the sample, whatever storage says.
    return s && s.storyKey === activeStoryKey.value ? s : null
  })
  function setLoadedSample(s: LoadedSample | null) {
    const stateKey = profile.value.stateKey
    loadedSamples.value = { ...loadedSamples.value, [stateKey]: s }
    if (!import.meta.client) return
    if (s === null) safeRemoveItem(loadedSampleKey(stateKey))
    else if (!safeSetItem(loadedSampleKey(stateKey), JSON.stringify(s))) notifyStorageFull()
  }
  /** The id of the bundled sample in the editor, or null. */
  const loadedSampleId = computed(() => loadedSample.value?.id ?? null)
  /** The loaded sample has been edited since it was loaded. */
  const sampleEdited = computed(() => {
    const s = loadedSample.value
    return s !== null && (source.value.length !== s.length || sourceHash(source.value) !== s.hash)
  })

  /** Everything a compile reads, as one string: equal keys mean equal builds. */
  function buildInputKey(): string {
    return JSON.stringify([
      profile.value.id,
      effectiveProfile.value,
      effectiveExt.value,
      source.value,
      enabledFiles.value,
      profile.value.id === 'zil' ? [zilFiles.files.value, zilFiles.mainPath.value] : null,
    ])
  }
  /** The input key of the build in `result`, when that build succeeded. */
  const builtInputKey = useState<string | null>('frotz:built-input-key', () => null)
  /** The input key of the last compile that reported errors: the same input
   *  is not compiled again from code (ensureBuild) until it changes. */
  const failedInputKey = useState<string | null>('frotz:failed-input-key', () => null)
  /** The compiled story is a clean build of exactly what the editor holds now. */
  const buildIsCurrent = computed(() => canPlay.value && builtInputKey.value === buildInputKey())

  /** Restore the persisted profile mode, then the source recovery snapshot. */
  function restore() {
    if (import.meta.client) {
      // Language switched since the last mount → the compile result, status,
      // right-pane tab, queued script, transcripts, and map all belong to the
      // other language (the shared useState keys are language-agnostic). Blank
      // them BEFORE restoring; same-language remounts (e.g. a /technical
      // round-trip) keep the working state.
      if (lastLang.value !== null && lastLang.value !== profile.value.id) {
        resetForNewSource()
        usedProfile.value = null
        // The spoiler guard is per game, and a story key is not one across
        // languages: the Inform 6 and the ZIL Mingus I share a title. Shown
        // in one language is not shown in the other.
        useState<string | null>('frotz:solution-revealed', () => null).value = null
      }
      lastLang.value = profile.value.id

      const profileModeKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode)
      const targetKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target)
      // No persisted value → 'auto', so the other language's in-memory choice
      // (e.g. a forced z4) doesn't leak into this language's toolbar.
      const saved = safeGetItem(profileModeKey)
      profileMode.value = saved === 'auto' || saved === 'std' || saved === 'puny' ? saved : 'auto'
      const t = safeGetItem(targetKey)
      targetMode.value =
        t !== null && (t === 'auto' || (profile.value.versionTargets as string[]).includes(t))
          ? (t as 'auto' | StoryExt)
          : 'auto'
    }
    restoreExtensions()
    if (profile.value.id === 'zil') zilFiles.restore()
    // Restore source before project files so tab reconciliation runs against the
    // restored source's library profile (not the demo's), keeping library tabs.
    restoreSource()
    restoreProjectFiles()
    // Set the stable story key AFTER source is restored so scripts restore under
    // the right per-game bucket.
    activeStoryKey.value = storyKey.value
    restoreScripts()
  }

  /** Blank every ephemeral run artifact: the captured play transcript, the last
   *  script-run output, any queued Send-to-Play commands, the auto-map, and the
   *  Parchment autosave. Shared by a fresh compile and by loading a new source so
   *  nothing from the previous game lingers. Saved scripts — including which one
   *  is selected — are kept: they're per-game (bucketed by activeStoryKey), and
   *  blanking the selection here persisted activeId='' and lost it on reload. */
  function resetEphemeral() {
    usePlayTranscript().reset()
    useTranscript().reset()
    useMap().reset()
    pendingScript.value = null
    clearPlayAutosave()
  }

  /** A new source was loaded (sample / opened file / new project): drop the
   *  compiled result and all ephemeral artifacts so the IDE returns to a clean
   *  slate — no stale results, transcript, map, or running Parchment game. The
   *  PlayPanel tears its iframe down when `result` goes null. */
  function resetForNewSource() {
    sourceGen.value += 1
    resetEphemeral()
    result.value = null
    builtInputKey.value = null
    failedInputKey.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

  /** Two rAFs = a guaranteed paint opportunity (setTimeout(0) is not), so
   *  "Compiling…" is actually on screen before a long synchronous main-thread
   *  compile (ZIL: ~5-9s) blocks the thread. */
  function nextPaint(): Promise<void> {
    return new Promise(resolve => {
      if (!import.meta.client || typeof requestAnimationFrame === 'undefined') return resolve()
      let done = false
      const finish = () => {
        if (!done) {
          done = true
          resolve()
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(finish))
      // Hidden tabs never fire rAF (Chrome throttles it to zero) — the compile
      // must not hang until the tab becomes visible again.
      setTimeout(finish, 100)
    })
  }

  async function runCompile() {
    if (status.value === 'compiling') return
    if (import.meta.client && lastCompileEnd.value > 0 && performance.now() - lastCompileEnd.value < 500) return
    await compileBuild(true)
  }

  const currentStatus = (): CompileStatus => status.value

  /** Resolves once no compile is running. */
  function whenNotCompiling(): Promise<void> {
    if (status.value !== 'compiling') return Promise.resolve()
    return new Promise(resolve => {
      const stop = watch(status, s => {
        if (s === 'compiling') return
        stop()
        resolve()
      })
    })
  }

  /** Make sure the compiled story matches the editor, compiling only when it
   *  is stale (waiting for a compile already running first). Called from code,
   *  not a click, so the queued-click debounce doesn't apply. A successful
   *  compile keeps the right-pane tab; a failed one leaves Results showing
   *  its errors. True when a current, playable build is in place. */
  async function ensureBuild(): Promise<boolean> {
    // A compile can start in the gap after the wait resolves (an author's
    // click): loop back and wait for it rather than reading its half state.
    for (let round = 0; round < 4; round++) {
      await whenNotCompiling()
      if (buildIsCurrent.value) return true
      if (failedInputKey.value !== null && failedInputKey.value === buildInputKey()) {
        activeTab.value = 'results' // the errors are shown, as for a real failure
        return false
      }
      if (status.value === 'compiling') continue
      const ran = await compileBuild(false)
      if (!ran) continue
      if (buildIsCurrent.value) return true
      // Read through a call: TS keeps the pre-await narrowing of status.value.
      const after = currentStatus()
      if (after !== 'compiling') {
        if (after === 'error') activeTab.value = 'results' // show the errors
        return false
      }
    }
    return buildIsCurrent.value
  }

  /** Compile the editor's source. `fresh` (the author's Compile) also blanks
   *  the play artifacts and shows Results; a compile from code (ensureBuild)
   *  leaves the game being played, its transcripts and the tab alone.
   *  Resolves false when a compile was already running. */
  async function compileBuild(fresh: boolean): Promise<boolean> {
    if (status.value === 'compiling') return false
    status.value = 'compiling'
    if (fresh) {
      // Fresh build → blank the prior game's artifacts (first room on next Play).
      resetEphemeral()
      activeTab.value = 'results'
    }
    const pid = effectiveProfile.value
    const gen = sourceGen.value
    const inputKey = buildInputKey()
    await nextPaint()
    const started = performance.now()
    // The source moved on while this compile ran: its result belongs to a
    // game that is no longer in the editor (resetForNewSource already put
    // status back to idle).
    const superseded = () => sourceGen.value !== gen
    try {
      if (superseded()) return true
      const r = await compile(source.value, {
        profileId: pid,
        ext: effectiveExt.value,
        extensions: enabledFiles.value,
        // Only ZIL compiles take the project's extra files (I6 never does).
        ...(profile.value.id === 'zil'
          ? { files: zilFiles.files.value.map(f => ({ ...f })), mainPath: zilFiles.mainPath.value }
          : {}),
      })
      if (superseded()) return true
      result.value = r
      builtInputKey.value = r.ok ? inputKey : null
      failedInputKey.value = r.ok ? null : inputKey
      usedProfile.value = pid
      status.value = r.ok ? 'success' : 'error'
    } catch (err: unknown) {
      // A thrown exception (vs. an ok:false result) means the compiler itself
      // failed — e.g. the lazy inform6.mjs/wasm fetch rejected. Surface it as a
      // failed CompileResult so ResultsPanel shows the reason instead of an
      // empty "0 errors" error state (the ZIL path already does this).
      if (superseded()) return true
      const msg = `Compiler failed to run: ${String(err)}`
      result.value = {
        ok: false,
        storyExt: effectiveExt.value,
        diagnostics: [{ severity: 'fatal', message: msg }],
        rawStderr: msg,
        ms: Math.round(performance.now() - started),
        byteLength: 0,
      }
      builtInputKey.value = null
      // A thrown compiler failure (e.g. a chunk fetch) may be transient: not cached.
      failedInputKey.value = null
      usedProfile.value = pid
      status.value = 'error'
    } finally {
      // Only a compile whose result landed arms the freeze-click debounce.
      if (import.meta.client && !superseded()) lastCompileEnd.value = performance.now()
    }
    return true
  }

  /** Show `line` of the file a diagnostic names (`file` as the compiler gave
   *  it; none means the main source). A file outside the project, such as a
   *  zillib file, has no tab: nothing moves, the line stays in Results. */
  function jumpTo(line: number, file?: string) {
    const fileId = diagnosticTarget(file)
    if (fileId === null) return
    openFile(fileId)
    mobileView.value = 'editor'
    jumpSignal.value = { line, fileId, nonce: (jumpSignal.value?.nonce ?? 0) + 1 }
  }

  /** Re-indent and tidy the active editable file (source, an uploaded ext or
   *  an extra ZIL file). Never solution.txt: it is text, not code, and the
   *  code formatters would strip its blank lines and indent its `>` commands. */
  function format() {
    if (!activeFile.value.editable || activeFile.value.id === SOLUTION_ID) return
    const src = readFile(activeFile.value.id)
    writeActive(profile.value.id === 'zil' ? formatZil(src) : formatI6(src))
  }

  function setProfileMode(mode: ProfileMode) {
    profileMode.value = mode
    if (import.meta.client && !safeSetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode), mode))
      notifyStorageFull()
  }

  function setTargetMode(mode: 'auto' | StoryExt) {
    targetMode.value = mode
    if (import.meta.client && !safeSetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target), mode))
      notifyStorageFull()
  }

  /** A different source is being loaded: hidden files kept from an opened
   *  `.frotzsmith` project no longer belong to the editor's game (the owner
   *  marker and the stored record both go), even when
   *  the new one has the same title (useProjectPackage re-claims them after
   *  its own loadSource). Not part of resetForNewSource — that also runs on a
   *  language-switch restore, which keeps the same game. */
  function releaseExtras() {
    if (!import.meta.client) return
    safeRemoveItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.extrasOwner))
    // …and drop the record itself, so the store never outgrows one project.
    void getExtrasStore().clear(profile.value.stateKey)
  }

  /** A different game is being loaded into a ZIL editor: its extra files
   *  belong to the old one. Called by the callers that bring a new source
   *  (never by loadSource: package open and restores keep their files). An
   *  I6 session leaves the ZIL project alone. */
  function releaseZilFiles() {
    if (profile.value.id === 'zil') zilFiles.clear()
  }

  /** Load a built-in sample into the editor, prettified for consistent formatting
   *  (unless the sample sets `format: false`).
   *  Async: I6 sample bodies live in per-sample lazy chunks (loadSampleSource). */
  async function loadSample(id: string): Promise<void> {
    // ZIL samples: look up from the ZIL sample registry; no I6 formatting.
    if (profile.value.id === 'zil') {
      const s = zilSampleById(id)
      if (!s) return
      source.value = s.source
      activeStoryKey.value = storyKey.value
      setTargetMode(s.target)
      resetForNewSource()
      releaseExtras()
      releaseZilFiles()
      useOutsideSource().trust() // the author's own choice of source (F2)
      markLoadedSample(id)
      return
    }
    // I6 path.
    const s = sampleById(id)
    if (!s) return
    // The body is a lazy chunk: a second sample click, another load, or a
    // language switch during the fetch must win over this one.
    const gen = sourceGen.value
    const lang = profile.value.id
    const src = await loadSampleSource(id)
    if (src === null) return // chunk failed to load — keep the current source
    if (sourceGen.value !== gen || profile.value.id !== lang) return
    source.value = s.format === false ? src : formatI6(src)
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the sample.
    activeStoryKey.value = storyKey.value
    // Reset to auto so the sample compiles with its own library, not whatever
    // profile happens to be forced (e.g. from a prior New Project).
    setProfileMode('auto')
    setTargetMode(s.target ?? 'auto')
    resetForNewSource()
    releaseExtras()
    releaseZilFiles()
    useOutsideSource().trust() // the author's own choice of source (F2)
    markLoadedSample(id)
  }

  /** Remember which sample is in the editor and exactly what it loaded as.
   *  Every other load clears it (loadSource, newProject). */
  function markLoadedSample(id: string) {
    setLoadedSample({ id, storyKey: activeStoryKey.value, length: source.value.length, hash: sourceHash(source.value) })
  }

  /** Load arbitrary source text (e.g. an opened .inf file) into the editor. */
  function loadSource(text: string) {
    source.value = text
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the loaded file.
    activeStoryKey.value = storyKey.value
    resetForNewSource()
    releaseExtras()
    setLoadedSample(null) // Open, a share link and a package all load through here
  }

  /** Load a source file the author opened from disk. It arrived from outside
   *  like a package does, so Skein auto-run waits until Play or Run (F2). */
  function loadOpenedFile(text: string) {
    loadSource(text)
    releaseZilFiles() // a plain file brings no extra files; package open and restores keep theirs
    useOutsideSource().markOutside()
  }

  /** Start a fresh project: a blank editor with the chosen library forced. */
  function newProject(library: ProfileId) {
    source.value = ''
    // Blank source → storyKey is 'untitled'.
    activeStoryKey.value = storyKey.value
    // Only set/persist the I6 library profile for I6; ZIL has no library concept
    // and persisting 'std' into the ZIL storage bucket is a state smell.
    if (profile.value.id === 'i6') setProfileMode(library)
    resetForNewSource()
    releaseExtras()
    releaseZilFiles()
    setLoadedSample(null)
    useOutsideSource().trust() // a blank project of the author's own (F2)
  }

  /** Clear all Parchment autosave entries from localStorage so the next Play boots
   *  from the first room. Parchment writes `autosave:<story-hash>` (same-origin). */
  function clearPlayAutosave() {
    if (!import.meta.client) return
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('autosave:')) localStorage.removeItem(k)
    } catch { /* ignore */ }
  }

  function playStory() {
    if (!canPlay.value) return
    // The author chose to play: a package/share-link source is trusted from
    // here on, so Skein auto-run resumes (audit F2; see outside-source.ts).
    useOutsideSource().trust()
    activeTab.value = 'play'
    playNonce.value += 1
  }

  /** Restart Play from the game's first move, whatever an autosave holds
   *  (a solution recording must not miss the opening). */
  function playFromStart() {
    if (!canPlay.value) return
    clearPlayAutosave()
    pendingScript.value = null
    playStory()
  }

  /** Run a script in the live game: clear the autosave so it plays from the start,
   *  queue the commands, and (re)boot Play. PlayPanel feeds them once the game is ready. */
  function sendToPlay(commands: string[]) {
    if (!canPlay.value || !commands.length) return
    clearPlayAutosave()
    pendingScript.value = commands.slice()
    playStory() // activeTab = 'play' + playNonce++ → fresh iframe boot
  }

  return {
    source,
    savedAt,
    restore,
    status,
    result,
    activeTab,
    jumpSignal,
    mobileView,
    profileMode,
    detectedProfile,
    effectiveProfile,
    activeProfile,
    targetMode,
    effectiveExt,
    usedProfile,
    storyTitle,
    storyBase,
    storyKey,
    activeStoryKey,
    canPlay,
    playNonce,
    pendingScript,
    sourceGen,
    loadedSampleId,
    sampleEdited,
    buildIsCurrent,
    runCompile,
    ensureBuild,
    jumpTo,
    format,
    setProfileMode,
    setTargetMode,
    loadSample,
    loadSource,
    loadOpenedFile,
    newProject,
    playStory,
    playFromStart,
    sendToPlay,
  }
}
