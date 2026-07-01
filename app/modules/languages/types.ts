import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import type { LanguageSupport } from '@codemirror/language'

export type { CompileResult, StoryExt }

/** Options passed to a language profile's compile function. */
export interface CompileOpts {
  /** Story-file version to target (z3/z4/z5/z8/ulx). */
  ext?: StoryExt
  /** Std/Puny library profile selector (Inform 6 only). */
  profileId?: 'std' | 'puny'
  /** User-uploaded extension files to mount (Inform 6 only). */
  extensions?: { name: string; content: string }[]
}

/**
 * A LanguageProfile describes one source language Frotzsmith can compile.
 * Currently two IDs are supported: 'i6' (Inform 6) and 'zil' (ZIL).
 *
 * Task 2 populates the real I6_PROFILE.
 * Task 10 populates the real ZIL_PROFILE.
 */
export interface LanguageProfile {
  id: 'i6' | 'zil'
  /** Human-readable name shown in the UI. */
  label: string
  /** Maturity badge shown in the language selector. */
  badge: 'beta' | 'alpha'
  /** Root route for this language's IDE, e.g. '/' or '/zil/'. */
  route: string
  /** Source file extension, e.g. 'inf' or 'zil'. */
  fileExt: string
  /**
   * Key prefix used to namespace Nuxt useState keys for this language.
   * e.g. 'i6' → useState keys like 'frotzsmith:i6:*'
   */
  stateKey: string
  /** Story-file formats the compiler can emit for this language. */
  versionTargets: StoryExt[]
  /** Compile the given source to a story file. */
  compile(source: string, opts: CompileOpts): Promise<CompileResult>
  /** Returns the CodeMirror LanguageSupport instance for this language's editor mode. */
  editorMode: () => LanguageSupport
}
