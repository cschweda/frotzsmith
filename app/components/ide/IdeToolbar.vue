<script setup lang="ts">
const { format, activeProfile, setProfile } = useIde()
const colorMode = useColorMode()

const profileItems = computed(() => [
  [
    {
      label: 'Inform 6 Standard Library',
      icon: 'i-lucide-book-marked',
      onSelect: () => setProfile('std'),
    },
    {
      label: 'PunyInform',
      icon: 'i-lucide-feather',
      onSelect: () => setProfile('puny'),
    },
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

    <UButton size="lg" color="neutral" variant="subtle" icon="i-lucide-wand-sparkles" @click="format">
      <span class="hidden sm:inline">Format</span>
    </UButton>

    <!-- Profile + theme -->
    <div class="ml-auto flex items-center gap-2">
      <UDropdownMenu :items="profileItems">
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-library-big"
          trailing-icon="i-lucide-chevron-down"
          class="font-semibold"
          aria-label="Library profile"
        >
          <span class="hidden md:inline">{{ activeProfile.shortLabel }}</span>
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
