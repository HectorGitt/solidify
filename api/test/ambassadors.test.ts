import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeNoteVision } from '../src/note3d.js'
import { FakeTutor } from '../src/tutor.js'

let clock = Date.UTC(2026, 10, 10, 9)
const setup = () => {
  const db = new MemoryDb()
  const app = createApp({ db, verifier: new FakeVerifier(), tutor: new FakeTutor(), noteVision: new FakeNoteVision(), config: { allowedOrigins: [], tutorDailyLimit: 3, adminEmails: ['boss@example.test'], evalToken: 'nightly-token-0123456789abcdef', now: () => clock } })
  const req = (method: string, path: string, json?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: json === undefined ? undefined : JSON.stringify(json) })
  return { db, req }
}
const as = (uid: string) => ({ Authorization: `Bearer user:${uid}:${uid[0].toUpperCase()}${uid.slice(1)}` })
const boss = { Authorization: 'Bearer user:boss:Boss' }
const application = { name: 'Ada Obi', email: 'ada@example.test', school: 'Obafemi Awolowo University', department: 'Agricultural engineering', level: '400', why: 'My classmates struggle to picture machines from the notes.' }

describe('student ambassadors', () => {
  it('apply, are accepted with a referral code, and get the dashboard', async () => {
    const { req } = setup()
    expect((await req('POST', '/v1/ambassadors/apply', application)).status).toBe(201)
    expect((await req('GET', '/v1/ambassador/me', undefined, as('ada'))).status).toBe(403)
    const list = (await (await req('GET', '/v1/admin/ambassadors', undefined, boss)).json()) as { applications: { email: string; status: string }[] }
    expect(list.applications[0]).toMatchObject({ email: 'ada@example.test', status: 'new' })
    expect((await req('POST', '/v1/admin/ambassadors/decide', { email: 'ada@example.test', decision: 'accept' }, as('sam'))).status).toBe(403)
    expect((await req('POST', '/v1/admin/ambassadors/decide', { email: 'ada@example.test', decision: 'accept' }, boss)).status).toBe(200)
    const me = (await (await req('GET', '/v1/ambassador/me', undefined, as('ada'))).json()) as { code: string; school: string; stats: { signups: number } }
    expect(me).toMatchObject({ code: 'adaobi', school: 'Obafemi Awolowo University', stats: { signups: 0 } })
    expect(((await (await req('GET', '/v1/me', undefined, as('ada'))).json()) as { roles: string[] }).roles).toContain('ambassador')
  })

  it('credit new accounts and their classes, never existing ones, and count who is still active', async () => {
    const { req } = setup()
    await req('POST', '/v1/ambassadors/apply', application)
    await req('POST', '/v1/admin/ambassadors/decide', { email: 'ada@example.test', decision: 'accept' }, boss)
    // an account made before the link was followed is not credited
    await req('GET', '/v1/me', undefined, as('old'))
    clock += 2 * 86_400_000
    expect(((await (await req('POST', '/v1/me/referral', { code: 'adaobi' }, as('old'))).json()) as { credited: boolean }).credited).toBe(false)
    // new ones are, once
    await req('GET', '/v1/me', undefined, as('tobi'))
    expect(((await (await req('POST', '/v1/me/referral', { code: 'adaobi' }, as('tobi'))).json()) as { credited: boolean }).credited).toBe(true)
    expect(((await (await req('POST', '/v1/me/referral', { code: 'adaobi' }, as('tobi'))).json()) as { credited: boolean }).credited).toBe(false)
    // a referred teacher's class counts too
    await req('GET', '/v1/me', undefined, as('drlee'))
    await req('POST', '/v1/me/referral', { code: 'adaobi' }, as('drlee'))
    await req('PATCH', '/v1/me', { role: 'teacher' }, as('drlee'))
    await req('POST', '/v1/classes', { name: 'Farm power' }, as('drlee'))
    let me = (await (await req('GET', '/v1/ambassador/me', undefined, as('ada'))).json()) as { stats: { signups: number; active: number; teachers: number; classes: number; latest: { name: string }[] } }
    expect(me.stats).toMatchObject({ signups: 2, active: 2, teachers: 1, classes: 1 })
    expect(me.stats.latest.map((l) => l.name).sort()).toEqual(['Drlee', 'Tobi'])
    // three weeks on, only someone who came back counts as active
    clock += 21 * 86_400_000
    await req('GET', '/v1/me', undefined, as('tobi'))
    me = (await (await req('GET', '/v1/ambassador/me', undefined, as('ada'))).json()) as typeof me
    expect(me.stats).toMatchObject({ signups: 2, active: 1 })
    // a paused ambassador's link credits no one
    await req('POST', '/v1/admin/ambassadors/decide', { email: 'ada@example.test', decision: 'pause' }, boss)
    await req('GET', '/v1/me', undefined, as('newer'))
    expect(((await (await req('POST', '/v1/me/referral', { code: 'adaobi' }, as('newer'))).json()) as { credited: boolean }).credited).toBe(false)
  })

  it('suggest library topics that carry their name through to the draft', async () => {
    const { req } = setup()
    await req('POST', '/v1/ambassadors/apply', application)
    await req('POST', '/v1/admin/ambassadors/decide', { email: 'ada@example.test', decision: 'accept' }, boss)
    const prompt = 'A cassava grater with a spiked drum and hopper'
    expect((await req('POST', '/v1/ambassador/suggestions', { topic: 'Processing', prompt }, as('ada'))).status).toBe(201)
    expect((await req('POST', '/v1/ambassador/suggestions', { topic: 'Processing', prompt }, as('ada'))).status).toBe(409)
    await req('POST', '/v1/library/drafts', { title: 'Cassava grater', prompt, spec: { parts: [] }, score: 92 }, { 'x-eval-token': 'nightly-token-0123456789abcdef' })
    const drafts = (await (await req('GET', '/v1/library/drafts', undefined, boss)).json()) as { drafts: { suggestedBy?: string }[] }
    expect(drafts.drafts[0].suggestedBy).toBe('Ada Obi')
    const me = (await (await req('GET', '/v1/ambassador/me', undefined, as('ada'))).json()) as { suggestions: { prompt: string }[] }
    expect(me.suggestions.map((s) => s.prompt)).toEqual([prompt])
  })
})
