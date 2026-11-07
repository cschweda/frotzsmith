<script setup lang="ts">
import type { PlayerChoice } from '~/composables/usePlayerChoice'

/**
 * The Play tab: the compiled game in frotzplay (the default) or Parchment
 * (frotzlens docs/16 §4), full screen on request, with the solution recorder's
 * bar above it. Each press of Play mounts the chosen player afresh (keyed on
 * playNonce); a new or cleared build tears it down. What the game reports goes
 * through usePlaySink, the same for both players.
 */
const { result, playNonce, canPlay } = useIde()
const { state: recState } = useSolutionRecorder()
const { player, setPlayer } = usePlayerChoice()

const container = shallowRef<HTMLElement | null>(null)
const isFullscreen = ref(false)
/** A game is running (Play was pressed for the current build). */
const playing = ref(false)

const PLAYERS: { id: PlayerChoice; label: string }[] = [
  { id: 'frotzplay', label: 'frotzplay' },
  { id: 'parchment', label: 'Parchment' },
]
const playerName = computed(() => PLAYERS.find(p => p.id === player.value)!.label)
const other = computed(() => PLAYERS.find(p => p.id !== player.value)!)

// Full-screen the play area (the whole game, not the IDE chrome).
function toggleFullscreen() {
  // Both return promises that reject when the browser refuses (permissions
  // policy, iOS Safari on non-video elements) — not worth an unhandled error.
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  else void container.value?.requestFullscreen?.()?.catch(() => {})
}
function onFsChange() {
  isFullscreen.value = document.fullscreenElement === container.value
}

watch(() => playNonce.value, () => {
  playing.value = !!result.value?.storyFile
})
// A new or cleared build invalidates the running game: tear the player down so a
// stale game never lingers after loading a new source or recompiling. Play is
// only re-enabled by a clean compile, and pressing it bumps playNonce.
watch(() => result.value, () => {
  playing.value = false
})
onMounted(() => {
  document.addEventListener('fullscreenchange', onFsChange)
  if (playNonce.value > 0) playing.value = !!result.value?.storyFile
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
})
</script>

<template>
  <div ref="container" class="bg-default flex h-full w-full flex-col">
    <!-- A solution being recorded: its light, Pause/Resume and Stop. -->
    <div v-if="recState !== 'stopped'" class="shrink-0 border-b border-default px-3 py-1.5">
      <SolutionRecorderBar compact />
    </div>
    <!-- While a game runs: which player, a switch to the other (it starts the game
         again there), and full screen. -->
    <div v-if="playing" class="flex shrink-0 items-center gap-2 border-b border-default px-3 py-1 text-xs">
      <span class="text-muted">Playing in <span class="text-default font-medium">{{ playerName }}</span></span>
      <UButton
        size="xs"
        color="neutral"
        variant="link"
        :label="`Switch to ${other.label}`"
        :title="`Start the game again in ${other.label}`"
        @click="setPlayer(other.id)"
      />
      <UButton
        class="ml-auto"
        color="neutral"
        variant="ghost"
        size="xs"
        :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
        :title="isFullscreen ? 'Exit full screen' : 'Play full screen'"
        :aria-label="isFullscreen ? 'Exit full screen' : 'Play full screen'"
        @click="toggleFullscreen"
      />
    </div>
    <div class="relative min-h-0 flex-1">
      <template v-if="playing">
        <FrotzplayPlayer v-if="player === 'frotzplay'" :key="`f${playNonce}`" />
        <ParchmentPlayer v-else :key="`p${playNonce}`" />
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
              ? `Your compiled game runs here in ${playerName}.`
              : 'A clean compile enables the Play button.'
          }}
        </p>
        <fieldset class="mt-2 flex flex-col items-center gap-2">
          <legend class="text-muted mb-2 text-sm">Play in</legend>
          <UFieldGroup>
            <UButton
              v-for="p in PLAYERS"
              :key="p.id"
              :label="p.label"
              size="sm"
              :color="player === p.id ? 'primary' : 'neutral'"
              :variant="player === p.id ? 'solid' : 'outline'"
              :aria-pressed="player === p.id"
              @click="setPlayer(p.id)"
            />
          </UFieldGroup>
        </fieldset>
        <p class="text-muted max-w-sm text-xs">
          frotzplay is the accessible player from the Frotz, Inc. family (screen readers,
          keyboard shortcuts, high contrast). Parchment is the player Frotzsmith shipped with.
        </p>
      </div>
    </div>
  </div>
</template>
