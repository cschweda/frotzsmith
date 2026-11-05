<script setup lang="ts">
/**
 * The solution recorder's light and controls, shared by the Play pane, the
 * Solution tab and (Task 5) the left-pane solution tab header.
 *
 * The light is a coloured dot plus a word — Recording (green), Paused
 * (amber), Stopped (red) — so it never relies on colour alone. State changes
 * and automatic notices are announced once, by the live region in
 * RightPaneTabs, not here (several bars can be mounted at once).
 *
 * `showStart` adds Record / Continue recording while Stopped (the Solution
 * tab); without it the bar only steers a running session.
 */
import type { RecorderResult } from '~/composables/useSolutionRecorder'

const props = withDefaults(defineProps<{ showStart?: boolean; compact?: boolean }>(), {
  showStart: false,
  compact: false,
})

const recorder = useSolutionRecorder()
const { has } = useSolutions()
const { storyTitle } = useIde()
const { state, saving, notice, hasUnsaved, revealed } = recorder

const light = computed(() => {
  switch (state.value) {
    case 'recording':
      return { word: 'Recording', dot: 'bg-success', text: 'text-success' }
    case 'paused':
      return { word: 'Paused', dot: 'bg-warning', text: 'text-warning' }
    default:
      return { word: 'Stopped', dot: 'bg-error', text: 'text-error' }
  }
})

const size = computed(() => (props.compact ? 'xs' : 'sm'))
const busy = ref(false)
/** The last action's failure, shown under the bar (automatic changes use `notice`). */
const failure = ref<string | null>(null)
const confirmRecord = ref(false)

async function run(action: () => Promise<RecorderResult>) {
  if (busy.value) return
  busy.value = true
  failure.value = null
  try {
    const r = await action()
    if (!r.ok) {
      if (r.needsConfirm) confirmRecord.value = true
      else failure.value = r.message
    } else if (r.note) {
      failure.value = r.note
    }
  } finally {
    busy.value = false
  }
}

const onRecord = () => run(() => recorder.record())
function onConfirmRecord() {
  confirmRecord.value = false
  void run(() => recorder.record({ confirmed: true }))
}
const onPause = () => run(() => recorder.pause())
const onResume = () => run(() => recorder.resume())
const onStop = () => run(() => recorder.stop())
const onContinue = () => run(() => recorder.continueRecording())
const onRetry = () => run(() => recorder.retrySave())

</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm font-semibold" :class="light.text">
        <span class="size-2.5 rounded-full" :class="[light.dot, state === 'recording' ? 'motion-safe:animate-pulse' : '']" aria-hidden="true" />
        <span>{{ light.word }}</span>
        <span class="sr-only">(solution recording)</span>
      </span>
      <span v-if="saving" class="text-muted text-xs">Saving…</span>

      <template v-if="state === 'recording'">
        <UButton :size="size" color="warning" variant="subtle" icon="i-lucide-pause" :disabled="busy" aria-label="Pause recording and save the solution so far" @click="onPause">
          Pause
        </UButton>
        <UButton :size="size" color="error" variant="subtle" icon="i-lucide-square" :disabled="busy" aria-label="Stop recording and save the solution" @click="onStop">
          Stop
        </UButton>
      </template>
      <template v-else-if="state === 'paused'">
        <UButton :size="size" color="success" variant="subtle" icon="i-lucide-play" :disabled="busy || saving" aria-label="Resume recording from the end of the solution" @click="onResume">
          Resume
        </UButton>
        <UButton :size="size" color="error" variant="subtle" icon="i-lucide-square" :disabled="busy || saving" aria-label="Stop recording and save the solution" @click="onStop">
          Stop
        </UButton>
      </template>
      <template v-else-if="showStart">
        <UButton :size="size" color="success" variant="subtle" icon="i-lucide-circle-dot" :disabled="busy || saving" aria-label="Record a solution from the start of the game" @click="onRecord">
          Record
        </UButton>
        <UButton
          v-if="has && revealed"
          :size="size"
          color="neutral"
          variant="subtle"
          icon="i-lucide-step-forward"
          :disabled="busy || saving"
          aria-label="Continue recording from the end of the solution"
          @click="onContinue"
        >
          Continue recording
        </UButton>
      </template>
      <UButton
        v-if="hasUnsaved && state !== 'recording'"
        :size="size"
        color="warning"
        variant="subtle"
        icon="i-lucide-save"
        :disabled="busy || saving"
        aria-label="Retry save of the solution"
        @click="onRetry"
      >
        Retry save
      </UButton>
    </div>
    <!-- The clicked bar's own failure is a status (only this bar shows it).
         An automatic notice is in every mounted bar, so it is shown here but
         announced once, by the live region in RightPaneTabs. -->
    <p v-if="failure" class="text-muted text-xs" role="status">{{ failure }}</p>
    <p v-else-if="notice" class="text-muted text-xs">{{ notice }}</p>

    <OpenProjectModal
      v-model:open="confirmRecord"
      :title="storyTitle || 'Untitled'"
      :replaces="[]"
      :heading="`Replace the solution for “${storyTitle || 'Untitled'}”?`"
      description="Recording from scratch restarts the game and replaces this game’s solution when you pause or stop."
      confirm-label="Record"
      @replace="onConfirmRecord"
      @cancel="confirmRecord = false"
    />
  </div>
</template>
