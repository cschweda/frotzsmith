import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error — plain .mjs function code, no type declarations
import { DAILY_CAP, MAX_BODY, guardReports } from '../netlify/lib/report-guard.mjs'

// What stands in front of the report function (review 2026-11-09, docs/06-security.md §10).
const URL_ = 'https://frotzsmith.frotzinc.com/.netlify/functions/report'
const ORIGIN = 'https://frotzsmith.frotzinc.com'

type Guarded = (req: Request) => Promise<Response>
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

function setup(options: { dailyCap?: number; status?: number } = {}) {
  const seen: Record<string, unknown>[] = []
  const handler = vi.fn(async (req: Request) => {
    if (req.method === 'POST') seen.push((await req.json()) as Record<string, unknown>)
    return new Response('{"ok":true}', { status: options.status ?? 200 })
  })
  const counts = new Map<string, string>()
  // Each call yields to the event loop first, as a real store does, so posts sent together interleave.
  const tick = () => new Promise<void>(r => setTimeout(r, 0))
  const store = () => ({
    set: async (k: string, v: string) => { await tick(); counts.set(k, v) },
    list: async ({ prefix }: { prefix: string }) => { await tick(); return { blobs: [...counts.keys()].filter(k => k.startsWith(prefix)) } },
    delete: async (k: string) => { await tick(); counts.delete(k) },
  })
  let n = 0
  const guarded = guardReports(handler, { store, now: () => Date.UTC(2026, 10, 9, 12), dailyCap: options.dailyCap, id: () => `r${++n}` }) as Guarded
  return { guarded, handler, seen, counts }
}

describe('the report function’s guard', () => {
  it('passes a same-site JSON report through and counts it', async () => {
    const { guarded, seen, counts } = setup()
    const res = await guarded(post({ kind: 'problem', happened: 'x' }))
    expect(res.status).toBe(200)
    expect(seen).toEqual([{ kind: 'problem', happened: 'x' }])
    expect([...counts.keys()]).toEqual(['2026-11-09/r1'])
    expect(res.headers.get('X-Report-Counted')).toBe('yes')
  })

  it('refuses a post from another site, or with no Origin', async () => {
    const { guarded, handler } = setup()
    expect((await guarded(post({}, { Origin: 'https://evil.example' }))).status).toBe(403)
    expect((await guarded(post({}, { Origin: 'null' }))).status).toBe(403)
    const bare = new Request(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    expect((await guarded(bare)).status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses anything but application/json', async () => {
    const { guarded, handler } = setup()
    expect((await guarded(post('{}', { 'Content-Type': 'text/plain' }))).status).toBe(415)
    expect((await guarded(post('{}', { 'Content-Type': 'application/jsonp' }))).status).toBe(415)
    expect((await guarded(post({ kind: 'idea' }, { 'Content-Type': 'application/json; charset=utf-8' }))).status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('refuses a body that is too long, not JSON, or not an object', async () => {
    const { guarded, handler } = setup()
    expect((await guarded(post(JSON.stringify({ happened: 'x'.repeat(MAX_BODY) })))).status).toBe(413)
    expect((await guarded(post('not json'))).status).toBe(400)
    expect((await guarded(post('[]'))).status).toBe(400)
    expect((await guarded(post('null'))).status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })

  it('makes the title one line (it becomes the email subject)', async () => {
    const { guarded, seen } = setup()
    await guarded(post({ kind: 'problem', title: ' A\r\nBcc: x@y.z\n\tC ', happened: 'x' }))
    expect(seen[0]!.title).toBe('A Bcc: x@y.z C')
  })

  it('stops at the daily cap, and says so', async () => {
    const { guarded, handler } = setup({ dailyCap: 2 })
    expect((await guarded(post({ kind: 'idea', idea: 'a' }))).status).toBe(200)
    expect((await guarded(post({ kind: 'idea', idea: 'b' }))).status).toBe(200)
    const res = await guarded(post({ kind: 'idea', idea: 'c' }))
    expect(res.status).toBe(429)
    expect(((await res.json()) as { error: string }).error).toMatch(/GitHub/)
    expect(handler).toHaveBeenCalledTimes(2)
    expect(DAILY_CAP).toBeGreaterThan(0)
  })

  it('posts sent together can’t all slip under the cap (each takes its place before it is sent)', async () => {
    const { guarded, handler, counts } = setup({ dailyCap: 3 })
    const answers = await Promise.all(Array.from({ length: 20 }, (_, i) => guarded(post({ kind: 'idea', idea: `n${i}` }))))
    const sent = answers.filter(r => r.status === 200).length
    expect(sent).toBeLessThanOrEqual(3)
    expect(answers.filter(r => r.status === 429).length).toBe(20 - sent)
    expect(handler).toHaveBeenCalledTimes(sent)
    expect(counts.size).toBe(sent) // a refused post gave its place back
    // …and once they have settled, the cap is exact.
    while ((await guarded(post({ kind: 'idea', idea: 'more' }))).status === 200) { /* fill what is left */ }
    expect(counts.size).toBe(3)
  })

  it('counts only reports that were sent: not a refusal, not a bot', async () => {
    const refused = setup({ status: 400 })
    await refused.guarded(post({ kind: 'problem' }))
    expect(refused.counts.size).toBe(0)
    const bot = setup()
    await bot.guarded(post({ kind: 'problem', happened: 'x', website: 'http://spam' }))
    expect(bot.counts.size).toBe(0)
  })

  it('still sends when the counter can’t be opened or read', async () => {
    const handler = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    const broken = guardReports(handler, { store: () => { throw new Error('no blobs') } }) as Guarded
    const uncounted = await broken(post({ kind: 'idea', idea: 'a' }))
    expect(uncounted.status).toBe(200)
    expect(uncounted.headers.get('X-Report-Counted')).toBe('no')
    const unreadable = guardReports(handler, { store: () => ({ set: async () => { throw new Error('x') }, list: async () => ({ blobs: [] }), delete: async () => {} }) }) as Guarded
    expect((await unreadable(post({ kind: 'idea', idea: 'a' }))).status).toBe(200)
  })

  it('leaves other methods to the handler (405)', async () => {
    const { guarded, handler } = setup()
    await guarded(new Request(URL_))
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
