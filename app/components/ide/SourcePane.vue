<script setup lang="ts">
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { inform6 } from '~/modules/inform6/editor/i6-language'
import { i6Theme } from '~/modules/inform6/editor/i6-theme'
import { i6Lint } from '~/modules/inform6/editor/i6-lint'

const { activeId, activeFile, readFile, writeActive, openFile } = useProjectFiles()
const { jumpSignal, runCompile } = useIde()
const colorMode = useColorMode()

const host = ref<HTMLElement | null>(null)
const themeComp = new Compartment()
const states = new Map<string, EditorState>()
let view: EditorView | null = null

const isDark = () => colorMode.value === 'dark'

// Build a fresh state for a file: editable files get lint + write-back; read-only
// files (library, bundled extensions) are locked and unlinted to avoid noise.
function makeState(id: string): EditorState {
  const editable = isEditable(id)
  const exts: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    history(),
    bracketMatching(),
    indentOnInput(),
    EditorView.lineWrapping,
    inform6(),
    EditorState.readOnly.of(!editable),
    EditorView.editable.of(editable),
    themeComp.of(i6Theme(isDark())),
    keymap.of([
      { key: 'Mod-b', preventDefault: true, run: () => (runCompile(), true) },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    ...(editable ? [i6Lint()] : []),
    EditorView.updateListener.of(u => {
      // Only the live, active editable file writes back (avoids stale closures).
      if (u.docChanged && editable && activeId.value === id) writeActive(u.state.doc.toString())
    }),
  ]
  return EditorState.create({ doc: readFile(id), extensions: exts })
}

// Editability for a non-active file id (mirrors the file list rules).
function isEditable(id: string): boolean {
  if (id === 'source') return true
  if (id.startsWith('lib:')) return false
  return id.startsWith('uploaded:')
}

function showFile(id: string) {
  if (!view) return
  const cached = states.get(id)
  // Rebuild when missing or when the backing content changed externally
  // (load sample, open file, new project, library switch, re-upload).
  if (!cached || cached.doc.toString() !== readFile(id)) {
    states.set(id, makeState(id))
  }
  view.setState(states.get(id)!)
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({ parent: host.value, state: makeState(activeId.value) })
  states.set(activeId.value, view.state)
})

// Switch files: save the outgoing state (keeps undo/cursor), show the incoming.
watch(activeId, (id, prevId) => {
  if (view && prevId) states.set(prevId, view.state)
  showFile(id)
})

// External content change for the active file → replace the doc in place.
watch(
  () => readFile(activeId.value),
  content => {
    if (view && view.state.doc.toString() !== content) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
      states.set(activeId.value, view.state)
    }
  },
)

// Dark/light swap without tearing down the editor.
watch(
  () => colorMode.value,
  () => view?.dispatch({ effects: themeComp.reconfigure(i6Theme(isDark())) }),
)

// A clicked diagnostic targets the source — make sure it's the active file first.
watch(jumpSignal, sig => {
  if (!sig) return
  if (activeId.value !== 'source') openFile('source')
  nextTick(() => {
    if (!view) return
    const lineNo = Math.min(Math.max(sig.line, 1), view.state.doc.lines)
    const line = view.state.doc.line(lineNo)
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
    view.focus()
  })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
  states.clear()
})
</script>

<template>
  <div
    ref="host"
    role="tabpanel"
    :aria-label="`Editing ${activeFile.name}${activeFile.editable ? '' : ' (read-only)'}`"
    class="h-full w-full overflow-hidden"
  />
</template>
