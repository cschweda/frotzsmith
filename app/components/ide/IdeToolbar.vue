<script setup lang="ts">
import type { ProfileMode } from '~/composables/useIde'

const { format, profileMode, activeProfile, setProfileMode } = useIde()
const colorMode = useColorMode()

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
      @click="format"
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
