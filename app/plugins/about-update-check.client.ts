import { checkMessage } from '~/update/check'
import { runUpdateCheck, useUpdateCheck } from '~/update/use-check'
import { currentAbout } from '~/utils/about'

/**
 * The family About menu's "Check for updates" (@frotzinc/nuxt-base) runs frotzsmith's own check,
 * which goes through its service worker (and knows the desktop build can't check): a found update
 * becomes the app's usual offer (UpdatePrompt), and the toast says what the check found.
 */
export default defineNuxtPlugin(() => {
  const toast = useToast()
  useAbout().setUpdateCheck(async () => {
    await runUpdateCheck()
    const state = useUpdateCheck().state.value
    const message = checkMessage(state, currentAbout().version)
    if (!message || state.status === 'ready') return // the offer (UpdatePrompt) speaks for itself
    toast.add({
      title: message,
      icon: state.status === 'latest' ? 'i-lucide-check' : 'i-lucide-wifi-off',
      color: state.status === 'latest' ? 'neutral' : 'warning',
    })
  })
})
