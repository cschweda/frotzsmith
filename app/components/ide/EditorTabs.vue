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

// Delete/Backspace closes the focused closable tab (the visible × is pointer-only:
// a focusable button nested inside role="tab" is an axe nested-interactive violation).
async function onCloseKey(event: KeyboardEvent, id: string) {
  if (id === 'source') return
  event.preventDefault()
  const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]') as HTMLElement | null
  closeTab(id)
  await nextTick()
  tablist?.querySelector<HTMLElement>(`[data-tab-id="${activeId.value}"]`)?.focus()
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
      :id="`tab-${tab.id}`"
      :data-tab-id="tab.id"
      aria-controls="editor-tabpanel"
      :aria-selected="tab.id === activeId"
      :tabindex="tab.id === activeId ? 0 : -1"
      :class="[
        'group flex cursor-pointer items-center gap-1.5 border-r border-default px-3 py-1.5 text-xs font-medium transition',
        tab.id === activeId
          ? 'bg-default text-primary'
          : 'text-muted hover:bg-default/60 hover:text-default',
      ]"
      :aria-keyshortcuts="tab.id !== 'source' ? 'Delete' : undefined"
      @click="openFile(tab.id)"
      @keydown.enter="openFile(tab.id)"
      @keydown.space.prevent="openFile(tab.id)"
      @keydown.delete="onCloseKey($event, tab.id)"
    >
      <UIcon
        :name="tab.editable ? 'i-lucide-file-code-2' : 'i-lucide-file-lock-2'"
        class="size-3.5 shrink-0"
      />
      <span class="whitespace-nowrap">{{ tab.name }}</span>
      <span v-if="!tab.editable" class="sr-only">(read-only)</span>
      <span
        v-if="tab.id !== 'source'"
        aria-hidden="true"
        :title="`Close ${tab.name} (Delete)`"
        class="ml-1 cursor-pointer rounded p-0.5 opacity-50 hover:bg-error/15 hover:text-error hover:opacity-100"
        @click.stop="closeTab(tab.id)"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </span>
    </div>
  </div>
</template>
