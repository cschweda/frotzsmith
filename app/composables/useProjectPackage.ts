import { COMPILED, readProjectPackage, splitPackable, writeProjectPackage, type ProjectSnapshot } from '~/project-package/project'
import { PackageError, displayPath } from '~/project-package/errors'
import { LIMITS } from '~/project-package/container'
import { pathKey, pathProblem, safeStem } from '~/project-package/paths'
import type { Target } from '~/project-package/manifest'
import { countNodes, createTree, type SkeinTree } from '~/composables/skein-tree'
import { getExtrasStore, type ProjectExtras } from '~/composables/project-extras-store'
import { getSkeinStore } from '~/composables/skein-store'
import { useOutsideSource } from '~/composables/outside-source'
import { includeNameOf, includePathOf, libraryFileFor, planUploaded } from '~/composables/useExtensions'
import { BUNDLED_EXTENSIONS } from '~/modules/inform6/extensions'
import { SEED_SCRIPT } from '~/composables/useTestScripts'
import { useZilProjectFiles } from '~/composables/useZilProjectFiles'
import { useSolutions } from '~/composables/useSolutions'
import { planZilFiles, ZIL_DEFAULT_MAIN_PATH, type ZilProjectFile } from '~/modules/zil/zil-project'
import { safeGetItem, safeSetItem } from '~/utils/safe-storage'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { currentAbout } from '~/utils/about'
import { isPristine } from '~/utils/pristine'
import { slugify } from '~/utils/slug'
import { storyKeyOf, storyTitleOf } from '~/utils/story-title'

/** A package that has been read and checked, waiting for the author to confirm. */
export interface PendingOpen {
  project: ProjectSnapshot
  ignored: string[]
  hashMismatches: string[]
  /** The package's Skein path when it couldn't be opened (kept as a hidden file). */
  skeinNotOpened: string | null
  /** Files kept with the project that the IDE doesn't show. */
  hiddenCount: number
  /** Their paths, without an unopened Skein (it has its own note). */
  hiddenNames: string[]
  /** The extensions opening installs (include paths) or enables (bundled
   *  names). They reach every Inform 6 game in this browser, so the open
   *  always asks first when there are any (audit F1). */
  extensions: string[]
  /** ZIL: the extra `.zil` files the open adds to the project (its includes).
   *  They belong to this project only, never to every ZIL game. */
  sourceFiles: string[]
  /** The package carries a solution (it replaces the game's; text only). */
  solution: boolean
}

const strictUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
/** A hidden file's bytes as text, or null when they aren't UTF-8 without NUL. */
function asText(bytes: Uint8Array): string | null {
  try {
    const s = strictUtf8.decode(bytes)
    return s.includes('\u0000') ? null : s
  } catch {
    return null
  }
}

const TARGETS: readonly string[] = ['auto', 'z3', 'z4', 'z5', 'z8']

/** The main file's name in a ZIL download: the store's main path, its last
 *  name made safe from the device-name rule (`con.zil` → `con_.zil`), or
 *  `fallback` when it still isn't a safe `.zil` path. */
function zilMainName(mainPath: string, fallback: string): string {
  const slash = mainPath.lastIndexOf('/')
  const base = mainPath.slice(slash + 1)
  const dot = base.indexOf('.')
  const stem = dot === -1 ? base : base.slice(0, dot)
  const fixed = `${mainPath.slice(0, slash + 1)}${safeStem(stem)}${dot === -1 ? '' : base.slice(dot)}`
  return /\.zil$/i.test(fixed) && pathProblem(fixed) === null ? fixed : fallback
}

/** A Skein's content without its node ids (pre-order: depth, command, outputs,
 *  status), so the same tree compares equal however its ids were minted. */
function skeinSignature(tree: SkeinTree): string {
  const out: unknown[] = []
  const stack: [string, number][] = [[tree.root, 0]]
  const seen = new Set<string>()
  while (stack.length) {
    const [id, depth] = stack.pop()!
    const n = tree.nodes[id]
    if (!n || seen.has(id)) continue
    seen.add(id)
    out.push([depth, n.command, n.blessedOutput ?? null, n.lastOutput ?? null, n.status])
    for (let i = n.childIds.length - 1; i >= 0; i--) stack.push([n.childIds[i]!, depth + 1])
  }
  return JSON.stringify(out)
}

/**
 * Download / Open the editor's project as a `.frotzsmith` package.
 *
 * `inspect` does ALL the reading and checking (format, language, the uploaded-
 * extension budget), so `apply` cannot fail half-way; `apply` re-runs the same
 * pure checks before its first write anyway. Opening only loads text — nothing
 * is compiled, played, or replayed.
 *
 * What the IDE has no home for (unknown files and manifest fields, `created`,
 * the Skein's path, per-test fields, the main file's name, unknown extension
 * names) goes to the extras store under the opened game's key, and
 * `buildPackage` writes it back — open → edit → download loses nothing.
 */
export function useProjectPackage() {
  const ide = useIde()
  const { profile } = useLanguage()
  const extensions = useExtensions()
  const testScripts = useTestScripts()
  const zilFiles = useZilProjectFiles()
  const solutions = useSolutions()
  const skein = useSkein()
  const sourceDoc = useSourceDocument()
  /** Bumped by useIde on every source load (shared state). */
  const sourceGen = useState<number>('frotz:source-gen', () => 0)

  const extrasKey = () => `${profile.value.stateKey}:${ide.activeStoryKey.value}`
  /** Which game the stored extras belong to. useIde clears it on every other
   *  source load (Open .inf, sample, share link, New), so a later project with
   *  the same title — or none — never inherits an opened package's hidden files. */
  const ownerKey = () => buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.extrasOwner)

  /** Every check an open needs, before anything changes. Throws the refusal. */
  function check(project: ProjectSnapshot) {
    const here = profile.value.id
    if (project.language !== here) {
      throw new PackageError(
        'wrong-language',
        project.language === 'zil'
          ? 'This is a ZIL project — open it from the ZIL editor.'
          : 'This is an Inform 6 project — open it from the Inform 6 editor.',
      )
    }
    // The solution must fit this browser's store beside the other games'
    // (the reader already held it to 1 MiB), or nothing opens.
    if (project.solution !== undefined) {
      const fits = solutions.planFor(storyKeyOf(project.language, project.main.text), project.solution)
      if (!fits.ok) throw new PackageError('solution-store', fits.message)
    }
    if (here === 'zil') {
      // The extra .zil files must be a set the editor can keep, or none open.
      const zil = planZilFiles(project.includes, project.main.name)
      if (!zil.ok) throw new PackageError('zil-files', zil.message)
      return null
    }
    // Throws ZipLimitError (budget) or PackageError (name clash).
    return planUploaded(project.includes, project.extensions)
  }

  async function inspect(file: File): Promise<PendingOpen> {
    // Refuse before reading a huge file into memory (the reader checks again).
    if (file.size > LIMITS.archiveBytes) {
      throw new PackageError('too-large', 'This project is larger than Frotzsmith can open (32 MB).')
    }
    const read = await readProjectPackage(new Uint8Array(await file.arrayBuffer()))
    const plan = check(read.project)
    const extensions = plan
      ? [
          ...plan.uploaded.map(u => u.title),
          ...BUNDLED_EXTENSIONS.filter(b => plan.enabledIds.includes(b.id)).map(b => b.name),
        ]
      : []
    return {
      ...read,
      hiddenCount: read.project.opaque.length,
      hiddenNames: read.project.opaque.map(f => f.path).filter(path => path !== read.skeinNotOpened),
      extensions,
      sourceFiles: read.project.language === 'zil' ? read.project.includes.map(f => f.path) : [],
      solution: read.project.solution !== undefined,
    }
  }

  async function apply(p: PendingOpen): Promise<void> {
    const project = p.project
    const plan = check(project) // nothing has changed yet
    const lang = profile.value.id

    // Every write below is synchronous and none can throw: storage failures
    // go through notifyStorageFull, so the IDE is never left half-opened.
    // The source first: loadSource resets run state and moves to the opened
    // game's story key, which every later write is keyed by.
    ide.loadSource(project.main.text) // clears the extras owner and record…
    useOutsideSource().markOutside() // no Skein auto-run until Play/Run (F2)
    sourceDoc.save() // durable now, not after the autosave debounce
    const openedKey = ide.activeStoryKey.value
    const openedGen = sourceGen.value
    if (lang === 'i6') ide.setProfileMode(project.settings.library ?? 'auto')
    ide.setTargetMode(project.settings.target)
    // loadSource never touches the extra files: the package's replace them.
    // check() ran planZilFiles on this set, so the replace can't be refused.
    if (lang === 'zil') zilFiles.replaceAll(project.includes, project.main.name)
    const unknown = plan ? extensions.replaceUploaded(project.includes, project.extensions) : project.extensions
    testScripts.replaceAll(project.tests.map(t => ({ name: t.name, text: t.text })))
    skein.replaceTree(project.skein ?? createTree())
    // The package's solution replaces the game's (none clears it), as its
    // scripts and Skein do. check() planned it, so set() can't refuse. It
    // stays behind the spoiler guard: opening never reveals it.
    if (project.solution !== undefined) {
      // A different text (perhaps someone else's) goes back behind the guard,
      // even when the author had revealed this game's own.
      if (solutions.text.value !== project.solution) solutions.conceal()
      solutions.set(project.solution)
    } else solutions.clear()

    const extras: ProjectExtras = {
      entries: project.opaque,
      manifestExtra: project.manifestExtra,
      main: project.main.name,
      testExtras: project.tests.flatMap(t => (t.extra ? [{ name: t.name, extra: t.extra }] : [])),
      extensions: { order: project.extensions.slice(), unknown },
    }
    // The IDE never leaves a game without a script: the seed it adds back must
    // not appear in a download of a project that had none.
    if (project.tests.length === 0) extras.noTests = true
    if (project.created !== undefined) extras.created = project.created
    if (project.skeinPath !== undefined) extras.skeinPath = project.skeinPath
    const [saved] = await Promise.all([getExtrasStore().save(extrasKey(), extras), skein.flushSaves()])
    // …which this open re-claims only once the record is really stored, and
    // only if no other source was loaded meanwhile — so buildPackage never
    // reads a record that isn't this project's.
    if (!saved) notifyStorageFull()
    else if (sourceGen.value === openedGen && ide.activeStoryKey.value === openedKey && !safeSetItem(ownerKey(), openedKey))
      notifyStorageFull()
  }

  /** The manifest `extensions` list: the opened order kept, unknown names kept
   *  in place, names disabled since dropped, newly enabled ones appended.
   *  `writtenIds` are the uploads actually written — by identity, not path,
   *  so a left-out twin's enabled state never passes to the file kept. */
  function extensionNames(extras: ProjectExtras | null, writtenIds: ReadonlySet<string>): string[] {
    const enabled =
      profile.value.id === 'i6'
        ? extensions.all.value
            .filter(e => extensions.isEnabled(e.id) && (e.origin === 'bundled' || writtenIds.has(e.id)))
            .map(e => (e.origin === 'bundled' ? e.name : includePathOf(e)))
        : []
    const keep = new Set([...enabled, ...(extras?.extensions?.unknown ?? [])])
    const order = (extras?.extensions?.order ?? []).filter(n => keep.has(n))
    return [...new Set([...order, ...enabled.filter(n => !order.includes(n))])]
  }

  /**
   * `hidden`: the files written back that the IDE doesn't show (F15).
   * `leftOut`: files kept in this browser that the package can't hold because
   * the reader would refuse them — uploads named like a library file and
   * hidden files whose names an older Frotzsmith accepted (review I-2/m-6).
   * They are never deleted; the download just goes without them, so it
   * always reopens.
   * `renamed`: uploads written under another name than their own (a Windows
   * device name gets `_`), so their Include name changes on reopening.
   */
  async function buildPackage(): Promise<{
    bytes: Uint8Array
    filename: string
    hidden: string[]
    leftOut: string[]
    renamed: { from: string; to: string }[]
  }> {
    const lang = profile.value.id
    const key = extrasKey()
    const filename = `${ide.storyBase.value}.frotzsmith`
    const title = ide.storyTitle.value
    const text = ide.source.value
    const target = TARGETS.includes(ide.targetMode.value) ? (ide.targetMode.value as Target) : 'auto'
    const library = ide.profileMode.value
    const uploads =
      lang === 'i6'
        ? extensions.uploaded.value.map(u => ({ path: includePathOf(u), text: u.content, id: u.id, name: u.name, title: u.title }))
        : []
    const scripts = testScripts.scripts.value.map(s => ({ name: s.name, text: s.text }))
    const tree = skein.tree.value

    const owned = safeGetItem(ownerKey()) === ide.activeStoryKey.value
    const extras = owned ? await getExtrasStore().load(key) : null

    const mainExt = lang === 'i6' ? '.inf' : '.zil'
    const fallbackMain = `${safeStem(slugify(title ?? '') || 'story')}${mainExt}`
    // ZIL: a main path a package set is kept; the default one (never set)
    // takes the title, as before multi-file ZIL, unless that names a file the project carries.
    const zilMain = zilFiles.mainPath.value
    const titleFits = ![...zilFiles.files.value, ...(extras?.entries ?? [])]
      .some(f => pathKey(f.path) === pathKey(fallbackMain))
    const main =
      lang === 'zil'
        ? zilMain === ZIL_DEFAULT_MAIN_PATH && titleFits
          ? fallbackMain
          : zilMainName(zilMain, fallbackMain)
        : extras?.main?.toLowerCase().endsWith(mainExt) && pathProblem(extras.main) === null
          ? extras.main
          : fallbackMain

    // ZIL: the store's extra files are the includes, then any `.zil` an older
    // version kept as a hidden file (a reader now opens those as includes, so
    // they go in only as valid text; else they're left out, kept in the browser).
    type ZilInclude = ZilProjectFile & { zil: true }
    const zilIncludes: ZilInclude[] = []
    const zilUnreadable: string[] = []
    let hiddenEntries = extras?.entries ?? []
    if (lang === 'zil') {
      for (const f of zilFiles.files.value) zilIncludes.push({ path: f.path, text: f.text, zil: true })
      const legacy = hiddenEntries.filter(e => e.path.toLowerCase().endsWith('.zil'))
      hiddenEntries = hiddenEntries.filter(e => !e.path.toLowerCase().endsWith('.zil'))
      for (const e of legacy) {
        const t = asText(e.bytes)
        if (t === null) zilUnreadable.push(e.path)
        else zilIncludes.push({ path: e.path, text: t, zil: true })
      }
    }

    // Leave out what the reader would refuse (it stays where it is): an
    // upload named like a library file, then any include or hidden file
    // whose name is unsafe or collides with one already in the package —
    // by path, or (includes) by the Include name a reader mounts it under.
    const libraryNamed = uploads.filter(u => libraryFileFor(u.path) !== null)
    type Upload = (typeof uploads)[number]
    const fit = splitPackable<Upload | ZilInclude | { path: string; bytes: Uint8Array }>(
      [...uploads.filter(u => libraryFileFor(u.path) === null), ...zilIncludes, ...hiddenEntries],
      [main],
      scripts.length > 0 ? ['tests'] : [],
      f => ('id' in f ? includeNameOf(f.path) : null),
    )
    const kept = fit.kept.filter((f): f is Upload => 'id' in f)
    // ZIL includes, in order, while the set stays one the editor can open.
    const zilKept: ZilProjectFile[] = []
    const zilOver: string[] = []
    for (const f of fit.kept) {
      if (!('zil' in f)) continue
      const next = [...zilKept, { path: f.path, text: f.text }]
      if (planZilFiles(next, main).ok) zilKept.push({ path: f.path, text: f.text })
      else zilOver.push(f.path)
    }
    const includes = lang === 'zil' ? zilKept : kept.map(u => ({ path: u.path, text: u.text }))
    const renamed = kept.filter(u => includeNameOf(u.path) !== u.name).map(u => ({ from: u.title, to: u.path }))
    const opaque = fit.kept.filter((f): f is { path: string; bytes: Uint8Array } => 'bytes' in f)
    const leftOut = [...[...libraryNamed, ...fit.leftOut].map(f => f.path), ...zilOver, ...zilUnreadable]
    const skeinPath =
      extras?.skeinPath !== undefined && pathProblem(extras.skeinPath) === null ? extras.skeinPath : undefined

    // Per-test fields go back to the script with the same name (first unused
    // match, so same-named scripts keep theirs in order). A script renamed
    // since opening loses its extra fields — accepted: the IDE has no way to
    // show or carry them through a rename.
    const pool = [...(extras?.testExtras ?? [])]
    const onlySeed =
      extras?.noTests === true &&
      scripts.length === 1 &&
      scripts[0]!.name === SEED_SCRIPT.name &&
      scripts[0]!.text === SEED_SCRIPT.text
    const tests: ProjectSnapshot['tests'] = (onlySeed ? [] : scripts).map(s => {
      const i = pool.findIndex(x => x.name === s.name)
      if (i === -1) return s
      const [hit] = pool.splice(i, 1)
      return { ...s, extra: hit!.extra }
    })

    const snapshot: ProjectSnapshot = {
      language: lang,
      main: { name: main, text },
      includes,
      extensions: extensionNames(extras, new Set(kept.map(u => u.id))),
      tests,
      // A root-only tree is "no Skein yet".
      skein: countNodes(tree) > 0 ? tree : null,
      settings: lang === 'i6' ? { target, library } : { target },
      opaque,
      manifestExtra: extras?.manifestExtra ?? {},
    }
    if (title !== undefined) snapshot.title = title
    // The game's saved solution (a recording's unsaved live text isn't one).
    const solution = solutions.text.value
    if (solution !== null) snapshot.solution = solution
    if (extras?.created !== undefined) snapshot.created = extras.created
    if (skeinPath !== undefined) snapshot.skeinPath = skeinPath

    const bytes = await writeProjectPackage(snapshot, {
      generator: `Frotzsmith ${currentAbout().version}`,
      now: new Date(),
    })
    // The writer drops compiled stories; everything else opaque goes back in.
    const hidden = snapshot.opaque.map(f => f.path).filter(path => !COMPILED.test(path))
    return { bytes, filename, hidden, leftOut, renamed }
  }

  /**
   * What opening `p` would replace that is real work, as phrases for the
   * confirmation ("the source in the editor", …); empty when nothing is.
   *  - source that isn't empty or a language seed;
   *  - uploaded extensions the open would replace with different ones
   *    (extensions are per language, not per game);
   *  - in the bucket of the game the package opens UNDER (its story key):
   *    test scripts other than the starter one, a Skein with commands, or a
   *    solution, that differ from the package's — the open replaces all
   *    three wholesale.
   */
  async function whatOpenReplaces(p?: PendingOpen): Promise<string[]> {
    const out: string[] = []
    if (!isPristine(ide.source.value)) out.push('the source in the editor')
    if (!p || p.project.language !== profile.value.id) return out

    if (profile.value.id === 'i6') {
      const current = extensions.uploaded.value
      const incoming = new Map(p.project.includes.map(f => [`uploaded:${includeNameOf(f.path)}`, f.text]))
      if (current.length > 0 && (current.length !== incoming.size || current.some(u => incoming.get(u.id) !== u.content)))
        out.push('your uploaded extensions')
    } else {
      // The open project's extra .zil files: replaced by the package's.
      const current = zilFiles.files.value
      const incoming = p.project.includes
      if (current.length > 0 && (current.length !== incoming.length || current.some((f, i) => f.path !== incoming[i]!.path || f.text !== incoming[i]!.text)))
        out.push('the project’s other ZIL files')
    }

    const lang = p.project.language
    const key = storyKeyOf(lang, p.project.main.text)
    const title = displayPath(storyTitleOf(lang, p.project.main.text) || 'Untitled', 80)
    const isSeed = (s: { name: string; text: string }) => s.name === SEED_SCRIPT.name && s.text === SEED_SCRIPT.text
    const same = (a: { name: string; text: string }[], b: { name: string; text: string }[]) =>
      a.length === b.length && a.every((s, i) => s.name === b[i]!.name && s.text === b[i]!.text)
    const stored = testScripts.scriptsFor(key).filter(s => !isSeed(s))
    const incoming = p.project.tests.filter(s => !isSeed(s))
    if (stored.length > 0 && !same(stored, incoming)) out.push(`the test scripts saved for “${title}”`)

    // The live tree when the package lands on the current game; else storage
    // (after flushing, so a just-made edit is there).
    let tree = key === ide.activeStoryKey.value ? skein.tree.value : null
    if (!tree) {
      await skein.flushSaves()
      tree = await getSkeinStore().load(`${profile.value.stateKey}:${key}`)
    }
    if (tree && countNodes(tree) > 0 && (!p.project.skein || skeinSignature(tree) !== skeinSignature(p.project.skein)))
      out.push(`the Skein saved for “${title}”`)

    // The solution saved for that game, when the package's differs (none counts).
    const storedSolution = solutions.textFor(key)
    if (storedSolution !== null && storedSolution !== p.project.solution) out.push(`the solution saved for “${title}”`)
    return out
  }

  /** Opening would replace real work (see whatOpenReplaces), or install or
   *  enable an extension — which every Inform 6 game then uses (F1). */
  async function needsConfirm(p?: PendingOpen): Promise<boolean> {
    if (p && p.extensions.length > 0) return true
    return (await whatOpenReplaces(p)).length > 0
  }

  return { buildPackage, inspect, apply, needsConfirm, whatOpenReplaces }
}
