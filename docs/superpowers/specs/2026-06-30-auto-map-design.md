# Frotzsmith — Auto-Map (live, Trizbort-style grid)

**Date:** 2026-06-30
**Status:** Design approved; implementation pending plan
**Builds on:** the play-command capture ([`2026-06-30-play-transcript-design.md`](./2026-06-30-play-transcript-design.md)), the per-game scoping + compile clean-slate, PlayPanel's Parchment iframe, ADR-008/010/011.

## 1. Context & problem

The right-pane **Map** tab has been a disabled "Auto-map — coming soon" stub since v1 (`RightPaneTabs.vue`). The goal: as the author plays interactively, draw a live map of the rooms they've discovered and the connections between them — a Trizbort-style grid.

We can't read the Z-machine's internal room model (it isn't exposed), so the map is **inferred** from text output the same way Trizbort / the Inform 7 IDE do: track the **current room** (the status line) and watch **movement commands**; a direction command that changes the room becomes an edge. The IDE already captures the player's commands (the Transcript feature) and the live iframe has a GlkOte **GridWindow** (status line), so this is an extension of existing work, not a from-scratch build.

## 2. Decisions (locked)

- **D1 — Live source.** The map builds in real time from interactive Play: captured commands + the room name read from the iframe's status line each turn. (Headless "map-a-script" is a future add; the builder is shared.)
- **D2 — Trizbort-style grid.** Rooms placed on a grid by direction deltas; `u/d/in/out` as labeled stubs; non-Euclidean edges drawn as free connectors.
- **D3 — Per-game + clean slate.** The map is scoped by `storyKey` and reset on a new game / compile, exactly like the play transcript (session state, not persisted).

## 3. Architecture

### 3.1 Live data — `public/play/index.html`

The capture script already posts `{ source:'frotzsmith-play', type:'command', value }`. Add a `MutationObserver` on the GlkOte **`.GridWindow`** (the status line). On each change, read its text, parse the **room name**, and post `{ source:'frotzsmith-play', type:'room', name }` to the parent. The observer also fires on the initial render → the **start room** is reported before any command. Skip capture (room + command) while `window.__frotzScriptRunning` is set (consistent with Send-to-Play suppression).

Room-name parse (heuristic, default status lines): take the grid's first line, split on runs of 2+ spaces, take the first chunk trimmed — the left-aligned room name, before the right-aligned `Score:`/`Moves:`/`n/m`. Empty/whitespace → `''` (treated as "no room", ignored).

### 3.2 Graph + layout — `app/composables/map-graph.ts` (pure, TDD'd)

```ts
export type Dir = 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'|'u'|'d'|'in'|'out'
export interface Edge { from: string; to: string; dir: Dir }
export interface MapGraph { rooms: string[]; edges: Edge[]; start: string | null }

export function emptyGraph(): MapGraph
/** Parse a command to a movement direction, else null. n/north/'go north'/ne/up/in/… */
export function parseDirection(command: string): Dir | null
/** Room name from a status-line string (leftmost text before score/moves). */
export function parseRoomName(statusLine: string): string
/** Record a turn: always ensures `newRoom` exists; adds an edge prev→new when
 *  `dir` is set and the room actually changed (failed moves add nothing). */
export function addStep(g: MapGraph, prevRoom: string | null, dir: Dir | null, newRoom: string): MapGraph

export interface PlacedRoom { name: string; col: number; row: number }
export interface Connector { from: string; to: string; dir: Dir; grid: boolean }
export interface MapLayout {
  rooms: PlacedRoom[]
  connectors: Connector[]
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }
}
/** Trizbort grid placement (deterministic). */
export function layout(g: MapGraph): MapLayout
```

**`layout` algorithm:** place `start` at `(0,0)`; walk edges breadth-first. For an edge `from→to (dir)` where `to` is unplaced, target = `from.pos + delta(dir)` with `delta`: `n=(0,-1) s=(0,1) e=(1,0) w=(-1,0) ne=(1,-1) nw=(-1,-1) se=(1,1) sw=(-1,1)`, and `u/d/in/out = (0,0)`. Cases:
- Cell free → place `to` there; connector `grid:true`.
- `delta=(0,0)` (`u/d/in/out`) → don't grid-place via this edge; connector `grid:false` (a stub). If `to` is reachable only by such edges, place it at the nearest free cell to `from` (spiral search).
- Cell taken by a different room (non-Euclidean) → place `to` at the nearest free cell; connector `grid:false` (free line).
Determinism: process rooms/edges in insertion order. `bounds` spans all placed rooms (for the SVG viewport).

### 3.3 Store — `app/composables/useMap.ts`

`useState`-backed, scoped by `useIde().activeStoryKey` (reset on game change, like `usePlayTranscript`). Holds `graph`, `currentRoom`, and the `lastCommand`'s parsed `dir`. Surface: `{ graph, currentRoom, layout (computed), recordCommand(cmd), recordRoom(name), reset() }`.
- `recordCommand(cmd)` stores `lastDir = parseDirection(cmd)` and remembers the room *before* the move (`prevRoom = currentRoom`).
- `recordRoom(name)` (on a `room` message): `graph = addStep(graph, prevRoom, lastDir, name)`; `currentRoom = name`; clear `lastDir` (so a stray room update without a fresh command doesn't draw a phantom edge).
Not persisted; `reset()` on `activeStoryKey` change and on compile (wire into the existing compile clean-slate in `useIde.runCompile`).

### 3.4 UI — `app/components/ide/MapPanel.vue` + `PlayPanel.vue` + `RightPaneTabs.vue`

- **`PlayPanel.vue`** `onMessage`: on `type:'command'` → also `useMap().recordCommand(value)`; on `type:'room'` → `useMap().recordRoom(name)`. (Keeps the existing transcript `record`.)
- **`MapPanel.vue`** renders `layout` as **SVG**: each `PlacedRoom` a rounded `<rect>` + name at `(col*CELL_W, row*CELL_H)`; the **current room** gets an amber border; grid `Connector`s are straight lines between adjacent boxes; `u/d/in/out` stubs are small labelled marks on the room; non-grid connectors are free lines. Drag-to-pan + wheel-zoom (an SVG `viewBox` transform), with a "fit" reset. Empty state: "Play to map the world." A note when the current status line yields no room name ("This game's status line has no room name — can't auto-map").
- **`RightPaneTabs.vue`** — replace the disabled Map tooltip/stub with an enabled `{ id:'map', … }` tab + `<MapPanel v-else-if="activeTab==='map'" />`; add `'map'` to `RightTab`.

## 4. Data flow

Play boots → GridWindow renders → `room`(start) → `useMap` sets start. Player types `north` + Enter → `command`(north) [`recordCommand`: prev=Cottage, dir=n] → VM runs → grid updates → `room`(Meadow) [`recordRoom`: addStep adds Meadow + edge Cottage→Meadow (n)] → `layout` recomputes → Map tab redraws. New game / compile → `reset()`.

## 5. Error handling / limitations

- **Room identity = status-line name** — same-named rooms merge; a room whose status line changes splits. Inherent to text auto-mapping (Trizbort/I7 share it).
- **Custom/absent status line** — no room name → the Map shows the can't-map note; nothing is drawn.
- **`u/d/in/out`** — drawn as stubs, not grid-placed.
- **Non-Euclidean geometry** — edges that don't fit the grid draw as free connectors.
- **Failed moves / parser errors** — room unchanged → no edge (correct).
- Untrusted iframe messages still gated by origin + `e.source` + the `frotzsmith-play` tag (unchanged); the room name is inert text rendered via SVG `<text>` (escaped), never HTML.

## 6. Testing (vitest, node)

- **`map-graph.ts`** — `parseDirection` (n/north/'go north'/ne/up/in/out/non-movement→null); `parseRoomName` (room before score/moves, empty); `addStep` (adds node, adds edge on change, no edge on failed move / non-movement, revisit confirms edge); **`layout`** (linear chain places by deltas; a square loop returns to grid; a conflict places at a free cell with `grid:false`; `u/d` → stub; deterministic output for a fixed input). Pure, exhaustive.
- `useMap` / `MapPanel` / the iframe observer = composable-state + live browser checks (matches the repo convention).

## 7. Accessibility

The Map is a labelled `role="img"`/`region` with an `aria-label` summarising the room count; an off-screen text list of rooms + connections backs the visual (screen-reader fallback); pan/zoom controls are keyboard-operable buttons (zoom in/out/fit) in addition to drag/wheel. axe-core clean (repo baseline).

## 8. Out of scope (v1)

**Mapping script runs** — both headless replay and live Send-to-Play runs are suppressed in v1 (the `__frotzScriptRunning` flag gates the room/command posts), so **only manual play maps**; a shared future add. Also out of scope: manual room drag/rename; persisting the map; export (PNG/Trizbort file); door/object annotations; multi-level (z-axis) layout for `u/d`. v1 is the live, auto-laid-out grid from hand-play.

## 9. Risks

- **Status-line parsing** across libraries — verify the heuristic against several samples (Standard Library + PunyInform default status lines) live; some samples use custom status lines (degrade to the note).
- **GridWindow timing** — the MutationObserver must read the room *after* the VM updates the grid; confirm the observer fires post-turn (it watches the actual grid DOM, so it does). Validate live.
- **Layout conflicts** — the nearest-free-cell fallback must stay deterministic and terminate (bounded spiral); covered by a layout unit test.

## 10. Done =

Play a Standard Library game; as you move (`n`, `e`, `enter booth`…), the **Map** tab draws rooms in a Trizbort grid with the current room highlighted and exits connecting them; failed moves add nothing; `up`/`down` show as stubs; recompiling / a new game clears the map; switching games shows that game's map. The graph builder + layout are unit-tested.
