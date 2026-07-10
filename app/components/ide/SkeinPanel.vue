<script setup lang="ts">
import { pathNodes, type SkeinNode, type SkeinStatus } from '~/composables/skein-tree'
import { lineDiff } from '~/utils/line-diff'

const skein = useSkein()
const { sendToPlay, canPlay, activeStoryKey } = useIde()

const collapsed = ref(new Set<string>())
const selectedId = ref<string | null>(null)
const addingUnder = ref<string | null>(null)
const newCommand = ref('')
const note = ref('')

interface Row {
  node: SkeinNode
  depth: number
  hasChildren: boolean
  expanded: boolean
}

/** DFS flatten of the tree (root hidden), honoring collapse state. */
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const walk = (id: string, depth: number) => {
    const node = skein.tree.value.nodes[id]
    if (!node) return
    if (id !== skein.tree.value.root) {
      const expanded = !collapsed.value.has(id)
      out.push({ node, depth, hasChildren: node.childIds.length > 0, expanded })
      if (!expanded) return
    }
    for (const child of node.childIds) walk(child, id === skein.tree.value.root ? 0 : depth + 1)
  }
  walk(skein.tree.value.root, 0)
  return out
})

const selected = computed(() => (selectedId.value ? skein.tree.value.nodes[selectedId.value] : undefined))
const selectedDiff = computed(() => {
  const n = selected.value
  if (!n || n.status !== 'diff' || n.blessedOutput === undefined || n.lastOutput === undefined) return null
  return lineDiff(n.blessedOutput, n.lastOutput)
})
const blessedCount = computed(
  () => Object.values(skein.tree.value.nodes).filter(n => n.blessedOutput !== undefined).length,
)

const STATUS_DOT: Record<SkeinStatus, string> = {
  unblessed: 'bg-neutral-500/60',
  match: 'bg-success',
  diff: 'bg-error',
  stale: 'bg-warning',
  error: 'bg-error ring-2 ring-error/40',
}
const STATUS_LABEL: Record<SkeinStatus, string> = {
  unblessed: 'not blessed',
  match: 'matches blessed output',
  diff: 'DIFFERS from blessed output',
  stale: 'stale — not re-run since the last compile',
  error: 'run never reached this command',
}

function toggle(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

function importScript() {
  const n = skein.importActiveScript()
  note.value = n ? `Imported ${n} command${n === 1 ? '' : 's'} from the active test script.` : 'No active test script to import.'
}

function startAdd(id: string) {
  addingUnder.value = id
  newCommand.value = ''
}
function confirmAdd() {
  if (addingUnder.value && newCommand.value.trim()) skein.addCommand(addingUnder.value, newCommand.value)
  addingUnder.value = null
  newCommand.value = ''
}

function playTo(id: string) {
  sendToPlay(skein.commandsTo(id))
}

function exportSkein() {
  const blob = new Blob([skein.exportSkein()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeStoryKey.value}.skein`
  a.click()
  URL.revokeObjectURL(url)
}

const fileInput = ref<HTMLInputElement | null>(null)
async function onImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  note.value = skein.importSkein(await file.text())
    ? 'Skein imported.'
    : 'That file is not a valid .skein export.'
  if (fileInput.value) fileInput.value.value = ''
}

/** ARIA tree keyboard nav: Up/Down move, Left collapses/goes up, Right expands. */
function onTreeKeydown(event: KeyboardEvent) {
  const ids = rows.value.map(r => r.node.id)
  if (!ids.length) return
  const current = selectedId.value && ids.includes(selectedId.value) ? selectedId.value : ids[0]!
  const i = ids.indexOf(current)
  let next: string | null = null
  if (event.key === 'ArrowDown') next = ids[i + 1] ?? current
  else if (event.key === 'ArrowUp') next = ids[i - 1] ?? current
  else if (event.key === 'ArrowRight') {
    const row = rows.value[i]!
    if (row.hasChildren && !row.expanded) toggle(current)
    else next = ids[i + 1] ?? current
  } else if (event.key === 'ArrowLeft') {
    const row = rows.value[i]!
    if (row.hasChildren && row.expanded) toggle(current)
    else next = row.node.parentId !== skein.tree.value.root ? row.node.parentId : current
  } else return
  event.preventDefault()
  if (next) {
    selectedId.value = next
    nextTick(() => document.getElementById(`skein-${next}`)?.focus())
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2">
      <UButton
        size="xs"
        color="primary"
        variant="subtle"
        icon="i-lucide-play"
        :disabled="skein.running.value || !blessedCount"
        title="Re-run every blessed thread against the current build"
        @click="skein.runStale()"
      >
        Run stale
      </UButton>
      <UButton
        v-if="skein.running.value"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-octagon-x"
        @click="skein.cancelRuns()"
      >
        {{ skein.progress.value ? `${skein.progress.value.done}/${skein.progress.value.total}` : '' }} Cancel
      </UButton>
      <UButton
        size="xs"
        color="neutral"
        variant="subtle"
        icon="i-lucide-scroll-text"
        title="Add the active test script as a thread"
        @click="importScript"
      >
        Import script
      </UButton>
      <USwitch
        :model-value="skein.autoRun.value"
        size="sm"
        label="Auto-run on compile"
        @update:model-value="skein.setAutoRun($event)"
      />
      <span class="text-muted ml-auto text-xs">{{ skein.nodeCount.value }} node{{ skein.nodeCount.value === 1 ? '' : 's' }}</span>
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-download" title="Export .skein" @click="exportSkein" />
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-upload" title="Import .skein" @click="fileInput?.click()" />
      <input ref="fileInput" type="file" accept=".skein,application/json" class="hidden" @change="onImportFile">
    </div>

    <p v-if="note" class="text-muted shrink-0 px-3 pt-2 text-xs" aria-live="polite">{{ note }}</p>

    <!-- Empty state -->
    <div v-if="!rows.length" class="frotz-grid flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <UIcon name="i-lucide-git-branch" class="text-primary size-10" />
      <p class="text-lg font-semibold">The Skein starts empty</p>
      <p class="text-muted max-w-sm text-sm">
        Feed it by <span class="text-default">playing the game</span> (every command you type extends the tree) or by
        <span class="text-default">importing the active test script</span>. Then run a thread, <span class="text-default">bless</span> its
        outputs as correct — and every later compile re-checks them.
      </p>
    </div>

    <!-- Tree -->
    <div v-else class="min-h-0 flex-1 overflow-auto px-2 py-2">
      <ul role="tree" aria-label="Skein command tree" class="space-y-0.5" @keydown="onTreeKeydown">
        <li
          v-for="row in rows"
          :key="row.node.id"
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-expanded="row.hasChildren ? row.expanded : undefined"
          :aria-selected="selectedId === row.node.id"
        >
          <div
            :id="`skein-${row.node.id}`"
            tabindex="0"
            :class="[
              'group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm',
              selectedId === row.node.id ? 'bg-elevated' : 'hover:bg-elevated/60',
            ]"
            :style="{ paddingLeft: `${row.depth * 1.25 + 0.375}rem` }"
            @click="selectedId = row.node.id"
            @keydown.enter.prevent="selectedId = row.node.id"
          >
            <button
              v-if="row.hasChildren"
              type="button"
              class="text-muted hover:text-default -ml-1 shrink-0"
              :aria-label="row.expanded ? 'Collapse' : 'Expand'"
              tabindex="-1"
              @click.stop="toggle(row.node.id)"
            >
              <UIcon :name="row.expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
            </button>
            <span v-else class="w-3 shrink-0" aria-hidden="true" />
            <span :class="['size-2.5 shrink-0 rounded-full', STATUS_DOT[row.node.status]]" aria-hidden="true" />
            <span class="sr-only">{{ STATUS_LABEL[row.node.status] }} —</span>
            <span class="truncate font-mono">{{ row.node.command }}</span>

            <span class="ml-auto hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-badge-check"
                :title="row.node.blessedOutput !== undefined ? 'Unbless this branch' : 'Bless outputs up to here'"
                :aria-label="row.node.blessedOutput !== undefined ? 'Unbless this branch' : 'Bless outputs up to here'"
                @click.stop="row.node.blessedOutput !== undefined ? skein.unblessAt(row.node.id) : skein.blessTo(row.node.id)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-play"
                :disabled="skein.running.value"
                title="Run from the start to here"
                aria-label="Run from the start to here"
                @click.stop="skein.runToNode(row.node.id)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-gamepad-2"
                :disabled="!canPlay"
                title="Play to here (feeds these commands into the live game)"
                aria-label="Play to here"
                @click.stop="playTo(row.node.id)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-plus"
                title="Add a command below this one"
                aria-label="Add a command below this one"
                @click.stop="startAdd(row.node.id)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                title="Delete this branch"
                aria-label="Delete this branch"
                @click.stop="skein.removeAt(row.node.id)"
              />
            </span>
          </div>

          <div v-if="addingUnder === row.node.id" class="py-1" :style="{ paddingLeft: `${row.depth * 1.25 + 1.75}rem` }">
            <UInput
              v-model="newCommand"
              size="xs"
              autofocus
              placeholder="new command…"
              aria-label="New command"
              @keydown.enter.prevent="confirmAdd"
              @keydown.escape.prevent="addingUnder = null"
              @blur="confirmAdd"
            />
          </div>
        </li>
      </ul>

      <!-- Diff view for the selected regression -->
      <div v-if="selected && selectedDiff" class="border-default mt-3 rounded-lg border">
        <p class="border-default text-muted border-b px-3 py-1.5 text-xs font-semibold">
          <span class="font-mono text-default">{{ selected.command }}</span> — blessed (red) vs current (green)
        </p>
        <pre tabindex="0" class="overflow-x-auto p-3 text-xs leading-relaxed"><template v-for="(line, i) in selectedDiff" :key="i"><span
          :class="[
            'block px-1',
            line.type === 'del' ? 'bg-error/15 text-error' : line.type === 'add' ? 'bg-success/15 text-success' : 'text-muted',
          ]"
        >{{ line.type === 'del' ? '− ' : line.type === 'add' ? '+ ' : '  ' }}{{ line.text }}</span></template></pre>
      </div>
      <div v-else-if="selected && selected.status === 'match'" class="text-muted mt-3 px-2 text-xs">
        <span class="font-mono text-default">{{ selected.command }}</span> matches its blessed output.
      </div>
    </div>
  </div>
</template>
