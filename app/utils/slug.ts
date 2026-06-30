/** Kebab-case a story title for use as a filename stem. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/['’]/g, '')     // drop straight + curly apostrophes (hermit's → hermits)
    .replace(/[^a-z0-9]+/g, '-')        // other non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '')            // trim leading/trailing hyphens
}

/** Filename stem for a story: slug of the title (or 'story'), '-puny' for PunyInform. */
export function storyBaseName(title: string | undefined | null, isPuny: boolean): string {
  const base = slugify(title ?? '') || 'story'
  return isPuny ? `${base}-puny` : base
}
