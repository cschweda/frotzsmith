<script setup lang="ts">
import type { RightTab } from '~/composables/useIde'

const { activeTab, status } = useIde()

const tabs: { id: RightTab; label: string; icon: string }[] = [
  { id: 'results', label: 'Results', icon: 'i-lucide-clipboard-list' },
  { id: 'play', label: 'Play', icon: 'i-lucide-gamepad-2' },
  { id: 'transcript', label: 'Transcript', icon: 'i-lucide-history' },
  { id: 'testscript', label: 'Test Script', icon: 'i-lucide-scroll-text' },
]
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

    </div>

    <div class="min-h-0 flex-1">
      <PlayPanel v-show="activeTab === 'play'" />
      <ResultsPanel v-if="activeTab === 'results'" />
      <TranscriptPanel v-else-if="activeTab === 'transcript'" />
      <TestScriptPanel v-else-if="activeTab === 'testscript'" />
    </div>
  </div>
</template>
