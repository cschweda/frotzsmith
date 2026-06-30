<script setup lang="ts">
const { result, playNonce, canPlay, pendingScript } = useIde()
const { record, reset } = usePlayTranscript()
const { recordCommand, recordRoom, markNoRoom } = useMap()
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

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// Dispatch a full key sequence (keydown → keypress → keyup) using the IFRAME's
// KeyboardEvent realm, with keyCode/which set. GlkOte's line input only submits
// on the keypress (not keydown alone), so all three are required — validated live.
function fireKey(target: EventTarget, win: Window, key: string, code: string, keyCode: number) {
  for (const type of ['keydown', 'keypress', 'keyup']) {
    const ev = new (win as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent(type, { key, code, bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'keyCode', { get: () => keyCode })
    Object.defineProperty(ev, 'which', { get: () => keyCode })
    target.dispatchEvent(ev)
  }
}

// Wait until the game is ready for a typed line. If a [MORE]/char prompt is up
// (no LineInput), press a key to advance, then keep waiting.
async function waitForLineInput(doc: Document, win: Window, timeoutMs = 5000): Promise<HTMLInputElement | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const input = doc.querySelector('input.LineInput') as HTMLInputElement | null
    if (input) return input
    fireKey(doc, win, ' ', 'Space', 32) // advance a [MORE]/char prompt
    await delay(140)
  }
  return null
}

// Feed a parsed script into the live GlkOte game, one command at a watchable pace.
async function feedScript(commands: string[]) {
  const ifr = playFrame.value
  const win = ifr?.contentWindow as (Window & { __frotzScriptRunning?: boolean }) | null
  const doc = ifr?.contentDocument
  if (!ifr || !win || !doc) return
  win.__frotzScriptRunning = true
  try {
    for (const cmd of commands) {
      const input = await waitForLineInput(doc, win)
      if (!input) break
      input.focus()
      input.value = cmd
      fireKey(input, win, 'Enter', 'Enter', 13)
      await delay(420)
    }
  } finally {
    win.__frotzScriptRunning = false
  }
}

interface PlayMessage {
  source?: string
  type?: string
  value?: unknown
  name?: unknown
  text?: unknown
}
// Only trust same-origin messages tagged by our play page (instruction-source
// boundary). The value is data — appended to a list, never executed.
function onMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return
  if (e.source !== playFrame.value?.contentWindow) return
  const data = e.data as PlayMessage | null
  if (!data || data.source !== 'frotzsmith-play') return
  if (data.type === 'command' && typeof data.value === 'string') {
    record(data.value)
    recordCommand(data.value)
  } else if (data.type === 'room' && typeof data.name === 'string') {
    recordRoom(data.name, typeof data.text === 'string' ? data.text : '')
  } else if (data.type === 'no-room') {
    markNoRoom()
  } else if (data.type === 'session-start') {
    reset()
    const cmds = pendingScript.value
    if (cmds && cmds.length) {
      pendingScript.value = null
      void feedScript(cmds)
    }
  }
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
