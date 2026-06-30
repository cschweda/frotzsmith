<script setup lang="ts">
import type { Dir } from '~/composables/map-graph'
const { layout, currentRoom, details } = useMap()

const CELL = 120, ROOM_W = 96, ROOM_H = 48, PAD = 60
/** Clamp limits for the viewBox width (SVG user-space units). */
const MIN_W = CELL       // most zoomed-in: one cell wide
const MAX_W = CELL * 60  // most zoomed-out: 60 cells wide

const hasRooms = computed(() => layout.value.rooms.length > 0)
const noMap = computed(() => false) // Task 8/later may surface a "no room name" note

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
const pos = (name: string) => {
  const r = layout.value.rooms.find(x => x.name === name)!
  return { x: r.col * CELL, y: r.row * CELL }
}
const dirLabel: Record<Dir, string> = {
  n: 'N', s: 'S', e: 'E', w: 'W',
  ne: 'NE', nw: 'NW', se: 'SE', sw: 'SW',
  u: '↑', d: '↓', in: 'in', out: 'out',
}

// ─── Hover / focus popover ─────────────────────────────────────────────────
/** Full-word direction names shown in the popover. */
const dirWord: Record<Dir, string> = {
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
  u: 'up', d: 'down', in: 'in', out: 'out',
}

/** Name of the room currently under the cursor or keyboard focus. */
const hovered = ref<string | null>(null)

/** Exits, objects, and one-line description for the hovered room. */
const hoveredDetails = computed(() => hovered.value ? details(hovered.value) : null)
</script>

<template>
  <div class="bg-default relative h-full w-full overflow-hidden">
    <!-- Empty state -->
    <div v-if="!hasRooms" class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <UIcon name="i-lucide-map" class="size-10 text-primary" />
      <p class="text-lg font-semibold">Play to map the world</p>
      <p class="text-muted max-w-sm text-sm">Move around in the Play tab and rooms appear here.</p>
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

        <!-- connectors -->
        <g stroke="currentColor" class="text-muted">
          <line
            v-for="(c, i) in layout.connectors"
            :key="i"
            :x1="pos(c.from).x" :y1="pos(c.from).y"
            :x2="pos(c.to).x"   :y2="pos(c.to).y"
            :stroke-dasharray="c.grid ? '0' : '6 5'"
            stroke-width="2"
          />
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
          @focus="hovered = r.name"
          @blur="hovered = null"
        >
          <rect
            :x="-ROOM_W / 2" :y="-ROOM_H / 2"
            :width="ROOM_W" :height="ROOM_H"
            rx="8"
            class="fill-elevated"
            :class="r.name === currentRoom ? 'stroke-amber-500' : 'stroke-default'"
            :stroke-width="r.name === currentRoom ? 3 : 1.5"
          />
          <text text-anchor="middle" dominant-baseline="middle" class="fill-default text-sm">{{ r.name }}</text>
        </g>
      </svg>

      <!-- Room detail popover — bottom-left corner, shown on hover or keyboard focus -->
      <div
        v-if="hovered && hoveredDetails"
        class="absolute bottom-2 left-2 z-10 w-56 rounded-lg border bg-elevated/95 p-3 shadow-lg backdrop-blur-sm"
        role="tooltip"
        aria-live="polite"
      >
        <p class="mb-1.5 text-sm font-semibold leading-tight">{{ hovered }}</p>
        <p class="text-muted text-xs">
          <span class="font-medium">Exits:</span>
          {{ hoveredDetails.exits.map(d => dirWord[d]).join(', ') || '—' }}
        </p>
        <p class="text-muted text-xs">
          <span class="font-medium">Objects:</span>
          {{ hoveredDetails.objects.join(', ') || '—' }}
        </p>
        <p v-if="hoveredDetails.description" class="text-muted mt-1.5 text-xs italic">{{ hoveredDetails.description }}</p>
      </div>

      <!-- Zoom / pan control overlay — top-right, keyboard-operable -->
      <div class="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-elevated/80 px-2 py-1 backdrop-blur-sm">
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
