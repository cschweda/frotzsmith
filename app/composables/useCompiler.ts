import type { CompileResult } from '~/modules/inform6/types'
import type { CompileOpts } from '~/modules/languages/types'

/**
 * Compiles the current source by delegating to the active language profile's
 * compile method (useLanguage().profile.value.compile). The full Inform 6
 * compile logic now lives in I6_PROFILE (app/modules/languages/i6/profile.ts).
 *
 * Public surface is unchanged: compile(source, opts) → CompileResult.
 */
export function useCompiler() {
  async function compile(
    source: string,
    opts: CompileOpts = {},
  ): Promise<CompileResult> {
    const { profile } = useLanguage()
    return profile.value.compile(source, opts)
  }

  return { compile }
}
