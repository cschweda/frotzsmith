<script setup lang="ts">
import type { RightTab } from '~/composables/useIde'

const { activeTab, status, result, runCompile, canPlay, playStory } = useIde()

const tabs: { id: RightTab; label: string; icon: string }[] = [
  { id: 'results', label: 'Results', icon: 'i-lucide-clipboard-list' },
  { id: 'play', label: 'Play', icon: 'i-lucide-gamepad-2' },
  { id: 'transcript', label: 'Transcript', icon: 'i-lucide-scroll-text' },
]

// "Ready" is red with an ✗ until a clean compile, then green with a ✓.
const statusMeta = computed(() => {
  switch (status.value) {
    case 'compiling':
      return { label: 'Compiling…', icon: 'i-lucide-loader-circle', spin: true, cls: 'text-primary' }
    case 'success':
      return { label: 'Ready', icon: 'i-lucide-circle-check-big', spin: false, cls: 'text-success' }
    default: // idle or error → not ready
      return { label: 'Not ready', icon: 'i-lucide-circle-x', spin: false, cls: 'text-error' }
  }
})
</script>

<template>
  <div class="flex h-full flex-col">
    <TitleStrip />

    <!-- Header: tabs (left) + status + Compile/Play (right) -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-2 py-2">
      <div class="flex items-center gap-1">
        <div role="tablist" class="flex gap-1">
          <button
            v-for="t in tabs"
            :key="t.id"
            role="tab"
            :aria-selected="activeTab === t.id"
            type="button"
            :class="[
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
              activeTab === t.id
                ? 'bg-elevated text-default'
                : 'text-muted hover:bg-elevated/60 hover:text-default',
            ]"
            @click="activeTab = t.id"
          >
            <UIcon :name="t.icon" class="size-4" />
            <span class="hidden sm:inline">{{ t.label }}</span>
            <span
              v-if="t.id === 'results' && status === 'error'"
              class="size-2 rounded-full bg-error"
              aria-hidden="true"
            />
            <span
              v-else-if="t.id === 'results' && status === 'success'"
              class="size-2 rounded-full bg-success"
              aria-hidden="true"
            />
          </button>
        </div>

        <!-- Map: planned (v2). Disabled now, with a "coming soon" tooltip.
             aria-disabled (not the disabled attribute) so hover still fires the tooltip. -->
        <UTooltip text="Auto-map — coming soon">
          <button
            type="button"
            aria-disabled="true"
            class="text-muted/50 flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <UIcon name="i-lucide-map" class="size-4" />
            <span class="hidden sm:inline">Map</span>
          </button>
        </UTooltip>
      </div>

      <div class="ml-auto flex items-center gap-3">
        <!-- Fixed width so the label changing never shifts the buttons. -->
        <span
          role="status"
          aria-live="polite"
          :class="['flex w-28 items-center justify-end gap-1.5 text-sm font-semibold', statusMeta.cls]"
        >
          <UIcon :name="statusMeta.icon" :class="['size-4 shrink-0', statusMeta.spin && 'animate-spin']" />
          <span>{{ statusMeta.label }}</span>
        </span>

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

    <div class="min-h-0 flex-1">
      <ResultsPanel v-if="activeTab === 'results'" />
      <PlayPanel v-else-if="activeTab === 'play'" />
      <div
        v-else
        class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon name="i-lucide-scroll-text" class="size-10 text-primary" />
        <p class="text-lg font-semibold">Test transcripts are coming next</p>
        <p class="text-muted max-w-sm text-sm">
          Run long command scripts and read the playthrough here (Phase 4).
        </p>
      </div>
    </div>
  </div>
</template>
