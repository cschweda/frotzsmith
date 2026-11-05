<script setup lang="ts">
/**
 * The Solution tab: a game told as it plays — the opening, then each command
 * and the game's full reply. Hidden until Show solution (a sample's solution
 * is a complete spoiler). Logic lives in useSolutionTab / useSolutionRecorder.
 */
import type { TabResult } from '~/composables/useSolutionTab'

const tab = useSolutionTab()
const { has } = useSolutions()
const { state } = useSolutionRecorder()
const { storyTitle, loadedSampleId } = useIde()

const recording = computed(() => state.value === 'recording')
const title = computed(() => storyTitle.value || 'Untitled')
const message = ref<string | null>(null)

/** The one confirm on screen: what it asks and what Confirm does. */
const confirm = ref<{ heading: string; description: string; label: string; run: () => unknown } | null>(null)
const confirmOpen = ref(false)

function report(r: TabResult, done?: string) {
  message.value = r.ok ? (r.note ?? done ?? null) : r.message
}
function ask(heading: string, description: string, label: string, run: () => unknown) {
  confirm.value = { heading, description, label, run }
  confirmOpen.value = true
}
function onConfirm() {
  const c = confirm.value
  confirmOpen.value = false
  confirm.value = null
  void c?.run()
}
function onCancel() {
  confirmOpen.value = false
  confirm.value = null
}

/** "The sample's original solution", collapsed while the game has its own. */
const showOriginal = ref(false)
async function onToggleOriginal() {
  showOriginal.value = !showOriginal.value
  if (showOriginal.value && tab.sampleText.value === null && !tab.sampleBusy.value) await tab.showSolution()
}

async function onShow() {
  message.value = null
  await tab.showSolution()
}

function onAdopt() {
  const r = tab.adoptSample()
  if (!r.ok && r.needsConfirm)
    return ask(r.message, 'Your solution for this game is replaced by the sample’s.', 'Replace', () => report(tab.adoptSample({ confirmed: true }), 'The sample’s solution is now this game’s solution.'))
  report(r, 'The sample’s solution is now this game’s solution.')
}

async function onRegenerate() {
  const r = await tab.regenerate()
  if (!r.ok && r.needsConfirm)
    return ask(`Regenerate the solution for “${title.value}”?`, r.message, 'Regenerate', async () => report(await tab.regenerate({ confirmed: true }), 'Solution regenerated.'))
  report(r)
}

function onClear() {
  const r = tab.clear()
  if (!r.ok && r.needsConfirm)
    return ask(r.message, 'The solution saved for this game is removed. This can’t be undone.', 'Clear', () => report(tab.clear({ confirmed: true }), 'Solution cleared.'))
  report(r)
}

async function onCopy() {
  report(await tab.copy(), 'Solution copied to the clipboard.')
}

const fileInput = shallowRef<HTMLInputElement | null>(null)
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // the same file can be picked again
  if (!file) return
  const read = await tab.readFile(file)
  if (!read.ok) return report(read)
  const r = tab.load(read.text)
  if (!r.ok && r.needsConfirm)
    return ask(r.message, 'The loaded file replaces this game’s solution; Continue recording carries on from its end.', 'Replace', () => report(tab.load(read.text, { confirmed: true }), 'Solution loaded; Continue recording carries on from its end.'))
  report(r, 'Solution loaded; Continue recording carries on from its end.')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2">
      <SolutionRecorderBar show-start />
    </div>

    <div class="min-h-0 flex-1 space-y-5 overflow-auto px-4 py-3">
      <!-- Spoiler guard -->
      <div v-if="!tab.revealed.value" class="frotz-grid flex flex-col items-center justify-center gap-3 p-6 text-center">
        <UIcon name="i-lucide-book-open-check" class="size-10 text-primary" />
        <p class="text-lg font-semibold">The solution is hidden</p>
        <p class="text-muted max-w-sm text-sm">
          A solution tells the whole game, so it stays hidden until you ask for it.
        </p>
        <UButton color="primary" icon="i-lucide-eye" @click="onShow">Show solution</UButton>
      </div>

      <template v-else>
        <!-- A sample with no solution of its own: the sample's solution IS the game's -->
        <section v-if="tab.mode.value === 'sample'" aria-labelledby="solution-own-h" class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 id="solution-own-h" class="text-sm font-semibold">This game’s solution <span class="text-muted font-normal">(from the sample)</span></h2>
            <div class="flex flex-wrap items-center gap-1">
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-copy-plus" :disabled="tab.sampleText.value === null" @click="onAdopt">
                Make it my solution
              </UButton>
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-clipboard-copy" :disabled="tab.sampleText.value === null" @click="onCopy">Copy</UButton>
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-download" :disabled="tab.sampleText.value === null" :title="`Download ${tab.downloadName.value}`" @click="tab.download()">
                Download
              </UButton>
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-file-up" @click="fileInput?.click()">Load file…</UButton>
              <UButton v-if="tab.sampleMessage.value" size="xs" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" @click="onShow">
                Try again
              </UButton>
            </div>
          </div>
          <p class="text-muted text-xs">Make it my solution to edit it; or press Record to play the game through yourself.</p>
          <p v-if="tab.sampleEdited.value" class="text-muted text-xs">You’ve edited this sample, so its solution shows your edited game.</p>
          <p v-if="tab.sampleBusy.value" class="text-muted text-xs" role="status">{{ tab.sampleBusyText.value }}</p>
          <p v-if="tab.sampleMessage.value" class="text-error text-xs" role="status">{{ tab.sampleMessage.value }}</p>
          <p v-if="tab.sampleNote.value" class="text-muted text-xs">{{ tab.sampleNote.value }}</p>
          <SolutionTextBlock v-if="tab.sampleText.value !== null" :text="tab.sampleText.value" label="This game’s solution, from the sample" />
          <p class="text-muted text-xs">
            The text comes from replaying the commands from the start, so where the game uses randomness it may differ from what you saw in Play.
          </p>
        </section>

        <!-- This game's own solution -->
        <section v-else aria-labelledby="solution-own-h" class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 id="solution-own-h" class="text-sm font-semibold">This game’s solution</h2>
            <div class="flex flex-wrap items-center gap-1">
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-pencil" :disabled="!has" @click="tab.edit()">Edit</UButton>
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-refresh-cw" :disabled="!has || recording || tab.busy.value" @click="onRegenerate">
                Regenerate
              </UButton>
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-clipboard-copy" :disabled="tab.ownText.value === null" @click="onCopy">Copy</UButton>
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-download" :disabled="tab.ownText.value === null" :title="`Download ${tab.downloadName.value}`" @click="tab.download()">
                Download
              </UButton>
              <UButton size="xs" color="neutral" variant="subtle" icon="i-lucide-file-up" :disabled="recording" @click="fileInput?.click()">Load file…</UButton>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" :disabled="!has || recording" @click="onClear">Clear</UButton>
            </div>
          </div>
          <SolutionTextBlock v-if="tab.ownText.value !== null" :text="tab.ownText.value" :label="`Solution for ${title}`" />
          <p v-else class="text-muted text-sm">
            This game has no solution yet. Press Record and play it through, or load a solution file.
          </p>
          <p class="text-muted text-xs">
            The text comes from replaying the commands from the start, so where the game uses randomness it may differ from what you saw in Play.
          </p>

          <!-- A sample with its own solution: the original stays one click away -->
          <div v-if="loadedSampleId && tab.hasSampleWalkthrough.value" class="space-y-2 border-t border-default pt-2">
            <UButton size="xs" color="neutral" variant="link" :icon="showOriginal ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" :aria-expanded="showOriginal" @click="onToggleOriginal">
              {{ showOriginal ? 'Hide' : 'Show' }} the sample’s original solution
            </UButton>
            <template v-if="showOriginal">
              <p v-if="tab.sampleEdited.value" class="text-muted text-xs">You’ve edited this sample, so its solution shows your edited game.</p>
              <p v-if="tab.sampleBusy.value" class="text-muted text-xs" role="status">{{ tab.sampleBusyText.value }}</p>
              <p v-if="tab.sampleMessage.value" class="text-error text-xs" role="status">
                {{ tab.sampleMessage.value }}
                <UButton size="xs" color="neutral" variant="link" @click="onShow">Try again</UButton>
              </p>
              <SolutionTextBlock v-if="tab.sampleText.value !== null" :text="tab.sampleText.value" label="The sample’s original solution" />
            </template>
          </div>
        </section>
        <input ref="fileInput" type="file" accept=".txt,text/plain" class="hidden" aria-hidden="true" tabindex="-1" @change="onFile" />
      </template>

      <p v-if="message" class="text-muted text-xs" role="status" aria-live="polite">{{ message }}</p>
    </div>

    <OpenProjectModal
      v-model:open="confirmOpen"
      :title="title"
      :replaces="[]"
      :heading="confirm?.heading ?? ''"
      :description="confirm?.description ?? ''"
      :confirm-label="confirm?.label ?? 'OK'"
      @replace="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>
