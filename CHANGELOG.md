# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.6] - 2026-11-08

### Changed
- `@frotzinc/nuxt-base` 0.3.2: a report that is sent says so plainly ("Report sent"), with a toast and in the dialog, so you know it went through.

## [0.2.5] - 2026-11-08

### Changed
- **The family top bar.** frotzsmith's header is now the one frotzlens, frotzplay and frotztrace share (`@frotzinc/nuxt-base` 0.3.0's `AppHeader`): the amber hammer tile and the name on the left, the IDE's controls (Inform 6 / ZIL, Prettify, Source Samples, the library and the target) in the middle, and the **About** menu and the colour-mode switch on the right. It runs full width and wraps onto a second row when the controls don't fit; below 1280px the library button shows its icon only. The Technical Details page has the same header.
- **The family About menu.** About frotzsmith (every version and the licences), What's new (this changelog), Report a problem, Suggest a feature, Check for updates and Source on GitHub, as in the other apps. Check for updates still goes through frotzsmith's own service-worker check, and now says what it found. The status bar's **About · v…** opens the same About dialog. The toolbar's bug button is gone: Report a problem replaces it.
- **Reports by email.** Report a problem and Suggest a feature can **Send** what you wrote (with an optional reply address) through a small Netlify Function (`netlify/functions/report.mjs`, Resend), as well as open it as a GitHub issue. The desktop app offers GitHub only.

### Added
- `public/logo.svg`, the 512px family tile with the social card's hammer.
- `.github/ISSUE_TEMPLATE/` (`bug.yml`, `idea.yml`), which the report form fills in, and `SECURITY.md`, which it links.

### Removed
- `AboutModal.vue`: the family About dialog replaces it.

### CI
- CI also runs on pushes to `staging`, where changes now land first: Netlify deploys `staging` as a free branch deploy, and only staging → main is a production deploy.

## [0.2.4] - 2026-11-08

### Changed
- `@frotzinc/nuxt-base` 0.1.0 → 0.2.1 and Nuxt 4.6.3 → 4.6.4, the versions frotzlens and frotzplay use, so frotzsmith shares the family's current palette (including the quieter `--frotz-ink-muted` and the `.high-contrast` theme) with the other frotz, Inc. apps. The IDE keeps its own header and About dialog; nuxt-base 0.2's shared header and footer are available but not used here.

## [0.2.3] - 2026-11-08

### Changed
- The demo game's title is **frotzsmith demo**, lower case (it was FROTZSMITH DEMO). That's its banner, the Play tab's title, the solution file's heading and an exported folder's README.txt heading. `public/play/demo.z5` is rebuilt from it.

## [0.2.2] - 2026-11-08

### Added
- **Export folder (.zip)**, beside *Export playable HTML* on the Results tab. It downloads `<story>.zip` with a folder inside: `index.html`, `boot.js`, `frotzplay.js`, `frotzplay.css`, `story.js`, `story.<ext>` and a `README.txt`. Upload the folder to itch.io as an HTML game or to any static host; `index.html` also plays from a double-click. It is always in frotzplay (Parchment has no folder build). Made in the browser from `@frotzinc/player`'s `bundleFolder()` and `zip()`; nothing is uploaded.

### Changed
- The README says the game plays in frotzplay (or Parchment) and lists the folder export.

## [0.2.1] - 2026-11-08

### Changed
- **The family's names are lower case everywhere:** frotzsmith, frotzlens, frotzplay, and frotz, Inc. That covers the pages, titles, meta tags, the og:image (re-rendered; otherwise the same), the About dialog, the samples' banners, the README, the docs and this changelog. Frotz the interpreter keeps its own name. Code identifiers and the vendored player files are unchanged.
- `public/play/demo.z5` is rebuilt from today's `demo.inf`, so the demo welcomes you to the frotzsmith demo. The old build was from June, from an earlier source.
- `@frotzinc/player` 0.2.1 and `@frotzinc/inform6-wasm` 0.1.1: the same code as before, with their npm READMEs in lower case.

## [0.2.0] - 2026-11-07

### Changed — frotzplay is the player
- **Play runs in [frotzplay](https://frotzplay.frotzinc.com)**, the frotz, Inc. family's accessible Z-machine player (`@frotzinc/player` 0.2.0), in the page, with no iframe. Its interpreter matches ZVM (the replay engine) turn for turn on frotzplay's own test walkthroughs, and it announces each turn to screen readers, and has keyboard shortcuts, high contrast, OpenDyslexic, undo, saves and transcript downloads. It follows the IDE's light and dark.
- **Parchment is still there:** *Switch to Parchment* in the bar above the game (or *Play in* before pressing Play) starts the game again in Parchment, and the choice is remembered in this browser. It's kept while frotzplay settles in; the plan to retire it is in frotzlens's [docs/16](https://github.com/cschweda/frotzlens/blob/main/docs/16-frotzsmith-on-frotzplay.md).
- **The transcript, auto-map, Skein and solution recorder work the same in both players.** Both report through one place (`usePlaySink`). frotzplay reports from its own events (its turns, its status line, its start), not by reading the screen.
- **Send to Play** types through frotzplay's `send()` and presses through "press a key" prompts; it says where it stopped, as before. Sent commands stay out of the typed transcript, as with Parchment.
- **Export playable HTML** makes frotzplay's single file when frotzplay is the player: about 150 KB plus the story, under its own strict Content-Security-Policy, branded, and it plays from a double-click. With Parchment chosen, the export is Parchment's as before.
- frotzplay's OpenDyslexic fonts are served at `/frotzplay-fonts/`, outside the offline precache (fetched only when chosen).

## [0.1.0] - 2026-11-07

> Working alpha — the core IDE compiles and plays **Inform 6** and **ZIL** entirely in the browser.

### Changed — 2026-11-07 New primary domain
- **frotzsmith now lives at [frotzsmith.frotzinc.com](https://frotzsmith.frotzinc.com).**
  The old `frotzsmith.com` (apex and `www`) 301s there, path kept
  (`public/_redirects`, ahead of Nitro's catch-all; pinned by
  `tools/redirects.test.ts`). `siteUrl` in `frotzsmith.config.ts` moves with
  it, so canonical and og:url links name the new domain.
- **Plausible tracker re-vendored** for the new `frotzsmith.frotzinc.com` site
  (`pa--Fyc-nN5t3vIahe6DaC7v.js`); diffed against the reviewed copy, only the
  baked-in domain changed. Checksums updated in `tools/vendored-files.json`.
- **Returning visitors of frotzsmith.com reach the new domain too.** Their
  installed service worker served pages from cache, so the 301 never ran, and
  its update failed on the cross-origin redirect of `sw.js`. The old domain now
  serves `sw.js` as `public/sw-retire.js`, which clears the caches, unregisters
  and reloads the tab into the 301.

### Added — 2026-11-06 frotz, Inc.
- **frotz, Inc. links.** A "frotz, Inc." link in the status bar and a line in
  **About** point to [frotzinc.com](https://frotzinc.com), the landing page for
  the frotz family (frotzsmith, [frotzlens](https://frotzlens.frotzinc.com), and what comes
  next). The URL is one value, `familyUrl`, in `frotzsmith.config.ts`.

### Added — 2026-11-05 Mingus II
- **New longer sample: Mingus II: Everything Rolls Downhill** (Inform 6
  and ZIL, both z5), the sequel to Mingus I. A funeral ship floats down the Verdance
  through five landings: 20 rooms, 10 puzzles and five names to keep, 100
  points. It teaches how to code an NPC: Lucan Fairweather, the Thursday
  tenor, follows you, leads you to the one thing you'll need, talks, reacts
  to what you give and show him, and dies in a scripted event on a timer.
  Sandwich, the front-runner, and Mrs. Thrumble show two more NPC patterns.
  It also shows a vehicle made of fixed rooms and one variable, and a
  current that gives you exactly one turn to act. Its walkthrough is in the
  Solution tab, and a golden test plays it to the win.
- **Mingus II in ZIL** (`zil-mingus-2`): the same game written natively for
  zillib, in one file. It has the same rooms, puzzles, score and timings,
  and it wins with the same 74-command walkthrough. Its NPC section explains
  each technique in ZIL terms: following and leading from one end-of-turn
  interrupt, the ASK/TELL topic table and its fallback, the greeting,
  GIVE/SHOW, the state machine, the scripted timer, and what stays after
  Lucan dies. INVENTORY takes a turn here, as it does in Inform.

### Changed — 2026-11-05 Mingus I
- **Mingus I's empire now has a name:** the Mingan Ascendancy, in both the Inform 6 and ZIL samples and in the lore.
- **Mingus I's tagline is now "a fall from great heights, in three acts"** — no "crypto". The in-game banner and the Samples dropdown description use the same wording, in both languages.

### Added — 2026-11-05 Solutions
- **Every game can have a solution:** the game told as it plays — the
  opening, then each `> command` and the game's full reply — made by
  replaying the commands headlessly. The new **Solution** tab keeps it hidden
  until you press **Show solution** (it's a complete spoiler), and offers
  Regenerate, Copy, Download, Load file and Clear; bundled samples come with
  theirs.
- **Record a solution by playing.** Record restarts the game and captures
  what you type; Pause saves so far and lets you edit, Resume and Continue
  recording carry on from where the solution ends, Stop saves. While you
  play on the right, **`solution.txt` opens in the left pane** — live and
  read-only while recording, editable when paused or stopped.
- **`.frotzsmith` projects carry the solution** as `solution.txt` (text
  only; it never runs). Opening a project with one says so, replaces the
  game's solution, and asks first when that game already has a different one.

### Fixed — 2026-11-05 a sample's solution never fails silently
- The Solution tab could show a sample's heading and buttons with no text
  and no word of why — e.g. after Show solution on the Inform 6 Mingus I,
  the ZIL Mingus I (same title) opened already "shown" but never made. A
  language switch now brings the spoiler guard back; the same sample picked
  again keeps (or, mid-compile, remakes) its solution; two Show solution
  clicks share one compile; and any other outcome is a plain sentence with
  **Try again**. While it works, the tab says so — for ZIL, that the first
  compile can take up to a minute.

### Fixed — 2026-11-05 samples
Every bundled sample now compiles with no errors or warnings and plays
through its walkthrough without a hitch (a golden test per language checks
both).
- **Two compile errors:** The Locked Chest (both libraries) used an em dash,
  which isn't in the Z-machine's default character set; it is now `--`.
- **Three warnings:** Magic 8-Ball (both libraries) named itself `'8'`, a
  character rather than a dictionary word; it is now `'8//'`. The PunyInform
  Haunted House defined a DeathMessage that PunyInform never called; it is
  gone.
- **ZIL samples play as described.** The Dark Cellar's opening look no
  longer calls the pitch-black cellar lit. One WAIT in The Burning Candle is
  now one turn, not four, so its hint is right. The Locked Chest says "an
  iron key" and "a ruby jewel", and stops mentioning the key once you've
  taken it.
- **Haunted House knife (both libraries).** Examining or pushing the knife
  is deadly only while it floats; once you hold it, it is an ordinary
  knife. A knife dropped in another room can be picked up again (before,
  the game could no longer be won).
- **Haunted House XYZZY** works only in the first room, as PLUGH does
  there; elsewhere XYZZY and SAY XYZZY both say "Nice try.". The GO
  `<room>` and ZAP `<room>` cheat verbs are kept, and a comment now says
  what they do and that a game normally removes them before release.
- **The Architect's Legacy (Inform 6)** answers EMPTY on the wastebasket and
  CLIMB on the floor panel, as the ZIL version does.
- **Smaller fixes:** Two Rooms' hint takes the lamp before going north, the
  Custom Grammar hint names its real verbs (INCANT, INVOKE), and the texts
  read "an old hermit" and "There is a bucket of water here".
- **Every sample explains itself.** Each one opens with what it teaches and
  how the game flows, and the rooms, objects and routines carry plain
  comments for someone new to the language.

### Added — 2026-11-05 Mingus I: Elevated Returns (Inform 6 and ZIL samples)
- **A second longer sample game, in both languages.** *Mingus I: Elevated
  Returns* is a fall from great heights, in three acts: 20 rooms, 10 puzzles and 5 lore
  points, 60 in all. It ships as an Inform 6 sample and as a ZIL sample
  (zillib, one file), both targeting z5 and loading exactly as written. The
  two are the same game: the same rooms, puzzles and score, the same
  outcome for the same command (only the two libraries' stock messages are
  worded differently) and one shared walkthrough, each written in its own
  language's idiom and commented for a newcomer. Where The Architect's Legacy shows how
  a big game is organised, Mingus shows how to make a timed, deadly rule
  fair: on the Runout, every turn without your pike raised costs a poke, the
  third poke kills you (taking treasure costs one more on the spot), and the
  counter is printed every turn. A golden test for each version compiles it
  with no errors or warnings, wins with the shared walkthrough at 60 of 60,
  and checks the finale's timing the same way in both: which turns cost a
  poke, the escorts, the parting of the crowd and the final rank.

### Added — 2026-11-04 Multi-file ZIL projects
- **A ZIL project can be several `.zil` files.** The main file pulls the
  others in with `<INSERT-FILE "rooms">`, and the browser compiles them
  together exactly as ZILF would on disk (names match ignoring case and are
  looked up in the main file's folder, then the project's top folder, then
  the ZIL library; line numbers in the main file are exact). Extra files show in the file
  explorer, open in their own tabs, and an error in one opens that file.
- **`.frotzsmith` projects carry all of a ZIL project's `.zil` files**, at
  their own paths, and opening one brings them back (the open names them;
  nothing compiles until you do). In older ZIL projects, the extra `.zil`
  files now open as source files. An older project whose extra `.zil` isn't
  valid text, or that breaks the limits below, is now refused. A project with
  more than 100 extra files, one over 1 MB, or 4 MB in all is refused whole.
- **Share links say what they leave out.** A link carries only the main
  file; when a ZIL project has other files, the "Share link copied" message
  says so and points to Download project.

### Security — 2026-11-04 .frotzsmith hardening (red/blue audit)
- **A project can no longer replace a library file.** An include named like a
  Standard Library or PunyInform file (`VerbLib.h`, `Parser.h`, `puny.h`, …,
  any case) refuses the whole project; uploading such a file yourself is
  refused with a clear message (choosing to replace a library file isn't
  offered yet); and the compiler now writes the library after your
  extensions, so the library always wins. A library-named extension you
  uploaded earlier is kept in your browser but no longer used, and you're
  told so once. Opening a project that adds or turns on any extension always
  asks first and names each one.
- **Skeins are rebuilt on every load** (project, `.skein` import, browser
  storage), keeping only the fields frotzsmith knows; node ids are checked.
  A booby-trapped Skein can no longer crash the panel, replay a different
  command from the one shown, or stop you downloading your project.
- **Stricter project files.** Archive comments, Unicode Comment fields and
  Unicode Path fields that give a file a second name (one that only repeats
  the name, as Linux `zip` writes, is fine), links and special files from any host, a file that is also a
  folder, data after a compressed stream, Windows device names (`CON`,
  `nul.txt`, …), names Windows or macOS can't hold, and invisible or
  look-alike characters are all refused; names that differ only by case or
  compatibility form (`ẞ`/`ß`/`ss`, `ﬀ`/`ff`) count as the same. A download
  always reopens: names frotzsmith makes up avoid device names (a test called
  "Con" is saved as `tests/con_.txt`), and files kept from before these rules
  whose names a project can no longer hold are left out of the download —
  kept in your browser, never deleted — and the download message names them,
  along with any extension saved under a new name (update its Include line).
- **Safer messages.** File names in messages are cleaned of invisible and
  layout-changing characters (emoji such as 👩‍💻 stay whole), shortened, and quoted; hidden files a project
  carries are named when you open and download it.
- **Limits.** At most 200 test scripts and 1 MB of script text per project; a
  `.skein` import is capped at 8 MB and asks before replacing a Skein; opening
  a plain source file asks before replacing edited source.
- A game titled "Constructor" (or similar) no longer breaks its test scripts.

### Security — 2026-11-04 interpreter, analytics and deployment (red/blue audit)
- **A game can no longer run JavaScript through the Z-machine interpreter.**
  A story whose custom character table used one particular private character
  could break out of the interpreter's generated code and run script with the
  IDE's own access (shown with a story compiled by frotzsmith's own compiler).
  Both interpreters — Play and the headless test runner — are fixed, and the
  build now checks the fix every time — and fails if the fix was never
  applied; the development server's test runner is fixed too.
- **A game from a project file, an opened source file or a shared link doesn't run until you say so.**
  Skein auto-run waits on the first Compile of such a game, with a one-line
  note in the Skein panel; pressing Play or Run once (or loading a sample or a
  new project) lets it auto-run as usual. This lasts until you do, even across
  a reload, and is kept per language (so is the note).
- **Analytics script is a reviewed copy** served from frotzsmith itself instead
  of a live pass-through of the analytics provider's script; the desktop
  build has no analytics at all.
- **Tighter Content Security Policy:** `blob:` can no longer be used as a
  script, worker or frame source, and a test pins every security header.
- **Supply chain:** checksums and sources recorded for every vendored file
  (player, jQuery, analytics); CI's GitHub Actions pinned by commit; the
  Netlify build installs exactly the locked dependency versions, including
  Netlify's own automatic install that runs before the build.
- **Smaller fixes:** the Play page only accepts a story created by this site
  (not merely any `blob:` link); a project whose file headers claim encryption
  only locally is refused; a room called "constructor" (or similar) no longer
  breaks the Map; new tests for the message, iframe and encryption checks.

### Added — 2026-11-04 .frotzsmith projects
- **Download project / Open project.** The toolbar's **Download project** saves
  the whole project — source, uploaded includes, test scripts and the Skein —
  as one `.frotzsmith` file (a ZIP with a readable `frotzsmith.json`
  manifest; compiled stories are never included). **Open** now accepts
  `.frotzsmith` too. If the editor holds work, you are asked "Replace the
  project in the editor?" first; **Cancel** changes nothing. Opening only
  loads text — nothing compiles, plays or runs.
- Files the editor has no place for (extra files, unknown manifest fields)
  are kept and written back on the next download, so open, edit, download
  loses nothing — as long as you stay in the opened project. They are tied
  to that project: loading another source (another file, a sample, New), or
  editing the title so the game changes and reloading, drops them from the
  next download, and so does a browser without IndexedDB once the page is
  reloaded. A package for the other language, a plain `.zip`, a hostile
  or oversized archive, or one whose includes don't fit the browser's
  extension budget is refused whole, with a one-sentence reason.

### Added — 2026-11-04 Offline website, versioning, update checks
- **The website works offline.** A Workbox service worker (`@vite-pwa/nuxt`)
  precaches the app's own files — both IDEs, `/technical`, the `_nuxt/`
  chunks and workers (the Inform 6 compiler's wasm among them), the
  Parchment player under `play/`, the demo story, fonts and icons. After one
  visit frotzsmith opens, compiles Inform 6, plays, and runs test scripts with
  no connection; any reload offline falls back to the app shell. With a web
  manifest and icons it can be **installed as an app**.
- **ZIL offline after one online use.** The ~13 MB ZILF runtime
  (`/zilf/r<rev>/_framework/*`) is not precached — a visitor who never opens
  ZIL downloads none of it — but is cached on first use (CacheFirst, cache
  `frotzsmith-zilf`, only 200 responses). Once it's there, ZIL compiles
  offline too; offline with an empty cache, a ZIL compile ends promptly with
  a compile error rather than hanging.
- **Updates wait for you.** A new deploy shows *"A new version of frotzsmith
  is ready"* with **Reload** / **Later**; nothing reloads by itself, in any
  tab. Reload writes the pending source autosave and Skein saves first, shows
  "Getting the newest version…", and the new version opens with
  "frotzsmith is up to date." Other open tabs keep their offer until their
  own author chooses.
- **One version number** — `desktop/package.json` (`0.1.0`, mirrored in the
  root `package.json`), with the build commit and date baked in. The footer's
  **About · v0.1.0** opens an About dialog (version, build, license, source)
  with **Check for updates**, which looks for the newest deploy and offers it
  — it never applies it unasked. The Technical page shows the version too.
- `postgenerate` runs `tools/check-sw.mjs`, which fails the build if the
  worker would precache ZILF, `/pa/`, the social image or the hosting
  fallbacks, or loses the ZILF runtime cache. Netlify serves `sw.js` and the
  manifest `no-cache`, so browsers see a new deploy promptly.

### Fixed — 2026-11-04 Review batch: replay restored, races, keyboard & mobile
- **Headless replay works in production again.** Every Test Script **Run**
  and Skein run/auto-run on the live site died with "GlkOte error … reading
  'e'" — not "some games", all of them. Cause: one top-level `this.e` in
  ifvms (`zvm/opcodes.js`) that Rollup's CommonJS wrapper turns into an
  unassigned-variable dereference; Node tests and `nuxt dev` both masked it.
  A build plugin (`tools/ifvms-this-fix.mjs`) rewrites it to its CommonJS
  value and fails the build if an ifvms upgrade moves it, and
  `postgenerate` now **executes the built replay worker** against `demo.z5`
  (`tools/smoke-replay-worker.mjs`) — so CI *and* the Netlify build refuse
  to ship a broken replay worker.
- **Stale compiles are discarded.** A compile still running when you load a
  sample / open a file / switch language no longer lands its story in the
  new game (Play and the Skein ran the wrong build). Overlapping sample
  loads resolve last-click-wins.
- **Session watchers register once per app** (`registerSessionOnce`): one
  watcher leaked per compile (the editor slowed over a session), and the
  Skein's watchers ran 3× per compile. The test harness's `useState` now
  returns a fresh ref per call like real Nuxt, which is what hid this.
- **Skein:** a recompile mid-run cancels the in-flight replay and re-runs on
  the new build (no old-build verdicts); Cancel terminates the worker;
  recompiling drops every previous output, so blessing can't certify the old
  build's text; per-bucket save timers and guarded restores stop one game's
  tree overwriting another's; `.skein` import rejects another language's
  file and structurally broken trees. Deleting a branch offers **Undo**.
- **Compile timeouts no longer freeze the tab.** A worker timeout now
  reports "Compile timed out" instead of re-running the source on the main
  thread, and doesn't demote the session to main-thread mode; an error reply
  falls back for that compile only. A ZIL compile queued behind the
  pre-warm starts its clock when the warm-up ends. Both compile clients now
  share `worker-rpc.ts` (the duplicated worker code is gone).
- **No lost edits on a language switch** — the pending autosave is flushed
  under its own language first; blocked storage reseeds the right starter.
- Test-script runs are cancelled by a recompile instead of writing old turns
  into the fresh transcript. Headless output is capped at 256 KB per turn
  (as `docs/06-security.md` promised).
- Share links: a blocked clipboard shows an error toast; oversized / deflate-
  bomb links are refused on decode; the "replace editor" toast only loads
  into the language it was made for.
- **Keyboard & a11y:** the Skein tree is a single tab stop with focus on the
  real treeitem; arrow keys no longer hijack (and auto-save) the inline
  "new command" box; Enter works on row buttons; Home/End; focus returns to
  the row after adding. ⌘B / Ctrl+B compiles from anywhere (hint is
  platform-correct); Results announces a one-line summary instead of reading
  the whole panel; the Extensions drop zone takes Space and announces
  results; the test-script editor no longer traps Tab.
- **Mobile & map:** `h-dvh` layout (iOS toolbar no longer hides the bottom),
  a Compile button on the pane switch, tapping a diagnostic shows the
  editor, the file drawer closes on pick. The map pans by touch, pinch-
  zooms, and wheel/trackpad zoom is proportional (a gentle swipe no longer
  zooms all the way).
- CSS preloads carry `crossorigin` (they were ignored and the sheet fetched
  twice); download blob URLs are revoked after the download starts.

### Added — 2026-07-09 The Skein (v1)
- **The Skein** — the v2 headline, grown from the test-script spine exactly as
  designed in Doc 10: a branching tree of commands (each root→node path is a
  playthrough) with **blessed-output regression diffing**. Live play extends
  the tree as you type (a cursor walks from the root each session; trying a
  different command branches the tree); the active test script imports as a
  thread. Run a thread headlessly, **bless** its outputs as correct — and
  every successful compile marks blessed nodes stale, then (auto-run on, the
  default) re-runs the blessed leaves in the replay worker and flags each
  node green (match) or red (diff), with a line-diff view of blessed vs
  current. Per-node actions: bless/unbless, run to here, **Play to here**
  (via Send-to-Play), add command, delete branch. Trees persist per game in
  **IndexedDB** (they outgrow localStorage) with `.skein` JSON export/import
  as the canonical backup. Failed runs surface a toast naming the engine
  error instead of dying silently. Spec:
  `docs/superpowers/specs/2026-07-09-skein-design.md`.

### Added — 2026-07-09 Export playable HTML; beta pre-flights
- **Export playable HTML** — one click on a successful build produces a
  single self-contained `.html`: the vendored Parchment/ZVM player inlined,
  the interpreter delivered through an import map → `data:` URI (Parchment
  loads engines via `import("./zvm.js")`), and the story embedded as base64
  with the same `#game.zN` format-detection fragment the IDE's blob URLs use.
  Plays offline from `file://` or any static host — the no-hosting
  distribution path (itch.io, Neocities) now that hosted publishing is
  deliberately deferred (see `docs/superpowers/specs/2026-07-09-publish-mode-design.md`).
- **Share** — a toolbar button copies a link that carries the current source
  *inside the URL fragment* (deflate + base64url, TypeScript-playground
  style) — nothing is uploaded, and fragments never reach a server. Opening
  a share link auto-loads only over a pristine buffer; over real work it
  offers a sticky "Replace editor contents" toast instead of overwriting
  (the recovery autosave would persist a silent replacement within a
  second). Wrong-language and malformed fragments are ignored.
- **Beta pre-flights** — a toolbar bug-report link straight to GitHub issues;
  the ZIL pre-warm respects Data Saver / 2g connections (opening `/zil/` to
  look no longer commits a metered visitor to the ~9 MB .NET download); and
  `docs/beta-testing.md` documents known limitations for testers.

### Fixed — 2026-07-09 (later the same day) boot waterfall, honest CI gates, storage cues
- **Route chunks preload in parallel** — with `ssr: false` the browser
  discovered each route's chunks serially (entry → route resolve → page chunk
  → IDE chunk); a postgenerate step (`tools/inject-preloads.mjs`, driven by
  the client manifest) now injects `modulepreload` hints for every route's
  full chain into the generated HTML, collapsing the waterfall.
- **Canonical matches the connected custom domain** — `siteUrl` flipped to
  `https://frotzsmith.com`; Netlify already serves the `*.netlify.app` alias
  with a `Link: rel=canonical` header pointing there, and the stale DOM
  canonical read as "multiple conflicting canonicals" (Lighthouse SEO 92).
- **The axe-core zero-violation gate is real now** — CI serves the build and
  runs `@axe-core/cli` on `/`, `/zil/`, and `/technical/`, failing on any
  violation. Running the full ruleset surfaced four genuine issues
  (Lighthouse's a11y subset scores 100 and missed them), all fixed: the IDE
  pages had no `h1` (the toolbar brand now is one), three `/technical/` prose
  links were color-only (now underlined), and the scrollable code/table
  regions weren't keyboard-focusable (`tabindex="0"`). CI also compiles all
  7 ZIL samples per run (`ZIL_SAMPLE_GOLDEN`, previously always skipped),
  asserts the generated artifacts exist, and drops the README's untrue
  "offline-capable" claim (no service worker exists — yet).
- **A full storage quota warns instead of silently eating autosave** — every
  persist path goes through `safeSetItem` and cues one sticky toast per
  session on refusal; the "Saved" indicator no longer advances when nothing
  was written; uploaded extensions get a cumulative 4 MB cap (per-import caps
  existed, but 2-3 large uploads could exhaust the whole origin quota).
- **Send-to-Play reports where it stopped** — the feed engine moved to a
  unit-tested module returning `{ completed, fed, total }`; a partial feed
  shows "stopped after N of M commands" instead of the old silent stop
  (previously indistinguishable from the throttled-tab stall).

### Fixed — 2026-07-09 Inform 6 compiles off the main thread; first paint slims down
- **Inform 6 compiles in a Web Worker** — with a 60 s wall-clock timeout, a
  fail-fast error channel (`error`/`messageerror`), and an automatic
  main-thread fallback, mirroring the ZILF worker. Closes the 2026-06-30
  audit's tracked Medium: a pathological source can no longer freeze the tab.
- **~1.1 MB of compile-time-only text left the critical-path chunk** — the
  Standard Library + PunyInform `.h` bodies now ride the compile worker's own
  chunk (fetched on first compile, not page load), with a lazy copy behind the
  file explorer's read-only library tabs; the 23 sample bodies are per-sample
  lazy chunks loaded on selection. Critical-path JS drops from ~600 KB gz to
  ~330 KB gz on both pages (ZIL authors previously downloaded the entire
  Inform 6 library before first paint).
- **Error paths fail loudly instead of invisibly** — a thrown compile
  exception (e.g. a failed `inform6.wasm` fetch) surfaces as a fatal
  diagnostic instead of an error banner reading "0 errors" over empty panes;
  the ZIL worker falls back immediately when its script fails to boot (was: a
  silent 60 s hang); the ZIL pre-warm no longer shares the real compiles'
  timeout, so a slow connection can't get the shared worker terminated
  mid-compile and every later compile silently latched onto the main-thread
  freeze; and `useIde` survives blocked or full `localStorage` (new
  `safeGetItem`/`safeSetItem` utility — the IDE previously failed to mount
  under Chrome's "Block all cookies").

### Fixed — 2026-07-02 ZIL compiles off the main thread
- **The ZIL Web Worker is enabled** — ZILF compiles no longer block the UI (warm
  compiles ~5 s fully off-thread; the main-thread path remains as an automatic
  fallback). The historical `dotnet.create()` hang was
  [dotnet/runtime#114918](https://github.com/dotnet/runtime/issues/114918):
  dotnet.js treats a worker with an **assigned `onmessage`** as a managed-pthread
  deputy and never resolves its asset loads. The worker now registers its handler
  via `addEventListener` (which leaves the `onmessage` IDL attribute null), boots
  eagerly on spawn, tags requests with ids, and posts stage breadcrumbs; the
  worker timeout is boot-aware (60 s) instead of shorter than the compile itself.
- **The ZIL compiler pre-warms on `/zil/`** — the first `Compile()` after a cold
  boot pays ~20 s of mono-interpreter warm-up (measured; download + `create()`
  are sub-second on a fast connection), so the page now boots the worker and runs
  a throwaway skeleton compile in the background on mount. The author's first
  real compile behaves like a warm one (~5 s, off-thread). `/zilf/_framework/*`
  also gets a one-week cache header (it previously revalidated ~30 assets per
  session).

### Fixed — 2026-07-01 review batch
- **Run replays test scripts headlessly again** — the per-turn transcript fills the
  Test Script panel in place; the live-game path is now its own **Send to Play**
  button. Replay **timeouts** are reported as timeouts (not "Stopped"), and the
  wall-clock budget scales with script length (15 s + 250 ms/command, capped at 2 min);
  **Stop** keeps working after a mid-run tab switch.
- **Language switches no longer leak state** — navigating `/` ↔ `/zil/` blanks the
  other language's compile result/status/game/queued script (a stale I6 game could
  previously boot inside the ZIL IDE); empty-storage restores reset scripts,
  extensions, and open tabs instead of inheriting (and persisting) the other
  language's; the editor reseeds the language default in **both** directions.
- **Session watchers survive navigation** — crash-recovery autosave (and the
  script-bucket/map/transcript reset watchers) are registered in detached effect
  scopes, so a visit to `/technical` no longer silently kills autosave.
- **Active test-script selection survives compiles and reloads** (compiles no longer
  blank the persisted selection back to "Script 1").
- **Compiler robustness** — Inform 6 source is compiled as UTF-8 (`-Cu`; accented
  prose no longer silently mojibakes), raw WASM traps surface as a fatal diagnostic
  instead of a silent zero-diagnostic failure, and a failed lazy WASM boot (network
  blip) retries on the next compile instead of bricking the session.
- **Main-thread compile UX** — "Compiling…" is guaranteed to paint before the
  synchronous ZIL compile freezes the thread (double-rAF), and clicks queued during
  the freeze can't immediately trigger a second full freeze.
- **Accessibility** — right-pane tabs get accessible names (they were unnamed
  icon-only below 640 px), full tabs semantics (`aria-controls`/`tabpanel`, roving
  tabindex, arrow keys) and an sr-only compile-status cue; editor-tab close is
  pointer-only + **Delete** key (no focusable control nested in `role="tab"`);
  the auto-map SVG uses coherent group/graphic roles; a `<main>` landmark; the
  mobile Source/Output switch announces state (`aria-pressed`);
  `prefers-reduced-motion` is honoured.
- **Auto-map fit** no longer over-zooms tiny maps — a one-room map renders
  room-sized (fit is clamped to ~3 cells across).
- **Security** — extension `.zip` import is capped (200 `.h` entries / 5 MB
  uncompressed, rejected before expansion), closing the 2026-06-30 audit's
  zip-bomb finding; oversized single `.h` uploads are rejected too.
- **SEO** — per-route `canonical`/`og:url` (`/zil/` and `/technical/` no longer
  declare themselves duplicates of the homepage); stale "ZIL coming" OG copy.
- **Send-to-Play feed is event-paced** — command feeding now waits on the game's
  actual DOM output (MutationObserver) instead of fixed timers, so Chrome's
  background-tab timer throttling can no longer stall a script mid-feed; the
  cosmetic per-command delay is skipped while the tab is hidden.

### Added — 2026-07-01 review batch
- **CI** (GitHub Actions): `yarn test` + `yarn typecheck` + `yarn generate` on
  every push/PR.

### Added — compiler & libraries
- Client-side **Inform 6 → Z-machine** compilation: `inform6` v6.44 built to
  WebAssembly, verified byte-identical to a native build.
- **Standard Library** (v6.12.8) and **PunyInform** (v6.7) bundled and fuzzily
  auto-detected from the source; either can be forced.
- Story-version targets **z3 / z4 / z5 / z8**, profile-aware (Standard → z5/z8;
  PunyInform → z3–z8; `.z5` default). Maximally verbose `-s` output.
- Footer stats: story-file size, dynamic memory / 64 KB (warns near the ceiling),
  total Z-machine free.

### Added — ZIL (second source language · alpha)
- **A second language at `/zil/`** — write **ZIL** (Infocom's original MDL/Lisp-like
  authoring language) and compile it to a Z-machine story file entirely client-side,
  alongside Inform 6. A **title-strip toggle** switches the two (Inform 6 `beta` · ZIL
  `alpha`), each with its own `frotzsmith:<lang>:*`-namespaced project state.
- **ZILF/ZAPF compiler in the browser** — the modern **ZILF + ZAPF** toolchain
  (C# / .NET 10) is built offline to **.NET WebAssembly** and committed like
  `inform6.wasm`. It runs **in a Web Worker** (originally main-thread; see the
  2026-07-02 fix above), and the
  ~7.5 MB bundle is **lazy-loaded only on the first ZIL compile** — Inform 6 users never
  download it. The `zillib` standard library is
  embedded; the `<VERSION>` directive drives the **z3 / z5 / z8** target.
- **ZIL authoring** — a CodeMirror 6 **ZIL syntax mode**, compile **diagnostics** parsed
  to the same click-to-jump format as Inform 6, a **ZIL-safe Prettify**, and a
  post-compile **summary** (target · story size · time · diagnostics).
- **7 ZIL concept demos** — Cloak of Darkness, a Skeleton starter, Two Rooms, an NPC,
  a locked-chest puzzle, light & darkness, and a daemon/timed event; each verified to
  compile as a golden case.
- **Shared for free** — because ZIL emits Z-code, inline **play**, the **auto-map**,
  **test scripts**, and the **transcript** all work for ZIL unchanged.
- **Relicensed MIT → GPLv3** — bundling and distributing the GPLv3 ZILF/ZAPF compiler
  requires the combined app to be GPLv3.

### Added — play
- **Inline Play** via the bundled Parchment interpreter + pure-JS **ZVM** (MIT):
  a clean compile runs in the right pane, fully client-side — the story is passed
  to the player iframe as a version-tagged blob URL, no server round-trip. Play is
  gated on a clean compile. Attribution in `public/play/web/README.md`.
- Player is light/dark-aware (follows the IDE), edge-to-edge, with a fullscreen
  toggle.

### Added — auto-map
- **Live Trizbort-style map** — as you play, the **Map** tab draws the rooms you've
  discovered and their connections: room names read from the status line, exits
  inferred from your movement commands, placed on a direction grid over a graph-paper
  backdrop. The current room is highlighted; **zoom / pan / Fit** keep a large map in
  one view. Hovering (or keyboard-focusing) a room shows its essentials — discovered
  exits, objects, and a one-line description. Per-game, reset on compile. Built live
  from hand-play: the room structure is reliable; objects/description are best-effort
  from the game's prose.

### Added — editor & authoring
- CodeMirror 6 with Inform 6 syntax highlighting, live linting, click-to-jump
  compile errors, and ⌘/Ctrl+B to compile.
- **Prettify** (structural re-indent); built-in samples are prettified on load.
- **14 verified samples** (7 concepts × 2 libraries): Skeleton, Two Rooms, The
  Hermit (NPC), The Locked Chest (puzzle), Custom Grammar, The Dark Cellar
  (darkness & light), and Timed Candle (daemons), grouped by library.
- **New Project** (title / author / library → skeleton), **Open `.inf`**,
  **Save As**, and crash-recovery autosave.

### Added — transcript & replay

- Headless **StoryEngine seam** (`app/modules/inform6/engine/`): a `createEngine`
  factory returns a `ZmachineEngine` (the `ifvms` ZVM wired to a headless GlkOte,
  with `normalizeTurnOutput` stripping trailing prompts and Glk input echoes) or a
  `GlulxEngine` stub; Glulx is behind the same factory but not yet implemented
  (ADR-002). Covered by golden, normalize, createEngine, and parseScript unit tests.
- **`replay()` Web Worker primitive** (`replay.worker.ts` + `useReplay` composable):
  runs a command script against the engine fully off-thread; supports cancellation
  and a configurable timeout. `glkapi.js` (Zarf's classic-mode script) is loaded
  via `?raw` + indirect `eval` so it executes inside the strict-ESM worker context.
  The worker chunk is emitted by `nuxt generate` (`replay.worker-*.js`).
- **Test Script tab** in the IDE right pane: a **CodeMirror** script editor
  (`ScriptEditor.vue`) + `TestScriptPanel.vue` with named-script CRUD, a Run /
  Cancel button pair, a live `role="status"` progress region, and the rendered
  turn-by-turn transcript. Named scripts persist to localStorage under the
  `frotzsmith:scripts` key. Run is gated on a clean compile.

### Added — play transcript & test-script UX

- **Play Transcript** — interactive Play now records every command you type into a
  read-only **Transcript** tab (`TranscriptPanel.vue`); **Copy to Test Script** turns a
  captured playthrough into a reusable, named Test Script in one click. Capture is a
  same-origin `postMessage` from the player iframe, verified by origin, a source tag,
  and `e.source`; the captured value is inert data (appended to a list, never executed).
- The original script-runner tab was **renamed Transcript → Test Script**
  (`TranscriptPanel.vue` → `TestScriptPanel.vue`), freeing "Transcript" for the capture.
- **Test Script UX** — first-class rename (a modal text input, replacing the browser
  prompt), a **Clear** button (empties the active script), and a fresh compile blanks the
  play transcript + the last run output (saved scripts are kept, and scripts never
  auto-run — only the Run button executes them).
- **Compile / Play moved into the title bar** (right-aligned; de-duplicated via an
  opt-in `actions` prop on `TitleStrip`). The tab row now holds only tabs; the redundant
  "Ready" status text was dropped (the Results tab's red/green dot signals readiness);
  and the Play iframe stays mounted (`v-show`) so switching tabs no longer restarts the game.
- **Slugified filenames** — Save-As and Download default to a slug of the story's
  `Constant Story` title (fallback `story`), with `-puny` for PunyInform — e.g.
  `haunted-house.inf` / `haunted-house.z5`, `haunted-house-puny.z3`.

### Added — loading & polish

- **SPA loading splash** (`app/spa-loading-template.html`) — a branded dark splash
  (amber spinner + wordmark) shown during the client-only initial load (Nuxt
  auto-detects the template when `ssr: false`), replacing the blank screen.

### Security

- **2026-06-30 red/blue audit** — findings + mitigations recorded in the
  [Security audits](./README.md#security-audits) README log. **Fixed:** the player accepts
  **same-origin `blob:` story URLs only** (closing a `?story=data:` remote delivery vector
  into the ZVM JIT); CSP `connect-src` tightened (dropped `data:` and a dead endpoint) and a
  `Permissions-Policy` header added; the play-command `postMessage` listener pins `e.source`.
  **Tracked (recommended):** zip-bomb decompression caps, worker-isolated compile, analytics SRI.

### Added — file explorer & multi-file editing
- **File explorer** — a collapsible panel (left column on desktop, a slide-over
  drawer on mobile) listing the project's **compilation bundle**: the `story.inf`
  source, enabled extensions, and a read-only **Library** group of the active
  library's `.h` files (the group switches with Standard Library / PunyInform).
- **Tabbed multi-file editing** — open any listed file in its own editor tab
  (one CodeMirror view with a per-file state, so undo history and cursor survive
  tab switches). `story.inf` is always open and non-closable; uploaded extensions
  are editable; library and bundled-extension files open read-only (still
  selectable and keyboard-scrollable, just not editable).
- Panel open/closed state and the set of open tabs persist; clicking a compile
  error still jumps to the source. Toggle the panel from the source toolbar
  (and the explorer's own close button).

### Added — site & infrastructure
- **Technical Details** page (`/technical`): the compile→play pipeline, Z-machine
  limits with measured numbers, "why Inform 6 over Inform 7", and a resource list
  (DM4, Inform site, libraries, Z-machine standards).
- `frotzsmith.config.ts` — a single source of truth for identity, toolchain
  versions, Z-machine limits, defaults, and storage keys.
- SEO/OG: a branded `og:image` (SVG + 1200×630 PNG), Open Graph + Twitter Card
  meta, favicons, `robots.txt`, and `sitemap.xml`.
- Footer links to the Changelog, Roadmap, and Technical page.
- `ROADMAP.md` and `docs/13-v2-roadmap.md` (ZIL/ZILF, auto-map, and other v2 notes).
- Dark mode by default with an accessible light/dark toggle; responsive.
- `netlify.toml` for static deployment (`nuxt generate` → `.output/public`) with
  headers tuned so the WASM compiler and ZVM player work under CSP.
- Repository scaffolding: `LICENSE` (MIT), `README.md`, `.gitignore`,
  `.nvmrc` (Node 22), and the design & specification suite in `docs/`.

### Fixed
- Brought the repository to a **clean `yarn typecheck`** (resolved 12 pre-existing
  strict-null / TS-library errors) and **zero axe-core violations** — fixing the
  output-pane tablist's non-tab child, giving the editor textbox an accessible
  name, making the editor scroll region keyboard-focusable, and raising the
  line-number gutter contrast to WCAG AA. The advertised axe-zero / WCAG 2.1 AA
  gate now holds.

### In progress
- **Extensions**: a bundled `.h` catalog plus drop-your-own `.h` / `.zip`, with a
  Borogove-style select/deselect picker that mounts them into the compile (the
  compiler already accepts mounted extensions).

### Decided (see `docs/11-architecture-decisions.md`)
- Client-side `inform6` → WebAssembly compilation. Feasibility verified against
  Borogove (compiles I6 client-side in production) and upstream
  DavidKinder/Inform6 v6.44 (Artistic License 2.0). — ADR-001
- Z-machine only in v1; the `StoryEngine` seam + `createEngine` factory ship so
  Glulx can be added later without a refactor. The author does not use Glulx. — ADR-002
- The `.inf` file is the canonical source; localStorage is crash-recovery only,
  with options/scripts as its working store and a project `.json` backup. — ADR-010
- Static deployment via `nuxt generate` (`ssr: false`) to `.output/public`. — ADR-011
- Inform 6 extension catalog: bundled/pinned + local `.h` import (offline);
  remote registry deferred. — ADR-012
- Dark mode by default with an accessible light/dark toggle; WCAG 2.1 AA,
  axe-core zero-violation gate, fully responsive.

[Unreleased]: https://github.com/cschweda/frotzsmith
