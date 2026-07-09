// Plausible bootstrap — a real file instead of an inline <script>, so
// script-src needs one less 'unsafe-inline' consumer. The endpoint points at
// our first-party proxy (netlify.toml /pa/event → plausible.io/api/event).
window.plausible = window.plausible || function () { (plausible.q = plausible.q || []).push(arguments) }
plausible.init = plausible.init || function (i) { plausible.o = i || {} }
plausible.init({ endpoint: '/pa/event' })
