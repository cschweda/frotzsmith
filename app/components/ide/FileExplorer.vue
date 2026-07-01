<script setup lang="ts">
const { files, activeId, openFile, togglePanel } = useProjectFiles()

const projectFiles = computed(() => files.value.filter(f => f.group === 'project'))
const libraryFiles = computed(() => files.value.filter(f => f.group === 'library'))
const libraryOpen = ref(true)
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
        <li v-for="file in projectFiles" :key="file.id">
          <button
            type="button"
            :aria-current="file.id === activeId ? 'true' : undefined"
            :class="[
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition',
              file.id === activeId
                ? 'bg-primary/15 font-semibold text-primary'
                : 'text-default hover:bg-default/60',
            ]"
            @click="openFile(file.id)"
          >
            <UIcon
              :name="file.editable ? 'i-lucide-file-code-2' : 'i-lucide-file-lock-2'"
              class="size-4 shrink-0 opacity-70"
            />
            <span class="truncate">{{ file.name }}</span>
            <span v-if="!file.editable" class="sr-only">(read-only)</span>
          </button>
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

    <!-- Add files: reuse the existing extensions modal -->
    <div class="shrink-0 border-t border-default p-2">
      <ExtensionsModal />
    </div>
  </div>
</template>
