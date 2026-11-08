<script setup lang="ts">
import { feedScript } from '~/composables/play-feed'
import { feedFailed, feedStopped } from '~/composables/play-feed-toasts'
import { acceptPlayMessage } from '~/utils/play-message'

/**
 * The compiled story in a Parchment iframe (pure-JS ZVM), the player frotzsmith
 * shipped with; now the alternative to frotzplay (frotzlens docs/16 §4). PlayPanel
 * mounts it fresh for each Play. We hand the in-memory story bytes to it as a
 * same-origin blob URL via ?story=.
 */
const { result, playNonce, pendingScript } = useIde()
const sink = usePlaySink()
const colorMode = useColorMode()

const playFrame = shallowRef<HTMLIFrameElement | null>(null)
const src = ref<string | null>(null)
let blobUrl: string | null = null

function boot() {
  const story = result.value?.storyFile
  if (!story) return
  blobUrl = URL.createObjectURL(new Blob([new Uint8Array(story)], { type: 'application/octet-stream' }))
  // Parchment chooses the interpreter from the URL's extension, so tag the blob
  // URL with the story version (the #fragment is ignored when fetching the blob).
  const ext = result.value?.storyExt ?? 'z5'
  const storyUrl = `${blobUrl}#game.${ext}`
  // ?n changes per play so the iframe reloads with the latest build.
  src.value = `/play/index.html?story=${encodeURIComponent(storyUrl)}&theme=${colorMode.value}&n=${playNonce.value}`
}

// The feed engine (pacing, pager auto-advance, watchdog) lives in
// ~/composables/play-feed — pure and unit-tested. This wrapper resolves the
// iframe's realm and turns a partial feed into a visible cue instead of the
// old silent stop (the "throttled tab: it just stopped" failure mode).
async function runPendingScript(commands: string[]) {
  const ifr = playFrame.value
  const win = ifr?.contentWindow as (Window & { __frotzScriptRunning?: boolean }) | null
  const doc = ifr?.contentDocument
  if (!ifr || !win || !doc) return
  try {
    const outcome = await feedScript(doc, win, commands)
    if (!outcome.completed) feedStopped(outcome.fed, outcome.total)
  } catch (err) {
    // e.g. the iframe navigated away mid-feed — surface it, never reject unhandled.
    feedFailed(err)
  }
}

// Only trust same-origin messages from the play iframe's own window, tagged by
// our play page (instruction-source boundary; ~/utils/play-message). The value
// is data — appended to a list, never executed.
function onMessage(e: MessageEvent) {
  const data = acceptPlayMessage(e, playFrame.value?.contentWindow, window.location.origin)
  if (!data) return
  if (data.type === 'command' && typeof data.value === 'string') {
    sink.command(data.value)
  } else if (data.type === 'room' && typeof data.name === 'string') {
    sink.room(data.name, typeof data.text === 'string' ? data.text : '')
  } else if (data.type === 'no-room') {
    sink.noRoom()
  } else if (data.type === 'session-start') {
    sink.started()
    const cmds = pendingScript.value
    if (cmds && cmds.length) {
      pendingScript.value = null
      void runPendingScript(cmds)
    }
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  boot()
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  if (blobUrl) URL.revokeObjectURL(blobUrl)
})
</script>

<template>
  <!-- sandbox (audit 2026-06-30, defense-in-depth): allow-same-origin +
       allow-scripts are required (the shell scripts the iframe's DOM and
       the player runs the ZVM), but popups, top navigation, downloads,
       and form submission stay blocked. -->
  <iframe
    v-if="src"
    ref="playFrame"
    :src="src"
    sandbox="allow-same-origin allow-scripts"
    class="h-full w-full border-0"
    title="Game — Parchment interpreter"
  />
</template>
