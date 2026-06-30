import { appendCommand, toScriptText } from './play-transcript'

/**
 * The Play transcript: the read-only, in-memory log of commands the player typed
 * during the current interactive Play session. Captured from the Parchment iframe
 * (see PlayPanel.vue) and rendered read-only in the Transcript tab. Not persisted
 * — it mirrors the live game and is reset when a fresh game boots (session-start).
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

  return { commands, count, text, record, reset }
}
