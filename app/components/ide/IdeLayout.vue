<script setup lang="ts">
const { restore, savedAt, activeProfile, profileMode } = useIde()
const mobileView = ref<'editor' | 'output'>('editor')

onMounted(() => restore())

const savedLabel = computed(() => {
  if (!savedAt.value) return 'Not saved yet'
  return 'Recovery saved'
})
</script>

<template>
  <div class="flex h-screen flex-col bg-default text-default">
    <IdeToolbar />

    <!-- Mobile pane switch -->
    <div class="flex gap-1 border-b border-default p-2 lg:hidden">
      <button
        type="button"
        :class="[
          'flex-1 rounded-lg py-2 text-sm font-semibold transition',
          mobileView === 'editor' ? 'bg-primary/15 text-primary' : 'text-muted',
        ]"
        @click="mobileView = 'editor'"
      >
        Source
      </button>
      <button
        type="button"
        :class="[
          'flex-1 rounded-lg py-2 text-sm font-semibold transition',
          mobileView === 'output' ? 'bg-primary/15 text-primary' : 'text-muted',
        ]"
        @click="mobileView = 'output'"
      >
        Output
      </button>
    </div>

    <!-- Two-pane shell -->
    <div class="min-h-0 flex-1 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-default">
      <section
        :class="['h-full min-h-0 flex-col', mobileView === 'editor' ? 'flex' : 'hidden', 'lg:flex']"
        aria-label="Source"
      >
        <SourceToolbar />
        <div class="min-h-0 flex-1">
          <SourcePane />
        </div>
      </section>
      <section
        :class="['h-full min-h-0', mobileView === 'output' ? 'block' : 'hidden', 'lg:block']"
        aria-label="Output"
      >
        <RightPaneTabs />
      </section>
    </div>

    <!-- Status bar -->
    <footer
      class="text-muted flex shrink-0 items-center gap-3 border-t border-default px-4 py-1.5 text-xs"
    >
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-save" class="size-3.5" />
        {{ savedLabel }}
      </span>
      <span class="ml-auto flex items-center gap-1.5">
        <UIcon name="i-lucide-book-open" class="size-3.5" />
        {{ profileMode === 'auto' ? 'Auto' : 'Forced' }}: {{ activeProfile.shortLabel }} ·
        {{ activeProfile.defaultExt.toUpperCase() }}
      </span>
    </footer>
  </div>
</template>
