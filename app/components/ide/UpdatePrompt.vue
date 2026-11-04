<script setup lang="ts">
import { APPLYING_MESSAGE, UPDATE_READY } from '~/update/flow'
import { later } from '~/update/prompt'
import { applyingUpdate, needRefresh } from '~/update/state'
import { justUpdated, UP_TO_DATE } from '~/update/updated'
import { takeUpdate } from '~/update/use-check'

// "A new version of Frotzsmith is ready": a persistent, non-modal offer with Reload and Later. It
// never reloads by itself. The region stays in the page and only its contents change, so a
// screen reader hears the offer when it appears.
const shown = computed(() => needRefresh.value && !later.value)
const reloadButton = ref<{ $el?: HTMLElement } | null>(null)

// Focus goes to Reload only if it was on <body>: never taken from the editor or anything else.
watch(shown, async (now) => {
  if (!now) return
  const active = document.activeElement
  if (active && active !== document.body) return
  await nextTick()
  reloadButton.value?.$el?.focus()
})

function putOff() {
  later.value = true
}

/** How long "up to date" stays. */
const UPDATED_MS = 4000
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  justUpdated,
  (now) => {
    clearTimeout(timer)
    if (now) timer = setTimeout(() => (justUpdated.value = false), UPDATED_MS)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    role="status"
    class="pointer-events-none fixed right-3 bottom-10 z-40 max-w-[calc(100vw-1.5rem)]"
    data-update-region
  >
    <section
      v-if="shown"
      aria-label="Update"
      class="border-warning bg-elevated text-default pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-l-4 px-3.5 py-2.5 text-sm shadow-lg"
      data-update
    >
      <p>{{ applyingUpdate ? APPLYING_MESSAGE : UPDATE_READY }}</p>
      <div class="flex gap-1.5">
        <UButton
          ref="reloadButton"
          size="xs"
          color="warning"
          :disabled="applyingUpdate"
          @click="takeUpdate"
        >
          Reload
        </UButton>
        <UButton size="xs" color="neutral" variant="ghost" :disabled="applyingUpdate" @click="putOff">
          Later
        </UButton>
      </div>
    </section>
    <Transition name="updated">
      <section
        v-if="justUpdated && !needRefresh"
        aria-label="Updated"
        class="border-default bg-elevated text-default pointer-events-auto rounded-md border border-l-4 border-l-primary px-3.5 py-2.5 text-sm shadow-lg"
        data-updated
      >
        <p>{{ UP_TO_DATE }}</p>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.updated-leave-active {
  transition: opacity 0.6s ease;
}
.updated-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .updated-leave-active {
    transition: none;
  }
}
</style>
