import type { CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from './types'
import { PROFILES } from './profiles'
import { PROFILE_FILES } from './profile-files'
import { parseDiagnostics, parseStats } from '~/utils/parse-diagnostics'
import { useCompilerWasm } from '~/composables/useCompilerWasm'

const VERSION_SWITCH: Record<string, string> = {
  z3: '-v3',
  z4: '-v4',
  z5: '-v5',
  z8: '-v8',
  ulx: '-G',
}

/**
 * The real Inform 6 compile: mounts the library + extensions in MEMFS, runs
 * inform6.wasm, and parses diagnostics/stats into a CompileResult.
 *
 * This module statically imports the heavy PROFILE_FILES library text, so it
 * must never be imported statically from UI code — it is reached only from
 * the compile Web Worker (inform6.worker.ts) or via dynamic import on the
 * main-thread fallback path (useI6Wasm). Runs identically in a Worker, on
 * the main thread, and under Node (the golden/crash tests).
 */
export async function runI6Compile(source: string, opts: CompileOpts): Promise<CompileResult> {
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
  for (const file of PROFILE_FILES[libProfile.id]) m.FS.writeFile(file.path, file.content)
  // Mount enabled extensions so `Include "name";` resolves to name.h.
  for (const extFile of opts.extensions ?? []) {
    m.FS.writeFile(`${libProfile.includePath}/${extFile.name}.h`, extFile.content)
  }

  mkdir('/work')
  m.FS.writeFile('/work/story.inf', source)
  m.FS.chdir('/work') // Inform writes output relative to the working directory

  const outName = `story.${ext}`
  let crash: string | null = null
  try {
    m.callMain([
      `+include_path=${libProfile.includePath}`,
      '-s', // emit statistics (story size, memory use) for the stats bar
      // FS.writeFile encodes the editor string as UTF-8; without -Cu Inform
      // reads ISO-8859-1 and non-ASCII prose silently mojibakes in-game.
      '-Cu',
      VERSION_SWITCH[ext]!,
      'story.inf',
      outName,
    ])
  } catch (e) {
    // Emscripten throws ExitStatus for ordinary non-zero exits — the parsed
    // diagnostics carry that detail. Anything else is a real crash (e.g. a
    // WASM RuntimeError trap) and must not vanish.
    const name = (e as { name?: string } | null)?.name
    if (name !== 'ExitStatus') crash = String(e)
  }

  const raw = out.join('\n')
  const { diagnostics, errorCount } = parseDiagnostics(raw)
  if (crash) diagnostics.push({ severity: 'fatal', message: `Compiler crashed: ${crash}` })

  let storyFile: Uint8Array | undefined
  try {
    storyFile = m.FS.readFile(`/work/${outName}`)
  } catch {
    // no output produced
  }

  return {
    ok: errorCount === 0 && !crash && !!storyFile,
    storyFile,
    storyExt: ext,
    diagnostics,
    rawStderr: raw,
    ms: Math.round(performance.now() - started),
    byteLength: storyFile?.length ?? 0,
    stats: parseStats(raw),
  }
}
