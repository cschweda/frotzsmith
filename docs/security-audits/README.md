# Security audits

Every red/blue security audit of Frotzsmith, newest first. Each file is a permanent record of one audit: written when the audit closes and never rewritten. A later audit that revisits an earlier finding says so in its own record. The project README shows the newest audit in full and condenses older ones to a line each; this folder keeps everything.

| Date | Audit | Scope | Result |
|---|---|---|---|
| 2026-11-04 | [Red/blue audit — `.frotzsmith` package (M2a)](./2026-11-04-red-blue-audit.md) | Package reader/writer, Skein, tests, extensions, ZVM interpreters, CSP, analytics, supply chain | 2 High, 3 Medium, 12 Low, 1 Info; all fixed except 1 Info (deferred) |
| 2026-06-30 | [Red/blue audit — play-transcript release](./2026-06-30-red-blue-audit.md) | CSP & headers, Glk layer, postMessage, Play iframe + ZVM JIT, WASM compiler, rendering, extension zips, storage, supply chain, analytics | 1 High, 3 Medium, 2 Low; the analytics SRI and JIT items were closed by the 2026-11-04 audit |

The design-level threat model is [`docs/06-security.md`](../06-security.md).
