<script setup lang="ts">
/**
 * Asks before something from outside replaces real work or changes what every
 * game uses: a .frotzsmith package, a plain source file, a .skein import.
 * Cancel changes nothing. `notes` are extra sentences shown in the body (the
 * extensions a package installs, the hidden files it carries) — already
 * display-safe.
 */
import { displayPath } from '~/project-package/errors'
import { joinPhrases } from '~/utils/package-messages'

const props = withDefaults(
  defineProps<{
    title: string
    mainName?: string
    replaces: string[]
    notes?: string[]
    /** Overrides the default "Replace the project in the editor?" / "Open this project?". */
    heading?: string
    /** Overrides the default description built from `replaces`. */
    description?: string
    confirmLabel?: string
  }>(),
  { mainName: '', notes: () => [], heading: undefined, description: undefined, confirmLabel: undefined },
)

// Both names come from untrusted input: make them display-safe.
const safeTitle = computed(() => displayPath(props.title, 80))
const safeMain = computed(() => displayPath(props.mainName))
const heading = computed(() =>
  props.heading ?? (props.replaces.length > 0 ? 'Replace the project in the editor?' : 'Open this project?'),
)
const description = computed(() => {
  if (props.description !== undefined) return props.description
  if (props.replaces.length > 0) return `Opening this project replaces ${joinPhrases(props.replaces)}.`
  return 'Check what this project adds before you open it.'
})
const confirmLabel = computed(() => props.confirmLabel ?? (props.replaces.length > 0 ? 'Replace' : 'Open'))
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
    :title="heading"
    :description="description"
  >
    <template #body>
      <p class="text-sm">
        <strong>{{ safeTitle }}</strong>
        <span v-if="safeMain" class="text-muted"> ({{ safeMain }})</span>
      </p>
      <ul v-if="notes.length" class="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li v-for="(n, i) in notes" :key="i">{{ n }}</li>
      </ul>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="cancel">Cancel</UButton>
        <UButton color="primary" icon="i-lucide-check" @click="replace">{{ confirmLabel }}</UButton>
      </div>
    </template>
  </UModal>
</template>
