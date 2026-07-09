# Publish Mode — Design (v1: unlisted links)

**Date:** 2026-07-09
**Status:** Approved (design); not yet planned/implemented
**Decisions locked with author:** unlisted links only in v1 · GitHub OAuth only · Netlify + Supabase (no droplet) · no app-wide accounts

## Goal

Let an author publish a compiled work — in progress or finished — as a shareable
card page: cover image, title, author, summary, **Play online**, and a download
link for the story file. Modeled on Borogove's publish affordance, scoped to
Frotzsmith's ethos: the IDE itself stays account-free and fully static.

## Decisions and why

### Netlify + Supabase, not a DO droplet

Considered: (a) keep the static Netlify app and add Supabase (Auth + Postgres
with RLS + Storage) spoken to directly from the client; (b) move the app to a
DigitalOcean droplet (Forge → nginx → PM2 → Node/Nitro) with SQLite, making
everything one box and incidentally enabling SSR; (c) hybrid — static app plus
a small self-hosted publish API.

**Chosen: (a).** Publishing is additive to a static site: the audited
"no-backend IDE" architecture survives untouched, ops stay ~zero (no patching,
process supervision, TLS, or DIY SQLite backups), Supabase Pro is already paid
for and bundles exactly the needed services, and RLS enforces ownership at the
data layer instead of hand-rolled route guards. The droplet's real advantages
(single box; trivial SSR, which would also lift the measured `ssr:false` LCP
floor) don't outweigh a standing ops tax on a weekend project — and if SSR is
ever wanted, Nuxt SSR deploys on Netlify functions without a server of ours.
Single-repo is preserved regardless: `supabase/migrations/` and
`netlify/edge-functions/` live in this repo.

### Auth: required to publish, GitHub OAuth only, nowhere else

Hosting third-party content under this domain without accountability is an
abuse magnet even at hobby scale. Accounts give ownership (republish /
unpublish), per-user quotas, and a meaningful delete. GitHub-only keeps PII
out: no passwords, no stored emails, no email-delivery service. The sign-in
gate exists **only** on the Publish button — writing, compiling, playing, and
testing never require an account.

**App-wide accounts (cloud project space) are explicitly rejected** for now:
local-first, account-free authoring is this project's stated differentiation
(README), and cloud sync means conflict semantics plus custodianship of
unpublished creative work. If ever wanted, "back up my projects to my account"
can be added later as an explicit push on the same auth foundation.

### Unlisted by default; no public index in v1

Publish returns an unguessable link. No listing query exists anywhere in the
client, so there is nothing to browse and (almost) nothing to moderate. An
opt-in public gallery is a phase-2 flag, not a v1 feature.

## Architecture

```
frotzsmith.com (static, Netlify — unchanged IDE)
 ├─ /p/[slug]        SPA card page
 │    └─ Netlify Edge Function on /p/* injects og: tags (crawlers don't run JS)
 ├─ /pub-api/*  ──►  Netlify rewrite → Supabase REST/auth (CSP stays same-origin)
 └─ /pub-cdn/*  ──►  Netlify rewrite → Supabase Storage public objects

play sandbox (second Netlify site; later alias play.frotzsmith.com)
 └─ serves the existing public/play/ Parchment player for PUBLISHED games only
```

The sandbox origin is a hard requirement, not polish: the 2026-06-30 audit's
High finding was "never run attacker-controlled z-code on this origin" (the
vendored ZVM JIT compiles z-code to JS under `unsafe-eval`), fixed then by
restricting the player to same-origin blobs of your own compile. Publishing
deliberately reintroduces third-party z-code running in visitors' browsers, so
it runs on an origin that holds nothing — no localStorage state, no session.
The main-origin player and its blob-only rule are unchanged for the IDE's own
compiles.

## Data model (Supabase)

```sql
works (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users on delete cascade,
  slug        text unique not null,          -- random, e.g. bright-cellar-4k2m
  title       text not null check (char_length(title) <= 120),
  author_name text not null check (char_length(author_name) <= 80),
  summary     text not null check (char_length(summary) <= 500),
  lang        text not null check (lang in ('i6', 'zil')),
  story_ext   text not null check (story_ext in ('z3','z4','z5','z8')),
  story_bytes int  not null check (story_bytes between 1 and 524288),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
)
```

Storage buckets (public-read): `stories/{work_id}/story.{ext}`,
`covers/{work_id}/cover.png`.

**RLS:** `select` open to all (unlisted = not enumerable — enforced by the
absence of any listing UI/query, not by read-protection); `insert`/`update`/
`delete` require `owner = auth.uid()`. **Quotas by trigger** (server-side, not
client-bypassable): max 20 works per owner, and combined stored bytes across
stories **and** covers ≤ 16 MB (per-object maxima alone would allow ~20.5 MB).
Storage policies mirror ownership and cap object sizes (story ≤ 512 KB, cover
PNG ≤ 512 KB).

## Publish flow (client)

Entry: a **Publish** button enabled by a successful compile. Dialog:

1. Title / author prefilled from the source (`storyTitle` computed; ZIL banner
   or I6 `Constant Story`), summary textarea, live preview of a
   **canvas-generated typographic cover** (title, author, language badge) —
   every work gets a presentable card with zero image pipeline. Author cover
   uploads are phase 2.
2. Not signed in → GitHub OAuth (Supabase Auth, PKCE) inline, return to dialog.
3. Confirm → client-side validation (z-header magic bytes, size), upload story
   + rendered cover PNG, insert row → show `https://frotzsmith.com/p/{slug}`
   with a copy button.
4. Republish (same work) overwrites the story object and bumps `updated_at` —
   no version history in v1. **Unpublish** deletes row + objects.
5. ZIL-only dialog footnote: games compiled with `zillib` embed GPLv3 code, so
   the published story file is arguably GPLv3 (I6 stdlib is Artistic 2.0;
   PunyInform has its own permissive license). One sentence, no legal advice.

Work↔local linkage (`work_id` + slug per project) persists via the existing
namespaced-localStorage pattern so "Republish" targets the right row.

## Card page

`/p/[slug]` (SPA route): cover, title, author, summary, updated date,
**Play online**, **Download story file** (`title-slug.z5`), "Made with
Frotzsmith". Play fetches the story bytes via `/pub-cdn/…` and hands them to
the sandbox-origin player iframe via `postMessage` (transferred ArrayBuffer;
the sandbox page makes its own blob URL). The main origin never feeds
third-party code to its own player, and the sandbox page accepts bytes only
from a `frotzsmith.com` `event.origin` — mirroring the existing pinned
postMessage pattern in reverse. Owner sees
Republish / Unpublish inline. The Edge Function injects `og:title`,
`og:description`, `og:image` (the stored cover), and a per-work canonical.

## Security & abuse posture

- Writes require auth; quotas enforced by trigger; sizes enforced by Storage
  policy and client checks.
- CSP stays tight via same-origin rewrites (`/pub-api/*`, `/pub-cdn/*`) instead
  of adding `*.supabase.co` to `connect-src`.
- README security section + `docs/06-security.md` updated honestly: "the IDE
  remains backend-free; publishing is an optional hosted service." A fresh
  red/blue audit pass gates the release — the threat model genuinely changes
  (user-generated content, OAuth, a second origin).
- Takedown path for v1: an email address on the card page footer; admin
  deletes via the Supabase dashboard. A report button ships with the phase-2
  gallery, if ever.

## Testing

House pattern throughout: a pure core (`publish-core.ts` — slug generation,
metadata extraction from source, cover rendering against an injected canvas,
z-header/size validation) with sibling unit tests; Supabase calls behind a thin
seam, mocked in composable tests; RLS policies exercised against `supabase
start` in a dedicated script/CI job so ownership rules are pinned by tests;
the Edge Function's OG injection is a pure string transform tested like
`tools/inject-preloads`.

## Phasing

- **V1 (this spec):** everything above. Estimate: 3–5 focused days including
  docs and the audit pass.
- **Phase 2 (optional, separate spec):** author cover uploads, "my shelf"
  listing page, opt-in public gallery + report button.
- **Explicitly out:** cloud project sync, source-file publishing, comments,
  ratings, per-work analytics.
