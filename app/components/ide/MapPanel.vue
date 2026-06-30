<script setup lang="ts">
import type { Dir } from '~/composables/map-graph'
const { layout, currentRoom } = useMap()

const CELL = 120, ROOM_W = 96, ROOM_H = 48, PAD = 60
const hasRooms = computed(() => layout.value.rooms.length > 0)
const noMap = computed(() => false) // Task 8/later may surface a "no room name" note

const viewBox = computed(() => {
  const b = layout.value.bounds
  const x = b.minCol * CELL - ROOM_W / 2 - PAD
  const y = b.minRow * CELL - ROOM_H / 2 - PAD
  const w = (b.maxCol - b.minCol) * CELL + ROOM_W + PAD * 2
  const h = (b.maxRow - b.minRow) * CELL + ROOM_H + PAD * 2
  return `${x} ${y} ${w} ${h}`
})
const pos = (name: string) => {
  const r = layout.value.rooms.find(x => x.name === name)!
  return { x: r.col * CELL, y: r.row * CELL }
}
const dirLabel: Record<Dir, string> = { n: 'N', s: 'S', e: 'E', w: 'W', ne: 'NE', nw: 'NW', se: 'SE', sw: 'SW', u: '↑', d: '↓', in: 'in', out: 'out' }
</script>

<template>
  <div class="bg-default relative h-full w-full overflow-hidden">
    <div v-if="!hasRooms" class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <UIcon name="i-lucide-map" class="size-10 text-primary" />
      <p class="text-lg font-semibold">Play to map the world</p>
      <p class="text-muted max-w-sm text-sm">Move around in the Play tab and rooms appear here.</p>
    </div>

    <svg v-else class="h-full w-full" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet"
         role="img" :aria-label="`Map: ${layout.rooms.length} rooms`">
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
        <line v-for="(c, i) in layout.connectors" :key="i"
              :x1="pos(c.from).x" :y1="pos(c.from).y" :x2="pos(c.to).x" :y2="pos(c.to).y"
              :stroke-dasharray="c.grid ? '0' : '6 5'" stroke-width="2" />
      </g>
      <!-- rooms -->
      <g v-for="r in layout.rooms" :key="r.name" :transform="`translate(${r.col * CELL},${r.row * CELL})`">
        <rect :x="-ROOM_W / 2" :y="-ROOM_H / 2" :width="ROOM_W" :height="ROOM_H" rx="8"
              class="fill-elevated"
              :class="r.name === currentRoom ? 'stroke-amber-500' : 'stroke-default'"
              :stroke-width="r.name === currentRoom ? 3 : 1.5" />
        <text text-anchor="middle" dominant-baseline="middle" class="fill-default text-sm">{{ r.name }}</text>
      </g>
    </svg>
  </div>
</template>
