<script setup lang="ts">
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine, drawSelection, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const { activeScript, activeId, updateText } = useTestScripts()
const colorMode = useColorMode()

const host = ref<HTMLElement | null>(null)
const themeComp = new Compartment()
let view: EditorView | null = null
const isDark = () => colorMode.value === 'dark'

// A script is a command list; only `!` lines are special (comments, like I6).
const scriptLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.peek() === '!') {
      stream.skipToEnd()
      return 'comment'
    }
    stream.skipToEnd()
    return null
  },
})
const commentHighlight = syntaxHighlighting(
  HighlightStyle.define([{ tag: tags.comment, fontStyle: 'italic', opacity: '0.6' }]),
)

function theme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { fontSize: '13px', height: '100%' },
      '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      '.cm-scroller': { overflow: 'auto' },
    },
    { dark },
  )
}

function makeState(text: string): EditorState {
  const exts: Extension[] = [
    history(),
    highlightActiveLine(),
    drawSelection(),
    EditorView.lineWrapping,
    scriptLanguage,
    commentHighlight,
    placeholder('north. examine lamp. take lamp. inventory…'),
    EditorView.contentAttributes.of({ 'aria-label': 'Test script commands' }),
    themeComp.of(theme(isDark())),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of(u => {
      if (u.docChanged && activeScript.value) updateText(activeScript.value.id, u.state.doc.toString())
    }),
  ]
  return EditorState.create({ doc: text, extensions: exts })
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({ parent: host.value, state: makeState(activeScript.value?.text ?? '') })
  // Keyboard-focusable scroll region (WCAG 2.1.1 / axe scrollable-region-focusable),
  // as in SourcePane — CodeMirror's contenteditable does not satisfy the rule.
  view.scrollDOM.setAttribute('tabindex', '0')
})

// Switch scripts → load the new doc. (Per-script undo resets on switch — fine for v1.)
watch(activeId, () => {
  if (view) view.setState(makeState(activeScript.value?.text ?? ''))
})

// Dark/light swap without tearing down the editor.
watch(
  () => colorMode.value,
  () => view?.dispatch({ effects: themeComp.reconfigure(theme(isDark())) }),
)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" class="h-full w-full overflow-hidden" />
</template>
