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
