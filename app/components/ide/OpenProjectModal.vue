<script setup lang="ts">
/** Asks before a .frotzsmith package replaces real work. Cancel changes nothing. */
const props = defineProps<{ title: string; mainName: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ replace: []; cancel: [] }>()

function cancel() {
  emit('cancel')
}
// Closing by any route (Esc, backdrop, X) is a Cancel.
watch(open, (v, was) => {
  if (was && !v && !replacing) emit('cancel')
  replacing = false
})
let replacing = false
function replace() {
  replacing = true
  emit('replace')
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Replace the project in the editor?"
    description="Opening this project replaces your source, includes, test scripts and Skein."
  >
    <template #body>
      <p class="text-sm">
        <strong>{{ props.title }}</strong>
        <span class="text-muted"> ({{ props.mainName }})</span>
      </p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="cancel">Cancel</UButton>
        <UButton color="primary" icon="i-lucide-check" @click="replace">Replace</UButton>
      </div>
    </template>
  </UModal>
</template>
