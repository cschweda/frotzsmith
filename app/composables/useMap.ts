// app/composables/useMap.ts
import {
  emptyGraph, addStep, layout as computeLayout, parseDirection, connectedDirs, parseObjects, parseExits,
  type Dir, type MapGraph,
} from './map-graph'
import { registerSessionOnce } from './session-once'

/** Per-room records are keyed by the game's room names, which can be anything
 *  — `constructor`, `toString`, `__proto__`. Keep them prototype-free and read
 *  own entries only (same approach as the test-script buckets, audit F7). */
type Rooms<T> = Record<string, T>

function emptyRooms<T>(): Rooms<T> {
  return Object.create(null) as Rooms<T>
}

/** The entry for `room` — an own entry only, never an inherited member. Read
 *  through the descriptor: Vue's reactive proxy answers `hasOwnProperty` itself. */
export function roomOf<T>(rooms: Rooms<T>, room: string): T | undefined {
  return Object.getOwnPropertyDescriptor(rooms, room)?.value as T | undefined
}

/** A new prototype-free record: `rooms` with `room` set to `value`. */
function withRoom<T>(rooms: Rooms<T>, room: string, value: T): Rooms<T> {
  const out = emptyRooms<T>()
  for (const k of Object.keys(rooms)) out[k] = roomOf(rooms, k)!
  out[room] = value // on a null-prototype object even `__proto__` is an own key
  return out
}

export function useMap() {
  // Read the active story key directly (do NOT call useIde() — avoid re-entrancy).
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')
  const graph = useState<MapGraph>('frotz:map-graph', emptyGraph)
  const currentRoom = useState<string | null>('frotz:map-current', () => null)
  const roomText = useState<Rooms<string>>('frotz:map-roomtext', emptyRooms)
  /** Sticky per-room union of every object ever seen there — survives take/drop,
   *  so the map can show what WAS in a room even after it's gone (dev view). */
  const roomObjects = useState<Rooms<string[]>>('frotz:map-objects', emptyRooms)
  /** Directions each room advertises via its "Obvious exits: …" line (Exits.h),
   *  so the map can show exits you haven't walked yet. */
  const roomExits = useState<Rooms<Dir[]>>('frotz:map-exits', emptyRooms)
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
    roomText.value = emptyRooms()
    roomObjects.value = emptyRooms()
    roomExits.value = emptyRooms()
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
      roomText.value = withRoom(roomText.value, name, text)
      // Fold this entry's visible objects into the room's sticky union so items
      // stay on record even after they've been taken away.
      const seen = parseObjects(text)
      if (seen.length) {
        const prev = roomOf(roomObjects.value, name) ?? []
        const added = seen.filter(o => !prev.includes(o))
        if (added.length) roomObjects.value = withRoom(roomObjects.value, name, [...prev, ...added])
      }
      // Record the room's advertised exits (Exits.h "Obvious exits: …"), so the
      // map can show ways out you haven't walked yet.
      const exits = parseExits(text)
      if (exits.length) roomExits.value = withRoom(roomExits.value, name, exits)
    }
    graph.value = addStep(graph.value, prevRoom.value, lastDir.value, name)
    currentRoom.value = name
    lastDir.value = null // a later redraw without a fresh command must not draw an edge
  }

  function details(room: string) {
    const t = roomOf(roomText.value, room) ?? ''
    const lines = t.split('\n').map(l => l.trim())
    const description = lines.find(l => Boolean(l) && !l.startsWith('>') && l !== room) ?? ''
    // `exits` = every way out the room advertises (connected or not);
    // `connectedExits` = the subset already drawn as connectors (out-edge or the
    // reverse of an in-edge). `objects` = best-effort current contents;
    // `seenObjects` = the sticky union ever seen here (dev view).
    const connected = connectedDirs(graph.value, room)
    const advertised = roomOf(roomExits.value, room) ?? []
    const exits = advertised.length ? [...advertised, ...connected.filter(d => !advertised.includes(d))] : connected
    return {
      exits,
      connectedExits: connected,
      objects: parseObjects(t),
      seenObjects: roomOf(roomObjects.value, room) ?? [],
      description,
    }
  }

  const layout = computed(() => computeLayout(graph.value))

  // Reset when the active story changes. Once per app — useMap() is also
  // called from runCompile (non-setup) and from several components; a
  // per-call watch would leak/duplicate. Shared useState means the first
  // closure's reset() still clears the shared state.
  registerSessionOnce('map', () => watch(activeStoryKey, reset))

  return {
    graph, currentRoom, roomText, roomObjects, roomExits, layout, mapMode,
    recordCommand, recordRoom, details, reset, toggleMapMode, noRoomName, markNoRoom,
  }
}
