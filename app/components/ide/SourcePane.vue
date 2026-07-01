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
import { i6Theme } from '~/modules/inform6/editor/i6-theme'
import { i6Lint } from '~/modules/inform6/editor/i6-lint'

const { activeId, activeFile, readFile, writeActive, openFile, files } = useProjectFiles()
const { jumpSignal, runCompile } = useIde()
const { profile } = useLanguage()
const colorMode = useColorMode()

const host = ref<HTMLElement | null>(null)
const themeComp = new Compartment()
const states = new Map<string, EditorState>()
let view: EditorView | null = null

const isDark = () => colorMode.value === 'dark'

// Build a fresh state for a file: editable files get lint + write-back; read-only
// files (library, bundled extensions) are locked and unlinted to avoid noise.
function makeState(id: string): EditorState {
  // Editability + display name come from the store's file list (single source of
  // truth), so the editor never re-derives the rule the explorer already owns.
  const meta = files.value.find(f => f.id === id)
  const editable = meta?.editable ?? false
  const name = meta?.name ?? 'file'
  const exts: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    history(),
    bracketMatching(),
    indentOnInput(),
    EditorView.lineWrapping,
    profile.value.editorMode(),
    EditorState.readOnly.of(!editable),
    EditorView.contentAttributes.of({
      'aria-label': `${name}${editable ? '' : ', read-only'} — ${profile.value.label} editor`,
    }),
    themeComp.of(i6Theme(isDark())),
    keymap.of([
      { key: 'Mod-b', preventDefault: true, run: () => (runCompile(), true) },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    ...(editable && profile.value.id === 'i6' ? [i6Lint()] : []),
    EditorView.updateListener.of(u => {
      // Only the live, active editable file writes back (avoids stale closures).
      if (u.docChanged && editable && activeId.value === id) writeActive(u.state.doc.toString())
    }),
  ]
  return EditorState.create({ doc: readFile(id), extensions: exts })
}

function showFile(id: string) {
  if (!view) return
  let state = states.get(id)
  // Rebuild when missing or when the backing content changed externally
  // (load sample, open file, new project, library switch, re-upload).
  if (!state || state.doc.toString() !== readFile(id)) {
    state = makeState(id)
    states.set(id, state)
  }
  view.setState(state)
  // Re-apply the current theme: cached states carry the theme they were built
  // with, so a dark/light toggle made while another file was active would
  // otherwise render this swapped-in file with a stale theme.
  view.dispatch({ effects: themeComp.reconfigure(i6Theme(isDark())) })
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({ parent: host.value, state: makeState(activeId.value) })
  // Make the scroll region keyboard-focusable (WCAG 2.1.1 / axe
  // scrollable-region-focusable). CodeMirror's contenteditable content does not
  // satisfy the rule, so the scroller (view.scrollDOM === .cm-scroller) must be
  // in the tab order itself. It persists across setState, so set it once here.
  view.scrollDOM.setAttribute('tabindex', '0')
  states.set(activeId.value, view.state)
})

// Switch files: save the outgoing state (keeps undo/cursor), show the incoming.
watch(activeId, (id, prevId) => {
  if (view && prevId) states.set(prevId, view.state)
  showFile(id)
})

// External content change for the active file → replace the doc in place.
// IMPORTANT: this watcher MUST stay registered AFTER the activeId watcher above.
// The activeId watcher calls showFile which swaps the view state on file switch,
// making the readFile watcher a no-op on switch. If the order were reversed the
// readFile watcher would fire first on switch and corrupt the incoming state.
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
    id="editor-tabpanel"
    role="tabpanel"
    :aria-labelledby="`tab-${activeFile.id}`"
    class="h-full w-full overflow-hidden"
  />
</template>
