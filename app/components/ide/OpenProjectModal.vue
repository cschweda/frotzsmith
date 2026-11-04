<script setup lang="ts">
/** Asks before a .frotzsmith package replaces real work. Cancel changes nothing. */
import { displayPath } from '~/project-package/errors'
import { joinPhrases } from '~/utils/package-messages'

const props = defineProps<{ title: string; mainName: string; replaces: string[] }>()

// Both names come from the untrusted package: make them display-safe.
const safeTitle = computed(() => displayPath(props.title, 80))
const safeMain = computed(() => displayPath(props.mainName, 80))
const description = computed(() =>
  props.replaces.length > 0
    ? `Opening this project replaces ${joinPhrases(props.replaces)}.`
    : 'Opening this project replaces the project in the editor.',
)
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ replace: []; cancel: []; closed: [] }>()

// Reka would return focus to whatever was focused before the picker (the editor);
// the toolbar puts it on Open instead.
const content = {
  onCloseAutoFocus: (e: Event) => {
    e.preventDefault()
    emit('closed')
  },
}

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
    :content="content"
    title="Replace the project in the editor?"
    :description="description"
  >
    <template #body>
      <p class="text-sm">
        <strong>{{ safeTitle }}</strong>
        <span class="text-muted"> ({{ safeMain }})</span>
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
