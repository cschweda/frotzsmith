/**
 * Frotzsmith — single source of truth for app-wide constants.
 *
 * Imported by `nuxt.config.ts` (build time) and by app code at runtime via the
 * `~~/frotzsmith.config` alias. Put tunable identity, versions, limits, defaults,
 * and storage keys here — not scattered string literals.
 */
export const frotzsmith = {
  // ── Identity ──────────────────────────────────────────────────────────────
  name: 'Frotzsmith',
  tagline: 'A browser-based Inform 6 IDE',
  description:
    'A free, browser-based IDE for Inform 6 interactive fiction — write, compile to Z-machine, and play instantly, all client-side. Standard Library & PunyInform.',
  /** Public site URL — used for absolute og:image / canonical links. */
  siteUrl: 'https://frotzsmith.com',
  repoUrl: 'https://github.com/cschweda/frotzsmith',
  author: 'cschweda',

  // ── Toolchain versions (for display / banners) ────────────────────────────
  versions: {
    inform6: '6.44',
    stdlib: '6.12.8',
    punyinform: '6.7',
  },

  // ── Z-machine limits (bytes) — the real ceilings, for footer warnings ─────
  zmachine: {
    /** Readable ("dynamic") memory ceiling — 64 KB, identical across versions. */
    dynamicMemoryMax: 65536,
    /** Total story-file size caps per version. */
    sizeCaps: { z3: 131072, z4: 262144, z5: 262144, z8: 524288 } as Record<string, number>,
    /** Maximum object count per version (z3 is the tight one). */
    objectCaps: { z3: 255, z4: 65535, z5: 65535, z8: 65535 } as Record<string, number>,
  },

  // ── Defaults ──────────────────────────────────────────────────────────────
  defaults: {
    /** 'auto' = fuzzily detect Standard Library vs PunyInform from the source. */
    profileMode: 'auto' as const,
    /** 'auto' = use the active library's default story version. */
    target: 'auto' as const,
    /** Default story version when a profile doesn't say otherwise. */
    storyVersion: 'z5' as const,
  },

  // ── localStorage keys ─────────────────────────────────────────────────────
  storageKeys: {
    recovery: 'frotzsmith:recovery',
    profileMode: 'frotzsmith:profile-mode',
    target: 'frotzsmith:target',
    extensions: 'frotzsmith:extensions',
  },

  // ── Inline play (Parchment) ───────────────────────────────────────────────
  play: {
    /** The vendored Parchment player page; fed a story via ?story=. */
    page: '/play/index.html',
  },
} as const

export type FrotzsmithConfig = typeof frotzsmith
