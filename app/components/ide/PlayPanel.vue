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

/** True when a [MORE]/char prompt is up (GlkOte's pager or a CharInput field). */
function pagerIsUp(doc: Document): boolean {
  const more = doc.querySelector('.MorePrompt') as HTMLElement | null
  if (more && more.style.display !== 'none') return true
  return !!doc.querySelector('input.CharInput')
}

// Wait until the game is ready for a typed line. Event-paced via MutationObserver,
// NOT fixed-interval polling: Chrome throttles chained timers in long-hidden tabs
// (intensive throttling ≈ one per minute), which used to stall the feed mid-script.
// Observer callbacks fire on DOM changes regardless of visibility. If a [MORE]/char
// prompt is up, press a key to advance, then keep waiting; the watchdog timer only
// bounds a game that never asks for line input again (e.g. it quit).
function waitForLineInput(doc: Document, win: Window, timeoutMs = 10_000): Promise<HTMLInputElement | null> {
  return new Promise(resolve => {
    let done = false
    let observer: MutationObserver | null = null
    let watchdog: ReturnType<typeof setTimeout> | null = null
    const finish = (input: HTMLInputElement | null) => {
      if (done) return
      done = true
      observer?.disconnect()
      if (watchdog) clearTimeout(watchdog)
      resolve(input)
    }
    const check = () => {
      const input = doc.querySelector('input.LineInput') as HTMLInputElement | null
      if (input) return finish(input)
      if (pagerIsUp(doc)) fireKey(doc, win, ' ', 'Space', 32)
    }
    observer = new MutationObserver(check)
    observer.observe(doc.getElementById('windowport') ?? doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
    watchdog = setTimeout(() => finish(doc.querySelector('input.LineInput') as HTMLInputElement | null), timeoutMs)
    check() // the input may already be present — don't wait for a mutation
  })
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
      // Watchable pace — but only when someone can watch. Hidden tabs skip it:
      // waitForLineInput already gates on the response having rendered, and a
      // throttled 420ms timer would stall the whole feed.
      if (document.visibilityState === 'visible') await delay(420)
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
// A new or cleared build invalidates the running game: tear the iframe down so a
// stale game never lingers after loading a new source or recompiling. Play is
// only re-enabled by a clean compile, and pressing it bumps playNonce → boot().
watch(() => result.value, () => {
  revoke()
  src.value = null
})
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
