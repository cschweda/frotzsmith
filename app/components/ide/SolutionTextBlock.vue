<script setup lang="ts">
/** A solution's text, read-only: command lines (`> …`) bold, as in the
 *  Transcript tab; scrollable and selectable. */
const props = defineProps<{ text: string; label: string }>()

const lines = computed(() =>
  props.text.split(/\r\n|\r|\n/).map(line => ({ line, command: line.startsWith('>') })),
)
</script>

<template>
  <div
    class="bg-elevated/40 max-h-[60vh] overflow-auto rounded-md border border-default px-3 py-2 font-mono text-sm select-text"
    tabindex="0"
    role="region"
    :aria-label="label"
  >
    <pre class="whitespace-pre-wrap break-words"><template v-for="(l, i) in lines" :key="i"><strong v-if="l.command" class="text-primary">{{ l.line }}</strong><template v-else>{{ l.line }}</template>{{ '\n' }}</template></pre>
  </div>
</template>
