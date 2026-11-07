import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeNoteVision } from '../src/note3d.js'
import { FakeTutor } from '../src/tutor.js'

let clock = Date.UTC(2026, 10, 10, 9)
const setup = () => {
  const db = new MemoryDb()
  const app = createApp({ db, verifier: new FakeVerifier(), tutor: new FakeTutor(), noteVision: new FakeNoteVision(), config: { allowedOrigins: [], tutorDailyLimit: 3, adminEmails: ['boss@example.test'], now: () => clock } })
  const req = (method: string, path: string, json?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: json === undefined ? undefined : JSON.stringify(json) })
  return { db, req }
}
const as = (uid: string) => ({ Authorization: `Bearer user:${uid}:${uid[0].toUpperCase()}${uid.slice(1)}` })
const boss = { Authorization: 'Bearer user:boss:Boss' }
type Page = { accounts: { email: string; name: string; type: string; roles: string[] }[]; total: number; page: number; pages: number; counts: Record<string, number> }

describe('every account, for admins', () => {
  it('lists, searches, filters, sorts and pages them; only for admins; and as CSV', async () => {
    const { req } = setup()
    await req('GET', '/v1/me', undefined, boss)
    for (const name of ['ada', 'bola', 'chidi', 'dami', 'efe']) {
      clock += 86_400_000
      await req('GET', '/v1/me', undefined, as(name))
    }
    await req('PATCH', '/v1/me', { role: 'teacher' }, as('chidi'))
    await req('PUT', '/v1/admin/people', { email: 'dami@example.test', roles: ['reviewer'] }, boss)

    expect((await req('GET', '/v1/admin/accounts', undefined, as('ada'))).status).toBe(403)

    const get = async (q = '') => (await (await req('GET', `/v1/admin/accounts${q}`, undefined, boss)).json()) as Page
    let p = await get()
    expect(p.total).toBe(6)
    expect(p.counts).toMatchObject({ all: 6, teachers: 1, students: 5, staff: 2 })
    // newest first by default
    expect(p.accounts[0].email).toBe('efe@example.test')

    expect((await get('?q=chi')).accounts.map((a) => a.email)).toEqual(['chidi@example.test'])
    expect((await get('?type=teacher')).accounts.map((a) => a.name)).toEqual(['Chidi'])
    expect((await get('?role=reviewer')).accounts.map((a) => a.email)).toEqual(['dami@example.test'])
    expect((await get('?role=staff')).total).toBe(2)
    expect((await get('?role=none')).total).toBe(4)
    expect((await get('?sort=name&dir=asc')).accounts.map((a) => a.name).slice(0, 2)).toEqual(['Ada', 'Bola'])

    // pages of ten at least; a page past the end gives the last one
    p = await get('?size=10&page=5')
    expect(p).toMatchObject({ page: 1, pages: 1 })

    // seen recently: everyone was, until a month passes; then only who comes back
    clock += 40 * 86_400_000
    await req('GET', '/v1/me', undefined, as('bola'))
    expect((await get('?active=7')).accounts.map((a) => a.email)).toEqual(['bola@example.test'])
    expect((await get('?active=inactive')).total).toBe(5)

    const csv = await req('GET', '/v1/admin/accounts.csv?type=teacher', undefined, boss)
    expect(csv.headers.get('content-type')).toContain('text/csv')
    const text = await csv.text()
    expect(text.split('\r\n')).toHaveLength(2)
    expect(text).toContain('"chidi@example.test","teacher"')
  })

  it('accepts all five staff roles at once', async () => {
    const { req } = setup()
    const r = await req('PUT', '/v1/admin/people', { email: 'x@example.test', roles: ['admin', 'curator', 'reviewer', 'support', 'ambassador'] }, boss)
    expect(r.status).toBe(200)
  })
})
