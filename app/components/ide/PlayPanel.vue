<script setup lang="ts">
const { result, playNonce, canPlay } = useIde()
const colorMode = useColorMode()

// The compiled story plays in a sandboxed Parchment iframe (pure-JS ZVM). We
// hand the in-memory story bytes to it as a same-origin blob URL via ?story=.
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
  blobUrl = URL.createObjectURL(new Blob([story], { type: 'application/octet-stream' }))
  // Parchment chooses the interpreter from the URL's extension, so tag the blob
  // URL with the story version (the #fragment is ignored when fetching the blob).
  const ext = result.value?.storyExt ?? 'z5'
  const storyUrl = `${blobUrl}#game.${ext}`
  // ?n changes per play so the iframe reloads with the latest build.
  src.value = `/play/index.html?story=${encodeURIComponent(storyUrl)}&theme=${colorMode.value}&n=${playNonce.value}`
}

// Boot whenever Play is pressed (playNonce bumps), and on first mount if a game
// is already queued.
watch(() => playNonce.value, boot)
onMounted(() => {
  if (playNonce.value > 0) boot()
})
onBeforeUnmount(revoke)
</script>

<template>
  <div class="bg-default h-full w-full">
    <iframe
      v-if="src"
      :src="src"
      class="h-full w-full border-0"
      title="Game — Parchment interpreter"
    />
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
