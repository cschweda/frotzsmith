import demoSource from '~/modules/inform6/samples/demo.inf?raw'
import zilSkeletonSource from '~/modules/languages/zil/samples/skeleton.zil?raw'

/**
 * True when `text` is nothing the author wrote: empty, or one of the language
 * seeds (the I6 demo, the ZIL skeleton). Replacing a pristine buffer needs no
 * confirmation — share links auto-load over it and opening a project skips the
 * "Replace the project?" question.
 */
export function isPristine(text: string): boolean {
  const t = text.trim()
  return t === '' || t === demoSource.trim() || t === zilSkeletonSource.trim()
}
