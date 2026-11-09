// Report a problem / Suggest a feature, by email (Resend), for frotzsmith. The work is in
// @frotzinc/nuxt-base; RESEND_API_KEY, REPORT_TO and REPORT_FROM are this site's Netlify environment
// variables (set for the whole team). Without them it answers 503, and the About menu's report
// dialog offers GitHub instead. netlify.toml sets no base, so Netlify finds it here.
//
// In front of it (netlify/lib/report-guard.mjs, docs/06-security.md §10): same-site JSON posts
// only, a one-line title, and a daily cap counted in Netlify Blobs. Netlify itself limits each
// address to 5 posts a minute (`config.rateLimit`, answered 429 at the edge).
import { getStore } from '@netlify/blobs'
import { createReportHandler } from '@frotzinc/nuxt-base/netlify/report'
import { guardReports } from '../lib/report-guard.mjs'

export default guardReports(createReportHandler({ app: 'frotzsmith' }), {
  store: () => getStore({ name: 'report-count', consistency: 'strong' }),
})

// `path`: Netlify applies a function's rate limit to the path it names, so the function is served
// at /api/report (app/app.config.ts `reportEndpoint`), not at its default /.netlify/functions/ URL.
export const config = {
  path: '/api/report',
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
