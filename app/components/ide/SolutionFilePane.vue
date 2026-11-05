<script setup lang="ts">
/**
 * The left-pane `solution.txt` tab (SourcePane shows it in place of the code
 * editor). While Play runs on the right, the game's solution sits here:
 *
 * - **Recording:** read-only, regenerated live, scrolled to the end.
 * - **Paused / Stopped:** editable; edits save through useSolutions().edit
 *   (memory at once, storage after ~1 s idle).
 * - **Spoiler guard:** a solution never revealed for this game is not shown —
 *   only a "hidden" note with Show solution. A from-scratch recording shows
 *   its own live text only (useSolutions().visible / view).
 *
 * The recorder's light and Pause/Resume/Stop sit at the top.
 */
const solutions = useSolutions()
const { view, visible, readOnly } = solutions
const tab = useSolutionTab()
const { storyTitle } = useIde()
const { state } = useSolutionRecorder()

const area = shallowRef<HTMLTextAreaElement | null>(null)
const message = ref<string | null>(null)
const text = computed(() => view.value ?? '')

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  const r = solutions.edit(el.value)
  if (r.ok) {
    message.value = null
  } else {
    // Refused (over a cap, or recording): the store is unchanged, so is the text.
    message.value = r.message
    el.value = text.value
  }
}

// Live while recording: keep the newest command and reply in view.
watch(text, async () => {
  if (!readOnly.value) return
  await nextTick()
  const el = area.value
  if (el) el.scrollTop = el.scrollHeight
})
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-1.5">
      <SolutionRecorderBar compact />
    </div>

    <div v-if="!visible" class="frotz-grid flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <UIcon name="i-lucide-book-open-check" class="size-8 text-primary" />
      <p class="font-semibold">Hidden — press Show solution</p>
      <p class="text-muted max-w-sm text-sm">A solution tells the whole game, so it stays hidden until you ask for it.</p>
      <UButton color="primary" icon="i-lucide-eye" @click="tab.showSolution()">Show solution</UButton>
    </div>

    <template v-else>
      <textarea
        ref="area"
        :value="text"
        :readonly="readOnly"
        :aria-label="`solution.txt for ${storyTitle || 'Untitled'}${readOnly ? ', read-only while recording' : ''}`"
        spellcheck="false"
        class="min-h-0 w-full flex-1 resize-none bg-default px-4 py-3 font-mono text-sm text-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        :class="readOnly ? 'cursor-default opacity-90' : ''"
        @input="onInput"
      />
      <p v-if="readOnly" class="text-muted shrink-0 border-t border-default px-3 py-1 text-xs">
        Read-only while recording; press Pause to edit.
      </p>
      <p v-else-if="state === 'paused'" class="text-muted shrink-0 border-t border-default px-3 py-1 text-xs">
        Resume rebuilds the text from its <code>&gt;</code> lines; other notes aren’t kept.
      </p>
      <p v-if="message" class="text-error shrink-0 border-t border-default px-3 py-1 text-xs" role="status">{{ message }}</p>
    </template>
  </div>
</template>
