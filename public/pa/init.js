// Plausible bootstrap — a real file instead of an inline <script>, so
// script-src has one less 'unsafe-inline' consumer. It must run BEFORE the
// library, and head managers (unhead/capo) reorder tags — so this file
// injects the library itself: ordering by construction, not by markup.
// The endpoint is our first-party proxy (public/_redirects → plausible.io).
window.plausible = window.plausible || function () { (plausible.q = plausible.q || []).push(arguments) }
plausible.init = plausible.init || function (i) { plausible.o = i || {} }
plausible.init({ endpoint: '/pa/event' })
var s = document.createElement('script')
s.src = '/pa/script.js'
s.async = true
document.head.appendChild(s)
