import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeNoteVision } from '../src/note3d.js'
import { FakeTutor } from '../src/tutor.js'

const TOKEN = 'nightly-token-0123456789abcdef'
let app: ReturnType<typeof createApp>
let db: MemoryDb

beforeEach(() => {
  db = new MemoryDb()
  app = createApp({
    db,
    verifier: new FakeVerifier(),
    tutor: new FakeTutor(),
    noteVision: new FakeNoteVision(),
    config: { allowedOrigins: ['https://solidify.studio'], tutorDailyLimit: 3, createDailyLimit: 1, adminEmails: ['boss@example.test'], evalToken: TOKEN, now: () => Date.UTC(2026, 10, 7, 10) },
  })
})

const req = (method: string, path: string, json?: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: json === undefined ? undefined : JSON.stringify(json) })
const asUser = (uid: string) => ({ Authorization: `Bearer user:${uid}:${uid}` })
const run = { runAt: Date.UTC(2026, 10, 7, 2), cases: [{ id: 'reducer', prompt: 'A gear reducer', score: 80, seconds: 61, checks: [{ name: 'builds', ok: true }] }], summary: { score: 80, passed: 1, total: 1 } }

describe('the nightly test run', () => {
  it('needs the token, and builds outside the students’ daily allowance', async () => {
    expect((await req('POST', '/v1/evals/build', { prompt: 'a shaft' })).status).toBe(401)
    expect((await req('POST', '/v1/evals/build', { prompt: 'a shaft' }, { 'x-eval-token': 'wrong-token-0123456789abcdef' })).status).toBe(401)
    for (let i = 0; i < 3; i++) {
      const res = await req('POST', '/v1/evals/build', { prompt: 'a shaft' }, { 'x-eval-token': TOKEN })
      expect(res.status).toBe(200) // the daily limit here is 1; the test run is not counted against anyone
    }
  })

  it('stores a night’s results, which only an admin can read', async () => {
    expect((await req('POST', '/v1/evals/runs', run)).status).toBe(401)
    expect((await req('POST', '/v1/evals/runs', run, { 'x-eval-token': TOKEN })).status).toBe(201)
    expect((await req('GET', '/v1/evals', undefined, asUser('sam'))).status).toBe(403)
    const got = (await (await req('GET', '/v1/evals', undefined, { Authorization: 'Bearer user:boss:Boss' })).json()) as { runs: { summary: { score: number } }[]; latest: typeof run }
    // FakeVerifier gives boss the address boss@example.test
    expect(got.runs[0].summary.score).toBe(80)
    expect(got.latest.cases[0].id).toBe('reducer')
  })

  it('refuses an eval route when no token is configured', async () => {
    const open = createApp({ db: new MemoryDb(), verifier: new FakeVerifier(), tutor: new FakeTutor(), noteVision: new FakeNoteVision(), config: { allowedOrigins: [], tutorDailyLimit: 3, adminEmails: [] } })
    expect((await open.request('/v1/evals/runs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-eval-token': '' }, body: JSON.stringify(run) })).status).toBe(401)
  })
})

describe('feedback events', () => {
  it('needs sign-in, counts by day and kind, keeps notes for thumbs-down only, and stores no user id', async () => {
    expect((await req('POST', '/v1/events', { kind: 'rating-up' })).status).toBe(401)
    for (const kind of ['rating-up', 'rating-up', 'rating-down', 'fix-layout']) expect((await req('POST', '/v1/events', { kind, subject: 'Gear pump', detail: kind === 'rating-down' ? 'gears floating' : undefined }, asUser('sam'))).status).toBe(201)
    expect((await req('POST', '/v1/events', { kind: 'hack' }, asUser('sam'))).status).toBe(400)
    const sum = (await (await req('GET', '/v1/events/summary', undefined, { Authorization: 'Bearer user:boss:Boss' })).json()) as { days: Record<string, unknown>[]; notes: { kind: string; detail: string }[] }
    const today = sum.days.at(-1)!
    expect(today).toMatchObject({ day: '2026-11-07', 'rating-up': 2, 'rating-down': 1, 'fix-layout': 1 })
    expect(sum.notes.map((n) => n.kind).sort()).toEqual(['fix-layout', 'rating-down'])
    expect(sum.notes.find((n) => n.kind === 'rating-down')!.detail).toBe('gears floating')
    expect(JSON.stringify(sum)).not.toContain('sam')
    expect((await req('GET', '/v1/events/summary', undefined, asUser('sam'))).status).toBe(403)
  })
})

describe('the model library and its review queue', () => {
  const boss = { Authorization: 'Bearer user:boss:Boss' }
  const draft = { title: 'Worm gear set', prompt: 'A worm and worm wheel, 30 : 1', topic: 'gears', spec: { title: 'Worm gear set', parts: [{ id: 'worm' }, { id: 'wheel' }] }, score: 92, checks: [{ name: 'layout', ok: true }] }

  it('takes drafts only from the nightly run, shows them only to admins, and publishes only what an admin approves', async () => {
    expect((await req('POST', '/v1/library/drafts', draft)).status).toBe(401)
    const { id } = (await (await req('POST', '/v1/library/drafts', draft, { 'x-eval-token': TOKEN })).json()) as { id: string }
    expect((await req('GET', '/v1/library/drafts', undefined, asUser('sam'))).status).toBe(403)
    const queue = (await (await req('GET', '/v1/library/drafts', undefined, boss)).json()) as { drafts: { id: string; parts: number; spec: unknown }[] }
    expect(queue.drafts).toHaveLength(1)
    expect(queue.drafts[0]).toMatchObject({ id, parts: 2 })
    expect(((await (await req('GET', '/v1/library')).json()) as { items: unknown[] }).items).toEqual([])

    expect((await req('POST', `/v1/library/drafts/${id}/approve`, {}, asUser('sam'))).status).toBe(403)
    expect((await req('POST', `/v1/library/drafts/${id}/approve`, { title: 'Worm and wheel, 30 : 1' }, boss)).status).toBe(200)
    const lib = (await (await req('GET', '/v1/library')).json()) as { items: Record<string, unknown>[] }
    expect(lib.items).toHaveLength(1)
    expect(lib.items[0]).toMatchObject({ id, title: 'Worm and wheel, 30 : 1', parts: 2 })
    expect(lib.items[0].spec).toBeUndefined()
    const full = (await (await req('GET', `/v1/library/${id}`)).json()) as { spec: { parts: unknown[] } }
    expect(full.spec.parts).toHaveLength(2)
    expect(((await (await req('GET', '/v1/library/drafts', undefined, boss)).json()) as { drafts: unknown[] }).drafts).toEqual([])
  })

  it('drops a rejected draft, and lets an admin take a model down', async () => {
    const { id } = (await (await req('POST', '/v1/library/drafts', draft, { 'x-eval-token': TOKEN })).json()) as { id: string }
    expect((await req('DELETE', `/v1/library/drafts/${id}`, undefined, boss)).status).toBe(200)
    expect(((await (await req('GET', '/v1/library/drafts', undefined, boss)).json()) as { drafts: unknown[] }).drafts).toEqual([])
    const second = (await (await req('POST', '/v1/library/drafts', draft, { 'x-eval-token': TOKEN })).json()) as { id: string }
    await req('POST', `/v1/library/drafts/${second.id}/approve`, {}, boss)
    expect((await req('DELETE', `/v1/library/${second.id}`, undefined, asUser('sam'))).status).toBe(403)
    expect((await req('DELETE', `/v1/library/${second.id}`, undefined, boss)).status).toBe(200)
    expect((await req('GET', `/v1/library/${second.id}`)).status).toBe(404)
  })

  it('tells the account whether it is an admin', async () => {
    expect(((await (await req('GET', '/v1/me', undefined, boss)).json()) as { isAdmin?: boolean }).isAdmin).toBe(true)
    expect(((await (await req('GET', '/v1/me', undefined, asUser('sam'))).json()) as { isAdmin?: boolean }).isAdmin).toBeUndefined()
  })
})

describe('what AI actions cost', () => {
  const boss = { Authorization: 'Bearer user:boss:Boss' }

  it('counts tokens by kind of action (a build, an edit, a question, a photo), without names', async () => {
    await req('POST', '/v1/create-3d', { prompt: 'a gear pump' }, asUser('a'))
    await (await req('POST', '/v1/create-3d/stream', { prompt: 'make it bigger', currentSpec: { title: 'Pump', parts: [] } }, asUser('b'))).text()
    await (await req('POST', '/v1/create-3d/stream', { prompt: 'why two gears?', currentSpec: { title: 'Pump', parts: [] } }, asUser('c'))).text()
    await req('POST', '/v1/create-3d', { prompt: 'this', photoBase64: 'data:image/jpeg;base64,/9j/AAAA' }, asUser('d'))
    expect((await req('GET', '/v1/ai-usage', undefined, asUser('a'))).status).toBe(403)
    const got = (await (await req('GET', '/v1/ai-usage', undefined, boss)).json()) as { days: Record<string, number | string>[] }
    const today = got.days.at(-1)!
    expect(today).toMatchObject({ day: '2026-11-07', build_n: 1, edit_n: 1, question_n: 1, photo_n: 1 })
    expect(Number(today.photo_in)).toBeGreaterThan(Number(today.build_in))
    expect(Number(today.build_out)).toBeGreaterThan(0)
    expect(JSON.stringify(got)).not.toMatch(/"(a|b|c|d)"/)
  })

  it('returns the tokens a test build used, and stops test builds at 200 a day', async () => {
    const first = (await (await req('POST', '/v1/evals/build', { prompt: 'a shaft' }, { 'x-eval-token': TOKEN })).json()) as { usage: { input: number; output: number } }
    expect(first.usage.input).toBeGreaterThan(0)
    for (let i = 1; i < 200; i++) expect((await req('POST', '/v1/evals/build', { prompt: 'a shaft' }, { 'x-eval-token': TOKEN })).status).toBe(200)
    expect((await req('POST', '/v1/evals/build', { prompt: 'a shaft' }, { 'x-eval-token': TOKEN })).status).toBe(429)
    // test builds are not counted as student actions
    const got = (await (await req('GET', '/v1/ai-usage', undefined, boss)).json()) as { days: Record<string, unknown>[] }
    expect(got.days.at(-1)!.build_n).toBeUndefined()
  })
})
