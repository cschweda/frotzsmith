<script setup lang="ts">
import { SAMPLES } from '~/modules/inform6/samples'
import type { ProfileId } from '~/modules/inform6/profiles'

const { loadSample, newProject } = useIde()

// Samples dropdown, split into labelled groups by library.
const sampleItems = computed(() => {
  const group = (g: ProfileId, label: string) => [
    { label, type: 'label' as const },
    ...SAMPLES.filter(s => s.group === g).map(s => ({
      label: s.name,
      onSelect: () => loadSample(s.id),
    })),
  ]
  return [group('std', 'Inform 6 (full)'), group('puny', 'PunyInform')]
})

// New-project modal state.
const open = ref(false)
const title = ref('')
const author = ref('')
const library = ref<ProfileId>('std')

function create() {
  newProject({ title: title.value, author: author.value, library: library.value })
  open.value = false
  title.value = ''
  author.value = ''
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 border-b border-default px-3 py-2">
    <UIcon name="i-lucide-file-code-2" class="text-muted size-4" />
    <span class="text-muted text-xs font-semibold uppercase tracking-wide">Source</span>

    <div class="ml-auto flex items-center gap-2">
      <UDropdownMenu :items="sampleItems">
        <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-book-open-text" trailing-icon="i-lucide-chevron-down">
          Samples
        </UButton>
      </UDropdownMenu>

      <UButton color="primary" variant="subtle" size="sm" icon="i-lucide-file-plus-2" @click="open = true">
        New Project
      </UButton>
    </div>

    <UModal v-model:open="open" title="New project" description="Clear the editor and start fresh from a skeleton.">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Title">
            <UInput v-model="title" placeholder="My Game" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Author">
            <UInput v-model="author" placeholder="Your name" class="w-full" />
          </UFormField>
          <UFormField label="Library">
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
