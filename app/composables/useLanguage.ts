import type { LanguageProfile } from '~/modules/languages/types'
import { I6_PROFILE } from '~/modules/languages/i6/profile'
import { ZIL_PROFILE } from '~/modules/languages/zil/profile'

/**
 * Module-level registry mapping language id → LanguageProfile.
 * Task 2 replaces the i6 stub with the real I6_PROFILE via registerProfile().
 * Task 10 replaces the zil stub with the real ZIL_PROFILE.
 */
const _registry = new Map<string, LanguageProfile>()

/** Register (or replace) a language profile. */
export function registerProfile(profile: LanguageProfile): void {
  _registry.set(profile.id, profile)
}

// ─── Real I6_PROFILE ────────────────────────────────────────────────────────
// Replaces the Task 2 stub with the full Inform 6 compile path.
registerProfile(I6_PROFILE)

// ─── Real ZIL_PROFILE ───────────────────────────────────────────────────────
// Replaces the Task 10 stub with the full ZIL compile path via useZilfWasm.
registerProfile(ZIL_PROFILE)

/**
 * Composable that exposes the active language profile and a setter.
 *
 * State is shared via useState('frotz:lang') so every component calling
 * useLanguage() within the same Nuxt context sees the same active language.
 */
export function useLanguage() {
  const lang = useState<'i6' | 'zil'>('frotz:lang', () => 'i6')

  const profile = computed<LanguageProfile>(() => {
    const p = _registry.get(lang.value)
    if (!p) throw new Error(`No language profile registered for id "${lang.value}"`)
    return p
  })

  function setLanguage(id: 'i6' | 'zil') {
    lang.value = id
  }

  return { profile, setLanguage }
}
