export const ZIP_MAX_ENTRIES = 200
export const ZIP_MAX_TOTAL_BYTES = 5 * 1024 * 1024 // 5 MB of expanded .h text

/**
 * Cumulative cap across ALL uploaded extensions (per language). They persist
 * as one localStorage value, and the whole origin typically gets 5-10 MB —
 * shared with the crash-recovery snapshot and test scripts. Without a total
 * cap, 2-3 large uploads exhaust the quota and every later persist (including
 * autosave) fails.
 */
export const EXTENSIONS_TOTAL_MAX_BYTES = 4 * 1024 * 1024

export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZipLimitError'
  }
}

/**
 * Stateful fflate `filter` for extension archives: admits only `.h` entries and
 * throws once the archive exceeds the entry-count or total-uncompressed-size
 * budget — a zip bomb is rejected BEFORE it expands (fflate consults `filter`
 * per entry, ahead of decompression). See README security audit 2026-06-30.
 */
export function makeZipEntryFilter(
  limits: { maxEntries?: number; maxTotalBytes?: number } = {},
): (info: { name: string; originalSize: number }) => boolean {
  const maxEntries = limits.maxEntries ?? ZIP_MAX_ENTRIES
  const maxTotal = limits.maxTotalBytes ?? ZIP_MAX_TOTAL_BYTES
  let entries = 0
  let total = 0
  return info => {
    if (!info.name.toLowerCase().endsWith('.h')) return false
    entries += 1
    total += info.originalSize
    if (entries > maxEntries) throw new ZipLimitError(`Archive has too many .h files (max ${maxEntries}).`)
    if (total > maxTotal)
      throw new ZipLimitError(`Archive expands past the ${Math.round(maxTotal / 1024 / 1024)} MB limit.`)
    return true
  }
}
