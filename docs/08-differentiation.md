# Frotzsmith — Differentiation

**Document 08 of 13 · Differentiation**

What already exists, and why Frotzsmith occupies an empty seat at the table.

---

## 1. The landscape

| Tool | What it is | What it doesn't do (that Frotzsmith does) |
|------|-----------|----------------------------------------|
| **Inform 7 IDE** (desktop, Electron) | Full IDE for **Inform 7**: write, compile, play, Index, Skein/transcript testing. | It's I7, not I6 — the natural-language layer, not the author's preferred low-level language. Desktop install, not browser. |
| **Parchment / iplayif** | Browser **interpreter** for finished story files. | Doesn't compile. You bring a `.z8`; it plays it. No editor, no error round-trip, no library, no scripts. |
| **Quixe / ZVM / Emglken** | Browser VM cores. | Building blocks, not an authoring environment. |
| **Desktop `inform6` CLI** | The actual compiler. | Command-line; no editor, no inline play, no error-to-cursor, no bundling, no scripts. You wire your own loop. |
| **Borogove.io** | Browser multi-language IF IDE (supports I6 among others). | The closest comparison — but general-purpose and account/cloud-oriented. Frotzsmith is purpose-built for I6, profile-driven (std **and** PunyInform first-class), fully static/offline-capable, no account, with a power-user script→transcript spine designed to grow into a real Skein, and house-style WCAG AA. |
| **PunyInform tooling** | Library + desktop compile instructions. | No dedicated browser IDE that treats PunyInform as a first-class profile with its own includes/defaults/keywords/template. |

## 2. The specific gap Frotzsmith fills

There is no clean, modern, **browser-native** place to **write Inform 6, compile it client-side, and immediately play it**, with:
1. **Library auto-import** so a plain `.inf` "just works" — no path wrangling.
2. **First-class profiles** for both the **Standard Library** and **PunyInform** (a replacement library, not a superset) — switchable per project.
3. **The I7-IDE working rhythm** (two panes, clickable problems, compile→play) but for I6.
4. **Power-user test scripts** (arbitrarily long command lists → transcript) as the linear spine of a future branching Skein with blessed-output regression diffing.
5. **Self-contained offline export** — the exact Parchment runtime you tested, embedded in one shareable `.html`.
6. **Zero backend, zero account, deploy-anywhere static**, WCAG 2.1 AA.

Borogove is the nearest neighbor and is excellent; Frotzsmith differs by being I6-focused, profile-driven, fully offline/static, account-free, and built around the script→Skein testing spine — a sharper tool for one author's actual workflow rather than a general playground.

## 3. Why "personal-first" is a feature, not a hedge

The author writes I6 with the standard library, targets the Z-machine, and tests by replaying long command lists. Frotzsmith optimizes that exact loop to feel effortless, then generalizes (Glulx, PunyInform, Skein) without diluting the spine. A tool built to delight its primary user tends to be better than one built to satisfy an imagined average — and this one's primary user has 45 years of coding, an IF design portfolio, and strong opinions about I6.

## 4. The Skein angle (future, but differentiating)

The I7 IDE's Skein + blessed-transcript regression testing is one of the best things about authoring IF — and it doesn't exist for I6 in the browser. Frotzsmith's Phase 4 ships the linear spine (script → transcript); the architecture (`replay()` over `StoryEngine`, shared output normalization) is laid so the **full branching Skein with blessed-output diffing** drops in later without a refactor. When it lands, Frotzsmith will offer something no I6 browser tool does: I7-grade regression testing for Inform 6 (Z-machine now; Glulx-ready via the same seam when the engine is added — ADR-002).

## 5. Open-source philosophy

A personal project, MIT-licensed under the author's own name: accessibility-gated, no expensive commercial dependency, free and offline. Consistent with the author's broader approach to tooling — open, self-hosted, no lock-in — but unaffiliated with any employer or organization.
