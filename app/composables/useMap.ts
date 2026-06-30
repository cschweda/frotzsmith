// app/composables/useMap.ts
import {
  emptyGraph, addStep, layout as computeLayout, parseDirection, exitsOf, parseObjects,
  type Dir, type MapGraph,
} from './map-graph'

function firstLine(t: string): string {
  return t.split('\n').map(l => l.trim()).find(Boolean) ?? ''
}

// Register the cross-game reset watcher exactly once (see the note in useMap).
let mapWatchRegistered = false

export function useMap() {
  // Read the active story key directly (do NOT call useIde() — avoid re-entrancy).
  const activeStoryKey = useState<string>('frotz:story-key', () => '')
  const graph = useState<MapGraph>('frotz:map-graph', emptyGraph)
  const currentRoom = useState<string | null>('frotz:map-current', () => null)
  const roomText = useState<Record<string, string>>('frotz:map-roomtext', () => ({}))
  const lastDir = useState<Dir | null>('frotz:map-lastdir', () => null)
  const prevRoom = useState<string | null>('frotz:map-prevroom', () => null)

  function reset() {
    graph.value = emptyGraph()
    currentRoom.value = null
    roomText.value = {}
    lastDir.value = null
    prevRoom.value = null
  }

  function recordCommand(cmd: string) {
    lastDir.value = parseDirection(cmd)
    prevRoom.value = currentRoom.value
  }

  function recordRoom(name: string, text: string) {
    if (!name) return
    if (text) roomText.value = { ...roomText.value, [name]: text }
    graph.value = addStep(graph.value, prevRoom.value, lastDir.value, name)
    currentRoom.value = name
    lastDir.value = null // a later redraw without a fresh command must not draw an edge
  }

  function details(room: string) {
    const t = roomText.value[room] ?? ''
    return { exits: exitsOf(graph.value, room), objects: parseObjects(t), description: firstLine(t) }
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

  return { graph, currentRoom, roomText, layout, recordCommand, recordRoom, details, reset }
}
