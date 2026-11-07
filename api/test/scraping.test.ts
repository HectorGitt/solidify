import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeNoteVision } from '../src/note3d.js'
import { RateLimiter } from '../src/ratelimit.js'
import { FakeTutor } from '../src/tutor.js'

const boss = { Authorization: 'Bearer user:boss:Boss' }
const make = (extra: Record<string, unknown> = {}, appChecker?: { verify(t: string): Promise<boolean> }) => {
  const app = createApp({ db: new MemoryDb(), verifier: new FakeVerifier(), tutor: new FakeTutor(), noteVision: new FakeNoteVision(), appChecker, config: { allowedOrigins: [], tutorDailyLimit: 3, adminEmails: ['boss@example.test'], ...extra } })
  return (method: string, path: string, json?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: json === undefined ? undefined : JSON.stringify(json) })
}

describe('against scraping', () => {
  it('keeps full library models for people signed in, a day’s worth each, and staff uncounted', async () => {
    const req = make()
    const { id } = (await (await req('POST', '/v1/library', { title: 'Pump', prompt: 'A pump', spec: { parts: [] }, score: 100 }, boss)).json()) as { id: string }
    // the cards stay public; the model itself does not
    expect((await req('GET', '/v1/library')).status).toBe(200)
    expect((await req('GET', `/v1/library/${id}`)).status).toBe(401)
    const sam = { Authorization: 'Bearer user:sam:Sam', 'X-Forwarded-For': '10.0.0.1' }
    for (let i = 0; i < 100; i++) expect((await req('GET', `/v1/library/${id}`, undefined, { ...sam, 'X-Forwarded-For': `10.0.${i}.1` })).status).toBe(200)
    expect((await req('GET', `/v1/library/${id}`, undefined, { ...sam, 'X-Forwarded-For': '10.1.0.1' })).status).toBe(429)
    expect((await req('GET', `/v1/library/${id}`, undefined, boss)).status).toBe(200)
    // what each person fetched shows when they are looked up
    await req('GET', '/v1/me', undefined, sam)
    const found = (await (await req('GET', '/v1/admin/people/lookup?email=sam@example.test', undefined, boss)).json()) as { today: { libraryModels: number } }
    expect(found.today.libraryModels).toBe(101)
  })

  it('slows one address hammering a public route, and says when to try again', async () => {
    const req = make()
    const from = (ip: string) => ({ 'X-Forwarded-For': `${ip}, 10.9.9.9` })
    for (let i = 0; i < 20; i++) expect((await req('POST', '/v1/waitlist', { email: `p${i}@example.test`, name: 'P', role: 'student', interest: ['describe'] }, from('1.2.3.4'))).status).toBe(201)
    const ninth = await req('POST', '/v1/waitlist', { email: 'p99@example.test', name: 'P', role: 'student', interest: ['describe'] }, from('1.2.3.4'))
    expect(ninth.status).toBe(429)
    expect(Number(ninth.headers.get('Retry-After'))).toBeGreaterThan(0)
    // another address is not held up
    expect((await req('POST', '/v1/waitlist', { email: 'q@example.test', name: 'Q', role: 'student', interest: ['describe'] }, from('5.6.7.8'))).status).toBe(201)
  })

  it('opens again when the window has passed', () => {
    let t = 0
    const limiter = new RateLimiter([{ name: 'x', limit: 2, windowMs: 1000, matches: () => true }], () => t)
    expect(limiter.check('a', 'GET', '/')).toBeNull()
    expect(limiter.check('a', 'GET', '/')).toBeNull()
    expect(limiter.check('a', 'GET', '/')).toMatchObject({ rule: 'x' })
    t = 1000
    expect(limiter.check('a', 'GET', '/')).toBeNull()
  })

  it('checks App Check: counted but let through when monitoring, refused when enforced, and never for the nightly run', async () => {
    const checker = { verify: async (t: string) => t === 'good' }
    const monitor = make({ appCheck: 'monitor' }, checker)
    expect((await monitor('GET', '/v1/library')).status).toBe(200)
    expect((await monitor('GET', '/v1/library', undefined, { 'X-Firebase-AppCheck': 'forged' })).status).toBe(200)
    const misses = (await (await monitor('GET', '/v1/admin/app-check', undefined, { ...boss, 'X-Firebase-AppCheck': 'good' })).json()) as { mode: string; days: Record<string, unknown>[] }
    expect(misses.mode).toBe('monitor')
    expect(misses.days.at(-1)).toMatchObject({ missing: 1, invalid: 1 })

    const enforce = make({ appCheck: 'enforce', evalToken: 'nightly-token-0123456789abcdef' }, checker)
    expect((await enforce('GET', '/v1/library')).status).toBe(401)
    expect((await enforce('GET', '/v1/library', undefined, { 'X-Firebase-AppCheck': 'good' })).status).toBe(200)
    expect((await enforce('POST', '/v1/evals/build', { prompt: 'a shaft' }, { 'x-eval-token': 'nightly-token-0123456789abcdef' })).status).toBe(200)
  })
})
