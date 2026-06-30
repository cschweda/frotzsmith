# Frotzsmith — Play Transcript (capture the player's commands) + Test Script rename

**Date:** 2026-06-30
**Status:** Design approved; implementation pending plan
**Builds on:** the Phase 4 Test Scripts work ([`2026-06-29-transcript-design.md`](./2026-06-29-transcript-design.md)), PlayPanel's Parchment iframe (`/play/index.html`), ADR-008 / 010 / 011.

## 1. Context & problem

The right pane has a **Transcript** tab that is really the *test-script runner*: an editable CodeMirror script you **Run** headlessly to read a per-turn playthrough. Nothing records what a human *actually typed* while playing interactively.

Interactive Play runs in a same-origin Parchment `<iframe>` (`PlayPanel.vue` → `/play/index.html?story=<blobUrl>`). The author wants, while hand-testing, a **real transcript** — a read-only log of every command issued this session — plus a one-click way to turn that log into a reusable **Test Script**.

This is naming + command capture, not a new engine. The headless `StoryEngine` / `replay()` seam is untouched.

## 2. Decisions (locked)

- **D1 — Rename, don't merge.** The existing editable runner tab becomes **Test Script** (id `testscript`, file `TestScriptPanel.vue`). A new read-only **Transcript** tab (id `transcript`, file `TranscriptPanel.vue`) shows the captured commands. Two distinct tabs.
- **D2 — Capture via `postMessage` from the play page; commands only.** A tiny vanilla script in `public/play/index.html` (we own it — `web/main.js` is vendored Parchment) watches GlkOte line input and posts each command to the parent. No game-output scraping (locked: player commands only).
- **D3 — Play stays mounted (`v-show`).** Today, leaving the Play tab restarts the game (the iframe unmounts). Keep it mounted so the live game **and** the transcript survive tab-switches; the transcript resets only on an explicit new **Play** or **Clear**.
- **D4 — Copy is non-destructive.** "Copy to Test Script" creates a **new** `Playthrough N` script (never overwrites the active one) and switches to the Test Script tab.
- **D5 — Drop the toolbar "Ready" text.** The Results tab's red/green dot already signals readiness; remove the status `<span>` to free room for a future button. (The **Results tab stays.**)

## 3. Architecture

### 3.1 Capture — `public/play/index.html`

GlkOte builds line input as `<input class="… Input LineInput">` and char input (key prompts) as `… CharInput` (confirmed in the vendored `web/main.js`). A small inline `<script>` captures only line input:

```js
// Report each typed command up to the IDE shell (same-origin parent).
window.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return
  var el = e.target
  if (!el || el.tagName !== 'INPUT' || !el.classList.contains('LineInput')) return
  var v = (el.value || '').trim()
  if (v) parent.postMessage({ source: 'frotzsmith-play', type: 'command', value: v }, location.origin)
}, true) // capture phase: read the value before GlkOte clears the field
// New game booted → tell the parent to start a fresh transcript.
parent.postMessage({ source: 'frotzsmith-play', type: 'session-start' }, location.origin)
```

Capture-phase `keydown` Enter reads the value before GlkOte consumes it. `CharInput` ("press a key", `[MORE]`) has no `LineInput` element → naturally excluded. `targetOrigin = location.origin` (the page is served same-origin).

### 3.2 Parent listener — `PlayPanel.vue`

PlayPanel owns the iframe, so it owns the listener. On mount add a `window` `message` handler; on unmount remove it. **Trust boundary:** ignore a message unless `event.origin === window.location.origin` **and** `event.data?.source === 'frotzsmith-play'`. Then:

- `type:'command'` → `record(value)`
- `type:'session-start'` → `reset()`

With Play kept mounted (D3), the iframe reloads only on an explicit new Play, so `session-start` fires exactly when a fresh game begins.

### 3.3 State — `usePlayTranscript` (+ pure `play-transcript.ts`, ADR-008)

A single-purpose capture store, mirroring the `project-files.ts` / `useProjectFiles` split:

```ts
// app/composables/play-transcript.ts (pure, Node-tested)
export function appendCommand(list: string[], cmd: string): string[] // trim; ignore empty; append (immutably)
export function toScriptText(commands: string[]): string             // one command per line
export function nextPlaythroughName(existing: string[]): string      // "Playthrough N", no collision

// app/composables/usePlayTranscript.ts (client state)
function usePlayTranscript(): {
  commands: Ref<string[]>          // useState('frotz:play-commands')
  count: ComputedRef<number>
  text: ComputedRef<string>        // toScriptText(commands)
  record(cmd: string): void        // commands = appendCommand(commands.value, cmd)
  reset(): void                    // commands = []
}
```

The transcript is **session/in-memory** (`useState`), **not** persisted — it mirrors the current live game. Persistence happens only when the player copies it into a Test Script.

### 3.4 Copy to Test Script — `useTestScripts.addFromText`

One new method, mirroring `add()`:

```ts
function addFromText(name: string, text: string): void // new TestScript {id,name,text}; select; persist
```

The Transcript tab's **Copy to Test Script** orchestrates (the component already has both composables):
`addFromText(nextPlaythroughName(scripts.map(s => s.name)), toScriptText(commands))`, then `activeTab = 'testscript'`. Keeping the orchestration in the component leaves `usePlayTranscript` single-purpose.

### 3.5 UI — `app/components/ide/`

**`RightPaneTabs.vue`**
- `tabs`: **Results · Play · Transcript · Test Script** (the disabled Map tooltip is unchanged). Transcript icon `i-lucide-history`; Test Script keeps `i-lucide-scroll-text`.
- **Remove** the `Ready/Not ready/Compiling…` status `<span>` and the now-unused `statusMeta` computed (D5). Compile/Play stay right-aligned.
- Panel area: `ResultsPanel v-if results` · `PlayPanel v-show play` (kept mounted) · `TranscriptPanel v-if transcript` · `TestScriptPanel v-if testscript`.

**`TestScriptPanel.vue`** — the existing runner, **renamed** from `TranscriptPanel.vue` (behavior unchanged: script bar, CM6 editor, headless Run/Cancel, transcript-of-the-run output).

**`TranscriptPanel.vue`** (new, read-only)
- Header: command count + **Copy to Test Script** + **Clear** (both disabled when empty).
- Body: a numbered, read-only `> command` list, monospace. Empty state: "Play your game — the commands you type appear here."
- a11y: labelled `role="region"`, focusable; labelled buttons.

**`useIde.ts`** — `RightTab = 'results' | 'play' | 'transcript' | 'testscript'`. Default tab unchanged (`results`); `runCompile` / `loadSample` / `loadSource` / `newProject` still focus `results`.

**`useTranscript.ts`** — `run()` focuses `activeTab = 'testscript'` (was `'transcript'`). (Name kept; it drives the Test Script tab's headless run.)

## 4. Data flow

Play (iframe boots → posts `session-start` → parent `reset()`) → player types a command + Enter → play page posts `{type:'command', value}` → PlayPanel validates origin + source → `record()` → `commands` grows → **Transcript** tab renders the list → **Copy to Test Script** → new `Playthrough N` script + switch to **Test Script** tab → (optionally) **Run** via the existing headless replay.

## 5. Error handling / edge cases

- **Untrusted messages** — dropped unless `event.origin` + `event.data.source` match (§3.2). The captured value is data, never executed; it only appends to a list and (on explicit user action) becomes script text.
- **Empty / whitespace command** — ignored (`appendCommand` trims & skips). Char-input prompts never reach capture.
- **No commands yet** — Copy/Clear disabled; empty-state hint shown.
- **Repeated commands** (`wait`, `wait`) — kept verbatim (legitimate); no dedupe.
- **`session-start` race** — PlayPanel mounts (and attaches the listener) before it ever sets the iframe `src`, so the listener is ready when the page loads; a missed reset self-heals on the next new Play.

## 6. Testing (vitest, Node)

- **`play-transcript.ts`** — `appendCommand` (trim, skip-empty, append, immutability); `toScriptText` (one per line); `nextPlaythroughName` (first = "Playthrough 1", skips existing names, no collision).
- **`useTestScripts.addFromText`** — creates, selects, persists (extend `test-scripts.test.ts` for any new pure helper; otherwise a focused composable test).
- Capture is DOM/iframe glue, exercised by the live browser check (matches the repo's worker/iframe convention), not unit tests.

## 7. Accessibility

The Transcript is a labelled, focusable `role="region"`; the command list is an ordered list; Copy/Clear are labelled buttons. Removing the toolbar status `<span>` drops one `aria-live` announcer, but compile state is still announced via the Results panel (`aria-live="polite"`, auto-focused on compile) and the Compile button's own `:loading` spinner. axe-core clean (repo baseline).

## 8. Out of scope (v1)

Game-output in the transcript (commands only, locked); persisting the transcript across reloads; multi-session history; in-place editing of the transcript; capturing from anything but the Parchment line input. The headless `StoryEngine` / `replay()` seam is untouched.

## 9. Risks

- **GlkOte selector drift** — capture keys on `input.LineInput`, confirmed in the current vendored bundle. If Parchment is re-vendored with different markup, capture silently stops; the live browser check catches it. (Low — the bundle is pinned.)
- **`v-show` for Play** — keeping the interpreter mounted in the background is idle (waiting for input, negligible cost), but verify fullscreen + theme still behave and that a hidden iframe doesn't steal focus. Validate in the browser.

## 10. Done =

Compile + **Play**, type several commands by hand → the **Transcript** tab shows them as a read-only numbered list → **Copy to Test Script** creates a `Playthrough N` script and switches to the **Test Script** tab, where it Runs unchanged. Switching tabs no longer restarts the game. The toolbar no longer shows the "Ready" text; the Results dot still signals readiness.
