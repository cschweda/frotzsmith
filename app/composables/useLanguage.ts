import type { LanguageProfile, CompileOpts } from '~/modules/languages/types'
import type { CompileResult } from '~/modules/inform6/types'

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

// ─── Minimal i6 stub ────────────────────────────────────────────────────────
// Task 2 calls registerProfile(I6_PROFILE) to replace this.
registerProfile({
  id: 'i6',
  label: 'Inform 6',
  badge: 'beta',
  route: '/',
  fileExt: 'inf',
  stateKey: 'i6',
  versionTargets: ['z3', 'z4', 'z5', 'z8'],
  async compile(_source: string, _opts: CompileOpts): Promise<CompileResult> {
    throw new Error('i6 compile stub — replace via registerProfile(I6_PROFILE) in Task 2')
  },
})

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
