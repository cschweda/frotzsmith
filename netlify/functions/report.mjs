// Report a problem / Suggest a feature, by email (Resend), for frotzsmith. The work is in
// @frotzinc/nuxt-base; RESEND_API_KEY, REPORT_TO and REPORT_FROM are this site's Netlify environment
// variables (set for the whole team). Without them it answers 503, and the About menu's report
// dialog offers GitHub instead. netlify.toml sets no base, so Netlify finds it here.
import { createReportHandler } from '@frotzinc/nuxt-base/netlify/report'

export default createReportHandler({ app: 'frotzsmith' })
