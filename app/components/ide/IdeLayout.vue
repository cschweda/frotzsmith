<script setup lang="ts">
import { frotzsmith } from '~~/frotzsmith.config'
import { isCompileShortcut } from '~/utils/shortcut'

const { restore, savedAt, activeProfile, profileMode, result, effectiveExt, mobileView, runCompile, status } = useIde()
const { profile: langProfile } = useLanguage()
const { panelOpen, togglePanel, activeId } = useProjectFiles()

/** Mobile has no Compile button in the Source pane (it lives in the Output
 *  title strip) — the pane switch carries one, and shows the results. */
function compileFromMobile() {
  mobileView.value = 'output'
  void runCompile()
}

// ⌘B / Ctrl+B compiles from anywhere in the IDE, not only inside CodeMirror
// (whose own Mod-b binding handles — and preventDefaults — editor focus).
function onGlobalKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented || !isCompileShortcut(e)) return
  e.preventDefault()
  void runCompile()
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))

const { consumeShareFragment } = useShareLink()
const { restore: restoreSkein } = useSkein()
onMounted(() => {
  restore()
  // After restore, so the pristine-buffer check sees the real recovered state.
  consumeShareFragment()
  // Skein bucket for the restored game (async — IndexedDB).
  void restoreSkein()
})

const savedLabel = computed(() => (savedAt.value ? 'Recovery saved' : 'Not saved yet'))

// Flash a green dot each time the recovery snapshot is autosaved.
const justSaved = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | null = null
watch(savedAt, () => {
  justSaved.value = true
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (justSaved.value = false), 900)
})

// Compiler + active library/toolchain version, so authors know exactly what's running.
const versionLabel = computed(() => {
  const v = frotzsmith.versions
  if (langProfile.value.id === 'zil') {
    return `ZILF ${v.zilf} · zillib`
  }
  // I6 path — unchanged.
  const lib = activeProfile.value.id === 'puny' ? `PunyInform ${v.punyinform}` : `Std Lib ${v.stdlib}`
  return `Inform ${v.inform6} · ${lib}`
})

function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

// Warn as dynamic ("readable") memory approaches the Z-machine's 64 KB ceiling.
const memClass = computed(() => {
  const s = result.value?.stats
  if (!s?.readableMem || !s.readableMax) return ''
  const pct = s.readableMem / s.readableMax
  return pct > 0.9 ? 'text-error font-semibold' : pct > 0.75 ? 'text-warning' : ''
})

// The mobile drawer must never be modal on desktop: the inline explorer column
// handles desktop, and a USlideover with open=true overlays the page even when
// CSS-hidden. Gate its open state to mobile viewports (Tailwind `lg` = 1024px).
const isDesktop = ref(import.meta.client ? window.matchMedia('(min-width: 1024px)').matches : true)
let viewportMq: MediaQueryList | null = null
function syncViewport() {
  isDesktop.value = viewportMq?.matches ?? true
}
onMounted(() => {
  viewportMq = window.matchMedia('(min-width: 1024px)')
  syncViewport()
  viewportMq.addEventListener('change', syncViewport)
})
onBeforeUnmount(() => viewportMq?.removeEventListener('change', syncViewport))

// Picking a file in the mobile drawer should show it, not leave the drawer
// covering the editor.
watch(activeId, () => {
  if (!isDesktop.value && panelOpen.value) togglePanel()
  if (!isDesktop.value) mobileView.value = 'editor'
})

// Drawer is open only on mobile; closing it (backdrop/Esc) routes through
// togglePanel so the closed state persists (not just an in-memory ref write).
const drawerOpen = computed({
  get: () => panelOpen.value && !isDesktop.value,
  set: (v: boolean) => {
    if (v !== panelOpen.value) togglePanel()
  },
})
</script>

<template>
  <!-- h-dvh, not h-screen: iOS Safari's 100vh is taller than the visible
       area, which hid the status bar and editor bottom under its toolbar. -->
  <div class="flex h-dvh flex-col bg-default text-default">
    <IdeToolbar />

    <!-- Mobile pane switch -->
    <div class="flex gap-1 border-b border-default p-2 lg:hidden">
      <button
        type="button"
        :aria-pressed="mobileView === 'editor'"
        :class="[
          'flex-1 rounded-lg py-2 text-sm font-semibold transition',
          mobileView === 'editor' ? 'bg-primary/15 text-primary' : 'text-muted',
        ]"
        @click="mobileView = 'editor'"
      >
        Source
      </button>
      <button
        type="button"
        :aria-pressed="mobileView === 'output'"
        :class="[
          'flex-1 rounded-lg py-2 text-sm font-semibold transition',
          mobileView === 'output' ? 'bg-primary/15 text-primary' : 'text-muted',
        ]"
        @click="mobileView = 'output'"
      >
        Output
      </button>
      <UButton
        color="primary"
        icon="i-lucide-hammer"
        :loading="status === 'compiling'"
        :disabled="status === 'compiling'"
        aria-label="Compile"
        title="Compile"
        @click="compileFromMobile"
      />
    </div>

    <!-- Explorer + two-pane shell -->
    <main class="flex min-h-0 flex-1">
      <!-- Desktop: collapsible explorer column -->
      <aside
        v-if="panelOpen"
        class="hidden w-60 shrink-0 border-r border-default lg:block"
        aria-label="File explorer"
      >
        <FileExplorer />
      </aside>

      <div class="min-h-0 flex-1 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-default">
        <section
          :class="['h-full min-h-0 flex-col', mobileView === 'editor' ? 'flex' : 'hidden', 'lg:flex']"
          aria-label="Source"
        >
          <TitleStrip />
          <SourceToolbar />
          <EditorTabs />
          <div class="min-h-0 flex-1">
            <SourcePane />
          </div>
        </section>
        <section
          :class="['h-full min-h-0', mobileView === 'output' ? 'block' : 'hidden', 'lg:block']"
          aria-label="Output"
        >
          <RightPaneTabs />
        </section>
      </div>
    </main>

    <!-- Mobile: explorer as a slide-over drawer -->
    <USlideover v-model:open="drawerOpen" side="left" title="Project files" class="lg:hidden">
      <template #body>
        <FileExplorer />
      </template>
    </USlideover>

    <!-- Status bar -->
    <footer
      class="text-muted flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-default px-4 py-1.5 text-xs"
    >
      <span class="flex items-center gap-1.5" title="Source is autosaved for crash recovery (~1s after edits)">
        <UIcon name="i-lucide-save" class="size-3.5" />
        {{ savedLabel }}
        <span
          aria-hidden="true"
          class="size-1.5 rounded-full transition-all duration-500"
          :class="justSaved ? 'bg-success scale-150 shadow-[0_0_5px] shadow-success/70' : 'bg-success/20'"
        />
      </span>

      <span class="flex items-center gap-1.5" title="Compile target (story-file version)">
        <UIcon name="i-lucide-cpu" class="size-3.5" />
        Target .{{ effectiveExt }}
      </span>

      <span class="flex items-center gap-1.5" title="Compiler & active library version">
        <UIcon name="i-lucide-package" class="size-3.5" />
        {{ versionLabel }}
      </span>

      <template v-if="result">
        <span class="flex items-center gap-1.5" title="Compiled story-file size">
          <UIcon name="i-lucide-file-archive" class="size-3.5" />
          {{ fmtBytes(result.byteLength) }}
        </span>
        <span
          v-if="result.stats?.readableMem != null"
          :class="['flex items-center gap-1.5', memClass]"
          title="Dynamic (readable) memory used / Z-machine 64 KB ceiling"
        >
          <UIcon name="i-lucide-memory-stick" class="size-3.5" />
          dyn {{ fmtBytes(result.stats.readableMem) }} / {{ fmtBytes(result.stats.readableMax ?? 0) }}
        </span>
        <span
          v-if="result.stats?.zFree != null"
          class="flex items-center gap-1.5"
          title="Total Z-machine memory free"
        >
          <UIcon name="i-lucide-database" class="size-3.5" />
          {{ fmtBytes(result.stats.zFree) }} free
        </span>
      </template>

      <!-- I6: show Std/Puny library mode; ZIL: show language label only. -->
      <span v-if="langProfile.id === 'i6'" class="ml-auto flex items-center gap-1.5">
        <UIcon name="i-lucide-book-open" class="size-3.5" />
        {{ profileMode === 'auto' ? 'Auto' : 'Forced' }}: {{ activeProfile.shortLabel }} ·
        {{ effectiveExt.toUpperCase() }}
      </span>
      <span v-else class="ml-auto flex items-center gap-1.5">
        <UIcon name="i-lucide-book-open" class="size-3.5" />
        ZIL · {{ effectiveExt.toUpperCase() }}
      </span>

      <a
        :href="`${frotzsmith.repoUrl}/blob/main/CHANGELOG.md`"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-primary flex items-center gap-1.5"
      >
        <UIcon name="i-lucide-history" class="size-3.5" />
        Changelog
      </a>

      <a
        :href="`${frotzsmith.repoUrl}/blob/main/ROADMAP.md`"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-primary flex items-center gap-1.5"
      >
        <UIcon name="i-lucide-signpost" class="size-3.5" />
        Roadmap
      </a>

      <NuxtLink
        to="/technical"
        class="hover:text-primary flex items-center gap-1.5 font-semibold"
        title="Technical details, Z-machine limits & resources"
      >
        <UIcon name="i-lucide-info" class="size-3.5" />
        Technical
      </NuxtLink>
    </footer>
  </div>
</template>
