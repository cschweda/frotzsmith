import { readProjectPackage, writeProjectPackage, type ProjectSnapshot } from '~/project-package/project'
import { PackageError } from '~/project-package/errors'
import { LIMITS } from '~/project-package/container'
import type { Target } from '~/project-package/manifest'
import { countNodes, createTree } from '~/composables/skein-tree'
import { getExtrasStore, type ProjectExtras } from '~/composables/project-extras-store'
import { includePathOf, planUploaded } from '~/composables/useExtensions'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { currentAbout } from '~/utils/about'
import { isPristine } from '~/utils/pristine'
import { slugify } from '~/utils/slug'

/** A package that has been read and checked, waiting for the author to confirm. */
export interface PendingOpen {
  project: ProjectSnapshot
  ignored: string[]
  hashMismatches: string[]
  /** Files kept with the project that the IDE doesn't show. */
  hiddenCount: number
}

const TARGETS: readonly string[] = ['auto', 'z3', 'z4', 'z5', 'z8']

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

  const extrasKey = () => `${profile.value.stateKey}:${ide.activeStoryKey.value}`

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
    check(read.project)
    return { ...read, hiddenCount: read.project.opaque.length }
  }

  async function apply(p: PendingOpen): Promise<void> {
    const project = p.project
    const plan = check(project) // nothing has changed yet
    const lang = profile.value.id

    // Every write below is synchronous and none can throw: storage failures
    // go through notifyStorageFull, so the IDE is never left half-opened.
    // The source first: loadSource resets run state and moves to the opened
    // game's story key, which every later write is keyed by.
    ide.loadSource(project.main.text)
    sourceDoc.save() // durable now, not after the autosave debounce
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
    if (project.created !== undefined) extras.created = project.created
    if (project.skeinPath !== undefined) extras.skeinPath = project.skeinPath
    const [saved] = await Promise.all([getExtrasStore().save(extrasKey(), extras), skein.flushSaves()])
    if (!saved) notifyStorageFull()
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

  async function buildPackage(): Promise<{ bytes: Uint8Array; filename: string }> {
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

    const extras = await getExtrasStore().load(key)

    const mainExt = lang === 'i6' ? '.inf' : '.zil'
    const main = extras?.main?.toLowerCase().endsWith(mainExt) ? extras.main : `${slugify(title ?? '') || 'story'}${mainExt}`

    // Per-test fields go back to the script with the same name (first unused
    // match, so same-named scripts keep theirs in order). A script renamed
    // since opening loses its extra fields — accepted: the IDE has no way to
    // show or carry them through a rename.
    const pool = [...(extras?.testExtras ?? [])]
    const tests: ProjectSnapshot['tests'] = scripts.map(s => {
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
      skein: countNodes(tree) > 1 ? tree : null,
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
    return { bytes, filename }
  }

  /** Opening would replace real work (anything but empty or a language seed). */
  function needsConfirm(): boolean {
    return !isPristine(ide.source.value)
  }

  return { buildPackage, inspect, apply, needsConfirm }
}
