import { COMPILED, readProjectPackage, writeProjectPackage, type ProjectSnapshot } from '~/project-package/project'
import { PackageError, displayPath } from '~/project-package/errors'
import { LIMITS } from '~/project-package/container'
import type { Target } from '~/project-package/manifest'
import { countNodes, createTree, type SkeinTree } from '~/composables/skein-tree'
import { getExtrasStore, type ProjectExtras } from '~/composables/project-extras-store'
import { getSkeinStore } from '~/composables/skein-store'
import { includeNameOf, includePathOf, planUploaded } from '~/composables/useExtensions'
import { BUNDLED_EXTENSIONS } from '~/modules/inform6/extensions'
import { SEED_SCRIPT } from '~/composables/useTestScripts'
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
}

const TARGETS: readonly string[] = ['auto', 'z3', 'z4', 'z5', 'z8']

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
    // Throws ZipLimitError (budget) or PackageError (name clash).
    return here === 'i6' ? planUploaded(project.includes, project.extensions) : null
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
    sourceDoc.save() // durable now, not after the autosave debounce
    const openedKey = ide.activeStoryKey.value
    const openedGen = sourceGen.value
    if (lang === 'i6') ide.setProfileMode(project.settings.library ?? 'auto')
    ide.setTargetMode(project.settings.target)
    const unknown = plan ? extensions.replaceUploaded(project.includes, project.extensions) : project.extensions
    testScripts.replaceAll(project.tests.map(t => ({ name: t.name, text: t.text })))
    skein.replaceTree(project.skein ?? createTree())

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
   *  in place, names disabled since dropped, newly enabled ones appended. */
  function extensionNames(extras: ProjectExtras | null): string[] {
    const enabled =
      profile.value.id === 'i6'
        ? extensions.all.value
            .filter(e => extensions.isEnabled(e.id))
            .map(e => (e.origin === 'bundled' ? e.name : includePathOf(e)))
        : []
    const keep = new Set([...enabled, ...(extras?.extensions?.unknown ?? [])])
    const order = (extras?.extensions?.order ?? []).filter(n => keep.has(n))
    return [...new Set([...order, ...enabled.filter(n => !order.includes(n))])]
  }

  /** `hidden`: the files written back that the IDE doesn't show (F15). */
  async function buildPackage(): Promise<{ bytes: Uint8Array; filename: string; hidden: string[] }> {
    const lang = profile.value.id
    const key = extrasKey()
    const filename = `${ide.storyBase.value}.frotzsmith`
    const title = ide.storyTitle.value
    const text = ide.source.value
    const target = TARGETS.includes(ide.targetMode.value) ? (ide.targetMode.value as Target) : 'auto'
    const library = ide.profileMode.value
    const includes =
      lang === 'i6' ? extensions.uploaded.value.map(u => ({ path: includePathOf(u), text: u.content })) : []
    const scripts = testScripts.scripts.value.map(s => ({ name: s.name, text: s.text }))
    const tree = skein.tree.value

    const owned = safeGetItem(ownerKey()) === ide.activeStoryKey.value
    const extras = owned ? await getExtrasStore().load(key) : null

    const mainExt = lang === 'i6' ? '.inf' : '.zil'
    const main = extras?.main?.toLowerCase().endsWith(mainExt) ? extras.main : `${slugify(title ?? '') || 'story'}${mainExt}`

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
      extensions: extensionNames(extras),
      tests,
      // A root-only tree is "no Skein yet".
      skein: countNodes(tree) > 0 ? tree : null,
      settings: lang === 'i6' ? { target, library } : { target },
      opaque: extras?.entries ?? [],
      manifestExtra: extras?.manifestExtra ?? {},
    }
    if (title !== undefined) snapshot.title = title
    if (extras?.created !== undefined) snapshot.created = extras.created
    if (extras?.skeinPath !== undefined) snapshot.skeinPath = extras.skeinPath

    const bytes = await writeProjectPackage(snapshot, {
      generator: `Frotzsmith ${currentAbout().version}`,
      now: new Date(),
    })
    // The writer drops compiled stories; everything else opaque goes back in.
    const hidden = snapshot.opaque.map(f => f.path).filter(path => !COMPILED.test(path))
    return { bytes, filename, hidden }
  }

  /**
   * What opening `p` would replace that is real work, as phrases for the
   * confirmation ("the source in the editor", …); empty when nothing is.
   *  - source that isn't empty or a language seed;
   *  - uploaded extensions the open would replace with different ones
   *    (extensions are per language, not per game);
   *  - in the bucket of the game the package opens UNDER (its story key):
   *    test scripts other than the starter one, or a Skein with commands,
   *    that differ from the package's — the open replaces both wholesale.
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
