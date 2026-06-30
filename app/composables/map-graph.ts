export type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'u' | 'd' | 'in' | 'out'
export interface Edge { from: string; to: string; dir: Dir }
export interface MapGraph { rooms: string[]; edges: Edge[]; start: string | null }

export function emptyGraph(): MapGraph {
  return { rooms: [], edges: [], start: null }
}

const DIRS: Record<string, Dir> = {
  n: 'n', north: 'n', s: 's', south: 's', e: 'e', east: 'e', w: 'w', west: 'w',
  ne: 'ne', northeast: 'ne', nw: 'nw', northwest: 'nw',
  se: 'se', southeast: 'se', sw: 'sw', southwest: 'sw',
  u: 'u', up: 'u', d: 'd', down: 'd',
  in: 'in', inside: 'in', enter: 'in', out: 'out', outside: 'out', exit: 'out',
}

/** Parse a command to a movement direction, else null. n/north/'go north'/ne/up/in/out. */
export function parseDirection(command: string): Dir | null {
  const c = command.trim().toLowerCase().replace(/^(go|walk|run|head)\s+/, '')
  return DIRS[c] ?? null
}

/** Room name from a status-line string: the left text before the score/moves gap. */
export function parseRoomName(statusLine: string): string {
  const firstLine = statusLine.split('\n')[0] ?? ''
  return firstLine.split(/\s{2,}/)[0]!.trim()
}

/** Record a turn: always ensures `newRoom` exists; adds an edge prev→new when
 *  `dir` is set and the room actually changed (failed moves add nothing). */
export function addStep(g: MapGraph, prevRoom: string | null, dir: Dir | null, newRoom: string): MapGraph {
  if (!newRoom) return g
  const rooms = g.rooms.includes(newRoom) ? g.rooms : [...g.rooms, newRoom]
  const start = g.start ?? newRoom
  let edges = g.edges
  if (dir && prevRoom && prevRoom !== newRoom) {
    const exists = edges.some(e => e.from === prevRoom && e.to === newRoom && e.dir === dir)
    if (!exists) edges = [...edges, { from: prevRoom, to: newRoom, dir }]
  }
  return { rooms, edges, start }
}
