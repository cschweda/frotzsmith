<script setup lang="ts">
const { source, status, canPlay, runCompile, playStory } = useIde()

defineProps<{ actions?: boolean }>()

// The game's title & headline, read live from the source.
const meta = computed(() => {
  const story = /Constant\s+Story\s+"([^"]*)"/i.exec(source.value)?.[1]?.trim()
  const headline = (/Constant\s+Headline\s+"([^"]*)"/i.exec(source.value)?.[1] ?? '')
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { story: story || 'Untitled', headline }
})
</script>

<template>
  <div class="flex shrink-0 items-center gap-3 border-b border-default px-4 py-2.5">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-bold">{{ meta.story }}</p>
      <p v-if="meta.headline" class="text-muted truncate text-xs">{{ meta.headline }}</p>
    </div>

    <!-- Primary actions — only on the pane that opts in (the output pane). -->
    <div v-if="actions" class="flex shrink-0 items-center gap-3">
      <UButton
        color="primary"
        icon="i-lucide-hammer"
        class="frotz-glow font-bold"
        :loading="status === 'compiling'"
        @click="runCompile"
      >
        Compile
        <kbd
          class="ml-1 hidden rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold sm:inline"
          >⌘B</kbd
        >
      </UButton>

      <!-- Hidden (but space reserved → no layout shift) until a clean compile. -->
      <UButton
        color="success"
        icon="i-lucide-play"
        class="font-bold"
        :class="canPlay ? 'visible' : 'invisible'"
        :disabled="!canPlay"
        title="Play the compiled game"
        @click="playStory"
      >
        Play
      </UButton>
    </div>
  </div>
</template>
