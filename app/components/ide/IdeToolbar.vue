<script setup lang="ts">
import type { ProfileMode } from '~/composables/useIde'
import type { StoryExt } from '~/modules/inform6/types'
import { SAMPLES, type Sample } from '~/modules/inform6/samples'
import { ZIL_SAMPLES } from '~/modules/languages/zil/samples'
import type { ProfileId } from '~/modules/inform6/profiles'

const { format, loadSample, profileMode, activeProfile, setProfileMode, targetMode, effectiveExt, setTargetMode } =
  useIde()
const { profile, profiles } = useLanguage()
const { activeFile } = useProjectFiles()
const colorMode = useColorMode()
const toast = useToast()

// Samples menu: language-aware — ZIL shows a flat list; I6 shows the grouped
// library submenu (one entry per concept, std vs puny as children).
const sampleItems = computed(() => {
  if (profile.value.id === 'zil') {
    return [
      ZIL_SAMPLES.map(s => ({
        label: s.name,
        icon: 'i-lucide-book-open-text',
        onSelect: () => loadSample(s.id),
      })),
    ]
  }
  // I6 path — unchanged.
  const byName = new Map<string, Partial<Record<ProfileId, Sample>>>()
  for (const s of SAMPLES) {
    const entry = byName.get(s.name) ?? {}
    entry[s.group] = s
    byName.set(s.name, entry)
  }
  // Always show both libraries; grey out the one a concept doesn't provide
  // (e.g. a Standard-Library-only sample has no PunyInform variant).
  return [
    [...byName.values()].map(v => ({
      label: (v.std ?? v.puny)!.name,
      children: [
        {
          label: v.std ? 'Inform 6 (full)' : 'Inform 6 (full) · n/a',
          icon: 'i-lucide-book-marked',
          ...(v.std ? { onSelect: () => loadSample(v.std!.id) } : { disabled: true }),
        },
        {
          label: v.puny ? 'PunyInform' : 'PunyInform · n/a',
          icon: 'i-lucide-feather',
          ...(v.puny ? { onSelect: () => loadSample(v.puny!.id) } : { disabled: true }),
        },
      ],
    })),
  ]
})

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
// Target options: ZIL lists z3/z5/z8 from the language profile; I6 lists the
// active library's targets with an "auto" entry (unchanged from before).
const targetItems = computed(() => {
  if (profile.value.id === 'zil') {
    return [
      profile.value.versionTargets.map(t => ({
        label: VERSION_LABEL[t] ?? t,
        trailingIcon: effectiveExt.value === t ? 'i-lucide-check' : undefined,
        onSelect: () => setTargetMode(t),
      })),
    ]
  }
  // I6 path — unchanged. Target options depend on the active library: PunyInform
  // can target the small z3/z4; the full Standard Library is too large for those.
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
        <p class="text-muted text-[10px] font-semibold uppercase tracking-widest">Interactive Fiction IDE</p>
      </div>
    </div>

    <!-- Language toggle: Inform 6 ↔ ZIL -->
    <div class="flex items-center gap-0.5 rounded-lg border border-default bg-elevated/60 p-0.5">
      <NuxtLink
        v-for="p in profiles"
        :key="p.id"
        :to="p.route"
        class="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-semibold transition-colors"
        :class="profile.id === p.id
          ? 'bg-primary/15 text-primary'
          : 'text-muted hover:text-default'"
      >
        {{ p.label }}
        <UBadge
          :color="p.badge === 'beta' ? 'primary' : 'warning'"
          size="xs"
          variant="subtle"
        >
          {{ p.badge }}
        </UBadge>
      </NuxtLink>
    </div>

    <!-- Prettify: I6 (formatI6) and ZIL (formatZil) — each uses its own formatter -->
    <UButton
      v-if="profile.id === 'i6' || profile.id === 'zil'"
      size="lg"
      color="neutral"
      variant="subtle"
      icon="i-lucide-wand-sparkles"
      title="Prettify: re-indent & tidy the source. Linting is automatic; this does not compile."
      @click="onPrettify"
    >
      <span class="hidden sm:inline">Prettify</span>
    </UButton>

    <UDropdownMenu :items="sampleItems">
      <UButton
        size="lg"
        color="neutral"
        variant="subtle"
        icon="i-lucide-book-open-text"
        trailing-icon="i-lucide-chevron-down"
        title="Load a sample into the source editor"
      >
        <span class="hidden sm:inline">Source Samples</span>
      </UButton>
    </UDropdownMenu>

    <!-- Library (auto-detected by default) + theme -->
    <div class="ml-auto flex items-center gap-2">
      <UDropdownMenu v-if="profile.id === 'i6'" :items="profileItems">
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
