import type { LanguageProfile, CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from '~/modules/inform6/types'
import { inform6 } from '~/modules/inform6/editor/i6-language'
import { useI6Wasm } from '~/composables/useI6Wasm'

/**
 * I6_PROFILE: the Inform 6 language profile.
 *
 * Compile delegates here via useLanguage().profile.value.compile(), and runs
 * in a Web Worker with a wall-clock timeout (useI6Wasm; main-thread fallback
 * for environments where the worker can't boot — including Node tests). The
 * heavy compile body + library text (compile-main.ts) lives in the worker's
 * chunk graph / behind a dynamic import, so this module — on the critical
 * path of every page through useLanguage — stays light.
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

  compile(source: string, opts: CompileOpts): Promise<CompileResult> {
    return useI6Wasm().compile(source, opts)
  },
}
