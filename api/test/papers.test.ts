import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeTutor } from '../src/tutor.js'

let clock: number
let app: ReturnType<typeof createApp>

beforeEach(() => {
  clock = Date.UTC(2026, 9, 25, 9)
  app = createApp({ db: new MemoryDb(), verifier: new FakeVerifier(), tutor: new FakeTutor(), config: { allowedOrigins: [], tutorDailyLimit: 5, adminEmails: [], now: () => clock } })
})

const as = (user: string) => ({
  get: (path: string) => app.request(path, { headers: { Authorization: `Bearer user:${user}` } }),
  send: (method: string, path: string, json: unknown = {}) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer user:${user}` }, body: JSON.stringify(json) }),
})

async function classWithStudents() {
  await as('tina:Tina').send('PATCH', '/v1/me', { role: 'teacher' })
  const cls = (await (await as('tina').send('POST', '/v1/classes', { name: 'Farm Power' })).json()) as { id: string; code: string }
  for (const s of ['ada:Ada', 'ben:Ben']) await as(s).send('POST', '/v1/classes/join', { code: cls.code })
  return cls
}

describe('papers', () => {
  it('only the teacher sets papers; members see them', async () => {
    const cls = await classWithStudents()
    expect((await as('ada').send('POST', `/v1/classes/${cls.id}/papers`, { title: 'X', questionIds: ['q1'], minutes: 20 })).status).toBe(403)
    const p = await (await as('tina').send('POST', `/v1/classes/${cls.id}/papers`, { title: 'Week 3 test', questionIds: ['q1', 'q2', 'q1'], minutes: 30 })).json()
    expect(p.questionIds).toEqual(['q1', 'q2'])
    const list = await (await as('ada').get(`/v1/classes/${cls.id}/papers`)).json()
    expect(list.papers).toHaveLength(1)
    expect(list.papers[0]).toMatchObject({ title: 'Week 3 test', attempt: null })
  })

  it('a student starts once (the clock can’t be reset) and hands in once', async () => {
    const cls = await classWithStudents()
    const { id: pid } = await (await as('tina').send('POST', `/v1/classes/${cls.id}/papers`, { title: 'T', questionIds: ['q1', 'q2'], minutes: 30 })).json()
    const s1 = await (await as('ada').send('POST', `/v1/classes/${cls.id}/papers/${pid}/start`)).json()
    clock += 5 * 60_000
    const s2 = await (await as('ada').send('POST', `/v1/classes/${cls.id}/papers/${pid}/start`)).json()
    expect(s2.startedAt).toBe(s1.startedAt)
    expect(s2.endsAt - s2.startedAt).toBe(30 * 60_000)

    const sub = { answers: { q1: { bp: '13.6' } }, results: { q1: { score: 1, slips: [] }, q2: { score: 0.5, slips: ['kilo'] }, extra: { score: 1, slips: [] } } }
    const res = await as('ada').send('POST', `/v1/classes/${cls.id}/papers/${pid}/submit`, sub)
    expect(res.status).toBe(201)
    expect((await res.json()).total).toBeCloseTo(0.75) // only the paper's questions count
    expect((await as('ada').send('POST', `/v1/classes/${cls.id}/papers/${pid}/submit`, sub)).status).toBe(409)
    expect((await as('tina').send('POST', `/v1/classes/${cls.id}/papers/${pid}/start`)).status).toBe(403)
  })

  it('flags late hand-ins and shows every student to the teacher', async () => {
    const cls = await classWithStudents()
    const { id: pid } = await (await as('tina').send('POST', `/v1/classes/${cls.id}/papers`, { title: 'T', questionIds: ['q1'], minutes: 10 })).json()
    await as('ada').send('POST', `/v1/classes/${cls.id}/papers/${pid}/start`)
    clock += 15 * 60_000
    const late = await (await as('ada').send('POST', `/v1/classes/${cls.id}/papers/${pid}/submit`, { answers: {}, results: { q1: { score: 1, slips: [] } } })).json()
    expect(late.late).toBe(true)
    const r = await (await as('tina').get(`/v1/classes/${cls.id}/papers/${pid}/results`)).json()
    expect(r.students.map((s: { displayName: string; total: number | null; late: boolean }) => [s.displayName, s.total, s.late])).toEqual([
      ['Ada', 1, true],
      ['Ben', null, false],
    ])
    expect((await as('ada').get(`/v1/classes/${cls.id}/papers/${pid}/results`)).status).toBe(403)
  })

  it('gives the teacher class progress for the weak-spot report', async () => {
    const cls = await classWithStudents()
    await as('ada').send('POST', '/v1/progress/sync', { progress: { questions: { q1: { attempts: 2, correct: 1, box: 1, score: 1 } } } })
    const r = await (await as('tina').get(`/v1/classes/${cls.id}/progress`)).json()
    expect(r.students.find((s: { uid: string }) => s.uid === 'ada').questions.q1).toMatchObject({ attempts: 2, box: 1 })
    expect((await as('ada').get(`/v1/classes/${cls.id}/progress`)).status).toBe(403)
  })
})
