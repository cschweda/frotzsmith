<script setup lang="ts">
const { openTabs, activeId, openFile, closeTab } = useProjectFiles()

// Arrow-key navigation across the tablist (WCAG: tabs are keyboard-operable).
// async so we can await nextTick() before moving DOM focus to the new tab.
async function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  const ids = openTabs.value.map(t => t.id)
  const i = ids.indexOf(activeId.value)
  if (i === -1) return
  const next = event.key === 'ArrowRight' ? ids[i + 1] ?? ids[0] : ids[i - 1] ?? ids[ids.length - 1]
  if (!next) return // noUncheckedIndexedAccess: both sides of ?? can be undefined on empty list
  event.preventDefault()
  // Capture the tablist NOW: event.currentTarget is reset to null once the event
  // finishes dispatching, which happens before the awaited microtask resumes.
  const tablist = event.currentTarget as HTMLElement
  openFile(next)
  // Wait for the roving tabindex to re-render, then move focus so the ARIA
  // tabs pattern (automatic activation) is satisfied: focus must follow selection.
  await nextTick()
  tablist.querySelector<HTMLElement>(`[data-tab-id="${next}"]`)?.focus()
}
</script>

<template>
  <div
    role="tablist"
    aria-label="Open files"
    class="flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-default bg-elevated/40"
    @keydown="onKeydown"
  >
    <div
      v-for="tab in openTabs"
      :key="tab.id"
      role="tab"
      :data-tab-id="tab.id"
      :aria-selected="tab.id === activeId"
      :tabindex="tab.id === activeId ? 0 : -1"
      :class="[
        'group flex cursor-pointer items-center gap-1.5 border-r border-default px-3 py-1.5 text-xs font-medium transition',
        tab.id === activeId
          ? 'bg-default text-primary'
          : 'text-muted hover:bg-default/60 hover:text-default',
      ]"
      @click="openFile(tab.id)"
      @keydown.enter="openFile(tab.id)"
      @keydown.space.prevent="openFile(tab.id)"
    >
      <UIcon
        :name="tab.editable ? 'i-lucide-file-code-2' : 'i-lucide-file-lock-2'"
        class="size-3.5 shrink-0"
      />
      <span class="whitespace-nowrap">{{ tab.name }}</span>
      <span v-if="!tab.editable" class="sr-only">(read-only)</span>
      <button
        v-if="tab.id !== 'source'"
        type="button"
        class="ml-1 rounded p-0.5 opacity-50 hover:bg-error/15 hover:text-error hover:opacity-100"
        :aria-label="`Close ${tab.name}`"
        @click.stop="closeTab(tab.id)"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </button>
    </div>
  </div>
</template>
