# Beta testing notes

Thanks for kicking the tires. Frotzsmith is a browser-based IDE for **Inform 6**
(beta) and **ZIL** (alpha) — write, compile to a Z-machine story file entirely
client-side, play it inline, and replay test scripts. Nothing you write leaves
your browser.

## How to report

Use the **bug icon** in the toolbar (top right), or go straight to
[GitHub issues](https://github.com/cschweda/frotzsmith/issues). Most useful
report: what you did, what you expected, what happened instead, your
browser/OS — and the source that triggered it, if you can share it.

## Known limitations (by design, for now)

- **Single-file projects.** One source buffer plus extensions; multi-file
  projects are on the roadmap.
- **Z-machine targets only** (z3/z4/z5/z8). No Glulx yet.
- **Export is the raw story file or a one-file playable HTML** (Results →
  "Export playable HTML" — works offline, uploads cleanly to itch.io). Hosted
  publishing is deliberately deferred.
- **Your work lives in this browser's localStorage.** Crash-recovery autosave
  is on, but clearing site data clears your source — use **Save As** for
  anything you care about. If storage fills up, the app warns you once and
  keeps working in memory.
- **First load takes a few seconds** — the entire toolchain is client-side.
  The ZIL page additionally downloads a ~9 MB .NET compiler bundle in the
  background (skipped automatically on Data Saver / very slow connections).
- **Best tested in Chromium.** Firefox and Safari should work (workers have a
  main-thread fallback), but they see less testing — reports from either are
  extra valuable.

## Good things to try

Compile-and-play a sample from **Source Samples** (both libraries), watch the
auto-map draw as you explore, capture a playthrough in the Transcript and turn
it into a Test Script, replay it headlessly, use **Send to Play** to run a
script inside the live game — and try **the Skein**: play a few commands,
run + bless the thread in the Skein tab, then change your source, recompile,
and watch the changed outputs flag red.
