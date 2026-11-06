import { slugify } from '@frotzinc/nuxt-base/utils/slug'

/**
 * The story title in a source — language-aware.
 * I6: reads `Constant Story "…"`.
 * ZIL: reads the first pipe-segment of `<CONSTANT GAME-BANNER "Title|…">`.
 */
export function storyTitleOf(language: 'i6' | 'zil', source: string): string | undefined {
  if (language === 'zil') {
    const banner = /<CONSTANT\s+GAME-BANNER[^"]*"([^"]*)/i.exec(source)?.[1] ?? ''
    const title = banner.split('|')[0]?.trim().replace(/[\r\n]/g, ' ').trim()
    return title || undefined
  }
  return /Constant\s+Story\s+"([^"]*)"/i.exec(source)?.[1]?.trim()
}

/** The per-game storage key a source loads under: its title's slug, or 'untitled'. */
export function storyKeyOf(language: 'i6' | 'zil', source: string): string {
  return slugify(storyTitleOf(language, source) || '') || 'untitled'
}
