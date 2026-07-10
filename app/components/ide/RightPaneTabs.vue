<script setup lang="ts">
import type { RightTab } from '~/composables/useIde'

const { activeTab, status } = useIde()

const tabs: { id: RightTab; label: string; icon: string }[] = [
  { id: 'results', label: 'Results', icon: 'i-lucide-clipboard-list' },
  { id: 'play', label: 'Play', icon: 'i-lucide-gamepad-2' },
  { id: 'transcript', label: 'Transcript', icon: 'i-lucide-history' },
  { id: 'testscript', label: 'Test Script', icon: 'i-lucide-scroll-text' },
  { id: 'skein', label: 'Skein', icon: 'i-lucide-git-branch' },
  { id: 'map', label: 'Map', icon: 'i-lucide-map' },
]

// Arrow-key navigation + focus-follows-selection (ARIA tabs pattern), mirroring
// EditorTabs. currentTarget is captured before the await — it nulls after dispatch.
async function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  const ids = tabs.map(t => t.id)
  const i = ids.indexOf(activeTab.value)
  if (i === -1) return
  const next = event.key === 'ArrowRight' ? ids[i + 1] ?? ids[0] : ids[i - 1] ?? ids[ids.length - 1]
  if (!next) return
  event.preventDefault()
  const tablist = event.currentTarget as HTMLElement
  activeTab.value = next
  await nextTick()
  tablist.querySelector<HTMLElement>(`#rtab-${next}`)?.focus()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <TitleStrip actions />

    <!-- Header: tabs only — Compile/Play live in the title bar (TitleStrip). -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-2 py-2">
      <div class="flex items-center gap-1">
        <div role="tablist" aria-label="Output panels" class="flex gap-1" @keydown="onKeydown">
          <button
            v-for="t in tabs"
            :id="`rtab-${t.id}`"
            :key="t.id"
            role="tab"
            :aria-selected="activeTab === t.id"
            :aria-label="t.label"
            aria-controls="right-tabpanel"
            :tabindex="activeTab === t.id ? 0 : -1"
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
            <span v-if="t.id === 'results' && (status === 'error' || status === 'success')" class="sr-only">
              {{ status === 'error' ? '— compile failed' : '— compiled cleanly' }}
            </span>
          </button>
        </div>

      </div>

    </div>

    <div id="right-tabpanel" role="tabpanel" :aria-labelledby="`rtab-${activeTab}`" class="min-h-0 flex-1">
      <PlayPanel v-show="activeTab === 'play'" />
      <ResultsPanel v-if="activeTab === 'results'" />
      <TranscriptPanel v-else-if="activeTab === 'transcript'" />
      <TestScriptPanel v-else-if="activeTab === 'testscript'" />
      <SkeinPanel v-else-if="activeTab === 'skein'" />
      <MapPanel v-else-if="activeTab === 'map'" />
    </div>
  </div>
</template>
