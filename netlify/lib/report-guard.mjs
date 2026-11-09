// What stands in front of the report function (netlify/functions/report.mjs) — review 2026-11-09.
// The handler from @frotzinc/nuxt-base fixes the recipient and limits every field, but what it
// relies on to stop a script is either sent by the client (`elapsed`, the hidden field) or kept in
// one function instance's memory (its per-address count). So, before a report reaches it:
//
//  - Same site only: the Origin header must name the host the request came to. A page on another
//    site can't post here from a visitor's browser (a script that forges headers still can; the
//    limits below are for that).
//  - JSON only: a cross-site form or a "simple" fetch can't send application/json.
//  - The title is one line (it becomes the email's subject).
//  - At most DAILY_CAP reports are sent a day, counted in Netlify Blobs, so a flood can't use up
//    the email quota or the inbox. If the count can't be read or written, the report still goes.
//
// The per-address limit is Netlify's own (the function's `config.rateLimit`), enforced at the edge.

export const MAX_BODY = 32 * 1024
export const DAILY_CAP = 100

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const hostOf = (url) => {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/**
 * @param {(req: Request, context?: unknown) => Promise<Response>} handler
 * @param {{ store?: () => { get(key: string): Promise<unknown>, set(key: string, value: string): Promise<unknown> }, now?: () => number, dailyCap?: number }} [options]
 *   `store` opens the day counter (Netlify Blobs on the site; a map in the tests).
 */
export function guardReports(handler, { store, now = () => Date.now(), dailyCap = DAILY_CAP } = {}) {
  return async function guarded(req, context) {
    if (req.method !== 'POST') return handler(req, context)

    const origin = req.headers.get('origin')
    if (!origin || hostOf(origin) === null || hostOf(origin) !== hostOf(req.url))
      return json(403, { error: 'Reports are sent from this site’s own page.' })
    if (!/^application\/json\s*(;|$)/i.test(req.headers.get('content-type') ?? ''))
      return json(415, { error: 'That wasn’t a report.' })

    const raw = await req.text()
    if (raw.length > MAX_BODY) return json(413, { error: 'The report is too long.' })
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return json(400, { error: 'That wasn’t a report.' })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'That wasn’t a report.' })
    if (typeof body.title === 'string') body.title = body.title.replace(/\s+/g, ' ').trim()

    const day = new Date(now()).toISOString().slice(0, 10)
    let counter = null
    let count = 0
    try {
      counter = store ? store() : null
      count = Number(await counter?.get(day)) || 0
    } catch {
      counter = null
    }
    if (count >= dailyCap)
      return json(429, { error: 'Too many reports have been sent today. Please open it on GitHub instead.' })

    const headers = new Headers(req.headers)
    headers.delete('content-length')
    const res = await handler(new Request(req.url, { method: 'POST', headers, body: JSON.stringify(body) }), context)

    // Only a report that was really sent counts (the handler answers a bot 200 and sends nothing).
    if (res.status === 200 && !body.website && counter) {
      try {
        await counter.set(day, String(count + 1))
      } catch { /* not counted: the report still went */ }
    }
    return res
  }
}
