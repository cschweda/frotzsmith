<script setup lang="ts">
import { frotzsmith } from '~~/frotzsmith.config'
import { checkMessage } from '~/update/check'
import { runUpdateCheck, takeUpdate, useUpdateCheck } from '~/update/use-check'
import { currentAbout } from '~/utils/about'

// About Frotzsmith: the build's identity and Check for updates. The footer button is the modal's
// trigger, so closing it returns focus there. A found update is the app's own offer
// (UpdatePrompt.vue); Reload here does what that offer's Reload does. Nothing reloads by itself.
const open = ref(false)
const about = currentAbout()
const check = useUpdateCheck()

const hasCommit = computed(() => !!about.commit && about.commit !== 'unknown')
const build = computed(() => [about.commit, about.date].filter(Boolean).join(' · '))
const message = computed(() => checkMessage(check.state.value, about.version))
const ready = computed(() => check.state.value.status === 'ready')
// While a check runs the button stays enabled (disabling it would drop a keyboard user's focus to
// the page): it says it is busy, and a second press is the same check (createUpdateCheck's run()).
const busy = computed(
  () => check.state.value.status === 'checking' || check.state.value.status === 'fetching',
)

function take() {
  open.value = false
  takeUpdate()
}
</script>

<template>
  <UModal v-model:open="open" title="About Frotzsmith" description="Version, license and updates.">
    <button
      type="button"
      class="hover:text-primary flex items-center gap-1.5"
      title="About Frotzsmith, and check for updates"
    >
      <UIcon name="i-lucide-badge-info" class="size-3.5" />
      About · v{{ about.version }}
    </button>

    <template #body>
      <div class="space-y-4 text-sm">
        <div>
          <p class="font-semibold">Frotzsmith v{{ about.version }}</p>
          <p v-if="hasCommit" class="text-muted text-xs" data-about-build>{{ build }}</p>
          <p class="mt-1 min-h-5" role="status" aria-live="polite" data-about-message>
            {{ message }}
          </p>
        </div>
        <p class="text-muted">
          Free software under the
          <a
            href="https://www.gnu.org/licenses/gpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline"
          >GNU GPL v3</a>.
          Source on
          <a
            :href="frotzsmith.repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline"
          >GitHub</a>.
        </p>
        <p class="text-muted">
          From
          <a
            :href="frotzsmith.familyUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline"
          >Frotz, Inc.</a>
          Frotz, Inc. is a fiction. The Frotz interpreter is the work of its own authors and is not affiliated.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :icon="busy ? 'i-lucide-loader-circle' : 'i-lucide-refresh-cw'"
          :ui="{ leadingIcon: busy ? 'motion-safe:animate-spin' : '' }"
          :aria-busy="busy"
          @click="runUpdateCheck"
        >
          Check for updates
        </UButton>
        <UButton v-if="ready" color="warning" @click="take">Reload</UButton>
      </div>
    </template>
  </UModal>
</template>
