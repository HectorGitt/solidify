import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { AuthUser, Verifier } from './auth.js'
import type { Db } from './db.js'
import { MAX_ENTRIES, emptyProgress, entryCount, mergeProgress, progressSchema, type Progress } from './progress.js'
import { SYSTEM_PROMPT, buildTurns, tutorRequest, type TutorModel } from './tutor.js'

export interface Config {
  /** browser origins allowed to call the API */
  allowedOrigins: string[]
  /** tutor questions per user per UTC day */
  tutorDailyLimit: number
  /** emails allowed to read the feedback queue */
  adminEmails: string[]
  now?: () => number
}

export interface Deps {
  db: Db
  verifier: Verifier
  tutor: TutorModel
  config: Config
}

type Role = 'student' | 'teacher'

interface UserDoc {
  [k: string]: unknown
  displayName: string
  email?: string
  role: Role
  createdAt: number
}

interface ClassDoc {
  [k: string]: unknown
  name: string
  teacherUid: string
  teacherName: string
  code: string
  createdAt: number
}

interface MemberDoc {
  [k: string]: unknown
  displayName: string
  joinedAt: number
}

type AssignmentKind = 'scene' | 'question' | 'challenge'

interface AssignmentDoc {
  [k: string]: unknown
  kind: AssignmentKind
  ref: string
  title: string
  due?: number
  better?: 'higher' | 'lower'
  createdAt: number
}

type Env = { Variables: { user: AuthUser | null } }

const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 429, message: string) => new HTTPException(status, { message })

/** Parse a JSON body against a schema, or answer 400 with the first problem. */
async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw fail(400, 'Body must be JSON.')
  }
  const r = schema.safeParse(raw)
  if (!r.success) {
    const i = r.error.issues[0]
    throw fail(400, `${i.path.join('.') || 'body'}: ${i.message}`)
  }
  return r.data
}

/** Class join codes: 6 characters, no look-alikes (0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function randomCode(n = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

const randomId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16)

const day = (t: number) => new Date(t).toISOString().slice(0, 10)

export function createApp({ db, verifier, tutor, config }: Deps) {
  const now = config.now ?? Date.now
  const app = new Hono<Env>()

  app.use(
    '*',
    cors({
      origin: (o) => (config.allowedOrigins.includes(o) ? o : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 3600,
    }),
  )

  // Sign-in is optional on every route; routes that need it call `requireUser`.
  app.use('/v1/*', async (c, next) => {
    const h = c.req.header('Authorization')
    let user: AuthUser | null = null
    if (h?.startsWith('Bearer ')) {
      try {
        user = await verifier.verify(h.slice(7))
      } catch {
        throw fail(401, 'Sign-in expired or invalid. Please sign in again.')
      }
    }
    c.set('user', user)
    await next()
  })

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
    console.error(err)
    return c.json({ error: 'Something went wrong on the server.' }, 500)
  })

  const requireUser = (c: Context<Env>) => {
    const u = c.get('user')
    if (!u) throw fail(401, 'Sign in to use this.')
    return u
  }

  /** The user's profile, created on first use. */
  async function profile(u: AuthUser): Promise<UserDoc> {
    return db.transact<UserDoc>(`users/${u.uid}`, (prev) =>
      prev ?? { displayName: u.name || u.email?.split('@')[0] || 'Student', email: u.email, role: 'student', createdAt: now() },
    )
  }

  async function loadClass(id: string) {
    const cls = await db.get<ClassDoc>(`classes/${id}`)
    if (!cls) throw fail(404, 'Class not found.')
    return cls
  }

  async function requireTeacherOf(c: Context<Env>, id: string) {
    const u = requireUser(c)
    const cls = await loadClass(id)
    if (cls.teacherUid !== u.uid) throw fail(403, 'Only the class teacher can do this.')
    return { u, cls }
  }

  async function requireMemberOrTeacher(c: Context<Env>, id: string) {
    const u = requireUser(c)
    const cls = await loadClass(id)
    const isTeacher = cls.teacherUid === u.uid
    if (!isTeacher && !(await db.get(`classes/${id}/members/${u.uid}`))) throw fail(403, 'You are not in this class.')
    return { u, cls, isTeacher }
  }

  app.get('/health', (c) => c.json({ ok: true }))

  /* ------------------------------------------------------------------ account */

  app.get('/v1/me', async (c) => {
    const u = requireUser(c)
    const p = await profile(u)
    const classes = await db.list<{ name: string; role: Role }>(`users/${u.uid}/classes`)
    return c.json({ uid: u.uid, ...p, classes: classes.map((r) => ({ id: r.id, ...r.data })) })
  })

  app.patch('/v1/me', async (c) => {
    const u = requireUser(c)
    const patch = await body(c, z.object({ displayName: z.string().trim().min(1).max(60).optional(), role: z.enum(['student', 'teacher']).optional() }))
    await profile(u)
    await db.set(`users/${u.uid}`, patch, { merge: true })
    return c.json({ uid: u.uid, ...(await db.get<UserDoc>(`users/${u.uid}`)) })
  })

  /* ------------------------------------------------------------------ progress sync */

  app.get('/v1/progress', async (c) => {
    const u = requireUser(c)
    const p = await db.get<Progress & { updatedAt: number }>(`progress/${u.uid}`)
    return c.json({ progress: p ? { scenes: p.scenes, questions: p.questions, challenges: p.challenges } : emptyProgress(), updatedAt: p?.updatedAt ?? 0 })
  })

  /** Send this device's progress; get back the merge of it and the cloud copy. */
  app.post('/v1/progress/sync', async (c) => {
    const u = requireUser(c)
    const { progress } = await body(c, z.object({ progress: progressSchema }))
    if (entryCount(progress) > MAX_ENTRIES) throw fail(413, 'Too much progress data.')
    const t = now()
    const merged = await db.transact<Progress & { updatedAt: number }>(`progress/${u.uid}`, (prev) => ({
      ...mergeProgress(prev ? { scenes: prev.scenes, questions: prev.questions, challenges: prev.challenges } : emptyProgress(), progress),
      updatedAt: t,
    }))
    if (entryCount(merged) > MAX_ENTRIES) throw fail(413, 'Too much progress data.')
    return c.json({ progress: { scenes: merged.scenes, questions: merged.questions, challenges: merged.challenges }, updatedAt: t })
  })

  /* ------------------------------------------------------------------ tutor */

  app.post('/v1/tutor', async (c) => {
    const u = requireUser(c)
    const req = await body(c, tutorRequest)
    const t = now()
    const usage = await db.transact<{ count: number }>(`tutorUsage/${u.uid}_${day(t)}`, (prev) => ({ count: (prev?.count ?? 0) + 1 }))
    if (usage.count > config.tutorDailyLimit) throw fail(429, `You've reached today's limit of ${config.tutorDailyLimit} tutor questions. It resets at midnight UTC.`)
    const remaining = config.tutorDailyLimit - usage.count

    return streamSSE(c, async (stream) => {
      const ac = new AbortController()
      stream.onAbort(() => ac.abort())
      await stream.writeSSE({ event: 'meta', data: JSON.stringify({ remaining }) })
      try {
        for await (const text of tutor.stream({ system: SYSTEM_PROMPT, turns: buildTurns(req), signal: ac.signal })) {
          await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text }) })
        }
        await stream.writeSSE({ event: 'done', data: '{}' })
      } catch (e) {
        if (ac.signal.aborted) return
        console.error('tutor', e)
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: 'The tutor could not answer just now. Please try again.' }) })
      }
    })
  })

  /* ------------------------------------------------------------------ classes */

  app.post('/v1/classes', async (c) => {
    const u = requireUser(c)
    const { name } = await body(c, z.object({ name: z.string().trim().min(1).max(80) }))
    const p = await profile(u)
    if (p.role !== 'teacher') throw fail(403, 'Switch your account to teacher to create classes.')
    const id = randomId()
    let code = ''
    for (let i = 0; i < 8 && !code; i++) {
      const candidate = randomCode()
      if (await db.create(`classCodes/${candidate}`, { classId: id })) code = candidate
    }
    if (!code) throw new Error('could not allocate a class code')
    const cls: ClassDoc = { name, teacherUid: u.uid, teacherName: p.displayName, code, createdAt: now() }
    await db.set(`classes/${id}`, cls)
    await db.set(`users/${u.uid}/classes/${id}`, { name, role: 'teacher' })
    return c.json({ id, ...cls }, 201)
  })

  app.get('/v1/classes', async (c) => {
    const u = requireUser(c)
    const rows = await db.list<{ name: string; role: Role }>(`users/${u.uid}/classes`)
    return c.json({ classes: rows.map((r) => ({ id: r.id, ...r.data })) })
  })

  app.post('/v1/classes/join', async (c) => {
    const u = requireUser(c)
    const { code } = await body(c, z.object({ code: z.string().trim().toUpperCase().length(6) }))
    const link = await db.get<{ classId: string }>(`classCodes/${code}`)
    if (!link) throw fail(404, 'No class has that code. Check it with your teacher.')
    const cls = await loadClass(link.classId)
    if (cls.teacherUid === u.uid) throw fail(409, 'You teach this class.')
    const p = await profile(u)
    await db.set(`classes/${link.classId}/members/${u.uid}`, { displayName: p.displayName, joinedAt: now() } satisfies MemberDoc)
    await db.set(`users/${u.uid}/classes/${link.classId}`, { name: cls.name, role: 'student' })
    return c.json({ id: link.classId, name: cls.name, teacherName: cls.teacherName })
  })

  app.get('/v1/classes/:id', async (c) => {
    const id = c.req.param('id')
    const { cls, isTeacher } = await requireMemberOrTeacher(c, id)
    const members = isTeacher ? (await db.list<MemberDoc>(`classes/${id}/members`)).map((r) => ({ uid: r.id, ...r.data })) : undefined
    return c.json({ id, name: cls.name, teacherName: cls.teacherName, code: isTeacher ? cls.code : undefined, isTeacher, members })
  })

  /** Teacher removes a student, or a student leaves. */
  app.delete('/v1/classes/:id/members/:uid', async (c) => {
    const id = c.req.param('id')
    const target = c.req.param('uid')
    const u = requireUser(c)
    const cls = await loadClass(id)
    if (cls.teacherUid !== u.uid && u.uid !== target) throw fail(403, 'Only the teacher can remove other students.')
    await db.delete(`classes/${id}/members/${target}`)
    await db.delete(`users/${target}/classes/${id}`)
    return c.body(null, 204)
  })

  const assignmentInput = z.object({
    kind: z.enum(['scene', 'question', 'challenge']),
    ref: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160),
    due: z.number().int().positive().optional(),
    better: z.enum(['higher', 'lower']).optional(),
  })

  app.post('/v1/classes/:id/assignments', async (c) => {
    const id = c.req.param('id')
    await requireTeacherOf(c, id)
    const a = await body(c, assignmentInput)
    const aid = randomId()
    const doc: AssignmentDoc = { ...a, createdAt: now() }
    await db.set(`classes/${id}/assignments/${aid}`, doc)
    return c.json({ id: aid, ...doc }, 201)
  })

  app.get('/v1/classes/:id/assignments', async (c) => {
    const id = c.req.param('id')
    await requireMemberOrTeacher(c, id)
    const rows = await db.list<AssignmentDoc>(`classes/${id}/assignments`)
    return c.json({ assignments: rows.map((r) => ({ id: r.id, ...r.data })).sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity) || a.createdAt - b.createdAt) })
  })

  app.delete('/v1/classes/:id/assignments/:aid', async (c) => {
    const id = c.req.param('id')
    await requireTeacherOf(c, id)
    await db.delete(`classes/${id}/assignments/${c.req.param('aid')}`)
    return c.body(null, 204)
  })

  /** Per-student status for every assignment, from each student's synced progress. */
  async function dashboard(id: string) {
    const [members, assignments] = await Promise.all([db.list<MemberDoc>(`classes/${id}/members`), db.list<AssignmentDoc>(`classes/${id}/assignments`)])
    const progress = await Promise.all(members.map((m) => db.get<Progress>(`progress/${m.id}`)))
    const sorted = assignments.map((r) => ({ id: r.id, ...r.data })).sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity) || a.createdAt - b.createdAt)
    const students = members.map((m, i) => {
      const p = progress[i] ?? emptyProgress()
      const results = sorted.map((a) => assignmentStatus(a, p))
      return { uid: m.id, displayName: m.data.displayName, completed: results.filter((r) => r.complete).length, results }
    })
    return { assignments: sorted, students }
  }

  app.get('/v1/classes/:id/dashboard', async (c) => {
    const id = c.req.param('id')
    const { cls } = await requireTeacherOf(c, id)
    return c.json({ class: { id, name: cls.name }, ...(await dashboard(id)) })
  })

  app.get('/v1/classes/:id/dashboard.csv', async (c) => {
    const id = c.req.param('id')
    const { cls } = await requireTeacherOf(c, id)
    const d = await dashboard(id)
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = [
      ['Student', 'Completed', ...d.assignments.map((a) => a.title)],
      ...d.students.map((s) => [s.displayName, `${s.completed}/${d.assignments.length}`, ...s.results.map((r) => r.label)]),
    ]
    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', `attachment; filename="${cls.name.replace(/[^\w -]/g, '').trim() || 'class'} results.csv"`)
    return c.body(rows.map((r) => r.map(esc).join(',')).join('\r\n'))
  })

  /** Challenge leaderboard for a class: members' synced best scores. */
  app.get('/v1/classes/:id/leaderboard', async (c) => {
    const id = c.req.param('id')
    const { u } = await requireMemberOrTeacher(c, id)
    const challenge = z.string().min(1).max(120).safeParse(c.req.query('challenge'))
    if (!challenge.success) throw fail(400, 'challenge: required')
    const members = await db.list<MemberDoc>(`classes/${id}/members`)
    const entries = (
      await Promise.all(
        members.map(async (m) => {
          const p = await db.get<Progress>(`progress/${m.id}`)
          const ch = p?.challenges?.[challenge.data]
          return ch?.best === undefined ? null : { uid: m.id, displayName: m.data.displayName, best: ch.best, better: ch.better, done: ch.done }
        }),
      )
    ).filter((e) => e !== null)
    const better = (c.req.query('better') as 'higher' | 'lower' | undefined) ?? entries.find((e) => e.better)?.better ?? 'higher'
    entries.sort((a, b) => (better === 'lower' ? a.best - b.best : b.best - a.best) || a.done - b.done)
    return c.json({ challenge: challenge.data, better, entries: entries.map((e, i) => ({ rank: i + 1, displayName: e.displayName, best: e.best, you: e.uid === u.uid })) })
  })

  /* ------------------------------------------------------------------ shared scene links */

  const shareInput = z.object({
    route: z.string().regex(/^\/[\w\-/]*$/).max(200),
    title: z.string().trim().max(160).optional(),
    /** camera, cut, params etc. — opaque to the API */
    state: z.record(z.string().max(60), z.unknown()),
  })

  app.post('/v1/shares', async (c) => {
    const u = requireUser(c)
    const s = await body(c, shareInput)
    if (JSON.stringify(s.state).length > 16_000) throw fail(413, 'Scene state is too large to share.')
    const id = randomCode(8).toLowerCase()
    await db.set(`shares/${id}`, { ...s, createdBy: u.uid, createdAt: now() })
    return c.json({ id }, 201)
  })

  /** Public: anyone with the link can open it. */
  app.get('/v1/shares/:id', async (c) => {
    const s = await db.get<{ route: string; title?: string; state: Record<string, unknown>; createdAt: number }>(`shares/${c.req.param('id').toLowerCase()}`)
    if (!s) throw fail(404, 'This link has expired or never existed.')
    return c.json({ route: s.route, title: s.title, state: s.state, createdAt: s.createdAt })
  })

  /* ------------------------------------------------------------------ waiting list */

  const waitlistInput = z.object({
    email: z.string().trim().toLowerCase().email().max(200),
    name: z.string().trim().max(80).optional(),
    role: z.enum(['student', 'teacher', 'engineer', 'other']),
    interest: z.array(z.enum(['describe', 'photo', 'customize', 'chat', 'classroom'])).max(5).default([]),
    useCase: z.string().trim().max(1000).optional(),
    organisation: z.string().trim().max(120).optional(),
    /** honeypot: a hidden field people never fill in */
    website: z.string().max(200).optional(),
  })

  /** Join the "Create in 3D" waiting list. Same answer whether new or already listed. */
  app.post('/v1/waitlist', async (c) => {
    const w = await body(c, waitlistInput)
    if (w.website) return c.json({ ok: true }, 201) // a bot: accept silently, store nothing
    const { website: _ignored, ...entry } = w
    void _ignored
    const u = c.get('user')
    await db.create(`waitlist/${encodeURIComponent(entry.email)}`, { ...entry, uid: u?.uid ?? null, createdAt: now() })
    return c.json({ ok: true }, 201)
  })

  const requireAdmin = (c: Context<Env>) => {
    const u = requireUser(c)
    if (!u.email || !config.adminEmails.includes(u.email.toLowerCase())) throw fail(403, 'Admins only.')
    return u
  }

  app.get('/v1/waitlist', async (c) => {
    requireAdmin(c)
    const rows = await db.list<Record<string, unknown> & { createdAt: number }>('waitlist', { limit: 5000 })
    return c.json({ count: rows.length, entries: rows.map((r) => r.data).sort((a, b) => a.createdAt - b.createdAt) })
  })

  app.get('/v1/waitlist.csv', async (c) => {
    requireAdmin(c)
    const rows = (await db.list<Record<string, unknown> & { createdAt: number }>('waitlist', { limit: 5000 })).map((r) => r.data).sort((a, b) => a.createdAt - b.createdAt)
    const esc = (v: unknown) => {
      const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const head = ['Joined', 'Email', 'Name', 'Role', 'Interested in', 'Organisation', 'What they would make']
    const lines = rows.map((r) => [new Date(r.createdAt).toISOString().slice(0, 10), r.email, r.name, r.role, r.interest, r.organisation, r.useCase].map(esc).join(','))
    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', 'attachment; filename="solidify-waitlist.csv"')
    return c.body([head.join(','), ...lines].join('\r\n'))
  })

  /* ------------------------------------------------------------------ feedback */

  const feedbackInput = z.object({
    kind: z.enum(['bug', 'error', 'idea']),
    message: z.string().trim().min(3).max(4000),
    route: z.string().max(200).optional(),
    partId: z.string().max(120).optional(),
    contact: z.string().trim().max(200).optional(),
  })

  /** Anyone can report a problem; signed-in reports are linked to the account. */
  app.post('/v1/feedback', async (c) => {
    const f = await body(c, feedbackInput)
    const u = c.get('user')
    await db.set(`feedback/${now()}_${randomId()}`, { ...f, uid: u?.uid ?? null, status: 'new', createdAt: now(), userAgent: c.req.header('User-Agent')?.slice(0, 200) ?? null })
    return c.json({ ok: true }, 201)
  })

  app.get('/v1/feedback', async (c) => {
    const u = requireUser(c)
    if (!u.email || !config.adminEmails.includes(u.email.toLowerCase())) throw fail(403, 'Admins only.')
    const rows = await db.list(`feedback`, { limit: 500 })
    return c.json({ feedback: rows.map((r) => ({ id: r.id, ...r.data })).reverse() })
  })

  return app
}

/** How far a student has got with one assignment. */
export function assignmentStatus(a: Pick<AssignmentDoc, 'kind' | 'ref' | 'due'>, p: Progress) {
  if (a.kind === 'scene') {
    const s = p.scenes[a.ref]
    const complete = !!s?.tour
    return { complete, at: s?.tour ?? s?.opened, label: s?.tour ? 'Toured' : s?.opened ? 'Opened' : 'Not started' }
  }
  if (a.kind === 'question') {
    const q = p.questions[a.ref]
    const complete = (q?.correct ?? 0) > 0
    return { complete, at: q?.last, attempts: q?.attempts ?? 0, label: complete ? `Solved (${q!.attempts} tries)` : q?.attempts ? `${q.attempts} tries` : 'Not started' }
  }
  const ch = p.challenges[a.ref]
  return { complete: !!ch, at: ch?.done, best: ch?.best, label: ch ? (ch.best !== undefined ? `Done, best ${Number(ch.best.toPrecision(4))}` : 'Done') : 'Not started' }
}
