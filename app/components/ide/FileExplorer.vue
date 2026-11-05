<script setup lang="ts">
import { quotedPath } from '~/project-package/errors'
import { addZilUploads } from '~/composables/zil-uploads'

const { files, activeId, openFile, togglePanel, findZilFile, addZilFile, removeZilFile } = useProjectFiles()
const { profile } = useLanguage()
const isZil = computed(() => profile.value.id === 'zil')

const projectFiles = computed(() => files.value.filter(f => f.group === 'project'))
const libraryFiles = computed(() => files.value.filter(f => f.group === 'library'))
const libraryOpen = ref(true)

// ── ZIL: extra .zil files (add / replace / remove, each asked first) ──────────
const ZIL_ID = 'zil:'
const zilInput = shallowRef<HTMLInputElement | null>(null)
const addArea = shallowRef<HTMLElement | null>(null)
const note = ref('')

const confirmOpen = ref(false)
const confirm = ref({ title: '', heading: '', description: '', confirmLabel: '' })
let settleConfirm: ((ok: boolean) => void) | null = null
function ask(c: typeof confirm.value): Promise<boolean> {
  settleConfirm?.(false)
  confirm.value = c
  confirmOpen.value = true
  return new Promise(resolve => (settleConfirm = resolve))
}
function settle(ok: boolean) {
  const done = settleConfirm
  settleConfirm = null
  confirmOpen.value = false
  done?.(ok)
}
// The modal leaves focus to us: put it back on the Add button.
function onConfirmClosed() {
  addArea.value?.querySelector<HTMLElement>('button')?.focus()
}

function askReplace(path: string, existing: string): Promise<boolean> {
  return ask({
    title: path,
    heading: `Replace ${quotedPath(existing)}?`,
    description: existing === path
      ? 'The file in the project is replaced by the one you chose.'
      : `The file in the project is replaced by the one you chose, named ${quotedPath(path)}.`,
    confirmLabel: 'Replace',
  })
}

async function addUploads(list: File[]) {
  note.value = ''
  note.value = await addZilUploads(list, { findZilFile, addZilFile, ask: askReplace })
}

async function onZilFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const list = Array.from(input.files ?? [])
  input.value = ''
  await addUploads(list)
}

async function askRemove(id: string) {
  const path = id.slice(ZIL_ID.length)
  const ok = await ask({
    title: path,
    heading: `Remove ${quotedPath(path)}?`,
    description: 'The file is taken out of the project and its text is gone from the editor.',
    confirmLabel: 'Remove',
  })
  if (!ok) return
  removeZilFile(path)
  note.value = `Removed ${quotedPath(path)}.`
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-elevated/30">
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-2 border-b border-default px-3 py-2.5">
      <UIcon name="i-lucide-folder-tree" class="text-muted size-4" />
      <span class="text-muted text-xs font-semibold uppercase tracking-wide">Project files</span>
      <UButton
        class="ml-auto"
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-x"
        aria-label="Close file explorer"
        @click="togglePanel"
      />
    </div>

    <nav class="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Project files">
      <!-- Project group -->
      <p class="text-muted px-3 pb-1 text-[10px] font-bold uppercase tracking-widest">
        Project
      </p>
      <ul>
        <li v-for="file in projectFiles" :key="file.id" class="flex items-center">
          <button
            type="button"
            :aria-current="file.id === activeId ? 'true' : undefined"
            :class="[
              'flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm transition',
              file.id === activeId
                ? 'bg-primary/15 font-semibold text-primary'
                : 'text-default hover:bg-default/60',
            ]"
            @click="openFile(file.id)"
          >
            <UIcon
              :name="file.id === 'solution' ? 'i-lucide-book-open-check' : file.editable ? 'i-lucide-file-code-2' : 'i-lucide-file-lock-2'"
              class="size-4 shrink-0 opacity-70"
            />
            <span class="truncate">{{ file.name }}</span>
            <span v-if="!file.editable" class="sr-only">(read-only)</span>
          </button>
          <UButton
            v-if="file.id.startsWith(ZIL_ID)"
            class="mr-1 shrink-0"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-trash-2"
            :aria-label="`Remove ${file.name}`"
            @click="askRemove(file.id)"
          />
        </li>
      </ul>

      <!-- Library group (read-only, collapsible) — hidden for ZIL (zillib is embedded in WASM) -->
      <template v-if="libraryFiles.length > 0">
        <button
          type="button"
          class="text-muted mt-2 flex w-full items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest hover:text-default"
          :aria-expanded="libraryOpen"
          @click="libraryOpen = !libraryOpen"
        >
          <UIcon
            :name="libraryOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="size-3"
          />
          Library ({{ libraryFiles.length }})
        </button>
        <ul v-show="libraryOpen">
          <li v-for="file in libraryFiles" :key="file.id">
            <button
              type="button"
              :aria-current="file.id === activeId ? 'true' : undefined"
              :class="[
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition',
                file.id === activeId
                  ? 'bg-primary/15 font-semibold text-primary'
                  : 'text-muted hover:bg-default/60 hover:text-default',
              ]"
              @click="openFile(file.id)"
            >
              <UIcon name="i-lucide-file-lock-2" class="size-4 shrink-0 opacity-70" />
              <span class="truncate">{{ file.name }}</span>
              <span class="sr-only">(read-only library file)</span>
            </button>
          </li>
        </ul>
      </template>
    </nav>

    <!-- Add files: ZIL takes extra .zil files; I6 reuses the extensions modal -->
    <div v-if="isZil" ref="addArea" class="shrink-0 space-y-1.5 border-t border-default p-2">
      <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-file-plus-2" @click="zilInput?.click()">
        Add .zil files
      </UButton>
      <input
        ref="zilInput"
        type="file"
        accept=".zil"
        multiple
        class="hidden"
        @change="onZilFileChange"
      />
      <p class="text-muted text-xs" role="status">{{ note }}</p>
      <OpenProjectModal
        v-model:open="confirmOpen"
        :title="confirm.title"
        :replaces="[]"
        :heading="confirm.heading"
        :description="confirm.description"
        :confirm-label="confirm.confirmLabel"
        @replace="settle(true)"
        @cancel="settle(false)"
        @closed="onConfirmClosed"
      />
    </div>
    <div v-else class="shrink-0 border-t border-default p-2">
      <ExtensionsModal />
    </div>
  </div>
</template>
