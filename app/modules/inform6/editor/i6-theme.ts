import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { tags as t } from '@lezer/highlight'

// Two palettes, both checked for WCAG AA contrast against the editor surface.
// The amber accent echoes the app's "frotz-glow" identity (keywords, caret).

const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#8b919e', fontStyle: 'italic' },
  { tag: t.string, color: '#7ee787' },
  { tag: t.number, color: '#f0a830' },
  { tag: t.keyword, color: '#ffb454', fontWeight: '600' },
  { tag: t.atom, color: '#79c0ff' },
  { tag: t.operator, color: '#ff7b72' },
  { tag: t.variableName, color: '#e6edf3' },
])

const lightHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: t.string, color: '#0a7d33' },
  { tag: t.number, color: '#9a5b00' },
  { tag: t.keyword, color: '#a64d00', fontWeight: '600' },
  { tag: t.atom, color: '#0550ae' },
  { tag: t.operator, color: '#cf222e' },
  { tag: t.variableName, color: '#1f2328' },
])

function chrome(dark: boolean) {
  return EditorView.theme(
    {
      '&': { backgroundColor: 'transparent', color: dark ? '#e6edf3' : '#1f2328', height: '100%' },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
        fontSize: '14px',
        lineHeight: '1.6',
      },
      '.cm-content': { caretColor: '#f0a830' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#f0a830', borderLeftWidth: '2px' },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        color: dark ? '#8b949e' : '#5d646d',
      },
      '.cm-activeLine': {
        backgroundColor: dark ? 'rgba(240,168,48,0.07)' : 'rgba(240,168,48,0.12)',
      },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: dark ? '#adbac7' : '#57606a' },
      '&.cm-focused': { outline: 'none' },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: dark ? 'rgba(240,168,48,0.25)' : 'rgba(240,168,48,0.30)',
      },
    },
    { dark },
  )
}

/** Editor chrome + syntax colors for the given color mode. */
export function i6Theme(dark: boolean): Extension {
  return [chrome(dark), syntaxHighlighting(dark ? darkHighlight : lightHighlight)]
}
