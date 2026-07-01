import type { LanguageProfile, CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from '~/modules/inform6/types'
import { PROFILES } from '~/modules/inform6/profiles'
import { parseDiagnostics, parseStats } from '~/utils/parse-diagnostics'
import { useCompilerWasm } from '~/composables/useCompilerWasm'
import { inform6 } from '~/modules/inform6/editor/i6-language'

const VERSION_SWITCH: Record<string, string> = {
  z3: '-v3',
  z4: '-v4',
  z5: '-v5',
  z8: '-v8',
  ulx: '-G',
}

/**
 * Real I6_PROFILE: wraps the Inform 6 compile path that previously lived in
 * useCompiler.ts. Compile delegates here via useLanguage().profile.value.compile().
 *
 * Behavior is identical to the old useCompiler.compile() body:
 *   - Picks Std/Puny library via opts.profileId (defaults to 'std').
 *   - Mounts library files + user extensions in MEMFS.
 *   - Runs inform6.wasm via useCompilerWasm.
 *   - Returns a CompileResult with diagnostics, stats, and the story bytes.
 */
export const I6_PROFILE: LanguageProfile = {
  id: 'i6',
  label: 'Inform 6',
  badge: 'beta',
  route: '/',
  fileExt: 'inf',
  stateKey: 'i6',
  versionTargets: ['z3', 'z4', 'z5', 'z8'],

  editorMode: inform6,

  async compile(source: string, opts: CompileOpts): Promise<CompileResult> {
    const { createInstance } = useCompilerWasm()
    const libProfile = PROFILES[opts.profileId ?? 'std']
    const ext = opts.ext ?? libProfile.defaultExt
    const started = performance.now()
    const out: string[] = []

    const m = await createInstance({
      print: line => out.push(line),
      printErr: line => out.push(line),
    })

    const mkdir = (path: string) => {
      try {
        m.FS.mkdir(path)
      } catch {
        // already exists — fine
      }
    }

    mkdir('/lib')
    mkdir(libProfile.includePath)
    for (const file of libProfile.files) m.FS.writeFile(file.path, file.content)
    // Mount enabled extensions so `Include "name";` resolves to name.h.
    for (const extFile of opts.extensions ?? []) {
      m.FS.writeFile(`${libProfile.includePath}/${extFile.name}.h`, extFile.content)
    }

    mkdir('/work')
    m.FS.writeFile('/work/story.inf', source)
    m.FS.chdir('/work') // Inform writes output relative to the working directory

    const outName = `story.${ext}`
    try {
      m.callMain([
        `+include_path=${libProfile.includePath}`,
        '-s', // emit statistics (story size, memory use) for the stats bar
        VERSION_SWITCH[ext]!,
        'story.inf',
        outName,
      ])
    } catch {
      // Emscripten throws on non-zero exit; diagnostics below carry the detail.
    }

    const raw = out.join('\n')
    const { diagnostics, errorCount } = parseDiagnostics(raw)

    let storyFile: Uint8Array | undefined
    try {
      storyFile = m.FS.readFile(`/work/${outName}`)
    } catch {
      // no output produced
    }

    return {
      ok: errorCount === 0 && !!storyFile,
      storyFile,
      storyExt: ext,
      diagnostics,
      rawStderr: raw,
      ms: Math.round(performance.now() - started),
      byteLength: storyFile?.length ?? 0,
      stats: parseStats(raw),
    }
  },
}
