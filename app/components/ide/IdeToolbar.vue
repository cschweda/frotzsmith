<script setup lang="ts">
import type { ProfileMode } from '~/composables/useIde'
import type { StoryExt } from '~/modules/inform6/types'

const { format, profileMode, activeProfile, setProfileMode, targetMode, effectiveExt, setTargetMode } =
  useIde()
const { activeFile } = useProjectFiles()
const colorMode = useColorMode()
const toast = useToast()

function onPrettify() {
  if (!activeFile.value.editable) {
    toast.add({
      title: 'Read-only file',
      description: `${activeFile.value.name} can't be edited.`,
      icon: 'i-lucide-file-lock-2',
      color: 'warning',
      duration: 2500,
    })
    return
  }
  format()
  toast.add({
    title: 'Prettified',
    description: `Re-indented and tidied ${activeFile.value.name}.`,
    icon: 'i-lucide-wand-sparkles',
    color: 'success',
    duration: 2500,
  })
}

const VERSION_LABEL: Record<string, string> = {
  z3: 'Z-machine v3 · .z3',
  z4: 'Z-machine v4 · .z4',
  z5: 'Z-machine v5 · .z5',
  z8: 'Z-machine v8 · .z8',
}
// Target options depend on the active library: PunyInform can target the small
// z3/z4; the full Standard Library is too large for those.
const targetItems = computed(() => {
  const item = (mode: 'auto' | StoryExt, label: string) => ({
    label,
    trailingIcon: targetMode.value === mode ? 'i-lucide-check' : undefined,
    onSelect: () => setTargetMode(mode),
  })
  return [
    [
      item('auto', `Auto (default · .${activeProfile.value.defaultExt})`),
      ...activeProfile.value.targets.map(t => item(t, VERSION_LABEL[t] ?? t)),
    ],
  ]
})

const profileLabel = computed(() =>
  profileMode.value === 'auto' ? `Auto · ${activeProfile.value.shortLabel}` : activeProfile.value.shortLabel,
)

function modeItem(mode: ProfileMode, label: string, icon: string) {
  return {
    label,
    icon,
    // A trailing check shows the active mode.
    trailingIcon: profileMode.value === mode ? 'i-lucide-check' : undefined,
    onSelect: () => setProfileMode(mode),
  }
}

const profileItems = computed(() => [
  [
    modeItem('auto', 'Auto-detect', 'i-lucide-wand-2'),
    modeItem('std', 'Inform 6 Standard Library', 'i-lucide-book-marked'),
    modeItem('puny', 'PunyInform', 'i-lucide-feather'),
  ],
])

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <header
    class="flex shrink-0 flex-wrap items-center gap-3 border-b border-default bg-default/80 px-4 py-3 backdrop-blur"
  >
    <!-- Brand -->
    <div class="flex items-center gap-2.5 pr-2">
      <span
        class="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30"
      >
        <UIcon name="i-lucide-hammer" class="size-5" />
      </span>
      <div class="leading-none">
        <p class="text-lg font-extrabold tracking-tight">Frotzsmith</p>
        <p class="text-muted text-[10px] font-semibold uppercase tracking-widest">Inform 6 IDE</p>
      </div>
    </div>

    <UButton
      size="lg"
      color="neutral"
      variant="subtle"
      icon="i-lucide-wand-sparkles"
      title="Prettify: re-indent & tidy the source. Linting is automatic; this does not compile."
      @click="onPrettify"
    >
      <span class="hidden sm:inline">Prettify</span>
    </UButton>

    <!-- Library (auto-detected by default) + theme -->
    <div class="ml-auto flex items-center gap-2">
      <UDropdownMenu :items="profileItems">
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-library-big"
          trailing-icon="i-lucide-chevron-down"
          class="font-semibold"
          title="Library: auto-detected from your source, or force one"
        >
          <span class="hidden md:inline">{{ profileLabel }}</span>
        </UButton>
      </UDropdownMenu>

      <UDropdownMenu :items="targetItems">
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-cpu"
          trailing-icon="i-lucide-chevron-down"
          class="font-semibold"
          title="Story-file version (compile target)"
        >
          <span class="hidden md:inline">{{ effectiveExt.toUpperCase() }}</span>
        </UButton>
      </UDropdownMenu>

      <UButton
        size="lg"
        color="neutral"
        variant="ghost"
        :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        :aria-label="colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      />
    </div>
  </header>
</template>
