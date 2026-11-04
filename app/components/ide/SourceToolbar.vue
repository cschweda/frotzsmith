<script setup lang="ts">
import type { ProfileId } from '~/modules/inform6/profiles'
import type { PendingOpen } from '~/composables/useProjectPackage'
import { formatNameList, mismatchNames } from '~/utils/mismatch-list'
import { DOWNLOAD_FAILED, OPEN_FAILED, downloadedNote, openDialogNotes, openedNotes, refusalSentence } from '~/utils/package-messages'
import { isPristine } from '~/utils/pristine'

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
    reader.onload = () => openPlain(file.name, String(reader.result ?? ''))
    reader.readAsText(file)
  }
  input.value = '' // allow re-opening the same file later
}

// A plain source file replaces the editor's text: ask first unless the
// editor holds nothing the author wrote (or the same text).
const pendingPlain = shallowRef<{ name: string; text: string } | null>(null)
const confirmPlain = ref(false)
function openPlain(name: string, text: string) {
  if (isPristine(source.value) || text === source.value) {
    loadSource(text)
    void focusOpen()
    return
  }
  pendingPlain.value = { name, text }
  confirmPlain.value = true
}
function onReplacePlain() {
  const p = pendingPlain.value
  confirmPlain.value = false
  pendingPlain.value = null
  if (p) loadSource(p.text)
  void focusOpen()
}
function onCancelPlain() {
  confirmPlain.value = false
  pendingPlain.value = null
  void focusOpen()
}

// .frotzsmith projects: read + check first, ask before replacing real work,
// then apply. Nothing is compiled or run by opening.
const pending = shallowRef<PendingOpen | null>(null)
/** What the pending open would replace, for the confirmation's wording. */
const replaces = shallowRef<string[]>([])
/** The extensions it adds and the hidden files it carries, named in the dialog. */
const openNotes = shallowRef<string[]>([])
const confirmOpen = ref(false)

function fail(err: unknown) {
  toast.add({
    title: 'Couldn’t open that project',
    description: refusalSentence(err, OPEN_FAILED),
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
    const work = await pkg.whatOpenReplaces(p)
    // Always ask when the package installs or enables an extension: every
    // Inform 6 game in this browser uses it, not just this one.
    if (work.length > 0 || p.extensions.length > 0) {
      pending.value = p
      replaces.value = work
      openNotes.value = openDialogNotes(p)
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
  const notes = openedNotes(p) // names the extensions added and the hidden files
  toast.add({
    title: 'Project opened',
    description: notes.join(' ') || undefined,
    color: 'success',
    icon: 'i-lucide-check',
  })
  const changed = mismatchNames(p.hashMismatches)
  if (changed.length > 0) {
    toast.add({
      title: 'Some files changed after the package was made',
      description: `These don't match what the package recorded: ${formatNameList(changed)}.`,
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
    const { bytes, filename, hidden } = await pkg.buildPackage()
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.frotzsmith.package+zip' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    // Files the IDE doesn't show still ride along: say which (F15).
    const note = downloadedNote(hidden)
    if (note) toast.add({ title: 'Project downloaded', description: note, color: 'neutral', icon: 'i-lucide-package' })
  } catch (err) {
    toast.add({
      title: 'Couldn’t download the project',
      description: refusalSentence(err, DOWNLOAD_FAILED),
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
      :replaces="replaces"
      :notes="openNotes"
      @replace="onReplace"
      @cancel="onCancelOpen"
      @closed="focusOpen"
    />

    <OpenProjectModal
      v-model:open="confirmPlain"
      :title="pendingPlain?.name ?? ''"
      :replaces="['the source in the editor']"
      heading="Replace the source in the editor?"
      description="Opening this file replaces the source in the editor."
      confirm-label="Replace"
      @replace="onReplacePlain"
      @cancel="onCancelPlain"
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
