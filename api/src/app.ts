import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { AuthUser, Verifier } from './auth.js'
import type { Db } from './db.js'
import { MAX_ENTRIES, emptyProgress, entryCount, mergeProgress, progressSchema, type Progress } from './progress.js'
import { SYSTEM_PROMPT, buildTurns, tutorRequest, type TutorModel } from './tutor.js'
import { FakeNoteVision, ModelReplyError, create3dRequest, noteAnalyzeRequest, noteRefineRequest, readCreateReply, type Create3dRequest, type ModelUsage, type NoteVisionModel } from './note3d.js'

export interface Config {
  /** browser origins allowed to call the API */
  allowedOrigins: string[]
  /** tutor questions per user per UTC day */
  tutorDailyLimit: number
  /** note/PDF pages analyzed per user per UTC day (default 20) */
  noteDailyPageLimit?: number
  /** 3D builds and refinements per user per UTC day (default 15) */
  createDailyLimit?: number
  /** emails allowed to read the feedback queue */
  adminEmails: string[]
  /** shared secret for the nightly test run (at least 24 characters); unset = no nightly runs */
  evalToken?: string
  /** the model's list price in US dollars per million tokens, to turn token counts into cost on the admin page */
  modelPrice?: { inputPerM: number; outputPerM: number }
  /** starts the nightly test workflow on GitHub now (unset = the admin page cannot start runs) */
  dispatchRun?: (inputs: { limit?: string; drafts?: string }) => Promise<void>
  now?: () => number
}

export interface Deps {
  db: Db
  verifier: Verifier
  tutor: TutorModel
  noteVision?: NoteVisionModel
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

interface PaperDoc {
  [k: string]: unknown
  title: string
  questionIds: string[]
  minutes: number
  due?: number
  createdAt: number
}

interface SubmissionDoc {
  [k: string]: unknown
  startedAt: number
  submittedAt?: number
  late?: boolean
  answers?: Record<string, Record<string, string>>
  results?: Record<string, { score: number; slips: string[] }>
  total?: number
}

type Env = { Variables: { user: AuthUser | null } }

const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 501 | 502, message: string) => new HTTPException(status, { message })

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

export function createApp({ db, verifier, tutor, noteVision = new FakeNoteVision(), config }: Deps) {
  const now = config.now ?? Date.now
  const app = new Hono<Env>()

  app.use(
    '*',
    cors({
      origin: (o) => (config.allowedOrigins.includes(o) ? o : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

  const isAdmin = (u: { email?: string | null }) => !!u.email && config.adminEmails.includes(u.email.toLowerCase())
  const requireAdmin = (c: Context<Env>) => {
    const u = requireUser(c)
    if (!isAdmin(u)) throw fail(403, 'Admins only.')
    return u
  }

  /* ------------------------------------------------------------------ account */

  app.get('/v1/me', async (c) => {
    const u = requireUser(c)
    const p = await profile(u)
    const classes = await db.list<{ name: string; role: Role }>(`users/${u.uid}/classes`)
    return c.json({ uid: u.uid, ...p, isAdmin: isAdmin(u) || undefined, classes: classes.map((r) => ({ id: r.id, ...r.data })) })
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

  /* ------------------------------------------------------------------ notes / textbook -> 3D */

  /** counts one use against a per-user daily allowance, failing once it is spent */
  const spend = async (uid: string, bucket: string, limit: number, what: string) => {
    const usage = await db.transact<{ count: number }>(`${bucket}/${uid}_${day(now())}`, (prev) => ({ count: (prev?.count ?? 0) + 1 }))
    if (usage.count > limit) throw fail(429, `You've reached today's limit of ${limit} ${what}. It resets at midnight UTC.`)
    return limit - usage.count
  }
  /*
   * What each kind of AI action really costs, counted by day without names: the numbers credit prices are
   * set from. A question is only known to be one once the model has answered.
   */
  const actionOf = (req: Create3dRequest, isQuestion?: boolean) => (req.photoBase64 ? 'photo' : !req.currentSpec ? 'build' : isQuestion ? 'question' : 'edit')
  const recordUsage = async (action: string, u?: ModelUsage) => {
    if (!u) return
    try {
      await db.transact<Record<string, number>>(`aiUsage/${day(now())}`, (prev) => {
        const p = prev ?? {}
        return { ...p, [`${action}_n`]: (p[`${action}_n`] ?? 0) + 1, [`${action}_in`]: (p[`${action}_in`] ?? 0) + u.input, [`${action}_out`]: (p[`${action}_out`] ?? 0) + u.output }
      })
    } catch (e) {
      console.error('recording usage', e) // never fail a student's build over the bookkeeping
    }
  }

  /** a model call, with an unusable reply turned into a clear error instead of a crash */
  const model = async <T>(call: () => Promise<T>) => {
    try {
      return await call()
    } catch (e) {
      if (e instanceof ModelReplyError) throw fail(502, 'The model gave an incomplete answer. Please try again.')
      throw e
    }
  }

  app.post('/v1/notes/analyze', async (c) => {
    const u = requireUser(c)
    const req = await body(c, noteAnalyzeRequest)
    const remainingPages = await spend(u.uid, 'noteUsage', config.noteDailyPageLimit ?? 20, 'note pages')
    const out = await model(() => noteVision.analyzePage(req))
    return c.json({ ...out, remainingPages })
  })

  app.post('/v1/notes/refine', async (c) => {
    const u = requireUser(c)
    const req = await body(c, noteRefineRequest)
    const remaining = await spend(u.uid, 'createUsage', config.createDailyLimit ?? 15, '3D builds')
    const out = await model(() => noteVision.refineSpec(req))
    return c.json({ ...out, remaining })
  })

  app.post('/v1/create-3d', async (c) => {
    const u = requireUser(c)
    const req = await body(c, create3dRequest)
    const remaining = await spend(u.uid, 'createUsage', config.createDailyLimit ?? 15, '3D builds')
    const { usage, ...out } = await model(() => noteVision.createOrEdit3D(req))
    await recordUsage(actionOf(req, out.isQuestion), usage)
    return c.json({ ...out, remaining })
  })

  /**
   * The same build as /v1/create-3d, streamed: `delta` events carry Gemini's JSON as it is written (so the
   * app can show parameters, formulas and parts as they arrive), then `done` carries the finished result.
   * A question about the current model counts against the same allowance.
   */
  app.post('/v1/create-3d/stream', async (c) => {
    const u = requireUser(c)
    const req = await body(c, create3dRequest)
    const remaining = await spend(u.uid, 'createUsage', config.createDailyLimit ?? 15, '3D builds')
    return streamSSE(c, async (stream) => {
      const ac = new AbortController()
      stream.onAbort(() => ac.abort())
      await stream.writeSSE({ event: 'meta', data: JSON.stringify({ remaining }) })
      let text = ''
      let usage: ModelUsage | undefined
      try {
        for await (const t of noteVision.streamCreate3D(req, ac.signal, (u) => (usage = u))) {
          text += t
          await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text: t }) })
        }
        const reply = readCreateReply(text, req)
        await recordUsage(actionOf(req, reply.isQuestion), usage)
        await stream.writeSSE({ event: 'done', data: JSON.stringify(reply) })
      } catch (e) {
        if (ac.signal.aborted) return
        const incomplete = e instanceof ModelReplyError
        if (!incomplete) console.error('create-3d stream', e)
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: incomplete ? 'The model gave an incomplete answer. Please try again.' : 'Solidify couldn’t build that just now. Please try again.' }) })
      }
    })
  })

  /* ------------------------------------------------------------------ getting better every day */

  /** the nightly test run proves itself with a shared secret (EVAL_TOKEN), compared in constant time */
  const requireEval = (c: Context<Env>) => {
    const want = config.evalToken ?? ''
    const got = c.req.header('x-eval-token') ?? ''
    let diff = want.length === got.length && want.length >= 24 ? 0 : 1
    for (let i = 0; i < Math.min(want.length, got.length); i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i)
    if (diff) throw fail(401, 'Not allowed.')
  }

  /** one build for the nightly test set: the same model call students get, outside their daily allowance */
  app.post('/v1/evals/build', async (c) => {
    requireEval(c)
    const req = await body(c, create3dRequest)
    // a night takes about 33; the cap keeps a leaked token from running up the bill
    await spend('nightly', 'evalUsage', 200, 'test builds')
    const t0 = now()
    const out = await model(() => noteVision.createOrEdit3D(req))
    return c.json({ ...out, ms: now() - t0 })
  })

  const evalCheck = z.object({ name: z.string().max(80), ok: z.boolean(), detail: z.string().max(300).optional() })
  const evalRun = z.object({
    runAt: z.number().int().positive(),
    label: z.string().max(80).optional(),
    cases: z
      .array(
        z.object({
          id: z.string().max(60),
          prompt: z.string().max(400),
          score: z.number().min(0).max(100),
          seconds: z.number().min(0).max(3600),
          checks: z.array(evalCheck).max(24),
          error: z.string().max(300).optional(),
          tokensIn: z.number().int().min(0).optional(),
          tokensOut: z.number().int().min(0).optional(),
        }),
      )
      .max(80),
    summary: z.object({
      score: z.number().min(0).max(100),
      passed: z.number().int().min(0),
      total: z.number().int().min(0),
      tokensIn: z.number().int().min(0).optional(),
      tokensOut: z.number().int().min(0).optional(),
    }),
  })

  /** a night's results */
  app.post('/v1/evals/runs', async (c) => {
    requireEval(c)
    const run = await body(c, evalRun)
    await db.set(`evalRuns/${run.runAt}`, run)
    return c.json({ ok: true }, 201)
  })

  /** the trend and the latest run in full, for the quality page */
  app.get('/v1/evals', async (c) => {
    requireAdmin(c)
    const rows = await db.list<z.infer<typeof evalRun>>('evalRuns')
    const runs = rows.map((r) => r.data).sort((a, b) => b.runAt - a.runAt)
    return c.json({ runs: runs.slice(0, 90).map(({ runAt, label, summary }) => ({ runAt, label, summary })), latest: runs[0] ?? null, price: await priceNow() })
  })

  /** the last 30 days of AI actions by kind (count and tokens), and the model's price if configured */
  app.get('/v1/ai-usage', async (c) => {
    requireAdmin(c)
    const days = Array.from({ length: 30 }, (_, i) => day(now() - i * 86_400_000)).reverse()
    const rows = await Promise.all(days.map(async (d) => ({ day: d, ...((await db.get<Record<string, number>>(`aiUsage/${d}`)) ?? {}) })))
    return c.json({ days: rows, price: await priceNow() })
  })

  /* the admin's controls: settings the nightly run follows, its topic list, builds on demand, and starting a run */
  const priceSchema = z.object({ inputPerM: z.number().min(0).max(1000), outputPerM: z.number().min(0).max(1000) })
  const settingsSchema = z.object({
    /** the nightly schedule skips its run (a run started by hand still goes) */
    paused: z.boolean(),
    draftsPerNight: z.number().int().min(0).max(20),
    /** the score a draft needs to reach the review queue */
    draftMin: z.number().min(0).max(100),
    /** overrides MODEL_PRICE */
    price: priceSchema.nullable(),
  })
  type QualitySettings = z.infer<typeof settingsSchema>
  const DEFAULT_SETTINGS: QualitySettings = { paused: false, draftsPerNight: 3, draftMin: 85, price: null }
  const getSettings = async (): Promise<QualitySettings> => ({ ...DEFAULT_SETTINGS, ...((await db.get<QualitySettings>('settings/quality')) ?? {}) })
  const priceNow = async () => (await getSettings()).price ?? config.modelPrice ?? null
  const topicItem = z.object({ topic: z.string().trim().min(1).max(60), prompt: z.string().trim().min(3).max(400) })
  /** null = the built-in list in the runner */
  const getTopics = async () => (await db.get<{ items: z.infer<typeof topicItem>[] }>('settings/topics'))?.items ?? null

  app.get('/v1/admin/settings', async (c) => {
    requireAdmin(c)
    return c.json({ settings: await getSettings(), topics: await getTopics(), canRunTests: !!config.dispatchRun })
  })

  app.put('/v1/admin/settings', async (c) => {
    requireAdmin(c)
    const patch = await body(c, settingsSchema.partial())
    await db.set('settings/quality', { ...(await getSettings()), ...patch })
    return c.json({ settings: await getSettings() })
  })

  app.put('/v1/admin/topics', async (c) => {
    requireAdmin(c)
    const { items } = await body(c, z.object({ items: z.array(topicItem).min(1).max(300) }))
    await db.set('settings/topics', { items })
    return c.json({ topics: items })
  })

  /** back to the built-in list */
  app.delete('/v1/admin/topics', async (c) => {
    requireAdmin(c)
    await db.delete('settings/topics')
    return c.json({ topics: null })
  })

  /** what the nightly run should do tonight */
  app.get('/v1/evals/settings', async (c) => {
    requireEval(c)
    return c.json({ settings: await getSettings(), topics: await getTopics() })
  })

  /** one build for the admin page (a draft from a prompt, a fix, a rebuild, a re-test): outside the students' allowance and usage counts */
  app.post('/v1/admin/build', async (c) => {
    requireAdmin(c)
    const req = await body(c, create3dRequest)
    await spend('admin', 'adminBuildUsage', 100, 'admin builds')
    const t0 = now()
    const out = await model(() => noteVision.createOrEdit3D(req))
    return c.json({ ...out, ms: now() - t0 })
  })

  /** starts the nightly test run now, through GitHub */
  app.post('/v1/admin/run-tests', async (c) => {
    requireAdmin(c)
    const r = await body(c, z.object({ limit: z.number().int().min(1).max(100).optional(), drafts: z.number().int().min(0).max(20).optional() }))
    if (!config.dispatchRun) throw fail(501, 'Starting runs from here is not set up: add GITHUB_DISPATCH_TOKEN to the API.')
    try {
      await config.dispatchRun({ ...(r.limit ? { limit: String(r.limit) } : {}), ...(r.drafts !== undefined ? { drafts: String(r.drafts) } : {}) })
    } catch (e) {
      console.error('dispatch', e)
      throw fail(502, 'GitHub didn’t start the run. Check the token’s access to the repository.')
    }
    return c.json({ ok: true }, 202)
  })

  /* what students do with the models: counted by day and kind, with no one's identity; a thumbs-down keeps its note */
  const EVENT_KINDS = ['rating-up', 'rating-down', 'fix-layout', 'layout-issue', 'rebuild', 'delete'] as const
  const eventInput = z.object({
    kind: z.enum(EVENT_KINDS),
    subject: z.string().trim().max(120).optional(),
    detail: z.string().trim().max(300).optional(),
  })

  app.post('/v1/events', async (c) => {
    const u = requireUser(c)
    const e = await body(c, eventInput)
    await spend(u.uid, 'eventUsage', 300, 'feedback events')
    const d = day(now())
    await db.transact<Record<string, number>>(`eventCounts/${d}`, (prev) => ({ ...(prev ?? {}), [e.kind]: ((prev ?? {})[e.kind] ?? 0) + 1 }))
    if (e.kind === 'rating-down' || e.kind === 'layout-issue' || e.kind === 'fix-layout') {
      await db.set(`eventNotes/${now()}_${randomId()}`, { kind: e.kind, subject: e.subject ?? '', detail: e.detail ?? '', day: d })
    }
    return c.json({ ok: true }, 201)
  })

  /** the last 14 days of counts, and the latest notes, for the quality page */
  app.get('/v1/events/summary', async (c) => {
    requireAdmin(c)
    const days = Array.from({ length: 14 }, (_, i) => day(now() - i * 86_400_000)).reverse()
    const counts = await Promise.all(days.map(async (d) => ({ day: d, ...((await db.get<Record<string, number>>(`eventCounts/${d}`)) ?? {}) })))
    const notes = (await db.list<{ kind: string; subject: string; detail: string; day: string }>('eventNotes')).slice(-40).reverse().map((r) => r.data)
    return c.json({ days: counts, notes })
  })

  /* ------------------------------------------------------------------ model library */

  /*
   * Models anyone can open from Create in 3D. The nightly run drafts a few (it builds requests from its topic
   * list and keeps the ones that score well); an admin approves or rejects each draft before anyone sees it.
   */
  const libraryInput = z.object({
    title: z.string().trim().min(1).max(120),
    prompt: z.string().trim().max(2000),
    topic: z.string().trim().max(60).optional(),
    spec: z.record(z.string().max(60), z.unknown()),
    explanation: z.string().max(4000).optional(),
    score: z.number().min(0).max(100),
    checks: z.array(evalCheck).max(24).optional(),
  })
  type LibraryDoc = z.infer<typeof libraryInput> & { [k: string]: unknown; parts: number; createdAt: number; publishedAt?: number }
  const libraryId = (id: string) => {
    if (!/^[a-z0-9]{6,20}$/.test(id)) throw fail(404, 'Not found.')
    return id
  }
  const libraryCard = ({ spec, checks: _c, explanation: _e, ...rest }: LibraryDoc, id: string) => {
    void _c
    void _e
    void spec
    return { id, ...rest }
  }

  app.post('/v1/library/drafts', async (c) => {
    if (c.req.header('x-eval-token')) requireEval(c)
    else requireAdmin(c)
    const d = await body(c, libraryInput)
    if (JSON.stringify(d.spec).length > 300_000) throw fail(413, 'This model is too large to save.')
    const id = randomId()
    await db.set(`libraryDrafts/${id}`, { ...d, parts: Array.isArray(d.spec.parts) ? d.spec.parts.length : 0, createdAt: now() })
    return c.json({ id }, 201)
  })

  /** a draft changed from the admin page: fixed, rebuilt or retitled, with its new score */
  app.put('/v1/library/drafts/:id', async (c) => {
    requireAdmin(c)
    const id = libraryId(c.req.param('id'))
    const draft = await db.get<LibraryDoc>(`libraryDrafts/${id}`)
    if (!draft) throw fail(404, 'Draft not found.')
    const patch = await body(c, libraryInput.partial())
    if (patch.spec && JSON.stringify(patch.spec).length > 300_000) throw fail(413, 'This model is too large to save.')
    const next = { ...draft, ...patch, ...(patch.spec ? { parts: Array.isArray(patch.spec.parts) ? patch.spec.parts.length : 0 } : {}) }
    await db.set(`libraryDrafts/${id}`, next)
    return c.json({ id, ...next })
  })

  /** the review queue, newest first, in full so the reviewer can open each one */
  app.get('/v1/library/drafts', async (c) => {
    requireAdmin(c)
    const rows = await db.list<LibraryDoc>('libraryDrafts', { limit: 200 })
    return c.json({ drafts: rows.map((r) => ({ id: r.id, ...r.data })).sort((a, b) => b.createdAt - a.createdAt) })
  })

  app.post('/v1/library/drafts/:id/approve', async (c) => {
    requireAdmin(c)
    const id = libraryId(c.req.param('id'))
    const draft = await db.get<LibraryDoc>(`libraryDrafts/${id}`)
    if (!draft) throw fail(404, 'Draft not found.')
    const patch = await body(c, z.object({ title: libraryInput.shape.title.optional() }))
    await db.set(`library/${id}`, { ...draft, ...(patch.title ? { title: patch.title } : {}), publishedAt: now() })
    await db.delete(`libraryDrafts/${id}`)
    return c.json({ ok: true })
  })

  app.delete('/v1/library/drafts/:id', async (c) => {
    requireAdmin(c)
    await db.delete(`libraryDrafts/${libraryId(c.req.param('id'))}`)
    return c.json({ ok: true })
  })

  /** the published models: cards only, anyone may read */
  app.get('/v1/library', async (c) => {
    const rows = await db.list<LibraryDoc>('library', { limit: 500 })
    return c.json({ items: rows.map((r) => libraryCard(r.data, r.id)).sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)) })
  })

  app.get('/v1/library/:id', async (c) => {
    const item = await db.get<LibraryDoc>(`library/${libraryId(c.req.param('id'))}`)
    if (!item) throw fail(404, 'Not found.')
    const { checks: _c, ...rest } = item
    void _c
    return c.json({ id: c.req.param('id'), ...rest })
  })

  app.delete('/v1/library/:id', async (c) => {
    requireAdmin(c)
    await db.delete(`library/${libraryId(c.req.param('id'))}`)
    return c.json({ ok: true })
  })

  /* ------------------------------------------------------------------ creation lab */

  /** a student's saved models: everything they build in Create in 3D, to reopen and keep changing */
  const CREATION_LIMIT = 50
  const historyItem = z.object({ prompt: z.string().max(2000), response: z.string().max(2000) })
  const creationFields = {
    title: z.string().trim().min(1).max(120),
    prompt: z.string().trim().max(2000),
    fromPhoto: z.boolean(),
    /** the model itself (a NoteSceneSpec); opaque to the API apart from its size */
    spec: z.record(z.string().max(60), z.unknown()),
    /** slider values the student set */
    params: z.record(z.string().max(60), z.number()),
    history: z.array(historyItem).max(30),
    /** a small JPEG or WebP of the model for the card */
    thumbnail: z.string().max(150_000).regex(/^data:image\/(jpeg|webp|png);base64,/),
  }
  const creationInput = z.object({
    ...creationFields,
    prompt: creationFields.prompt.default(''),
    fromPhoto: creationFields.fromPhoto.default(false),
    params: creationFields.params.default({}),
    history: creationFields.history.default([]),
    thumbnail: creationFields.thumbnail.optional(),
  })
  /** an update changes only the fields it sends (no defaults, or it would wipe the others) */
  const creationPatch = z.object(creationFields).partial()

  interface CreationDoc {
    [k: string]: unknown
    title: string
    prompt: string
    fromPhoto: boolean
    spec: Record<string, unknown>
    params: Record<string, number>
    history: { prompt: string; response: string }[]
    thumbnail?: string
    parts: number
    createdAt: number
    updatedAt: number
  }

  const checkSpecSize = (spec?: Record<string, unknown>) => {
    if (spec && JSON.stringify(spec).length > 300_000) throw fail(413, 'This model is too large to save.')
  }
  const partCount = (spec: Record<string, unknown>) => (Array.isArray(spec.parts) ? spec.parts.length : 0)
  const creationPath = (uid: string, id: string) => {
    if (!/^[a-z0-9]{6,20}$/.test(id)) throw fail(404, 'Model not found.')
    return `users/${uid}/creations/${id}`
  }

  /** the list leaves out each model's spec and history, so it stays small */
  app.get('/v1/creations', async (c) => {
    const u = requireUser(c)
    const rows = await db.list<CreationDoc>(`users/${u.uid}/creations`)
    const items = rows
      .map(({ id, data: d }) => ({ id, title: d.title, prompt: d.prompt, fromPhoto: d.fromPhoto, thumbnail: d.thumbnail, parts: d.parts, createdAt: d.createdAt, updatedAt: d.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
    return c.json({ items, limit: CREATION_LIMIT })
  })

  app.get('/v1/creations/:id', async (c) => {
    const u = requireUser(c)
    const d = await db.get<CreationDoc>(creationPath(u.uid, c.req.param('id')))
    if (!d) throw fail(404, 'Model not found.')
    return c.json({ id: c.req.param('id'), ...d })
  })

  app.post('/v1/creations', async (c) => {
    const u = requireUser(c)
    const input = await body(c, creationInput)
    checkSpecSize(input.spec)
    const existing = await db.list(`users/${u.uid}/creations`, { limit: CREATION_LIMIT + 1 })
    if (existing.length >= CREATION_LIMIT) throw fail(409, `You have ${CREATION_LIMIT} saved models. Delete one in My models to save more.`)
    const id = randomId()
    const t = now()
    await db.set(creationPath(u.uid, id), { ...input, parts: partCount(input.spec), createdAt: t, updatedAt: t })
    return c.json({ id }, 201)
  })

  app.put('/v1/creations/:id', async (c) => {
    const u = requireUser(c)
    const path = creationPath(u.uid, c.req.param('id'))
    const patch = await body(c, creationPatch)
    checkSpecSize(patch.spec)
    if (!(await db.get(path))) throw fail(404, 'Model not found.')
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
    await db.set(path, { ...clean, ...(patch.spec ? { parts: partCount(patch.spec) } : {}), updatedAt: now() }, { merge: true })
    return c.body(null, 204)
  })

  app.delete('/v1/creations/:id', async (c) => {
    const u = requireUser(c)
    await db.delete(creationPath(u.uid, c.req.param('id')))
    return c.body(null, 204)
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

  /* ------------------------------------------------------------------ papers (timed; every student gets their own numbers) */

  const paperInput = z.object({
    title: z.string().trim().min(1).max(160),
    questionIds: z.array(z.string().min(1).max(120)).min(1).max(40),
    minutes: z.number().int().min(5).max(240),
    due: z.number().int().positive().optional(),
  })

  app.post('/v1/classes/:id/papers', async (c) => {
    const id = c.req.param('id')
    await requireTeacherOf(c, id)
    const p = await body(c, paperInput)
    const pid = randomId()
    const doc: PaperDoc = { ...p, questionIds: [...new Set(p.questionIds)], createdAt: now() }
    await db.set(`classes/${id}/papers/${pid}`, doc)
    return c.json({ id: pid, ...doc }, 201)
  })

  /** Papers in the class; a student also sees their own attempt. */
  app.get('/v1/classes/:id/papers', async (c) => {
    const id = c.req.param('id')
    const { u, isTeacher } = await requireMemberOrTeacher(c, id)
    const papers = await db.list<PaperDoc>(`classes/${id}/papers`)
    const out = await Promise.all(
      papers.map(async (p) => {
        const mine = isTeacher ? null : await db.get<SubmissionDoc>(`classes/${id}/papers/${p.id}/submissions/${u.uid}`)
        return { id: p.id, ...p.data, attempt: mine ? { startedAt: mine.startedAt, submittedAt: mine.submittedAt ?? null, total: mine.total ?? null } : null }
      }),
    )
    return c.json({ papers: out.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity) || a.createdAt - b.createdAt) })
  })

  app.get('/v1/classes/:id/papers/:pid', async (c) => {
    const id = c.req.param('id')
    const { u, isTeacher } = await requireMemberOrTeacher(c, id)
    const p = await db.get<PaperDoc>(`classes/${id}/papers/${c.req.param('pid')}`)
    if (!p) throw fail(404, 'Paper not found.')
    const mine = isTeacher ? null : await db.get<SubmissionDoc>(`classes/${id}/papers/${c.req.param('pid')}/submissions/${u.uid}`)
    return c.json({ id: c.req.param('pid'), ...p, isTeacher, attempt: mine })
  })

  app.delete('/v1/classes/:id/papers/:pid', async (c) => {
    const id = c.req.param('id')
    await requireTeacherOf(c, id)
    await db.delete(`classes/${id}/papers/${c.req.param('pid')}`)
    return c.body(null, 204)
  })

  /** A student starts the paper: the start time is recorded once, so reloading doesn't reset the clock. */
  app.post('/v1/classes/:id/papers/:pid/start', async (c) => {
    const id = c.req.param('id')
    const pid = c.req.param('pid')
    const { u, isTeacher } = await requireMemberOrTeacher(c, id)
    if (isTeacher) throw fail(403, 'Teachers preview papers; students sit them.')
    const p = await db.get<PaperDoc>(`classes/${id}/papers/${pid}`)
    if (!p) throw fail(404, 'Paper not found.')
    const t = now()
    const s = await db.transact<SubmissionDoc>(`classes/${id}/papers/${pid}/submissions/${u.uid}`, (prev) => prev ?? { startedAt: t })
    return c.json({ startedAt: s.startedAt, endsAt: s.startedAt + p.minutes * 60_000, submittedAt: s.submittedAt ?? null })
  })

  const submitInput = z.object({
    /** what the student typed, per question and answer box */
    answers: z.record(z.string().max(120), z.record(z.string().max(40), z.string().max(40))),
    /** marks per question (0–1) and the mistakes the marker named */
    results: z.record(z.string().max(120), z.object({ score: z.number().min(0).max(1), slips: z.array(z.string().max(40)).max(10).default([]) })),
  })

  /** One submission per student. Marking runs in the browser with the app's question bank. */
  app.post('/v1/classes/:id/papers/:pid/submit', async (c) => {
    const id = c.req.param('id')
    const pid = c.req.param('pid')
    const { u, isTeacher } = await requireMemberOrTeacher(c, id)
    if (isTeacher) throw fail(403, 'Teachers preview papers; students sit them.')
    const p = await db.get<PaperDoc>(`classes/${id}/papers/${pid}`)
    if (!p) throw fail(404, 'Paper not found.')
    const sub = await body(c, submitInput)
    const t = now()
    const results = Object.fromEntries(p.questionIds.map((q) => [q, sub.results[q] ?? { score: 0, slips: [] }]))
    const total = p.questionIds.reduce((s, q) => s + results[q].score, 0) / p.questionIds.length
    let already = false
    const saved = await db.transact<SubmissionDoc>(`classes/${id}/papers/${pid}/submissions/${u.uid}`, (prev) => {
      already = !!prev?.submittedAt
      if (already) return prev!
      const startedAt = prev?.startedAt ?? t
      return { startedAt, submittedAt: t, late: t > startedAt + p.minutes * 60_000 + 60_000, answers: sub.answers, results, total }
    })
    if (already) throw fail(409, 'You have already handed in this paper.')
    return c.json({ submittedAt: t, total, late: saved.late }, 201)
  })

  /** Teacher: every student's result on a paper. */
  app.get('/v1/classes/:id/papers/:pid/results', async (c) => {
    const id = c.req.param('id')
    const pid = c.req.param('pid')
    await requireTeacherOf(c, id)
    const p = await db.get<PaperDoc>(`classes/${id}/papers/${pid}`)
    if (!p) throw fail(404, 'Paper not found.')
    const members = await db.list<MemberDoc>(`classes/${id}/members`)
    const subs = await db.list<SubmissionDoc>(`classes/${id}/papers/${pid}/submissions`)
    const byUid = new Map(subs.map((s) => [s.id, s.data]))
    return c.json({
      paper: { id: pid, ...p },
      students: members.map((m) => {
        const s = byUid.get(m.id)
        return { uid: m.id, displayName: m.data.displayName, startedAt: s?.startedAt ?? null, submittedAt: s?.submittedAt ?? null, late: !!s?.late, total: s?.total ?? null, results: s?.results ?? null }
      }),
    })
  })

  /** Teacher: each student's question progress, for the class weak-spot report (topics are known to the app). */
  app.get('/v1/classes/:id/progress', async (c) => {
    const id = c.req.param('id')
    await requireTeacherOf(c, id)
    const members = await db.list<MemberDoc>(`classes/${id}/members`)
    const progress = await Promise.all(members.map((m) => db.get<Progress>(`progress/${m.id}`)))
    return c.json({ students: members.map((m, i) => ({ uid: m.id, displayName: m.data.displayName, questions: progress[i]?.questions ?? {} })) })
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

  const feedbackInput = z
    .object({
      /** bug / error / idea: reports and feature requests; sales: a school or company asking about plans */
      kind: z.enum(['bug', 'error', 'idea', 'sales']),
      message: z.string().trim().min(3).max(4000),
      route: z.string().max(200).optional(),
      partId: z.string().max(120).optional(),
      contact: z.string().trim().max(200).optional(),
      name: z.string().trim().max(120).optional(),
      organisation: z.string().trim().max(160).optional(),
      seats: z.enum(['1-10', '11-50', '51-200', '200+']).optional(),
    })
    .refine((f) => f.kind !== 'sales' || (f.contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact)), {
      message: 'Add an email address so we can reply.',
      path: ['contact'],
    })

  /** Anyone can report a problem, ask for a feature or contact sales; signed-in messages are linked to the account. */
  app.post('/v1/feedback', async (c) => {
    const f = await body(c, feedbackInput)
    const u = c.get('user')
    await db.set(`feedback/${now()}_${randomId()}`, { ...f, uid: u?.uid ?? null, status: 'new', createdAt: now(), userAgent: c.req.header('User-Agent')?.slice(0, 200) ?? null })
    return c.json({ ok: true }, 201)
  })

  app.get('/v1/feedback', async (c) => {
    requireAdmin(c)
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
