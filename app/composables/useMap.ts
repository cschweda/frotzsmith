// app/composables/useMap.ts
import {
  emptyGraph, addStep, layout as computeLayout, parseDirection, exitsOf, parseObjects,
  type Dir, type MapGraph,
} from './map-graph'

// Register the cross-game reset watcher exactly once (see the note in useMap).
let mapWatchRegistered = false

export function useMap() {
  // Read the active story key directly (do NOT call useIde() — avoid re-entrancy).
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')
  const graph = useState<MapGraph>('frotz:map-graph', emptyGraph)
  const currentRoom = useState<string | null>('frotz:map-current', () => null)
  const roomText = useState<Record<string, string>>('frotz:map-roomtext', () => ({}))
  /** Sticky per-room union of every object ever seen there — survives take/drop,
   *  so the map can show what WAS in a room even after it's gone (dev view). */
  const roomObjects = useState<Record<string, string[]>>('frotz:map-objects', () => ({}))
  const lastDir = useState<Dir | null>('frotz:map-lastdir', () => null)
  const prevRoom = useState<string | null>('frotz:map-prevroom', () => null)
  /** True when the play frame confirmed the status line carries no room name. */
  const noRoomName = useState<boolean>('frotz:map-no-room', () => false)
  /** Map view mode: 'player' shows a clean map; 'dev' paints every room's full
   *  object history on its box. A view preference — NOT cleared on reset(). */
  const mapMode = useState<'player' | 'dev'>('frotz:map-mode', () => 'player')

  function reset() {
    graph.value = emptyGraph()
    currentRoom.value = null
    roomText.value = {}
    roomObjects.value = {}
    lastDir.value = null
    prevRoom.value = null
    noRoomName.value = false
  }

  function toggleMapMode() {
    mapMode.value = mapMode.value === 'dev' ? 'player' : 'dev'
  }

  function markNoRoom() {
    noRoomName.value = true
  }

  function recordCommand(cmd: string) {
    lastDir.value = parseDirection(cmd)
    prevRoom.value = currentRoom.value
  }

  function recordRoom(name: string, text: string) {
    if (!name) return
    noRoomName.value = false
    const entered = name !== currentRoom.value
    if (text && entered) {
      roomText.value = { ...roomText.value, [name]: text }
      // Fold this entry's visible objects into the room's sticky union so items
      // stay on record even after they've been taken away.
      const seen = parseObjects(text)
      if (seen.length) {
        const prev = roomObjects.value[name] ?? []
        const added = seen.filter(o => !prev.includes(o))
        if (added.length) roomObjects.value = { ...roomObjects.value, [name]: [...prev, ...added] }
      }
    }
    graph.value = addStep(graph.value, prevRoom.value, lastDir.value, name)
    currentRoom.value = name
    lastDir.value = null // a later redraw without a fresh command must not draw an edge
  }

  function details(room: string) {
    const t = roomText.value[room] ?? ''
    const lines = t.split('\n').map(l => l.trim())
    const description = lines.find(l => Boolean(l) && !l.startsWith('>') && l !== room) ?? ''
    // `objects` = best-effort current contents (from the latest description);
    // `seenObjects` = the sticky union of everything ever seen here (dev view).
    return {
      exits: exitsOf(graph.value, room),
      objects: parseObjects(t),
      seenObjects: roomObjects.value[room] ?? [],
      description,
    }
  }

  const layout = computed(() => computeLayout(graph.value))

  // Reset when the active story changes (matches usePlayTranscript scoping).
  // Register ONCE — useMap() is also called from runCompile (non-setup) and from
  // several components; a per-call watch would leak/duplicate. Mirror whatever
  // approach usePlayTranscript uses; a module-level flag is the simplest. Shared
  // useState means the first closure's reset() still clears the shared state.
  if (import.meta.client && !mapWatchRegistered) {
    mapWatchRegistered = true
    watch(activeStoryKey, reset)
  }

  return {
    graph, currentRoom, roomText, roomObjects, layout, mapMode,
    recordCommand, recordRoom, details, reset, toggleMapMode, noRoomName, markNoRoom,
  }
}
