<script setup lang="ts">
import { nextPlaythroughName } from '~/composables/play-transcript'

const { commands, count, text, reset } = usePlayTranscript()
const { scripts, addFromText } = useTestScripts()
const { activeTab } = useIde()

// Spin the captured commands into a new, non-destructive Test Script, then focus it.
function copyToTestScript() {
  if (!count.value) return
  addFromText(nextPlaythroughName(scripts.value.map(s => s.name)), text.value)
  activeTab.value = 'testscript'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Action bar -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2">
      <span class="text-muted text-sm font-semibold">
        {{ count }} command{{ count === 1 ? '' : 's' }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-copy"
          :disabled="!count"
          title="Create a Test Script from these commands"
          @click="copyToTestScript"
        >
          Copy to Test Script
        </UButton>
        <UButton
          color="neutral"
          variant="subtle"
          size="sm"
          icon="i-lucide-trash-2"
          :disabled="!count"
          title="Clear the transcript"
          @click="reset"
        >
          Clear
        </UButton>
      </div>
    </div>

    <!-- Transcript (read-only) -->
    <div
      class="min-h-0 flex-1 overflow-auto px-4 py-3"
      tabindex="0"
      role="region"
      aria-label="Play transcript — commands you typed"
    >
      <div
        v-if="!count"
        class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon name="i-lucide-history" class="size-10 text-primary" />
        <p class="text-lg font-semibold">No commands yet</p>
        <p class="text-muted max-w-sm text-sm">
          Play your game — the commands you type appear here as a transcript.
        </p>
      </div>

      <ol v-else class="space-y-1">
        <li v-for="(cmd, i) in commands" :key="i" class="font-mono text-sm">
          <span class="text-muted select-none">{{ i + 1 }}.</span>
          <span class="text-primary ml-1 font-semibold">&gt; {{ cmd }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>
