<script setup lang="ts">
import type { RightTab } from '~/composables/useIde'

const { activeTab, status, result, runCompile, canPlay, playStory } = useIde()

const tabs: { id: RightTab; label: string; icon: string }[] = [
  { id: 'results', label: 'Results', icon: 'i-lucide-clipboard-list' },
  { id: 'play', label: 'Play', icon: 'i-lucide-gamepad-2' },
  { id: 'transcript', label: 'Transcript', icon: 'i-lucide-scroll-text' },
]

const errorCount = computed(
  () => result.value?.diagnostics.filter(d => d.severity !== 'warning').length ?? 0,
)

const statusMeta = computed(() => {
  switch (status.value) {
    case 'compiling':
      return { label: 'Compiling…', icon: 'i-lucide-loader-circle', spin: true, cls: 'text-primary' }
    case 'success':
      return { label: 'Ready', icon: 'i-lucide-circle-check', spin: false, cls: 'text-success' }
    case 'error':
      return {
        label: `${errorCount.value} error${errorCount.value === 1 ? '' : 's'}`,
        icon: 'i-lucide-circle-x',
        spin: false,
        cls: 'text-error',
      }
    default:
      return { label: 'Idle', icon: 'i-lucide-circle-dot', spin: false, cls: 'text-muted' }
  }
})
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header: tabs (left) + status + Compile/Play (right) -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-2 py-2">
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

      <div class="ml-auto flex items-center gap-3">
        <span
          role="status"
          aria-live="polite"
          :class="['flex items-center gap-1.5 text-sm font-semibold', statusMeta.cls]"
        >
          <UIcon :name="statusMeta.icon" :class="['size-4', statusMeta.spin && 'animate-spin']" />
          <span class="hidden md:inline">{{ statusMeta.label }}</span>
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

        <UButton
          :color="canPlay ? 'success' : 'neutral'"
          :variant="canPlay ? 'solid' : 'subtle'"
          icon="i-lucide-play"
          class="font-bold"
          :disabled="!canPlay"
          :title="canPlay ? 'Play the compiled game' : 'Compile successfully to play'"
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
