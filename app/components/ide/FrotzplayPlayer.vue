<script setup lang="ts">
import { ZPlayer, type TurnBlock } from '@frotzinc/player'
import '@frotzinc/player/player.css'
import { feedPlayer, roomFromStatus } from '~/composables/frotzplay-feed'
import { feedFailed, feedStopped } from '~/composables/play-feed-toasts'

/**
 * The compiled story in frotzplay's player (frotzlens docs/16): the same
 * Z-machine as the replay engine's oracle, with frotzplay's accessibility
 * contract (announcements, shortcuts, high contrast, OpenDyslexic). PlayPanel
 * mounts it fresh for each Play. No iframe and no DOM scraping: commands, the
 * status line and boot come from the player's own events, and Send-to-Play
 * types through its `send()`.
 */
const { result, storyTitle, pendingScript } = useIde()
const sink = usePlaySink()
const colorMode = useColorMode()

const story = result.value?.storyFile ? new Uint8Array(result.value.storyFile) : null
const player = useTemplateRef<InstanceType<typeof ZPlayer>>('player')

// The IDE's light/dark is the player's; high contrast, chosen in the player's
// Settings, stays the player's own until the IDE's mode changes.
const theme = computed({
  get: () => (colorMode.value === 'dark' ? 'dark' : 'light'),
  set: (t: string) => {
    if (t === 'dark' || t === 'light') colorMode.preference = t
  },
})

let noRoomSaid = false

// (`started` comes after the opening turn, and each Play mounts this afresh.)
function onStarted() {
  sink.started()
  const cmds = pendingScript.value
  if (cmds && cmds.length) {
    pendingScript.value = null
    void runPendingScript(cmds)
  }
}

/**
 * Each turn: the command the player typed (Send-to-Play's are left out, as with
 * Parchment), then the room the status line names and the turn's text for the
 * auto-map. A game with no status line says so once.
 */
function onTurn(block: TurnBlock) {
  if (block.fed) return
  const state = player.value?.state
  if (!state) return
  if (block.kind === 'line' && block.command?.trim()) sink.command(block.command.trim())
  const room = roomFromStatus(state)
  if (room) sink.room(room, block.text)
  else if (!noRoomSaid) {
    noRoomSaid = true
    sink.noRoom()
  }
}

async function runPendingScript(commands: string[]) {
  const p = player.value
  if (!p) return
  try {
    const outcome = await feedPlayer(p, commands)
    if (!outcome.completed) feedStopped(outcome.fed, outcome.total)
    // The map catches up with where the script left the player.
    const room = roomFromStatus(p.state)
    if (room) sink.room(room, '')
  } catch (err) {
    feedFailed(err)
  }
}
</script>

<template>
  <ZPlayer
    v-if="story"
    ref="player"
    v-model:theme="theme"
    class="h-full"
    :story="story"
    :title="storyTitle || 'story'"
    :autosave="false"
    font-base="/frotzplay-fonts/"
    @started="onStarted"
    @turn="onTurn"
  />
</template>
