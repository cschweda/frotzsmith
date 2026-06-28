import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { PROFILES, type ProfileId } from '~/modules/inform6/profiles'
import { parseDiagnostics, parseStats } from '~/utils/parse-diagnostics'

const VERSION_SWITCH: Record<StoryExt, string> = {
  z3: '-v3',
  z4: '-v4',
  z5: '-v5',
  z8: '-v8',
  ulx: '-G',
}

/**
 * Compiles Inform 6 source to a story file entirely in the browser, using the
 * active library profile (Standard Library or PunyInform): mounts that profile's
 * includes + the source in MEMFS, runs the WASM compiler at the profile's default
 * story version, reads the story file back, and parses diagnostics.
 */
export function useCompiler() {
  const { createInstance } = useCompilerWasm()

  async function compile(
    source: string,
    opts: {
      profileId?: ProfileId
      ext?: StoryExt
      extensions?: { name: string; content: string }[]
    } = {},
  ): Promise<CompileResult> {
    const profile = PROFILES[opts.profileId ?? 'std']
    const ext = opts.ext ?? profile.defaultExt
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
    mkdir(profile.includePath)
    for (const file of profile.files) m.FS.writeFile(file.path, file.content)
    // Mount enabled extensions so `Include "name";` resolves to name.h.
    for (const ext of opts.extensions ?? []) {
      m.FS.writeFile(`${profile.includePath}/${ext.name}.h`, ext.content)
    }

    mkdir('/work')
    m.FS.writeFile('/work/story.inf', source)
    m.FS.chdir('/work') // Inform writes output relative to the working directory

    const outName = `story.${ext}`
    try {
      m.callMain([
        `+include_path=${profile.includePath}`,
        '-s', // emit statistics (story size, memory use) for the stats bar
        VERSION_SWITCH[ext],
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
  }

  return { compile }
}
