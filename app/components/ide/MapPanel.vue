<script setup lang="ts">
import type { Dir } from '~/composables/map-graph'
const { layout, currentRoom, details, graph, noRoomName, roomObjects, mapMode, toggleMapMode } = useMap()

const CELL = 120, ROOM_W = 96, ROOM_H = 48, PAD = 60
/** Clamp limits for the viewBox width (SVG user-space units). */
const MIN_W = CELL       // most zoomed-in: one cell wide
const MAX_W = CELL * 60  // most zoomed-out: 60 cells wide

const hasRooms = computed(() => layout.value.rooms.length > 0)
/** True once the play frame confirms the status line has no room name and no rooms have been recorded. */
const noMap = computed(() => noRoomName.value && layout.value.rooms.length === 0)

// ─── Reactive viewBox state ────────────────────────────────────────────────
/**
 * `view` is the SVG viewBox expressed in user-space coordinates:
 *   top-left = (view.x, view.y), dimensions = (view.w × view.h)
 * The SVG attribute string is derived from this via `viewBox`.
 *
 * `auto` starts true and resets to false the moment the user zooms or pans.
 * While `auto` is true the map re-fits whenever the layout changes, so
 * newly discovered rooms are always visible. Fit button sets it back to true.
 */
const view = ref({ x: 0, y: 0, w: MAX_W, h: MAX_W * 0.75 })
const auto = ref(true)
/** The viewBox width captured at the last fitView() call — the "100% zoom" baseline. */
const baseW = ref(MAX_W)

const viewBox = computed(
  () => `${view.value.x} ${view.value.y} ${view.value.w} ${view.value.h}`,
)
/**
 * Zoom percentage: 100% = fully fitted, >100% = zoomed in (viewport narrower
 * than the fit width), <100% = zoomed out (more map visible than fit).
 */
const zoomPct = computed(() => Math.round((baseW.value / view.value.w) * 100))

/** Set the viewBox to show all rooms with padding (the "fit" state). */
function fitView() {
  const b = layout.value.bounds
  const x = b.minCol * CELL - ROOM_W / 2 - PAD
  const y = b.minRow * CELL - ROOM_H / 2 - PAD
  const w = (b.maxCol - b.minCol) * CELL + ROOM_W + PAD * 2
  const h = (b.maxRow - b.minRow) * CELL + ROOM_H + PAD * 2
  view.value = { x, y, w, h }
  baseW.value = w
}

/** Reset to fit mode and re-fit immediately (Fit button). */
function onFit() {
  auto.value = true
  fitView()
}

// ─── Zoom ──────────────────────────────────────────────────────────────────
/**
 * Scale the viewport by `factor` about the SVG-coordinate pivot (cx, cy).
 * factor < 1  →  zoom in  (viewport shrinks, content appears larger)
 * factor > 1  →  zoom out (viewport grows,   content appears smaller)
 *
 * The pivot stays at the same fractional position after the scale:
 *   frac = (pivotX - v.x) / v.w
 *   newX = pivotX - frac * newW
 *        = pivotX - (pivotX - v.x) * (newW / v.w)
 *        = pivotX - (pivotX - v.x) * scale
 *
 * Width is clamped to [MIN_W, MAX_W]; height is scaled by the same effective
 * factor so the aspect ratio is preserved.
 */
function zoomBy(factor: number, cx?: number, cy?: number) {
  auto.value = false
  const v = view.value
  const pivotX = cx ?? (v.x + v.w / 2)
  const pivotY = cy ?? (v.y + v.h / 2)

  const newW = Math.min(MAX_W, Math.max(MIN_W, v.w * factor))
  const scale = newW / v.w  // effective scale after clamping
  const newH = v.h * scale

  view.value = {
    x: pivotX - (pivotX - v.x) * scale,
    y: pivotY - (pivotY - v.y) * scale,
    w: newW,
    h: newH,
  }
}

// ─── SVG element ref & coordinate conversion ───────────────────────────────
const svgEl = ref<SVGSVGElement | null>(null)
const dragging = ref(false)

/**
 * Convert a browser client-space point to SVG user-space coordinates.
 *
 * The viewBox maps [view.x, view.x+view.w] to [0, rect.width] in pixels,
 * so the inverse is:
 *   svgX = view.x + (clientX - rect.left) / rect.width  * view.w
 *   svgY = view.y + (clientY - rect.top)  / rect.height * view.h
 *
 * Classic bug: using view.w/h directly as scale instead of dividing by
 * rect.width/height first — that would give wrong units.
 */
function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
  const el = svgEl.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const v = view.value
  return {
    x: v.x + ((clientX - rect.left) / rect.width) * v.w,
    y: v.y + ((clientY - rect.top) / rect.height) * v.h,
  }
}

// ─── Wheel zoom ────────────────────────────────────────────────────────────
function onWheel(e: WheelEvent) {
  // @wheel.prevent on the SVG calls e.preventDefault() before this handler,
  // so the page does not scroll. We just need to zoom toward the cursor.
  const { x, y } = clientToSvg(e.clientX, e.clientY)
  zoomBy(e.deltaY < 0 ? 0.9 : 1.1, x, y)
}

// ─── Drag pan ─────────────────────────────────────────────────────────────
let lastPx = 0
let lastPy = 0

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return  // left-click only
  dragging.value = true
  lastPx = e.clientX
  lastPy = e.clientY
  // Capture so pointermove/pointerup still fire if the cursor leaves the SVG.
  svgEl.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const el = svgEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const v = view.value

  // Convert the client-pixel delta to SVG-unit delta, then subtract:
  // dragging right (+dx pixels) should reveal content to the left, so
  // view.x decreases — the natural "grab and pull" direction.
  const svgDx = ((e.clientX - lastPx) / rect.width) * v.w
  const svgDy = ((e.clientY - lastPy) / rect.height) * v.h

  view.value = { ...v, x: v.x - svgDx, y: v.y - svgDy }
  auto.value = false
  lastPx = e.clientX
  lastPy = e.clientY
}

function onPointerUp() {
  dragging.value = false
}

// ─── Keep current room on-screen (when in manual zoom/pan mode) ────────────
watch(currentRoom, (name) => {
  // While auto=true, the layout watcher calls fitView() which already shows
  // all rooms. Only pan manually when the user has taken over the viewport.
  if (auto.value || !name) return
  const r = layout.value.rooms.find(x => x.name === name)
  if (!r) return
  const cx = r.col * CELL
  const cy = r.row * CELL
  const v = view.value
  const margin = CELL  // one-cell breathing room
  let { x, y, w, h } = v

  // Shift the viewport just enough so the room centre is inside with `margin`.
  // Left overflow:  room is too far left  → decrease x so room lands at margin from left
  // Right overflow: room is too far right → increase x so room lands at margin from right
  if (cx < x + margin)           x = cx - margin
  else if (cx > x + w - margin)  x = cx - w + margin
  if (cy < y + margin)           y = cy - margin
  else if (cy > y + h - margin)  y = cy - h + margin

  if (x !== v.x || y !== v.y) view.value = { x, y, w, h }
})

// ─── Auto-fit while no user interaction ────────────────────────────────────
// `layout` is a computed ref that returns a new object on each graph change,
// so a shallow watcher fires correctly whenever rooms are added/removed.
watch(layout, () => {
  if (auto.value && layout.value.rooms.length > 0) fitView()
})

// If rooms are already present when the component mounts (e.g. hot-reload).
onMounted(() => {
  if (layout.value.rooms.length > 0) fitView()
})

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Memoized name→pixel lookup built once per layout (not on every render frame).
 * Each connector/room reads from this Map rather than doing a linear .find.
 */
const posMap = computed<Map<string, { x: number; y: number }>>(() => {
  const m = new Map<string, { x: number; y: number }>()
  for (const r of layout.value.rooms) m.set(r.name, { x: r.col * CELL, y: r.row * CELL })
  return m
})
const pos = (name: string): { x: number; y: number } => posMap.value.get(name) ?? { x: 0, y: 0 }

const dirLabel: Record<Dir, string> = {
  n: 'N', s: 'S', e: 'E', w: 'W',
  ne: 'NE', nw: 'NW', se: 'SE', sw: 'SW',
  u: '↑', d: '↓', in: 'in', out: 'out',
}

/**
 * Truncate a room name so it stays inside the ROOM_W-wide box.
 * Estimate: at text-sm (~14u font) the average glyph advance is ~7u, so ROOM_W
 * (96u) less a little padding fits ~12 chars. Longer names get an ellipsis; the
 * `<title>` element and the hover popover both still expose the full name.
 */
const LABEL_MAX = 12
const fitLabel = (name: string): string =>
  name.length > LABEL_MAX ? name.slice(0, LABEL_MAX - 1).trimEnd() + '…' : name

// ─── u/d/in/out stub rendering ─────────────────────────────────────────────
/**
 * Directions whose connectors render as a short stub + glyph on the room edge
 * rather than a long dashed cross-map line (spec §3.4/§10).
 */
type StubDir = 'u' | 'd' | 'in' | 'out'
const STUB_DIRS: ReadonlySet<Dir> = new Set<Dir>(['u', 'd', 'in', 'out'])

/**
 * Geometry offsets from the from-room centre for each stub direction.
 * ax/ay: anchor on the room box edge; ex/ey: outer tick-mark endpoint.
 */
const STUB_OFFSETS: Record<StubDir, { ax: number; ay: number; ex: number; ey: number }> = {
  u:   { ax: 0,           ay: -ROOM_H / 2,      ex: 0,               ey: -ROOM_H / 2 - 14 },
  d:   { ax: 0,           ay:  ROOM_H / 2,       ex: 0,               ey:  ROOM_H / 2 + 14 },
  in:  { ax: ROOM_W / 2,  ay: -ROOM_H / 4,       ex: ROOM_W / 2 + 14, ey: -ROOM_H / 4      },
  out: { ax: ROOM_W / 2,  ay:  ROOM_H / 4,       ex: ROOM_W / 2 + 14, ey:  ROOM_H / 4      },
}

/** Pre-computed stub geometry used in the template. */
const stubConnectors = computed(() =>
  layout.value.connectors
    .filter(c => STUB_DIRS.has(c.dir))
    .map(c => {
      const p = pos(c.from)
      const o = STUB_OFFSETS[c.dir as StubDir]
      const isUD = c.dir === 'u' || c.dir === 'd'
      return {
        key: `${c.from}-${c.dir}`,
        x1: p.x + o.ax, y1: p.y + o.ay,
        x2: p.x + o.ex, y2: p.y + o.ey,
        lx: p.x + o.ex + (isUD ? 0 : 8),
        ly: p.y + o.ey + (c.dir === 'u' ? -7 : c.dir === 'd' ? 7 : 0),
        label: dirLabel[c.dir],
        anchor: isUD ? ('middle' as const) : ('start' as const),
      }
    }),
)

/** Regular (cardinal/diagonal) connectors — stubs are rendered separately. */
const regularConnectors = computed(() => layout.value.connectors.filter(c => !STUB_DIRS.has(c.dir)))

// ─── Dev view: each room's full object history painted under its box ─────────
const DEV_MAX_LINES = 4  // objects listed on a box before collapsing to "+N more"
const DEV_OBJ_MAX = 14   // per-object label truncation
/** name → up to DEV_MAX_LINES object labels + overflow count. Empty unless dev mode. */
const devObjectsByRoom = computed(() => {
  const m = new Map<string, { items: string[]; more: number }>()
  if (mapMode.value !== 'dev') return m
  for (const r of layout.value.rooms) {
    const objs = roomObjects.value[r.name] ?? []
    if (!objs.length) continue
    const items = objs.slice(0, DEV_MAX_LINES).map(o => (o.length > DEV_OBJ_MAX ? o.slice(0, DEV_OBJ_MAX - 1) + '…' : o))
    m.set(r.name, { items, more: Math.max(0, objs.length - DEV_MAX_LINES) })
  }
  return m
})

// ─── Hover / focus popover ─────────────────────────────────────────────────
/** Full-word direction names shown in the popover and the SR room list. */
const dirWord: Record<Dir, string> = {
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
  u: 'up', d: 'down', in: 'in', out: 'out',
}

// ─── Screen-reader room list ────────────────────────────────────────────────
/**
 * Textual room+exit descriptions for the visually-hidden SR fallback (spec §7).
 * Derives targets from graph edges so we can say "north to Library" not just "north".
 */
const srRoomList = computed(() =>
  layout.value.rooms.map(r => {
    const exits = graph.value.edges.filter(e => e.from === r.name)
    const exitText = exits.length
      ? exits.map(e => `${dirWord[e.dir]} to ${e.to}`).join(', ')
      : 'no exits'
    const objs = roomObjects.value[r.name] ?? []
    return { name: r.name, exitText, objText: objs.length ? objs.join(', ') : '' }
  }),
)

/** Name of the room currently under the cursor or keyboard focus. */
const hovered = ref<string | null>(null)
/** Name of the room that has keyboard focus (drives the visible focus ring). */
const focused = ref<string | null>(null)

/** Exits, objects, and one-line description for the hovered room. */
const hoveredDetails = computed(() => hovered.value ? details(hovered.value) : null)

/** Every object ever seen in the hovered room, each flagged `taken` when it is
 *  no longer in the current contents — so the popover can show both at a glance. */
const hoveredSeen = computed(() => {
  const d = hoveredDetails.value
  if (!d) return [] as { name: string; taken: boolean }[]
  const present = new Set(d.objects)
  return d.seenObjects.map(name => ({ name, taken: !present.has(name) }))
})
</script>

<template>
  <div class="bg-default relative h-full w-full overflow-hidden">
    <!-- Empty state -->
    <div v-if="!hasRooms" class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <template v-if="noMap">
        <UIcon name="i-lucide-map-off" class="size-10 text-muted" />
        <p class="text-lg font-semibold">Can't auto-map</p>
        <p class="text-muted max-w-sm text-sm">This game's status line has no room name — the map can't track rooms.</p>
      </template>
      <template v-else>
        <UIcon name="i-lucide-map" class="size-10 text-primary" />
        <p class="text-lg font-semibold">Play to map the world</p>
        <p class="text-muted max-w-sm text-sm">Move around in the Play tab and rooms appear here.</p>
      </template>
    </div>

    <template v-else>
      <svg
        ref="svgEl"
        class="h-full w-full select-none"
        :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
        :viewBox="viewBox"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        :aria-label="`Map: ${layout.rooms.length} rooms`"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <!-- graph-paper background: visual flair. A user-space pattern, so the grid
             aligns to the room cells and pans/zooms with the map. Offset by half a
             cell so rooms sit inside the squares (old-school Infocom hand-map look).
             The sky-500 tint at low opacity is tunable — keep it subtle so rooms and
             labels stay readable in both light and dark themes. -->
        <defs>
          <pattern id="gp-minor" :x="CELL / 2" :y="CELL / 2" :width="CELL" :height="CELL" patternUnits="userSpaceOnUse">
            <path :d="`M ${CELL} 0 L 0 0 0 ${CELL}`" fill="none" stroke="currentColor" stroke-width="1" class="text-sky-500/10" />
          </pattern>
          <pattern id="gp-major" :x="CELL / 2" :y="CELL / 2" :width="CELL * 5" :height="CELL * 5" patternUnits="userSpaceOnUse">
            <rect :width="CELL * 5" :height="CELL * 5" fill="url(#gp-minor)" />
            <path :d="`M ${CELL * 5} 0 L 0 0 0 ${CELL * 5}`" fill="none" stroke="currentColor" stroke-width="1.5" class="text-sky-500/20" />
          </pattern>
        </defs>
        <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#gp-major)" />

        <!-- regular connectors (cardinal/diagonal) -->
        <g stroke="currentColor" class="text-muted">
          <line
            v-for="(c, i) in regularConnectors"
            :key="i"
            :x1="pos(c.from).x" :y1="pos(c.from).y"
            :x2="pos(c.to).x"   :y2="pos(c.to).y"
            :stroke-dasharray="c.grid ? '0' : '6 5'"
            stroke-width="2"
          />
        </g>

        <!-- u/d/in/out stubs: short tick + dirLabel glyph on the from-room edge (spec §3.4/§10) -->
        <g>
          <template v-for="s in stubConnectors" :key="s.key">
            <line
              :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
              stroke="currentColor" stroke-width="2" fill="none" class="text-muted"
            />
            <text
              :x="s.lx" :y="s.ly"
              :text-anchor="s.anchor"
              dominant-baseline="middle"
              fill="currentColor"
              stroke="none"
              class="text-xs text-muted"
            >{{ s.label }}</text>
          </template>
        </g>

        <!-- rooms — focusable for a11y; hover/focus → popover -->
        <g
          v-for="r in layout.rooms"
          :key="r.name"
          :transform="`translate(${r.col * CELL},${r.row * CELL})`"
          tabindex="0"
          role="button"
          :aria-label="`Room ${r.name}`"
          class="outline-none"
          @mouseenter="hovered = r.name"
          @mouseleave="hovered = null"
          @focus="hovered = r.name; focused = r.name"
          @blur="hovered = null; focused = null"
        >
          <!-- Full name on native hover (label below may be truncated to fit the box) -->
          <title>{{ r.name }}</title>
          <!-- Focus ring: visible primary-colour halo, distinct from the amber current-room stroke -->
          <rect
            v-if="r.name === focused"
            :x="-ROOM_W / 2 - 3" :y="-ROOM_H / 2 - 3"
            :width="ROOM_W + 6" :height="ROOM_H + 6"
            rx="10"
            fill="none"
            class="stroke-primary"
            stroke-width="2.5"
            pointer-events="none"
          />
          <rect
            :x="-ROOM_W / 2" :y="-ROOM_H / 2"
            :width="ROOM_W" :height="ROOM_H"
            rx="8"
            class="fill-elevated"
            :class="r.name === currentRoom ? 'stroke-amber-500' : 'stroke-default'"
            :stroke-width="r.name === currentRoom ? 3 : 1.5"
          />
          <text text-anchor="middle" dominant-baseline="middle" fill="currentColor" class="text-highlighted text-sm">{{ fitLabel(r.name) }}</text>

          <!-- Dev view: every object ever seen in this room, painted below the
               box (sticky, so taken items still show). Player view omits this. -->
          <template v-if="devObjectsByRoom.get(r.name)">
            <text
              v-for="(o, oi) in devObjectsByRoom.get(r.name)!.items"
              :key="oi"
              text-anchor="middle"
              :y="ROOM_H / 2 + 13 + oi * 11"
              class="fill-amber-600 dark:fill-amber-400"
              style="font-size: 9px"
            >{{ o }}</text>
            <text
              v-if="devObjectsByRoom.get(r.name)!.more"
              text-anchor="middle"
              :y="ROOM_H / 2 + 13 + devObjectsByRoom.get(r.name)!.items.length * 11"
              fill="currentColor"
              class="text-muted"
              style="font-size: 9px"
            >+{{ devObjectsByRoom.get(r.name)!.more }} more</text>
          </template>
        </g>
      </svg>

      <!-- Visually-hidden room list for screen readers (spec §7).
           Enumerates each room with full-word direction targets so AT users
           can navigate the map without the SVG graphics. -->
      <ul class="sr-only" aria-label="Room list">
        <li v-for="item in srRoomList" :key="item.name">{{ item.name }} — {{ item.exitText }}<template v-if="item.objText">; objects seen: {{ item.objText }}</template></li>
      </ul>

      <!-- Room detail popover — bottom-left corner, shown on hover or keyboard focus -->
      <div
        v-if="hovered && hoveredDetails"
        class="absolute bottom-2 left-2 z-10 w-56 rounded-lg border bg-elevated/95 p-3 shadow-lg backdrop-blur-sm"
        aria-live="polite"
      >
        <p class="mb-1.5 text-sm font-semibold leading-tight">{{ hovered }}</p>
        <p class="text-muted text-xs">
          <span class="font-medium">Exits:</span>
          {{ hoveredDetails.exits.map(d => dirWord[d]).join(', ') || '—' }}
        </p>
        <p class="text-muted text-xs">
          <span class="font-medium">Here now:</span>
          {{ hoveredDetails.objects.join(', ') || '—' }}
        </p>
        <p v-if="hoveredSeen.length" class="text-muted text-xs">
          <span class="font-medium">Seen here:</span>
          <template v-for="(o, i) in hoveredSeen" :key="o.name"><span
            :class="o.taken ? 'line-through opacity-60' : ''"
            :title="o.taken ? 'no longer here' : 'here now'"
          >{{ o.name }}</span>{{ i < hoveredSeen.length - 1 ? ', ' : '' }}</template>
        </p>
        <p v-if="hoveredDetails.description" class="text-muted mt-1.5 text-xs italic">{{ hoveredDetails.description }}</p>
      </div>

      <!-- Zoom / pan control overlay — top-right, keyboard-operable -->
      <div class="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-elevated/80 px-2 py-1 backdrop-blur-sm">
        <UButton
          size="xs"
          :variant="mapMode === 'dev' ? 'soft' : 'ghost'"
          :color="mapMode === 'dev' ? 'primary' : 'neutral'"
          :icon="mapMode === 'dev' ? 'i-lucide-wrench' : 'i-lucide-user-round'"
          :aria-pressed="mapMode === 'dev'"
          :aria-label="mapMode === 'dev'
            ? 'Dev view active — every room\'s object history is shown. Switch to player view.'
            : 'Player view active. Switch to dev view to show every room\'s object history.'"
          :title="mapMode === 'dev' ? 'Dev view — all room objects shown' : 'Player view — switch to Dev to show all room objects'"
          @click="toggleMapMode"
        >
          <span class="text-xs font-medium">{{ mapMode === 'dev' ? 'Dev' : 'Player' }}</span>
        </UButton>
        <span class="bg-default mx-0.5 h-4 w-px" aria-hidden="true" />
        <span class="text-muted min-w-[3ch] text-right text-xs tabular-nums">{{ zoomPct }}%</span>
        <UButton
          icon="i-lucide-zoom-in"
          size="xs"
          variant="ghost"
          aria-label="Zoom in"
          title="Zoom in"
          @click="zoomBy(0.8)"
        />
        <UButton
          icon="i-lucide-zoom-out"
          size="xs"
          variant="ghost"
          aria-label="Zoom out"
          title="Zoom out"
          @click="zoomBy(1.25)"
        />
        <UButton
          icon="i-lucide-maximize"
          size="xs"
          variant="ghost"
          aria-label="Fit map"
          title="Fit map"
          @click="onFit"
        />
      </div>
    </template>
  </div>
</template>
