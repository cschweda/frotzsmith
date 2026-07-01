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

export interface PlacedRoom { name: string; col: number; row: number }
export interface Connector { from: string; to: string; dir: Dir; grid: boolean }
export interface MapLayout {
  rooms: PlacedRoom[]
  connectors: Connector[]
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }
}

const DELTA: Record<Dir, [number, number]> = {
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
  ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1],
  u: [0, 0], d: [0, 0], in: [0, 0], out: [0, 0],
}

/** Trizbort grid placement (deterministic; insertion order; bounded spiral fallback). */
export function layout(g: MapGraph): MapLayout {
  const pos = new Map<string, [number, number]>()
  const occupied = new Set<string>()
  const key = (c: number, r: number) => `${c},${r}`
  const place = (room: string, c: number, r: number) => { pos.set(room, [c, r]); occupied.add(key(c, r)) }
  const nearestFree = (c: number, r: number): [number, number] => {
    for (let ring = 0; ring < 64; ring++)
      for (let dc = -ring; dc <= ring; dc++)
        for (let dr = -ring; dr <= ring; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue
          if (!occupied.has(key(c + dc, r + dr))) return [c + dc, r + dr]
        }
    return [c, r]
  }

  // Repeated passes place each edge's target next to its already-placed source,
  // by the edge's compass delta. Runs until no further edge can be placed.
  const relax = () => {
    let changed = true
    while (changed) {
      changed = false
      for (const e of g.edges) {
        const from = pos.get(e.from)
        if (!from || pos.has(e.to)) continue
        const [dc, dr] = DELTA[e.dir]
        if (dc === 0 && dr === 0) {
          const [c, r] = nearestFree(from[0], from[1]); place(e.to, c, r)
        } else if (!occupied.has(key(from[0] + dc, from[1] + dr))) {
          place(e.to, from[0] + dc, from[1] + dr)
        } else {
          const [c, r] = nearestFree(from[0] + dc, from[1] + dr); place(e.to, c, r)
        }
        changed = true
      }
    }
  }

  if (g.start) place(g.start, 0, 0)
  relax()
  // Rooms unreachable from `start` via edges (e.g. entered by a magic word or an
  // unparsed move, so the entering step created no edge) seed a NEW component
  // root at a free cell — then relax again so that component's own rooms are
  // positioned by their true compass edges, not dumped one-by-one by the spiral.
  for (const room of g.rooms) {
    if (pos.has(room)) continue
    const [c, r] = nearestFree(0, 0); place(room, c, r)
    relax()
  }

  const connectors: Connector[] = g.edges.map(e => {
    const a = pos.get(e.from)!, b = pos.get(e.to)!
    const [dc, dr] = DELTA[e.dir]
    const grid = (dc !== 0 || dr !== 0) && b[0] === a[0] + dc && b[1] === a[1] + dr
    return { from: e.from, to: e.to, dir: e.dir, grid }
  })

  const placed = [...pos.values()]
  const cols = placed.map(p => p[0]); const rows = placed.map(p => p[1])
  const bounds = placed.length
    ? { minCol: Math.min(...cols), maxCol: Math.max(...cols), minRow: Math.min(...rows), maxRow: Math.max(...rows) }
    : { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 }

  const rooms: PlacedRoom[] = g.rooms.map(name => ({ name, col: pos.get(name)![0], row: pos.get(name)![1] }))
  return { rooms, connectors, bounds }
}

const DIR_ORDER: Dir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'u', 'd', 'in', 'out']

/** Directions of edges leading out of `room`, in canonical compass order. */
export function exitsOf(g: MapGraph, room: string): Dir[] {
  const dirs = new Set<Dir>()
  for (const e of g.edges) if (e.from === room) dirs.add(e.dir)
  return DIR_ORDER.filter(d => dirs.has(d))
}

function splitObjects(s: string): string[] {
  return s
    .split(/\s*,\s*|\s+and\s+/i)
    .map(x => x.replace(/^\s*(?:a|an|the|some)\s+/i, '').trim())
    .filter(Boolean)
}

/** Reject fragments the fuzzy patterns pick up that clearly aren't objects:
 *  over-long noun stacks and phrases carrying pronouns/narrative words. */
function plausibleObject(name: string): boolean {
  const n = name.trim()
  if (!n || n.split(/\s+/).length > 5) return false
  return !/\b(?:you|your|yourself|it|its|itself|they|them|there|here|which|that|who|whose|when|where|nothing|something|anything|everything)\b/i.test(n)
}

// Verbs that typically sit next to an object noun in a room description
// ("a lamp SITS on the table", "a knife IS levitating"). SUBJECT_VERB (article
// first) can safely use the weak is/are too because the leading article anchors
// it; VERB_SUBJECT keeps only strong placement verbs so it doesn't fire on
// narrative "it is a dark night" clauses.
const PLACE_VERBS = 'is|are|was|were|lies|lie|lay|hangs?|sits?|rests?|stands?|floats?|levitates?|leans?|dangles?|glows?|gleams?|glimmers?|sparkles?|glitters?'
const STRONG_VERBS = 'lies|lie|lay|hangs?|sits?|rests?|stands?|floats?|levitates?|leans?|dangles?|glows?|gleams?|glimmers?|sparkles?|glitters?'
const SUBJECT_VERB = new RegExp(`(?:^|[.!?"']\\s*)(?:a|an|some) (.+?) (?:${PLACE_VERBS})\\b`, 'i')
const VERB_SUBJECT = new RegExp(`\\b(?:${STRONG_VERBS}) (?:a|an|some) (.+?)(?:\\s+(?:on|in|at|by|near|against|from|above|below|beside|behind|beneath|atop|inside|around)\\b|[.!?"']|$)`, 'i')

/** Best-effort object names from a room's captured text. High-precision listing
 *  phrasings first, then a fuzzy pass over describe-style prose so custom object
 *  descriptions ("A knife is levitating…") surface too. Tuned for the dev map, so
 *  it favors recall — an occasional scenery/narrative noun may slip through. */
export function parseObjects(roomText: string): string[] {
  const out: string[] = []
  const add = (raw: string | undefined) => {
    if (raw) for (const o of splitObjects(raw)) if (plausibleObject(o)) out.push(o)
  }
  for (const line of roomText.split('\n')) {
    // "You can (also) see a lamp here." — Standard/PunyInform default listing.
    add(/you can (?:also )?see (.+?) here\b/i.exec(line)?.[1])
    // "There is a lamp here." — the other default listing.
    add(/there (?:is|are) (.+?) here\b/i.exec(line)?.[1])
    // "There is a scroll on the ground." — placement phrasing.
    add(/there (?:is|are) (.+?) (?:on|in|under|beneath|atop|beside|behind|near|inside) the\b/i.exec(line)?.[1])
    // Fuzzy: "A knife is levitating…", "A rug lies on the floor."
    add(SUBJECT_VERB.exec(line)?.[1])
    // Fuzzy: "…on the floor sits a rusty sword."
    add(VERB_SUBJECT.exec(line)?.[1])
  }
  return [...new Set(out)]
}
