import { beforeEach, describe, expect, it } from 'vitest'
import { assignmentStatus, createApp, randomCode } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { emptyProgress } from '../src/progress.js'
import { FakeTutor, buildTurns, contextBlock, tutorRequest } from '../src/tutor.js'

let db: MemoryDb
let tutor: FakeTutor
let clock: number
let app: ReturnType<typeof createApp>

beforeEach(() => {
  db = new MemoryDb()
  tutor = new FakeTutor()
  clock = Date.UTC(2026, 9, 24, 10)
  app = createApp({
    db,
    verifier: new FakeVerifier(),
    tutor,
    config: { allowedOrigins: ['https://solidify.studio'], tutorDailyLimit: 3, adminEmails: ['boss@example.test'], now: () => clock },
  })
})

const as = (user: string | null) => ({
  get: (path: string) => app.request(path, { headers: user ? { Authorization: `Bearer user:${user}` } : {} }),
  del: (path: string) => app.request(path, { method: 'DELETE', headers: user ? { Authorization: `Bearer user:${user}` } : {} }),
  send: (method: string, path: string, json: unknown) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer user:${user}` } : {}) }, body: JSON.stringify(json) }),
})

const teacher = async (uid = 'tina:Tina') => {
  await as(uid).send('PATCH', '/v1/me', { role: 'teacher' })
  const res = await as(uid).send('POST', '/v1/classes', { name: 'AEE 500L Farm Power' })
  return (await res.json()) as { id: string; code: string }
}

/** Parse an SSE body into [event, data] pairs. */
async function events(res: Response) {
  const text = await res.text()
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const ev = /event: (.*)/.exec(block)?.[1] ?? 'message'
      const data = /data: (.*)/.exec(block)?.[1] ?? ''
      return [ev, JSON.parse(data)] as const
    })
}

describe('auth and account', () => {
  it('answers health checks without sign-in', async () => {
    expect((await app.request('/health')).status).toBe(200)
  })

  it('refuses signed-in routes without a token and rejects bad tokens', async () => {
    expect((await as(null).get('/v1/me')).status).toBe(401)
    const bad = await app.request('/v1/me', { headers: { Authorization: 'Bearer nonsense' } })
    expect(bad.status).toBe(401)
    expect((await bad.json()).error).toMatch(/sign in again/i)
  })

  it('creates a student profile on first sign-in and lets the user rename and switch role', async () => {
    const me = await (await as('ada:Ada Obi').get('/v1/me')).json()
    expect(me).toMatchObject({ uid: 'ada', displayName: 'Ada Obi', role: 'student', classes: [] })
    const patched = await (await as('ada').send('PATCH', '/v1/me', { displayName: 'Ada O.', role: 'teacher' })).json()
    expect(patched).toMatchObject({ displayName: 'Ada O.', role: 'teacher' })
    expect((await as('ada').send('PATCH', '/v1/me', { role: 'admin' })).status).toBe(400)
  })

  it('only allows browser calls from listed origins', async () => {
    const ok = await app.request('/health', { headers: { Origin: 'https://solidify.studio' } })
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://solidify.studio')
    const other = await app.request('/health', { headers: { Origin: 'https://evil.example' } })
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('progress sync', () => {
  it('merges each device into the cloud copy and returns the result', async () => {
    const phone = { scenes: { belts: { opened: 100 } }, questions: { q1: { attempts: 1, correct: 0, last: 100 } }, challenges: {} }
    const laptop = { scenes: { belts: { opened: 50, tour: 200 } }, questions: { q1: { attempts: 2, correct: 1, last: 300 } }, challenges: { dyno: { done: 250, best: 31, better: 'higher' } } }
    await as('ada').send('POST', '/v1/progress/sync', { progress: phone })
    const res = await (await as('ada').send('POST', '/v1/progress/sync', { progress: laptop })).json()
    expect(res.progress).toEqual({
      scenes: { belts: { opened: 50, tour: 200 } },
      questions: { q1: { attempts: 2, correct: 1, last: 300 } },
      challenges: { dyno: { done: 250, best: 31, better: 'higher' } },
    })
    expect((await (await as('ada').get('/v1/progress')).json()).progress).toEqual(res.progress)
  })

  it('keeps each user’s progress separate', async () => {
    await as('ada').send('POST', '/v1/progress/sync', { progress: { scenes: { belts: { opened: 1 } } } })
    expect((await (await as('ben').get('/v1/progress')).json()).progress).toEqual(emptyProgress())
  })

  it('rejects malformed progress with a readable message', async () => {
    const res = await as('ada').send('POST', '/v1/progress/sync', { progress: { questions: { q: { attempts: 'x', correct: 0 } } } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/progress\.questions\.q\.attempts/)
  })
})

describe('tutor', () => {
  const ask = { question: 'Why does the governor droop?', context: { scene: 'Air cleaner & governor', part: { name: 'Flyweights' }, live: { 'Engine speed (rpm)': 2104.37 } } }

  it('streams the answer with the remaining quota first', async () => {
    const res = await as('ada').send('POST', '/v1/tutor', ask)
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/)
    const ev = await events(res)
    expect(ev[0]).toEqual(['meta', { remaining: 2 }])
    expect(ev.filter(([e]) => e === 'delta').map(([, d]) => d.text).join('')).toContain('Why does the governor droop?')
    expect(ev.at(-1)?.[0]).toBe('done')
  })

  it('sends the on-screen context to the model as a delimited data block', async () => {
    await (await as('ada').send('POST', '/v1/tutor', ask)).text()
    const last = tutor.last!.turns.at(-1)!.text
    expect(last).toContain('<app_context>')
    expect(last).toContain('Selected part: Flyweights')
    expect(last).toContain('Engine speed (rpm): 2104.4')
    expect(tutor.last!.system).toMatch(/not instructions/)
  })

  it('enforces the daily limit per user and resets the next day', async () => {
    for (let i = 0; i < 3; i++) await (await as('ada').send('POST', '/v1/tutor', ask)).text()
    const over = await as('ada').send('POST', '/v1/tutor', ask)
    expect(over.status).toBe(429)
    expect((await as('ben').send('POST', '/v1/tutor', ask)).status).toBe(200)
    clock += 24 * 3600 * 1000
    expect((await as('ada').send('POST', '/v1/tutor', ask)).status).toBe(200)
  })

  it('needs sign-in and a question', async () => {
    expect((await as(null).send('POST', '/v1/tutor', ask)).status).toBe(401)
    expect((await as('ada').send('POST', '/v1/tutor', { question: '' })).status).toBe(400)
  })

  it('reports a model failure as an error event instead of dropping the stream', async () => {
    tutor.stream = async function* () {
      throw new Error('quota exceeded')
    }
    const ev = await events(await as('ada').send('POST', '/v1/tutor', ask))
    expect(ev.at(-1)?.[0]).toBe('error')
  })

  it('builds turns from history plus the context-wrapped question', () => {
    const req = tutorRequest.parse({ question: 'And now?', history: [{ role: 'user', text: 'hi' }, { role: 'model', text: 'hello' }] })
    const turns = buildTurns(req)
    expect(turns.map((t) => t.role)).toEqual(['user', 'model', 'user'])
    expect(contextBlock({})).toContain('No scene is open')
  })
})

describe('classes', () => {
  it('only teachers can create classes; each gets a unique join code', async () => {
    expect((await as('ada').send('POST', '/v1/classes', { name: 'X' })).status).toBe(403)
    const cls = await teacher()
    expect(cls.code).toMatch(/^[A-Z2-9]{6}$/)
    expect(await db.get(`classCodes/${cls.code}`)).toEqual({ classId: cls.id })
  })

  it('students join with the code (any case) and see the class in their account', async () => {
    const cls = await teacher()
    const joined = await (await as('ada:Ada').send('POST', '/v1/classes/join', { code: cls.code.toLowerCase() })).json()
    expect(joined).toMatchObject({ id: cls.id, name: 'AEE 500L Farm Power', teacherName: 'Tina' })
    expect((await (await as('ada').get('/v1/me')).json()).classes).toEqual([{ id: cls.id, name: 'AEE 500L Farm Power', role: 'student' }])
    expect((await as('ada').send('POST', '/v1/classes/join', { code: 'ZZZZZZ' })).status).toBe(404)
  })

  it('shows the roster and code to the teacher only', async () => {
    const cls = await teacher()
    await as('ada:Ada').send('POST', '/v1/classes/join', { code: cls.code })
    const t = await (await as('tina').get(`/v1/classes/${cls.id}`)).json()
    expect(t).toMatchObject({ isTeacher: true, code: cls.code, members: [{ uid: 'ada', displayName: 'Ada' }] })
    const s = await (await as('ada').get(`/v1/classes/${cls.id}`)).json()
    expect(s.code).toBeUndefined()
    expect(s.members).toBeUndefined()
    expect((await as('ben').get(`/v1/classes/${cls.id}`)).status).toBe(403)
  })

  it('teacher assigns work; the dashboard and CSV show each student’s status', async () => {
    const cls = await teacher()
    await as('ada:Ada').send('POST', '/v1/classes/join', { code: cls.code })
    await as('ben:Ben, Jr').send('POST', '/v1/classes/join', { code: cls.code })
    expect((await as('ada').send('POST', `/v1/classes/${cls.id}/assignments`, { kind: 'scene', ref: 'belts', title: 'Belts' })).status).toBe(403)
    await as('tina').send('POST', `/v1/classes/${cls.id}/assignments`, { kind: 'scene', ref: 'belts', title: 'Belt drives', due: clock + 1000 })
    await as('tina').send('POST', `/v1/classes/${cls.id}/assignments`, { kind: 'question', ref: 'q-belt-1', title: 'Belt tension' })
    await as('ada').send('POST', '/v1/progress/sync', { progress: { scenes: { belts: { opened: 1, tour: 2 } }, questions: { 'q-belt-1': { attempts: 2, correct: 1 } } } })

    const list = await (await as('ada').get(`/v1/classes/${cls.id}/assignments`)).json()
    expect(list.assignments.map((a: { title: string }) => a.title)).toEqual(['Belt drives', 'Belt tension'])

    const d = await (await as('tina').get(`/v1/classes/${cls.id}/dashboard`)).json()
    const ada = d.students.find((s: { uid: string }) => s.uid === 'ada')
    const ben = d.students.find((s: { uid: string }) => s.uid === 'ben')
    expect(ada.completed).toBe(2)
    expect(ada.results.map((r: { label: string }) => r.label)).toEqual(['Toured', 'Solved (2 tries)'])
    expect(ben.completed).toBe(0)
    expect((await as('ada').get(`/v1/classes/${cls.id}/dashboard`)).status).toBe(403)

    const csv = await (await as('tina').get(`/v1/classes/${cls.id}/dashboard.csv`)).text()
    expect(csv.split('\r\n')[0]).toBe('Student,Completed,Belt drives,Belt tension')
    expect(csv).toContain('Ada,2/2,Toured,Solved (2 tries)')
    expect(csv).toContain('"Ben, Jr",0/2,Not started,Not started')
  })

  it('ranks the class challenge leaderboard in the challenge direction', async () => {
    const cls = await teacher()
    for (const [u, best] of [['ada:Ada', 3.2], ['ben:Ben', 2.1], ['cy:Cy', 4.0]] as const) {
      await as(u).send('POST', '/v1/classes/join', { code: cls.code })
      await as(u.split(':')[0]).send('POST', '/v1/progress/sync', { progress: { challenges: { fuel: { done: 1, best, better: 'lower' } } } })
    }
    await as('dee:Dee').send('POST', '/v1/classes/join', { code: cls.code })
    const lb = await (await as('ada').get(`/v1/classes/${cls.id}/leaderboard?challenge=fuel`)).json()
    expect(lb.better).toBe('lower')
    expect(lb.entries.map((e: { displayName: string }) => e.displayName)).toEqual(['Ben', 'Ada', 'Cy'])
    expect(lb.entries.find((e: { you: boolean }) => e.you).displayName).toBe('Ada')
    expect((await as('ada').get(`/v1/classes/${cls.id}/leaderboard`)).status).toBe(400)
  })

  it('students can leave; teachers can remove; others cannot', async () => {
    const cls = await teacher()
    await as('ada:Ada').send('POST', '/v1/classes/join', { code: cls.code })
    await as('ben:Ben').send('POST', '/v1/classes/join', { code: cls.code })
    expect((await as('ben').del(`/v1/classes/${cls.id}/members/ada`)).status).toBe(403)
    expect((await as('ada').del(`/v1/classes/${cls.id}/members/ada`)).status).toBe(204)
    expect((await as('tina').del(`/v1/classes/${cls.id}/members/ben`)).status).toBe(204)
    expect((await (await as('tina').get(`/v1/classes/${cls.id}`)).json()).members).toEqual([])
    expect((await (await as('ada').get('/v1/me')).json()).classes).toEqual([])
  })
})

describe('shared links and feedback', () => {
  it('saves a scene view and lets anyone open it', async () => {
    expect((await as(null).send('POST', '/v1/shares', { route: '/m/pto/hookes-joint', state: {} })).status).toBe(401)
    const { id } = await (await as('ada').send('POST', '/v1/shares', { route: '/m/pto/hookes-joint', title: '45° joint', state: { camera: [1, 2, 3], params: { angle: 45 } } })).json()
    const open = await (await as(null).get(`/v1/shares/${id}`)).json()
    expect(open).toMatchObject({ route: '/m/pto/hookes-joint', title: '45° joint', state: { params: { angle: 45 } } })
    expect((await as(null).get('/v1/shares/nope')).status).toBe(404)
    expect((await as('ada').send('POST', '/v1/shares', { route: 'javascript:alert(1)', state: {} })).status).toBe(400)
  })

  it('takes reports from anyone and shows the queue to admins only', async () => {
    expect((await as(null).send('POST', '/v1/feedback', { kind: 'error', message: 'Torque should be 16 N·m', route: '/m/elements/clutch-brake' })).status).toBe(201)
    await as('ada').send('POST', '/v1/feedback', { kind: 'idea', message: 'Add a baler knotter close-up' })
    expect((await as('ada').get('/v1/feedback')).status).toBe(403)
    const q = await (await as('boss').get('/v1/feedback')).json()
    expect(q.feedback).toHaveLength(2)
    expect(q.feedback.map((f: { uid: string | null }) => f.uid).sort()).toEqual(['ada', null].sort())
  })

  it('takes sales enquiries only with an email to reply to', async () => {
    const enquiry = { kind: 'sales', message: 'Licences for our agric engineering department', name: 'Dr Bello', organisation: 'State Polytechnic', seats: '51-200' }
    expect((await as(null).send('POST', '/v1/feedback', enquiry)).status).toBe(400)
    expect((await as(null).send('POST', '/v1/feedback', { ...enquiry, contact: 'not-an-email' })).status).toBe(400)
    expect((await as(null).send('POST', '/v1/feedback', { ...enquiry, contact: 'bello@poly.edu.ng' })).status).toBe(201)
    expect((await as(null).send('POST', '/v1/feedback', { ...enquiry, contact: 'bello@poly.edu.ng', seats: 'lots' })).status).toBe(400)
    const q = await (await as('boss').get('/v1/feedback')).json()
    expect(q.feedback.find((f: { kind: string }) => f.kind === 'sales')).toMatchObject({ organisation: 'State Polytechnic', seats: '51-200', contact: 'bello@poly.edu.ng' })
  })
})

describe('helpers', () => {
  it('join codes avoid look-alike characters', () => {
    for (let i = 0; i < 200; i++) expect(randomCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/)
  })
  it('a challenge without a score still counts as done', () => {
    expect(assignmentStatus({ kind: 'challenge', ref: 'c' }, { ...emptyProgress(), challenges: { c: { done: 1 } } })).toMatchObject({ complete: true, label: 'Done' })
  })
})

describe('waiting list', () => {
  const join = (extra: Record<string, unknown> = {}) => as(null).send('POST', '/v1/waitlist', { email: 'Ada@School.edu', role: 'teacher', interest: ['describe', 'classroom'], useCase: 'Gearbox models for my class', ...extra })

  it('takes sign-ups without an account, once per email, answering the same both times', async () => {
    expect((await join()).status).toBe(201)
    expect((await join({ name: 'Ada' })).status).toBe(201)
    const list = await (await as('boss').get('/v1/waitlist')).json()
    expect(list.count).toBe(1)
    expect(list.entries[0]).toMatchObject({ email: 'ada@school.edu', role: 'teacher', interest: ['describe', 'classroom'] })
  })

  it('silently drops bots that fill the hidden field, and rejects bad emails', async () => {
    expect((await join({ email: 'bot@spam.test', website: 'http://spam' })).status).toBe(201)
    expect((await as(null).send('POST', '/v1/waitlist', { email: 'not-an-email', role: 'other' })).status).toBe(400)
    expect((await (await as('boss').get('/v1/waitlist')).json()).count).toBe(0)
  })

  it('shows the list and CSV to admins only', async () => {
    await join()
    expect((await as('ada').get('/v1/waitlist')).status).toBe(403)
    const csv = await (await as('boss').get('/v1/waitlist.csv')).text()
    const [head, row] = csv.split('\r\n')
    expect(head).toBe('Joined,Email,Name,Role,Interested in,Organisation,What they would make')
    expect(row).toContain('ada@school.edu,,teacher,describe; classroom,,Gearbox models for my class')
  })
})

describe('progress sync keeps the review schedule', () => {
  it('takes box, due and score from the copy with the latest attempt', async () => {
    await as('ada').send('POST', '/v1/progress/sync', { progress: { questions: { q: { attempts: 3, correct: 2, last: 100, box: 2, due: 5000, score: 1 } } } })
    const res = await (await as('ada').send('POST', '/v1/progress/sync', { progress: { questions: { q: { attempts: 4, correct: 2, last: 200, box: 0, due: 900, score: 0.5 } } } })).json()
    expect(res.progress.questions.q).toEqual({ attempts: 4, correct: 2, last: 200, box: 0, due: 900, score: 0.5 })
    const older = await (await as('ada').send('POST', '/v1/progress/sync', { progress: { questions: { q: { attempts: 1, correct: 1, last: 50, box: 4, due: 99999, score: 1 } } } })).json()
    expect(older.progress.questions.q).toMatchObject({ last: 200, box: 0, due: 900 })
  })
})
