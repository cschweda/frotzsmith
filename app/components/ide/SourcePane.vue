<script setup lang="ts">
import { EditorState, Compartment } from '@codemirror/state'
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

const { source, jumpSignal, runCompile } = useIde()
const colorMode = useColorMode()

const host = ref<HTMLElement | null>(null)
const themeComp = new Compartment()
let view: EditorView | null = null

const isDark = () => colorMode.value === 'dark'

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: source.value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        bracketMatching(),
        indentOnInput(),
        EditorView.lineWrapping,
        inform6(),
        i6Lint(),
        themeComp.of(i6Theme(isDark())),
        keymap.of([
          { key: 'Mod-b', preventDefault: true, run: () => (runCompile(), true) },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of(u => {
          if (u.docChanged) source.value = u.state.doc.toString()
        }),
      ],
    }),
  })
})

// External source changes (recovery restore, etc.) → sync into the editor.
watch(source, val => {
  if (view && val !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: val } })
  }
})

// Dark/light swap without tearing down the editor.
watch(() => colorMode.value, () => {
  view?.dispatch({ effects: themeComp.reconfigure(i6Theme(isDark())) })
})

// Cursor jump requested by a clicked results row.
watch(jumpSignal, sig => {
  if (!sig || !view) return
  const lineNo = Math.min(Math.max(sig.line, 1), view.state.doc.lines)
  const line = view.state.doc.line(lineNo)
  view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
  view.focus()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" class="h-full w-full overflow-hidden" aria-label="Inform 6 source editor" />
</template>
