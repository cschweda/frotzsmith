import { compile } from '@frotzinc/inform6-wasm'
import type { CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from './types'
import { PROFILES } from './profiles'
import { useCompilerWasm } from '~/composables/useCompilerWasm'

/**
 * The real Inform 6 compile, through @frotzinc/inform6-wasm: it mounts the
 * library + extensions in MEMFS (extensions first, the library over them, an
 * explicit override last — audit F1), runs inform6.wasm with `-s -Cu`, and
 * parses diagnostics and stats. This adapter maps frotzsmith's CompileOpts in
 * and its CompileResult out; the Emscripten instance comes from
 * useCompilerWasm (the bundler seam the tests mock).
 *
 * The package statically carries the heavy library text, so this module must
 * never be imported statically from UI code — it is reached only from the
 * compile Web Worker (inform6.worker.ts) or via dynamic import on the
 * main-thread fallback path (useI6Wasm). Runs identically in a Worker, on the
 * main thread, and under Node (the golden/crash tests).
 */
export async function runI6Compile(source: string, opts: CompileOpts): Promise<CompileResult> {
  const { createInstance } = useCompilerWasm()
  const libProfile = PROFILES[opts.profileId ?? 'std']
  const ext = opts.ext ?? libProfile.defaultExt

  const r = await compile(source, {
    version: ext,
    library: libProfile.id,
    extensions: opts.extensions ?? [],
    instantiate: createInstance,
  })

  return {
    ok: r.ok,
    storyFile: r.story,
    storyExt: ext,
    diagnostics: r.diagnostics,
    rawStderr: r.rawOutput,
    ms: r.ms,
    byteLength: r.story?.length ?? 0,
    stats: r.stats,
  }
}
