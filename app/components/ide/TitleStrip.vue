<script setup lang="ts">
const { source } = useIde()

// The game's title & headline, read live from the source.
const meta = computed(() => {
  const story = /Constant\s+Story\s+"([^"]*)"/i.exec(source.value)?.[1]?.trim()
  const headline = (/Constant\s+Headline\s+"([^"]*)"/i.exec(source.value)?.[1] ?? '')
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { story: story || 'Untitled', headline }
})
</script>

<template>
  <div class="shrink-0 border-b border-default px-4 py-2.5">
    <p class="truncate text-sm font-bold">{{ meta.story }}</p>
    <p v-if="meta.headline" class="text-muted truncate text-xs">{{ meta.headline }}</p>
  </div>
</template>
