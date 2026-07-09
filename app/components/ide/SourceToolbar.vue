<script setup lang="ts">
import type { ProfileId } from '~/modules/inform6/profiles'

const { source, storyBase, loadSource, newProject } = useIde()
const { togglePanel, panelOpen } = useProjectFiles()
const { profile } = useLanguage()
const { copyShareLink } = useShareLink()
function onShare() {
  void copyShareLink() // outcome lands in a toast either way
}

// New-project modal state.
const open = ref(false)
const library = ref<ProfileId>('std')

function create() {
  // ZIL has no library choice — pass 'std' as a harmless default (ignored by ZIL).
  newProject(profile.value.id === 'i6' ? library.value : 'std')
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
  return `${storyBase.value}.${profile.value.fileExt}`
}
async function saveAs() {
  const name = suggestedFilename()
  const text = source.value
  const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<unknown> }).showSaveFilePicker
  if (picker) {
    try {
      const handle = (await picker({
        suggestedName: name,
        types: [{ description: `${profile.value.label} source`, accept: { 'text/plain': [`.${profile.value.fileExt}`] } }],
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
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-panel-left"
      :aria-label="panelOpen ? 'Hide file explorer' : 'Show file explorer'"
      :aria-pressed="panelOpen"
      @click="togglePanel"
    />
    <UIcon name="i-lucide-file-code-2" class="text-muted size-4" />
    <span class="text-muted text-xs font-semibold uppercase tracking-wide">Source</span>

    <input ref="fileInput" type="file" :accept="`.${profile.fileExt},.txt,.h`" class="hidden" @change="onFileChange" />

    <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
      <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-folder-open" @click="openFile">
        Open
      </UButton>

      <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-save" @click="saveAs">
        Save As
      </UButton>
      <UButton
        color="neutral"
        variant="subtle"
        size="sm"
        icon="i-lucide-link"
        title="Copy a link that carries this source (compressed in the URL — nothing is uploaded)"
        @click="onShare"
      >
        Share
      </UButton>

      <UButton color="primary" variant="subtle" size="sm" icon="i-lucide-file-plus-2" @click="open = true">
        New Project
      </UButton>

      <!-- Extensions are an Inform 6 concept (`Include "…";`); ZIL uses zillib
           embedded in the WASM bundle, so hide it outside I6. -->
      <ExtensionsModal v-if="profile.id === 'i6'" />
    </div>

    <UModal v-model:open="open" title="New project" description="Start with a blank editor for the chosen library.">
      <template #body>
        <div class="space-y-4">
          <UFormField v-if="profile.id === 'i6'" label="Library" hint="The editor starts blank; load a Skeleton from Samples for a starting structure.">
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
