<script setup lang="ts">
import { parseScript } from '~/modules/inform6/engine/parseScript'

const { scripts, activeId, activeScript, add, rename, remove, select, restore } = useTestScripts()
const { turns, running, progress, ms, error, run, cancel } = useTranscript()
const { canPlay } = useIde()

// First client mount: hydrate scripts (idempotent; useIde.restore also calls it).
onMounted(restore)

const scriptItems = computed(() => [
  scripts.value.map(s => ({
    label: s.name,
    icon: s.id === activeId.value ? 'i-lucide-check' : 'i-lucide-scroll-text',
    onSelect: () => select(s.id),
  })),
  [
    { label: 'New script', icon: 'i-lucide-plus', onSelect: () => add() },
    {
      label: 'Rename…',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        const name = activeScript.value && window.prompt('Script name', activeScript.value.name)
        if (name && activeScript.value) rename(activeScript.value.id, name)
      },
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      onSelect: () => activeScript.value && remove(activeScript.value.id),
    },
  ],
])

const liveStatus = computed(() => {
  if (running.value) return progress.value ? `Running ${progress.value.done} of ${progress.value.total}…` : 'Running…'
  if (error.value) return error.value
  if (turns.value.length) return `Done — ${turns.value.length - 1} commands${ms.value != null ? ` · ${ms.value} ms` : ''}`
  return ''
})

function onRun() {
  run(parseScript(activeScript.value?.text ?? ''))
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Script bar -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2">
      <UDropdownMenu :items="scriptItems">
        <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-scroll-text" trailing-icon="i-lucide-chevron-down">
          {{ activeScript?.name ?? 'No scripts' }}
        </UButton>
      </UDropdownMenu>

      <UButton
        v-if="!running"
        color="primary"
        size="sm"
        icon="i-lucide-play"
        :disabled="!canPlay || !activeScript"
        :title="canPlay ? 'Run this script headlessly' : 'Compile a clean build first'"
        @click="onRun"
      >
        Run
      </UButton>
      <UButton v-else color="error" size="sm" icon="i-lucide-square" @click="cancel">Cancel</UButton>

      <span role="status" aria-live="polite" class="text-muted ml-auto text-sm">{{ liveStatus }}</span>
    </div>

    <!-- Script editor (CodeMirror 6) -->
    <div class="bg-elevated/40 h-28 shrink-0 border-b border-default">
      <ScriptEditor />
    </div>

    <!-- Transcript -->
    <div class="min-h-0 flex-1 overflow-auto px-4 py-3" tabindex="0" role="region" aria-label="Transcript output">
      <div
        v-if="!turns.length && !running"
        class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon name="i-lucide-scroll-text" class="size-10 text-primary" />
        <p class="text-lg font-semibold">{{ canPlay ? 'Write a script and press Run' : 'Compile to run scripts' }}</p>
        <p class="text-muted max-w-sm text-sm">Commands run headlessly; the playthrough appears here.</p>
      </div>

      <div v-for="(t, i) in turns" :key="i" class="mb-3">
        <p v-if="t.command" class="text-primary font-mono text-sm font-semibold">&gt; {{ t.command }}</p>
        <pre class="whitespace-pre-wrap font-mono text-sm leading-relaxed">{{ t.output }}</pre>
      </div>
    </div>
  </div>
</template>
