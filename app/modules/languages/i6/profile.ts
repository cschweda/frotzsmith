import type { LanguageProfile, CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from '~/modules/inform6/types'
import { inform6 } from '~/modules/inform6/editor/i6-language'

/**
 * I6_PROFILE: the Inform 6 language profile.
 *
 * Compile delegates here via useLanguage().profile.value.compile(). The real
 * compile body lives in `~/modules/inform6/compile-main` (runI6Compile), which
 * carries the heavy library text — it is reached only via dynamic import so
 * this module (on the critical path of every page through useLanguage) stays
 * light.
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
    const { runI6Compile } = await import('~/modules/inform6/compile-main')
    return runI6Compile(source, opts)
  },
}
