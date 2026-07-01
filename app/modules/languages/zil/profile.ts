import type { LanguageProfile, CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from '~/modules/inform6/types'
import { useZilfWasm } from '~/composables/useZilfWasm'
import { zil } from '~/modules/languages/zil/mode'

/** Maps a StoryExt string to the numeric Z-machine version ZILF expects. */
const EXT_TO_VERSION: Record<string, number> = {
  z3: 3,
  z5: 5,
  z8: 8,
}

/**
 * ZIL_PROFILE: LanguageProfile for the ZIL (Zork Implementation Language)
 * compile path. Delegates to useZilfWasm() which drives the ZILF .NET WASM
 * bundle via a lazy Web Worker.
 *
 * The numeric version passed to compile() matches the first element of
 * versionTargets (z3 → 3) when opts.ext is absent, consistent with the
 * Infocom-authentic z3 target used by all ZIL_SAMPLES.
 *
 * NOTE: Do NOT prepend a <VERSION> directive in the source here — the ZILF
 * worker already prepends `<VERSION {version}>` before compiling.
 */
export const ZIL_PROFILE: LanguageProfile = {
  id: 'zil',
  label: 'ZIL',
  badge: 'alpha',
  route: '/zil/',
  fileExt: 'zil',
  stateKey: 'zil',
  versionTargets: ['z3', 'z5', 'z8'],

  editorMode: zil,

  async compile(source: string, opts: CompileOpts): Promise<CompileResult> {
    const version = (opts.ext !== undefined ? EXT_TO_VERSION[opts.ext] : undefined) ?? 3
    return useZilfWasm().compile(source, version)
  },
}
