<script setup lang="ts">
const { result, playNonce, canPlay } = useIde()
const { record, reset } = usePlayTranscript()
const colorMode = useColorMode()

// The compiled story plays in a Parchment iframe (pure-JS ZVM). We hand the
// in-memory story bytes to it as a same-origin blob URL via ?story=.
const container = ref<HTMLElement | null>(null)
const playFrame = ref<HTMLIFrameElement | null>(null)
const isFullscreen = ref(false)
const src = ref<string | null>(null)
let blobUrl: string | null = null

function revoke() {
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl)
    blobUrl = null
  }
}

function boot() {
  const story = result.value?.storyFile
  if (!story) {
    src.value = null
    return
  }
  revoke()
  blobUrl = URL.createObjectURL(new Blob([new Uint8Array(story)], { type: 'application/octet-stream' }))
  // Parchment chooses the interpreter from the URL's extension, so tag the blob
  // URL with the story version (the #fragment is ignored when fetching the blob).
  const ext = result.value?.storyExt ?? 'z5'
  const storyUrl = `${blobUrl}#game.${ext}`
  // ?n changes per play so the iframe reloads with the latest build.
  src.value = `/play/index.html?story=${encodeURIComponent(storyUrl)}&theme=${colorMode.value}&n=${playNonce.value}`
}

// Full-screen the play area (the whole game, not the IDE chrome).
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else container.value?.requestFullscreen?.()
}
function onFsChange() {
  isFullscreen.value = document.fullscreenElement === container.value
}

interface PlayMessage {
  source?: string
  type?: string
  value?: unknown
}
// Only trust same-origin messages tagged by our play page (instruction-source
// boundary). The value is data — appended to a list, never executed.
function onMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return
  if (e.source !== playFrame.value?.contentWindow) return
  const data = e.data as PlayMessage | null
  if (!data || data.source !== 'frotzsmith-play') return
  if (data.type === 'command' && typeof data.value === 'string') record(data.value)
  else if (data.type === 'session-start') reset()
}

watch(() => playNonce.value, boot)
onMounted(() => {
  document.addEventListener('fullscreenchange', onFsChange)
  window.addEventListener('message', onMessage)
  if (playNonce.value > 0) boot()
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  window.removeEventListener('message', onMessage)
  revoke()
})
</script>

<template>
  <div ref="container" class="bg-default relative h-full w-full">
    <template v-if="src">
      <UButton
        class="absolute right-2 top-2 z-10 opacity-70 hover:opacity-100"
        color="neutral"
        variant="solid"
        size="xs"
        :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
        :title="isFullscreen ? 'Exit full screen' : 'Play full screen'"
        :aria-label="isFullscreen ? 'Exit full screen' : 'Play full screen'"
        @click="toggleFullscreen"
      />
      <iframe ref="playFrame" :src="src" class="h-full w-full border-0" title="Game — Parchment interpreter" />
    </template>
    <div
      v-else
      class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <UIcon name="i-lucide-gamepad-2" class="size-10 text-primary" />
      <p class="text-lg font-semibold">
        {{ canPlay ? 'Press Play to start the game' : 'Compile to play' }}
      </p>
      <p class="text-muted max-w-sm text-sm">
        {{
          canPlay
            ? 'Your compiled game runs here in the Parchment interpreter.'
            : 'A clean compile enables the Play button.'
        }}
      </p>
    </div>
  </div>
</template>
