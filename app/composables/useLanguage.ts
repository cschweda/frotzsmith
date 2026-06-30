import type { LanguageProfile, CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from '~/modules/inform6/types'
import { I6_PROFILE } from '~/modules/languages/i6/profile'

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

// ─── Minimal zil stub ───────────────────────────────────────────────────────
// Task 10 calls registerProfile(ZIL_PROFILE) to replace this.
registerProfile({
  id: 'zil',
  label: 'ZIL',
  badge: 'alpha',
  route: '/zil/',
  fileExt: 'zil',
  stateKey: 'zil',
  versionTargets: ['z3', 'z5'],
  async compile(_source: string, _opts: CompileOpts): Promise<CompileResult> {
    throw new Error('zil compile stub — replace via registerProfile(ZIL_PROFILE) in Task 10')
  },
})

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
