<script setup lang="ts">
import { makeZipEntryFilter, ZipLimitError, ZIP_MAX_TOTAL_BYTES } from '~/utils/zip-limits'

const { all, isEnabled, toggle, addUploaded, removeUploaded, enabledCount } = useExtensions()

const open = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const note = ref('')

function pick() {
  fileInput.value?.click()
}

async function addZip(file: File): Promise<number> {
  // fflate is lazy-loaded only when a .zip is actually dropped.
  const { unzipSync, strFromU8 } = await import('fflate')
  const buf = new Uint8Array(await file.arrayBuffer())
  let n = 0
  // The filter admits only .h entries and throws ZipLimitError on a bomb —
  // fflate consults it per entry BEFORE decompressing.
  for (const [path, data] of Object.entries(unzipSync(buf, { filter: makeZipEntryFilter() }))) {
    addUploaded(path.split('/').pop() as string, strFromU8(data))
    n++
  }
  return n
}

async function ingest(files: File[]) {
  let added = 0
  for (const file of files) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.zip')) {
      try {
        added += await addZip(file)
      } catch (e) {
        note.value = e instanceof ZipLimitError ? e.message : 'Could not read that .zip.'
        return
      }
    } else if (lower.endsWith('.h')) {
      if (file.size > ZIP_MAX_TOTAL_BYTES) {
        note.value = `${file.name} is too large (5 MB max).`
        continue
      }
      addUploaded(file.name, await file.text())
      added++
    }
  }
  note.value = added
    ? `Added ${added} extension${added === 1 ? '' : 's'}.`
    : 'No .h files found in that drop.'
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  await ingest(Array.from(input.files ?? []))
  input.value = ''
}
async function onDrop(event: DragEvent) {
  dragging.value = false
  await ingest(Array.from(event.dataTransfer?.files ?? []))
}
</script>

<template>
  <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-puzzle" @click="open = true">
    Extensions
    <span
      v-if="enabledCount"
      class="bg-primary/20 text-primary ml-1 rounded-full px-1.5 text-[10px] font-bold"
      >{{ enabledCount }}</span
    >
  </UButton>

  <input
    ref="fileInput"
    type="file"
    accept=".h,.zip"
    multiple
    class="hidden"
    @change="onFileChange"
  />

  <UModal
    v-model:open="open"
    title="Extensions"
    description="Mount Inform 6 extensions, then Include them in your source. Tick the ones to compile with."
  >
    <template #body>
      <div class="space-y-4">
        <div
          :class="[
            'cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-sm transition',
            dragging ? 'border-primary bg-primary/5' : 'border-default text-muted hover:border-primary/50',
          ]"
          role="button"
          tabindex="0"
          @click="pick"
          @keydown.enter="pick"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <UIcon name="i-lucide-upload" class="mb-1 size-5" />
          <p>
            Drop or click to add <code class="frotz-code">.h</code> files (or a
            <code class="frotz-code">.zip</code> of them)
          </p>
        </div>
        <p v-if="note" class="text-muted text-xs">{{ note }}</p>

        <ul class="divide-default divide-y">
          <li v-for="ext in all" :key="ext.id" class="flex items-start gap-3 py-2.5">
            <UCheckbox
              :model-value="isEnabled(ext.id)"
              class="mt-0.5"
              :aria-label="`Include ${ext.title}`"
              @update:model-value="toggle(ext.id)"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold">{{ ext.title }}</span>
                <span
                  :class="[
                    'rounded px-1.5 text-[10px] font-medium',
                    ext.origin === 'bundled' ? 'bg-elevated text-muted' : 'bg-primary/15 text-primary',
                  ]"
                  >{{ ext.origin }}</span
                >
              </div>
              <p class="text-muted truncate text-xs">{{ ext.description }}</p>
              <code class="frotz-code mt-1 inline-block">Include "{{ ext.name }}";</code>
            </div>
            <UButton
              v-if="ext.origin === 'uploaded'"
              color="error"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :aria-label="`Remove ${ext.title}`"
              @click="removeUploaded(ext.id)"
            />
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="neutral" variant="ghost" @click="open = false">Done</UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.frotz-code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.8em;
  padding: 0.1em 0.4em;
  border-radius: 0.3em;
  background: var(--ui-bg-elevated, rgba(127, 127, 127, 0.15));
}
</style>
