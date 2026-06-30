import { appendCommand, toScriptText } from './play-transcript'

// Register the cross-game reset watcher exactly once (mirrors useMap / useTestScripts).
let playTranscriptWatchRegistered = false

/**
 * The Play transcript: the read-only, in-memory log of commands the player typed
 * during the current interactive Play session. Captured from the Parchment iframe
 * (see PlayPanel.vue) and rendered read-only in the Transcript tab. Not persisted
 * — it mirrors the live game and is reset when a fresh game boots (session-start)
 * or when a different game is loaded.
 */
export function usePlayTranscript() {
  const commands = useState<string[]>('frotz:play-commands', () => [])
  const count = computed(() => commands.value.length)
  const text = computed(() => toScriptText(commands.value))

  function record(cmd: string) {
    commands.value = appendCommand(commands.value, cmd)
  }
  function reset() {
    commands.value = []
  }

  // Clear the transcript whenever the active game changes so a freshly-loaded
  // game doesn't show the prior game's captured commands.
  // useIde() is safe here: usePlayTranscript is not called during useIde's
  // initialization (only inside runCompile), so there is no circular call chain.
  if (import.meta.client && !playTranscriptWatchRegistered) {
    playTranscriptWatchRegistered = true
    const { activeStoryKey } = useIde()
    watch(activeStoryKey, () => {
      commands.value = []
    })
  }

  return { commands, count, text, record, reset }
}
