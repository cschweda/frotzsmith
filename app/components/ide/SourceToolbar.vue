<script setup lang="ts">
import type { ProfileId } from '~/modules/inform6/profiles'
import type { PendingOpen } from '~/composables/useProjectPackage'
import { PackageError } from '~/project-package/errors'
import { ZipLimitError } from '~/utils/zip-limits'
import { formatNameList } from '~/utils/mismatch-list'

const { source, storyBase, loadSource, newProject } = useIde()
const { togglePanel, panelOpen } = useProjectFiles()
const { profile } = useLanguage()
const { copyShareLink } = useShareLink()
const pkg = useProjectPackage()
const toast = useToast()
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
const fileInput = shallowRef<HTMLInputElement | null>(null)
const openButton = ref<{ $el?: HTMLElement } | null>(null)
/** The file picker's modal opens asynchronously, so nothing restores focus for
 *  us: put it back on Open so keyboard users never land on <body>. */
async function focusOpen() {
  await nextTick()
  openButton.value?.$el?.focus()
}
function openFile() {
  fileInput.value?.click()
}
function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && file.name.toLowerCase().endsWith('.frotzsmith')) {
    void openPackage(file)
  } else if (file) {
    const reader = new FileReader()
    reader.onload = () => loadSource(String(reader.result ?? ''))
    reader.readAsText(file)
  }
  input.value = '' // allow re-opening the same file later
}

// .frotzsmith projects: read + check first, ask before replacing real work,
// then apply. Nothing is compiled or run by opening.
const pending = shallowRef<PendingOpen | null>(null)
const confirmOpen = ref(false)

function fail(err: unknown) {
  const known = err instanceof PackageError || err instanceof ZipLimitError
  toast.add({
    title: 'Couldn’t open that project',
    description: known ? err.message : 'That file couldn’t be read as a Frotzsmith project.',
    color: 'error',
    icon: 'i-lucide-circle-alert',
  })
}

async function openPackage(file: File) {
  try {
    await openPackageInner(file)
  } finally {
    // A confirmation dialog takes focus itself and returns it on close.
    if (!confirmOpen.value) await focusOpen()
  }
}

async function openPackageInner(file: File) {
  try {
    const p = await pkg.inspect(file)
    if (pkg.needsConfirm(p)) {
      pending.value = p
      confirmOpen.value = true
    } else {
      await applyPending(p)
    }
  } catch (err) {
    fail(err)
  }
}

async function applyPending(p: PendingOpen) {
  try {
    await pkg.apply(p)
  } catch (err) {
    fail(err)
    return
  }
  const notes: string[] = []
  if (p.hiddenCount > 0) {
    notes.push(`${p.hiddenCount} files in this project aren't shown here — they're kept and included when you download it.`)
  }
  if (p.ignored.length > 0) notes.push('Compiled story files in the package were ignored — compile to rebuild them.')
  toast.add({
    title: 'Project opened',
    description: notes.join(' ') || undefined,
    color: 'success',
    icon: 'i-lucide-check',
  })
  if (p.hashMismatches.length > 0) {
    toast.add({
      title: 'Some files changed after the package was made',
      description: `These don't match what the package recorded: ${formatNameList(p.hashMismatches)}.`,
      color: 'warning',
      icon: 'i-lucide-triangle-alert',
    })
  }
}

function onReplace() {
  const p = pending.value
  confirmOpen.value = false
  pending.value = null
  if (p) void applyPending(p).finally(focusOpen)
  else void focusOpen()
}
function onCancelOpen() {
  confirmOpen.value = false
  pending.value = null
  void focusOpen()
}

async function downloadProject() {
  try {
    const { bytes, filename } = await pkg.buildPackage()
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.frotzsmith.package+zip' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  } catch {
    toast.add({
      title: 'Couldn’t download the project',
      description: 'Something went wrong building the .frotzsmith file.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
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

    <input ref="fileInput" type="file" :accept="`.${profile.fileExt},.txt,.h,.frotzsmith`" class="hidden" @change="onFileChange" />

    <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
      <UButton ref="openButton" color="neutral" variant="subtle" size="sm" icon="i-lucide-folder-open" @click="openFile">
        Open
      </UButton>
      <UButton
        color="neutral"
        variant="subtle"
        size="sm"
        icon="i-lucide-package"
        title="Download this project as a .frotzsmith file — source, includes, test scripts and Skein"
        @click="downloadProject"
      >
        Download project
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

    <OpenProjectModal
      v-model:open="confirmOpen"
      :title="pending?.project.title ?? pending?.project.main.name ?? ''"
      :main-name="pending?.project.main.name ?? ''"
      @replace="onReplace"
      @cancel="onCancelOpen"
      @closed="focusOpen"
    />

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
