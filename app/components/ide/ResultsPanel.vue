<script setup lang="ts">
import { useHtmlExport } from '~/composables/useHtmlExport'

import { compileShortcutLabel } from '~/utils/shortcut'
import { displayPath } from '~/project-package/errors'

const { result, status, storyBase, jumpTo, playStory } = useIde()
const { diagnosticTarget } = useProjectFiles()

/** The file a diagnostic is in, shown before its line when that isn't the
 *  main source (an extra ZIL file, or a zillib file that has no tab). */
function fileLabel(file: string | undefined): string {
  if (!file || diagnosticTarget(file) === 'source') return ''
  return displayPath(file)
}
const shortcut = compileShortcutLabel()
const { exportHtml, exporting } = useHtmlExport()
function onExportHtml() {
  void exportHtml() // outcome surfaces via toast on failure
}

const errorCount = computed(
  () => result.value?.diagnostics.filter(d => d.severity !== 'warning').length ?? 0,
)
const warningCount = computed(
  () => result.value?.diagnostics.filter(d => d.severity === 'warning').length ?? 0,
)

/** What a screen reader hears after a compile: one short line — not the whole
 *  panel (banner, every diagnostic and the raw compiler output). */
const announcement = computed(() => {
  if (status.value === 'compiling') return 'Compiling…'
  if (status.value === 'idle' || !result.value) return ''
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const counts = `${plural(errorCount.value, 'error')}, ${plural(warningCount.value, 'warning')}`
  return status.value === 'success' ? `Compiled successfully — ${counts}.` : `Compile failed — ${counts}.`
})

function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

function severityIcon(s: string) {
  if (s === 'warning') return 'i-lucide-triangle-alert'
  if (s === 'fatal') return 'i-lucide-octagon-x'
  return 'i-lucide-circle-x'
}

function severityClass(s: string) {
  return s === 'warning' ? 'text-warning' : 'text-error'
}

function downloadStory() {
  const r = result.value
  if (!r?.storyFile) return
  const blob = new Blob([new Uint8Array(r.storyFile)], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${storyBase.value}.${r.storyExt}`
  a.click()
  // Revoking synchronously can cancel the download in some Safari/Firefox builds.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
</script>

<template>
  <div class="h-full overflow-auto p-4 sm:p-6">
    <p class="sr-only" role="status">{{ announcement }}</p>
    <!-- Idle -->
    <div
      v-if="status === 'idle'"
      class="frotz-grid flex h-full flex-col items-center justify-center gap-3 rounded-xl text-center"
    >
      <UIcon name="i-lucide-hammer" class="size-10 text-primary" />
      <p class="text-lg font-semibold">Ready to forge</p>
      <p class="text-muted max-w-xs text-sm">
        Press <kbd class="rounded bg-elevated px-1.5 py-0.5 text-xs font-semibold">{{ shortcut }}</kbd> or
        <span class="font-medium text-default">Compile</span> to build your story file.
      </p>
    </div>

    <!-- Compiling -->
    <div v-else-if="status === 'compiling'" class="flex items-center gap-3 text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-primary" />
      <span class="font-medium">Compiling…</span>
    </div>

    <template v-else>
      <!-- Success banner — ready to play/test -->
      <div
        v-if="status === 'success' && result"
        class="mb-5 rounded-xl bg-success/10 p-5 ring-1 ring-success/30"
      >
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-circle-check-big" class="size-8 shrink-0 text-success" />
          <div class="min-w-0 flex-1">
            <p class="text-lg font-bold text-success">Ready to play</p>
            <p class="text-muted text-sm">
              Compiled cleanly · story.{{ result.storyExt }} · {{ fmtBytes(result.byteLength) }} ·
              {{ result.ms }} ms
              <span v-if="warningCount" class="text-warning">
                · {{ warningCount }} warning{{ warningCount > 1 ? 's' : '' }}</span>
            </p>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton color="success" size="lg" icon="i-lucide-play" @click="playStory">
            Play
          </UButton>
          <UButton
            color="neutral"
            variant="subtle"
            size="lg"
            icon="i-lucide-download"
            @click="downloadStory"
          >
            Download story file
          </UButton>
          <UButton
            color="neutral"
            variant="subtle"
            size="lg"
            icon="i-lucide-file-code-2"
            :loading="exporting"
            title="A single offline-playable .html — upload it to itch.io or any static host"
            @click="onExportHtml"
          >
            Export playable HTML
          </UButton>
        </div>
      </div>

      <!-- Error banner -->
      <div
        v-else-if="status === 'error'"
        class="mb-5 flex items-center gap-3 rounded-xl bg-error/10 p-4 ring-1 ring-error/30"
      >
        <UIcon name="i-lucide-circle-x" class="size-6 text-error" />
        <div>
          <p class="font-semibold text-error">
            {{ errorCount }} error{{ errorCount === 1 ? '' : 's' }}
            <span v-if="warningCount" class="text-warning">
              · {{ warningCount }} warning{{ warningCount > 1 ? 's' : '' }}</span>
          </p>
          <p class="text-muted text-sm">Click a line to jump to it in the editor.</p>
        </div>
      </div>

      <!-- Diagnostics -->
      <ul v-if="result?.diagnostics.length" class="space-y-1.5">
        <li v-for="(d, i) in result.diagnostics" :key="i">
          <button
            v-if="d.line && diagnosticTarget(d.file) !== null"
            type="button"
            class="group flex w-full items-start gap-3 rounded-lg border border-default p-3 text-left transition hover:border-primary/50 hover:bg-elevated"
            @click="jumpTo(d.line, d.file)"
          >
            <UIcon :name="severityIcon(d.severity)" :class="['mt-0.5 size-4 shrink-0', severityClass(d.severity)]" />
            <span class="font-mono text-xs font-semibold text-muted group-hover:text-primary">
              <template v-if="fileLabel(d.file)">{{ fileLabel(d.file) }}:</template>{{ d.line }}
            </span>
            <span class="min-w-0 flex-1 text-sm">{{ d.message }}</span>
          </button>
          <div v-else class="flex items-start gap-3 rounded-lg border border-default p-3">
            <UIcon :name="severityIcon(d.severity)" :class="['mt-0.5 size-4 shrink-0', severityClass(d.severity)]" />
            <span v-if="d.line" class="font-mono text-xs font-semibold text-muted">
              <template v-if="fileLabel(d.file)">{{ fileLabel(d.file) }}:</template>{{ d.line }}
            </span>
            <span class="min-w-0 flex-1 text-sm">{{ d.message }}</span>
          </div>
        </li>
      </ul>

      <!-- Full compiler output — always shown, nothing hidden -->
      <div v-if="result" class="mt-5">
        <p
          class="text-muted mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
        >
          <UIcon name="i-lucide-terminal" class="size-3.5" />
          Compiler output
        </p>
        <pre
          class="overflow-auto whitespace-pre-wrap rounded-lg border border-default bg-elevated p-3 font-mono text-xs leading-relaxed text-muted"
        >{{ result.rawStderr || '(no output)' }}</pre>
      </div>
    </template>
  </div>
</template>
