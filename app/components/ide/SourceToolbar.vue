<script setup lang="ts">
import { SAMPLES, type Sample } from '~/modules/inform6/samples'
import type { ProfileId } from '~/modules/inform6/profiles'

const { source, loadSample, loadSource, newProject } = useIde()

// One entry per concept; choose the library in a submenu instead of listing every
// concept twice (saves space).
const sampleItems = computed(() => {
  const byName = new Map<string, Partial<Record<ProfileId, Sample>>>()
  for (const s of SAMPLES) {
    const entry = byName.get(s.name) ?? {}
    entry[s.group] = s
    byName.set(s.name, entry)
  }
  return [
    [...byName.values()].map(v => ({
      label: (v.std ?? v.puny)!.name,
      children: [
        v.std && { label: 'Inform 6 (full)', icon: 'i-lucide-book-marked', onSelect: () => loadSample(v.std!.id) },
        v.puny && { label: 'PunyInform', icon: 'i-lucide-feather', onSelect: () => loadSample(v.puny!.id) },
      ].filter(Boolean),
    })),
  ]
})

// New-project modal state.
const open = ref(false)
const library = ref<ProfileId>('std')

function create() {
  newProject(library.value)
  open.value = false
}

// Open a local .inf into the editor.
const fileInput = ref<HTMLInputElement | null>(null)
function openFile() {
  fileInput.value?.click()
}
function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = () => loadSource(String(reader.result ?? ''))
    reader.readAsText(file)
  }
  input.value = '' // allow re-opening the same file later
}

// Save As… — a real save dialog where supported (Chromium), else a download.
function suggestedFilename() {
  const story = /Constant\s+Story\s+"([^"]*)"/i.exec(source.value)?.[1]?.trim()
  const slug = (story || 'story')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${slug || 'story'}.inf`
}
async function saveAs() {
  const name = suggestedFilename()
  const text = source.value
  const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<unknown> }).showSaveFilePicker
  if (picker) {
    try {
      const handle = (await picker({
        suggestedName: name,
        types: [{ description: 'Inform 6 source', accept: { 'text/plain': ['.inf'] } }],
      })) as { createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }> }
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
      return
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return // user cancelled
      // otherwise fall through to a plain download
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 border-b border-default px-3 py-2">
    <UIcon name="i-lucide-file-code-2" class="text-muted size-4" />
    <span class="text-muted text-xs font-semibold uppercase tracking-wide">Source</span>

    <input ref="fileInput" type="file" accept=".inf,.txt,.h" class="hidden" @change="onFileChange" />

    <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
      <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-folder-open" @click="openFile">
        Open
      </UButton>

      <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-save" @click="saveAs">
        Save As
      </UButton>

      <UDropdownMenu :items="sampleItems">
        <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-book-open-text" trailing-icon="i-lucide-chevron-down">
          Samples
        </UButton>
      </UDropdownMenu>

      <UButton color="primary" variant="subtle" size="sm" icon="i-lucide-file-plus-2" @click="open = true">
        New Project
      </UButton>

      <ExtensionsModal />
    </div>

    <UModal v-model:open="open" title="New project" description="Start with a blank editor for the chosen library.">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Library" hint="The editor starts blank; load a Skeleton from Samples for a starting structure.">
            <div class="flex gap-2">
              <UButton
                :color="library === 'std' ? 'primary' : 'neutral'"
                :variant="library === 'std' ? 'solid' : 'subtle'"
                icon="i-lucide-book-marked"
                @click="library = 'std'"
              >
                Inform 6 (full)
              </UButton>
              <UButton
                :color="library === 'puny' ? 'primary' : 'neutral'"
                :variant="library === 'puny' ? 'solid' : 'subtle'"
                icon="i-lucide-feather"
                @click="library = 'puny'"
              >
                PunyInform
              </UButton>
            </div>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton color="primary" icon="i-lucide-check" @click="create">Create project</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
