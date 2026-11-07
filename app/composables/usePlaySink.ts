/**
 * Where live Play reports to, whichever player is running (frotzplay or
 * Parchment): the typed-command transcript, the auto-map and the Skein's play
 * cursor. One place, so the two players feed the IDE identically.
 */
export function usePlaySink() {
  const { record, reset } = usePlayTranscript()
  // Live play also feeds the Skein: commands walk/extend the tree from a cursor
  // that returns to the root when a fresh game boots. Outputs never come from
  // play — only headless reruns write them (normalized, deterministic).
  const { recordPlayCommand, resetPlayCursor } = useSkein()
  const { recordCommand, recordRoom, markNoRoom } = useMap()

  return {
    /** A command the player typed (never one Send-to-Play fed in). */
    command(text: string) {
      record(text)
      recordCommand(text)
      recordPlayCommand(text)
    },
    /** The room the status line names, and the text shown on entering it. */
    room(name: string, text: string) {
      recordRoom(name, text)
    },
    /** The game shows no status line, so it can't be mapped. */
    noRoom() {
      markNoRoom()
    },
    /** A fresh game booted: a new transcript, and the Skein cursor back at the root. */
    started() {
      reset()
      resetPlayCursor()
    },
  }
}
