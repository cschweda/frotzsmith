# 13 · v2 Roadmap & Feasibility Notes

Post-v1 ideas with feasibility assessments, captured as they arise. v1 is
**Inform 6 (Standard Library + PunyInform) → Z-machine, fully client-side**.
Nothing here is committed; these are candidates for a later version.

## ZIL / ZILF support (a third source language)

**Why.** ZIL (Zork Implementation Language) is the Lisp-like language Infocom
wrote its games in — the historic root of the whole z-code lineage. Supporting it
would let Frotzsmith span **ZIL → Inform 6 → PunyInform**, all compiling to the
same Z-machine and playing in the same interpreter. Thematically ideal for a tool
named after Frotz.

**The play side is free.** ZIL compiles to z-code (.z3–.z8), so the existing
Parchment + ZVM player, export bundle, stats, and target switching all work
unchanged. The `StoryEngine` seam and the profile system already abstract
"source language → z-code," so ZIL slots in as a third profile.

**The compiler is the real decision.** Two open-source ZIL compilers exist:

| | ZILF | Zorkie |
|---|---|---|
| Language | C# / .NET | **Python** |
| License | GPLv3 (+ permissive library/runtime licenses) | GPL-3.0-or-later |
| Maturity | Reference compiler; complete; full ZILF stdlib | Beta; "works well with Infocom-style ZIL", ~36% of the ZILF stdlib parses |
| Repo | foss.heptapod.net/zilf/zilf | github.com/avwohl/zorkie |
| Browser path | Hard — needs the .NET WASM runtime, or a server | **Easy — Pyodide (CPython→WASM), client-side, no server** |

- **Borogove** ([borogove.app/zil](https://borogove.app/zil)) proves browser ZIL is
  wanted — but it runs **ZILF on a backend** (`POST /prepare` → poll for a job),
  because ZILF is .NET. That breaks Frotzsmith's no-server / offline principle.
- **Zorkie** is pure Python with no external dependencies (`requires-python >=3.8`),
  so it can run **client-side via Pyodide** (Python compiled to WebAssembly) —
  `micropip` can install it from PyPI, or it can be vendored. This keeps Frotzsmith
  fully static/offline, exactly like v1.

**Recommendation.** Zorkie + Pyodide is the Frotzsmith-aligned path (client-side,
no server). Trade-offs to weigh at the time:

- Zorkie is young/beta — it handles classic Infocom-style ZIL well but only part of
  the modern ZILF standard library, so it's fine for learning and classic ZIL, not
  yet full ZILF-library games. Track its progress.
- Pyodide is a multi-MB runtime; lazy-load it only when ZIL is selected so the I6
  path is unaffected.
- GPL-3.0: shipping the compiler as a runtime-loaded WASM/Python artifact is mere
  aggregation (the MIT app and the games you compile are unaffected), but provide
  the compiler's source to comply.
- Add a ZIL editor mode (Lisp-like `<ROUTINE …>` syntax) and `.zil` detection.

**Hosting changes the calculus.** The deciding factor isn't Netlify vs DigitalOcean
per se — it's whether a **backend** is available (the client-side WASM I6/Puny
compile runs the same on any static host):

- **Static host (Netlify, today):** ZIL compile must be client-side → Zorkie +
  Pyodide, accepting its current ZILF-stdlib gaps. Stays fully offline.
- **A real backend (e.g. DigitalOcean App Platform / Droplet):** run the *complete*
  ZILF (C#/.NET) as a small compile service — Borogove's exact model — sidestepping
  both Zorkie's incompleteness *and* the hard .NET-to-WASM port. You can keep the
  static app on Netlify and add only a ZILF microservice on DO (with CORS), or host
  both on DO. Trade-off: ZIL compiles then require connectivity — a **hybrid**, where
  I6/PunyInform stay client-side/offline and only ZIL goes through the server.

So: for **complete** ZIL today, a ZILF backend (DigitalOcean) is the pragmatic,
proven path; for fully-offline purity, Zorkie + Pyodide, improving over time.

## Auto-map (play-time room map)

A **Map** tab (already stubbed in the UI, disabled with a "coming soon" tooltip)
that draws the rooms revealed as you play: centred on the start, the four cardinal
and four diagonal links shown on a grid, with up/down/in/out as room badges;
scrollable for large maps.

- **Data source:** observe the play iframe — GlkOte's status line gives the current
  room and the transcript echoes movement commands, so record an edge when the room
  changes after a direction command. (More accurate, later: read the ZVM object tree
  for exits directly.)
- **Hard part:** IF maps are routinely non-Euclidean (go N-E-S-W and you rarely end
  up back at the start), so naive grid layout collides — this is why tools like
  Trizbort exist. A basic version tolerates overlaps or uses a force-directed layout.
- Self-contained; reuses the existing play iframe. v2.

## Other deferred items

- **Remote extension registry** (ADR-012): v1 ships bundled extensions plus local
  `.h` / `.zip` upload; a searchable online catalog comes later.
- **Glulx** (ADR-002): v1 is Z-machine only. The `StoryEngine` seam allows adding
  Glulx (Inform 6 `-G`, played via the already-built `glulxe` / `git` WASM) later.
- **Multi-`.inf` projects:** v1 is one source file plus `Include`d `.h` files.
- **`app.frotzsmith.com` + landing split:** a marketing landing page at the apex
  domain with the IDE on a subdomain — two Netlify sites from this one repo (Yarn
  workspaces optional); no restructuring needed until then.
