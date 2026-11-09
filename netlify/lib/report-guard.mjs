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
//    the email quota or the inbox. Each report takes a place of its own (one key under the day)
//    BEFORE it is sent, then counts the places taken: posts arriving together each see the
//    others' places, so they can't all read the same count and all go through. A report that
//    isn't sent gives its place back. If the store can't be reached, the report still goes.
//
// The function also asks Netlify for a per-address limit (`config.rateLimit`). On a Deploy Preview
// it was not seen to refuse anything (2026-11-09), so nothing here depends on it: the handler
// keeps its own per-address count for each instance, and the daily cap is the backstop.

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
 * @param {{ store?: () => { set(key: string, value: string): Promise<unknown>, list(o: { prefix: string }): Promise<{ blobs: unknown[] }>, delete(key: string): Promise<unknown> }, now?: () => number, dailyCap?: number, id?: () => string }} [options]
 *   `store` opens the places taken (Netlify Blobs, strongly consistent, on the site; a map in the tests).
 */
export function guardReports(handler, { store, now = () => Date.now(), dailyCap = DAILY_CAP, id = () => crypto.randomUUID() } = {}) {
  return async function guarded(req, context) {
    if (req.method !== 'POST') return handler(req, context)

    // The host the request came to: its URL's, or its Host header's (a browser sets that itself, so
    // another site's page can't make it match its own Origin).
    const from = hostOf(req.headers.get('origin') ?? '')
    if (from === null || (from !== hostOf(req.url) && from !== req.headers.get('host')))
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

    // Take a place for today, then count the places taken (this one included).
    const day = new Date(now()).toISOString().slice(0, 10)
    const place = `${day}/${id()}`
    let places = null
    let taken = 0
    try {
      places = store ? store() : null
      if (places) {
        await places.set(place, '1')
        taken = (await places.list({ prefix: `${day}/` })).blobs.length
      }
    } catch {
      places = null // the store can't be reached: not counted, and the report goes
    }
    const giveBack = async () => {
      try {
        await places?.delete(place)
      } catch { /* a place kept by mistake only makes the cap a little stricter */ }
    }
    if (taken > dailyCap) {
      await giveBack()
      return json(429, { error: 'Too many reports have been sent today. Please open it on GitHub instead.' })
    }

    const headers = new Headers(req.headers)
    headers.delete('content-length')
    let res
    try {
      res = await handler(new Request(req.url, { method: 'POST', headers, body: JSON.stringify(body) }), context)
    } catch (err) {
      await giveBack()
      throw err
    }
    // Only a report that was really sent keeps its place (the handler answers a bot 200 and sends nothing).
    if (res.status !== 200 || body.website) await giveBack()
    // Says whether the day's count could be kept (the store was reachable), so a deploy can be
    // checked without sending a report. Nothing about the count itself.
    res = new Response(res.body, { status: res.status, headers: new Headers(res.headers) })
    res.headers.set('X-Report-Counted', places ? 'yes' : 'no')
    return res
  }
}
