import { isBusy, retryBusy } from './retry.js'
import { RateLimiter, clientIp } from './ratelimit.js'
import { FakeEmbedder, cosine, keywordScore, type Embedder } from './embed.js'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { AuthUser, Verifier } from './auth.js'
import type { Db, Row } from './db.js'
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
  /** how close (cosine, 0 to 1) a library model must be to be offered for a request, and to be given to a build to start from */
  matchMin?: number
  referenceMin?: number
  /** App Check: off (not checked), monitor (checked and counted, never refused) or enforce (refused without it) */
  appCheck?: 'off' | 'monitor' | 'enforce'
  /** per-address limits on public routes (tests may turn them off) */
  rateLimits?: boolean
  /** waits between retries when the model is busy (tests use zeros); default 2, 6 and 15 s */
  retryWaits?: number[]
  /** shared secret for the nightly test run (at least 24 characters); unset = no nightly runs */
  evalToken?: string
  /** the model's list price in US dollars per million tokens, to turn token counts into cost on the admin page */
  modelPrice?: { inputPerM: number; outputPerM: number } | ((t: number) => { inputPerM: number; outputPerM: number } | undefined)
  now?: () => number
}

export interface Deps {
  db: Db
  verifier: Verifier
  tutor: TutorModel
  noteVision?: NoteVisionModel
  config: Config
  /** text embeddings for matching requests to the library (a word-count stand-in when not given) */
  embedder?: Embedder
  /** checks an App Check token (proof a request came from the real app); absent = none checked */
  appChecker?: { verify(token: string): Promise<boolean> }
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

const BUSY = 'Solidify’s model is busy right now. Please try again in a minute.'
const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 502 | 503, message: string) => new HTTPException(status, { message })

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

export function createApp({ db, verifier, tutor, noteVision = new FakeNoteVision(), embedder = new FakeEmbedder(), appChecker, config }: Deps) {
  const now = config.now ?? Date.now
  const app = new Hono<Env>()

  app.use(
    '*',
    cors({
      origin: (o) => (config.allowedOrigins.includes(o) ? o : null),
      allowHeaders: ['Authorization', 'Content-Type', 'X-Firebase-AppCheck'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 3600,
    }),
  )

  /*
   * Against scraping and floods: limits per address, then App Check (proof the request came from the real
   * Solidify app, not a script). The nightly run (its token) and preflights are not counted.
   */
  const limiter = new RateLimiter(undefined, now)
  app.use('/v1/*', async (c, next) => {
    if (c.req.method === 'OPTIONS' || c.req.header('x-eval-token')) return next()
    if (config.rateLimits !== false) {
      const over = limiter.check(clientIp(c.req.header('X-Forwarded-For')), c.req.method, c.req.path)
      if (over) {
        c.header('Retry-After', String(over.retryAfterS))
        throw fail(429, `Too many requests. Please wait ${over.retryAfterS} s and try again.`)
      }
    }
    const mode = config.appCheck ?? 'off'
    if (mode !== 'off') {
      const token = c.req.header('X-Firebase-AppCheck')
      const ok = !!token && !!appChecker && (await appChecker.verify(token).catch(() => false))
      if (!ok) {
        // counted by day, so the admin page can show how much traffic comes from outside the app before enforcing
        await db.transact<Record<string, number>>(`appCheckMisses/${day(now())}`, (prev) => ({ ...(prev ?? {}), [token ? 'invalid' : 'missing']: ((prev ?? {})[token ? 'invalid' : 'missing'] ?? 0) + 1 }))
        if (mode === 'enforce') throw fail(401, 'This request did not come from the Solidify app. Please reload the page.')
      }
    }
    await next()
  })

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

  /*
   * Staff roles. Admins run everything; curators run the library (drafting, topics, publishing, editing);
   * reviewers check drafts and publish them; support answers feedback and the waitlist. Roles are given by
   * email (before the person has even signed in) on the admin page's Users tab and kept in `roles`; the
   * emails in ADMIN_EMAILS are owners, always admins, and cannot be changed from the app.
   */
  const STAFF_ROLES = ['admin', 'curator', 'reviewer', 'support', 'ambassador'] as const
  type StaffRole = (typeof STAFF_ROLES)[number]
  /** what each permission needs: any one of these roles */
  const PERMS = {
    admin: ['admin'],
    curate: ['admin', 'curator'],
    review: ['admin', 'curator', 'reviewer'],
    support: ['admin', 'support'],
    ambassador: ['ambassador'],
  } as const satisfies Record<string, readonly StaffRole[]>
  type Perm = keyof typeof PERMS
  const roleKey = (email: string) => encodeURIComponent(email.trim().toLowerCase())
  const isOwner = (email?: string | null) => !!email && config.adminEmails.includes(email.toLowerCase())
  /** reviewers named before roles existed (settings/reviewers) still count as reviewers */
  const getReviewers = async () => (await db.get<{ emails: string[] }>('settings/reviewers'))?.emails ?? []
  const rolesOfEmail = async (email?: string | null): Promise<StaffRole[]> => {
    if (!email) return []
    const out = new Set<StaffRole>()
    if (isOwner(email)) out.add('admin')
    for (const r of (await db.get<{ roles: StaffRole[] }>(`roles/${roleKey(email)}`))?.roles ?? []) out.add(r)
    if ((await getReviewers()).includes(email.toLowerCase())) out.add('reviewer')
    return STAFF_ROLES.filter((r) => out.has(r))
  }
  const can = (roles: StaffRole[], perm: Perm) => roles.some((r) => (PERMS[perm] as readonly StaffRole[]).includes(r))
  const requirePerm = async (c: Context<Env>, perm: Perm) => {
    const u = requireUser(c)
    if (!can(await rolesOfEmail(u.email), perm)) throw fail(403, perm === 'admin' ? 'Admins only.' : 'Your role doesn’t allow this.')
    return u
  }
  const requireAdmin = (c: Context<Env>) => requirePerm(c, 'admin')
  const requireReviewer = (c: Context<Env>) => requirePerm(c, 'review')
  const isAdmin = async (u: { email?: string | null }) => can(await rolesOfEmail(u.email), 'admin')

  /*
   * The audit trail: who did what to the library, the review queue and the admin settings, and when. Every
   * change is a line in `audit`, never edited; the admin page lists them and each draft shows its own.
   */
  type Who = { uid: string; name: string; email?: string }
  const NIGHTLY: Who = { uid: 'nightly', name: 'Nightly run' }
  const whoIs = async (u: { uid: string; email?: string; name?: string }): Promise<Who> => ({
    uid: u.uid,
    name: (await db.get<{ displayName?: string }>(`users/${u.uid}`))?.displayName ?? u.name ?? u.email ?? 'Someone',
    ...(u.email ? { email: u.email } : {}),
  })
  type AuditTarget = { type: 'draft' | 'library' | 'settings' | 'reviewers' | 'topics'; id?: string; title?: string }
  // a counter breaks ties between entries made in the same millisecond, so the order is always the order done
  let auditSeq = 0
  const audit = async (by: Who, action: string, target: AuditTarget, detail = '') => {
    const seq = ++auditSeq
    await db.set(`audit/${now()}_${String(seq).padStart(6, '0')}_${randomId()}`, { at: now(), seq, by, action, target, detail: detail.slice(0, 500) })
  }
  const newestFirst = (a: AuditDoc, b: AuditDoc) => b.at - a.at || (b.seq ?? 0) - (a.seq ?? 0)
  interface AuditDoc {
    [k: string]: unknown
    at: number
    by: Who
    action: string
    target: AuditTarget
    detail: string
    seq?: number
  }

  /* ------------------------------------------------------------------ account */

  app.get('/v1/me', async (c) => {
    const u = requireUser(c)
    const p = await profile(u)
    // last seen, at most one write a day: what makes a referred student count as active
    if (!p.lastSeenAt || day(p.lastSeenAt as number) !== day(now())) await db.set(`users/${u.uid}`, { lastSeenAt: now() }, { merge: true })
    const classes = await db.list<{ name: string; role: Role }>(`users/${u.uid}/classes`)
    const roles = await rolesOfEmail(u.email)
    return c.json({ uid: u.uid, ...p, roles, isAdmin: can(roles, 'admin') || undefined, isReviewer: can(roles, 'review') || undefined, classes: classes.map((r) => ({ id: r.id, ...r.data })) })
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
  const actionOf = (req: Create3dRequest, isQuestion?: boolean, answerOnly?: boolean) => (answerOnly ? 'answer' : req.photoBase64 ? 'photo' : !req.currentSpec ? 'build' : isQuestion ? 'question' : 'edit')
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
      // the model service turns calls away when it is overloaded: wait and try again before giving up
      return await retryBusy(call, config.retryWaits)
    } catch (e) {
      if (e instanceof ModelReplyError) throw fail(502, 'The model gave an incomplete answer. Please try again.')
      if (isBusy(e)) throw fail(503, BUSY)
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
    const req = await withReference(await body(c, create3dRequest))
    const remaining = await spend(u.uid, 'createUsage', config.createDailyLimit ?? 15, '3D builds')
    const { usage, ...out } = await model(() => noteVision.createOrEdit3D(req))
    await recordUsage(actionOf(req, out.isQuestion, out.answerOnly), usage)
    return c.json({ ...out, remaining })
  })

  /**
   * The same build as /v1/create-3d, streamed: `delta` events carry Gemini's JSON as it is written (so the
   * app can show parameters, formulas and parts as they arrive), then `done` carries the finished result.
   * A question about the current model counts against the same allowance.
   */
  app.post('/v1/create-3d/stream', async (c) => {
    const u = requireUser(c)
    const req = await withReference(await body(c, create3dRequest))
    const remaining = await spend(u.uid, 'createUsage', config.createDailyLimit ?? 15, '3D builds')
    return streamSSE(c, async (stream) => {
      const ac = new AbortController()
      stream.onAbort(() => ac.abort())
      await stream.writeSSE({ event: 'meta', data: JSON.stringify({ remaining }) })
      let text = ''
      let usage: ModelUsage | undefined
      try {
        // busy before the first word: wait and start again (once words have gone out, a retry would repeat them)
        const waits = config.retryWaits ?? [2000, 6000, 15000]
        for (let attempt = 0; ; attempt++) {
          try {
            for await (const t of noteVision.streamCreate3D(req, ac.signal, (u) => (usage = u))) {
              text += t
              await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text: t }) })
            }
            break
          } catch (e) {
            if (text || attempt >= waits.length || !isBusy(e) || ac.signal.aborted) throw e
            await new Promise((r) => setTimeout(r, waits[attempt]))
          }
        }
        const reply = readCreateReply(text, req)
        await recordUsage(actionOf(req, reply.isQuestion, reply.answerOnly), usage)
        await stream.writeSSE({ event: 'done', data: JSON.stringify(reply) })
      } catch (e) {
        if (ac.signal.aborted) return
        const incomplete = e instanceof ModelReplyError
        if (!incomplete) console.error('create-3d stream', e)
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: incomplete ? 'The model gave an incomplete answer. Please try again.' : isBusy(e) ? BUSY : 'Solidify couldn’t build that just now. Please try again.' }) })
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
  /** a run's results: from the nightly job (token), or from a run an admin started on the admin page */
  app.post('/v1/evals/runs', async (c) => {
    if (c.req.header('x-eval-token')) requireEval(c)
    else await requirePerm(c, 'curate')
    const run = await body(c, evalRun)
    await db.set(`evalRuns/${run.runAt}`, run)
    return c.json({ ok: true }, 201)
  })

  /** the trend and the latest run in full, for the quality page */
  app.get('/v1/evals', async (c) => {
    await requirePerm(c, 'curate')
    const rows = await db.list<z.infer<typeof evalRun>>('evalRuns')
    const runs = rows.map((r) => r.data).sort((a, b) => b.runAt - a.runAt)
    return c.json({ runs: runs.slice(0, 90).map(({ runAt, label, summary }) => ({ runAt, label, summary })), latest: runs[0] ?? null, price: await priceNow() })
  })

  /** requests without a valid App Check token, by day: how much would be refused if App Check were enforced */
  app.get('/v1/admin/app-check', async (c) => {
    await requireAdmin(c)
    const days = Array.from({ length: 14 }, (_, i) => day(now() - i * 86_400_000)).reverse()
    const rows = await Promise.all(days.map(async (d) => ({ day: d, ...((await db.get<Record<string, number>>(`appCheckMisses/${d}`)) ?? {}) })))
    return c.json({ mode: config.appCheck ?? 'off', days: rows })
  })

  /** the last 30 days of AI actions by kind (count and tokens), and the model's price if configured */
  app.get('/v1/ai-usage', async (c) => {
    await requireAdmin(c)
    const days = Array.from({ length: 30 }, (_, i) => day(now() - i * 86_400_000)).reverse()
    const rows = await Promise.all(days.map(async (d) => ({ day: d, ...((await db.get<Record<string, number>>(`aiUsage/${d}`)) ?? {}) })))
    return c.json({ days: rows, price: await priceNow() })
  })

  /* the admin's controls: settings the nightly run follows, its topic list, builds on demand, and starting a run */
  const priceSchema = z.object({ inputPerM: z.number().min(0).max(1000), outputPerM: z.number().min(0).max(1000) })
  const settingsSchema = z.object({
    /** the nightly schedule skips its run (a run started by hand still goes) */
    paused: z.boolean(),
    draftsPerNight: z.number().int().min(0).max(100),
    /** the score a draft needs to reach the review queue */
    draftMin: z.number().min(0).max(100),
    /** overrides MODEL_PRICE */
    price: priceSchema.nullable(),
  })
  type QualitySettings = z.infer<typeof settingsSchema>
  const DEFAULT_SETTINGS: QualitySettings = { paused: false, draftsPerNight: 3, draftMin: 85, price: null }
  const getSettings = async (): Promise<QualitySettings> => ({ ...DEFAULT_SETTINGS, ...((await db.get<QualitySettings>('settings/quality')) ?? {}) })
  const priceNow = async () => (await getSettings()).price ?? (typeof config.modelPrice === 'function' ? config.modelPrice(now()) : config.modelPrice) ?? null
  const topicItem = z.object({ topic: z.string().trim().min(1).max(60), prompt: z.string().trim().min(3).max(400), suggestedBy: z.string().max(80).optional() })
  /** null = the built-in list in the runner */
  const getTopics = async () => (await db.get<{ items: z.infer<typeof topicItem>[] }>('settings/topics'))?.items ?? null

  /*
   * The drafting pool: every prompt ever drafted is remembered (settings/drafted), so no topic is built twice;
   * when fewer than a batch are left unused, Gemini suggests new ones (avoiding everything planned, drafted or
   * published), which join the topic list. The list starts from the runner's built-in one (`fallback`).
   */
  const draftedKey = (p: string) => p.trim().toLowerCase().replace(/\s+/g, ' ')
  const getDrafted = async () => new Set((await db.get<{ prompts: string[] }>('settings/drafted'))?.prompts ?? [])
  const markDrafted = async (prompt: string) => {
    await db.transact<{ prompts: string[] }>('settings/drafted', (prev) => {
      const prompts = prev?.prompts ?? []
      const k = draftedKey(prompt)
      return prompts.includes(k) ? { prompts } : { prompts: [...prompts, k].slice(-5000) }
    })
  }
  const nextTopics = async (want: number, fallback: z.infer<typeof topicItem>[]) => {
    let pool = (await getTopics()) ?? fallback
    const drafted = await getDrafted()
    const unused = () => pool.filter((t) => !drafted.has(draftedKey(t.prompt)))
    let added = 0
    if (unused().length < want) {
      const library = (await db.list<{ title?: string; prompt?: string }>('library', { limit: 1000 })).map((r) => r.data.prompt ?? r.data.title ?? '')
      const avoid = [...pool.map((t) => t.prompt), ...drafted, ...library].filter(Boolean)
      // ask for a few more than needed, so a short or repeated answer still fills the batch
      const fresh = (await model(() => noteVision.suggestTopics(Math.min(60, want - unused().length + 10), avoid))).filter(
        (t) => !drafted.has(draftedKey(t.prompt)) && !pool.some((x) => draftedKey(x.prompt) === draftedKey(t.prompt)),
      )
      if (fresh.length) {
        pool = [...pool, ...fresh].slice(-1000)
        await db.set('settings/topics', { items: pool })
        added = fresh.length
      }
    }
    // handed out counts as used: a topic that builds badly is not tried again every night
    const topics = unused().slice(0, want)
    for (const t of topics) await markDrafted(t.prompt)
    return { topics, added }
  }
  const nextTopicsInput = z.object({ want: z.number().int().min(1).max(100), fallback: z.array(topicItem).max(300).default([]) })

  /** tonight's topics for the nightly run: unused ones, topped up by Gemini when the list runs low */
  app.post('/v1/evals/topics/next', async (c) => {
    requireEval(c)
    const { want, fallback } = await body(c, nextTopicsInput)
    return c.json(await nextTopics(want, fallback))
  })

  /** the same, for a batch drafted from the admin page */
  app.post('/v1/admin/topics/next', async (c) => {
    await requirePerm(c, 'curate')
    const { want, fallback } = await body(c, nextTopicsInput)
    return c.json(await nextTopics(want, fallback))
  })

  app.get('/v1/admin/settings', async (c) => {
    await requirePerm(c, 'curate')
    return c.json({ settings: await getSettings(), topics: await getTopics() })
  })

  app.put('/v1/admin/settings', async (c) => {
    const u = await requireAdmin(c)
    const patch = await body(c, settingsSchema.partial())
    const before = await getSettings()
    await db.set('settings/quality', { ...before, ...patch })
    const changes = (Object.keys(patch) as (keyof typeof patch)[])
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(patch[k]))
      .map((k) => `${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(patch[k])}`)
    if (changes.length) await audit(await whoIs(u), 'changed settings', { type: 'settings' }, changes.join('; '))
    return c.json({ settings: await getSettings() })
  })

  app.put('/v1/admin/topics', async (c) => {
    const u = await requirePerm(c, 'curate')
    const { items } = await body(c, z.object({ items: z.array(topicItem).min(1).max(300) }))
    const had = (await getTopics())?.length
    await db.set('settings/topics', { items })
    await audit(await whoIs(u), 'edited the topic list', { type: 'topics' }, `${had ?? 'built-in'} → ${items.length} topics`)
    return c.json({ topics: items })
  })

  /** back to the built-in list */
  app.delete('/v1/admin/topics', async (c) => {
    const u = await requirePerm(c, 'curate')
    await db.delete('settings/topics')
    await audit(await whoIs(u), 'went back to the built-in topic list', { type: 'topics' })
    return c.json({ topics: null })
  })

  /** what the nightly run should do tonight */
  app.get('/v1/evals/settings', async (c) => {
    requireEval(c)
    return c.json({ settings: await getSettings(), topics: await getTopics() })
  })

  /** one build for the admin page (a draft from a prompt, a fix, a rebuild, a re-test): outside the students' allowance and usage counts */
  app.post('/v1/admin/build', async (c) => {
    const u = await requireReviewer(c)
    const req = await body(c, create3dRequest)
    if (await isAdmin(u)) await spend('admin', 'adminBuildUsage', 100, 'admin builds')
    else await spend(u.uid, 'reviewBuildUsage', 40, 'review builds')
    const t0 = now()
    const out = await model(() => noteVision.createOrEdit3D(req))
    return c.json({ ...out, ms: now() - t0 })
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
    await requireAdmin(c)
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
    /** a small JPEG of the model for its card */
    thumbnail: z.string().max(150_000).regex(/^data:image\/(jpeg|webp|png);base64,/).optional(),
  })
  type LibraryDoc = z.infer<typeof libraryInput> & { [k: string]: unknown; parts: number; createdAt: number; publishedAt?: number }
  const libraryId = (id: string) => {
    if (!/^[a-z0-9]{6,20}$/.test(id)) throw fail(404, 'Not found.')
    return id
  }
  const libraryCard = ({ spec, checks: _c, explanation: _e, embedding: _v, ...rest }: LibraryDoc, id: string) => {
    void _c
    void _e
    void _v
    void spec
    return { id, ...rest }
  }

  /*
   * Matching a request to the library: each published model is embedded (title, subject and request), and a
   * request is compared with them all. Embeddings are made when a model is published, or the first time the
   * index is built for older ones. If embeddings cannot be had, shared words stand in.
   */
  const entryText = (d: { title?: string; topic?: string; prompt?: string }) => [d.title, d.topic, d.prompt].filter(Boolean).join(' · ')
  const MATCH_MIN = config.matchMin ?? 0.75
  const REFERENCE_MIN = config.referenceMin ?? 0.82
  let index: { at: number; items: { id: string; doc: LibraryDoc; text: string; embedding?: number[] }[] } | null = null
  const dropIndex = () => {
    index = null
  }
  const libraryIndex = async () => {
    if (index && now() - index.at < 60_000) return index
    const rows = await db.list<LibraryDoc>('library', { limit: 1000 })
    const items = rows.map((r) => ({ id: r.id, doc: r.data, text: entryText(r.data), embedding: Array.isArray(r.data.embedding) ? (r.data.embedding as number[]) : undefined }))
    const missing = items.filter((i) => !i.embedding)
    if (missing.length) {
      try {
        const vectors = await embedder.embed(missing.map((i) => i.text), 'document')
        await Promise.all(
          missing.map(async (item, k) => {
            item.embedding = vectors[k]
            await db.set(`library/${item.id}`, { embedding: vectors[k] }, { merge: true })
          }),
        )
      } catch (e) {
        console.error('embedding the library', e) // matched by shared words until it works
      }
    }
    index = { at: now(), items }
    return index
  }
  /** the closest library models to a request, best first, with how close (0 to 1) */
  const matchLibrary = async (q: string, n: number, min: number) => {
    const { items } = await libraryIndex()
    if (!items.length) return []
    let scored: { item: (typeof items)[number]; score: number }[]
    try {
      const [v] = await embedder.embed([q], 'query')
      scored = items.filter((i) => i.embedding).map((item) => ({ item, score: cosine(v, item.embedding!) }))
      if (!scored.length) throw new Error('no embeddings yet')
    } catch {
      // shared words, on their own scale
      scored = items.map((item) => ({ item, score: Math.min(1, keywordScore(q, item.text) * 1.6) }))
    }
    return scored.filter((s) => s.score >= min).sort((a, b) => b.score - a.score).slice(0, n)
  }
  /** a new build from words starts from the closest checked library model, if one is close enough */
  const withReference = async (req: Create3dRequest): Promise<Create3dRequest> => {
    if (req.currentSpec || req.photoBase64) return req
    try {
      const [best] = await matchLibrary(req.prompt, 1, REFERENCE_MIN)
      return best ? { ...req, reference: { title: best.item.doc.title, spec: best.item.doc.spec } } : req
    } catch {
      return req
    }
  }

  /** embeds one newly published model (best effort: the index catches up later if this fails) */
  const embedOne = async (id: string, d: LibraryDoc) => {
    try {
      const [v] = await embedder.embed([entryText(d)], 'document')
      await db.set(`library/${id}`, { embedding: v }, { merge: true })
    } catch {
      /* embedded next time the index is built */
    }
    dropIndex()
  }

  /** checked library models close to what someone is typing: anyone may ask (signed out too) */
  app.get('/v1/library/match', async (c) => {
    const q = (c.req.query('q') ?? '').trim().slice(0, 400)
    if (q.length < 8) return c.json({ matches: [] })
    const u = c.get('user')
    await spend(u?.uid ?? 'anyone', 'matchUsage', u ? 600 : 20_000, 'library searches')
    const found = await matchLibrary(q, 3, MATCH_MIN)
    return c.json({ matches: found.map(({ item, score }) => ({ ...libraryCard(item.doc, item.id), score: Math.round(score * 100) / 100 })) })
  })

  app.post('/v1/library/drafts', async (c) => {
    let by = NIGHTLY
    if (c.req.header('x-eval-token')) requireEval(c)
    else by = await whoIs(await requirePerm(c, 'curate'))
    const d = await body(c, libraryInput)
    if (JSON.stringify(d.spec).length > 300_000) throw fail(413, 'This model is too large to save.')
    const id = randomId()
    // drafted from an ambassador's suggestion: the credit goes with it into the library
    const suggestedBy = ((await getTopics()) ?? []).find((t) => draftedKey(t.prompt) === draftedKey(d.prompt))?.suggestedBy
    await db.set(`libraryDrafts/${id}`, { ...d, parts: Array.isArray(d.spec.parts) ? d.spec.parts.length : 0, createdAt: now(), ...(suggestedBy ? { suggestedBy } : {}) })
    await markDrafted(d.prompt)
    await audit(by, 'drafted', { type: 'draft', id, title: d.title }, `scored ${d.score}`)
    return c.json({ id }, 201)
  })

  /** a draft changed from the admin page: fixed, rebuilt or retitled, with its new score */
  /** what a review records on a draft: the reviewer's notes, and what they have checked */
  const reviewFields = {
    reviewNotes: z.string().trim().max(2000),
    checklist: z.object({ calculations: z.boolean(), model: z.boolean(), text: z.boolean() }).partial(),
  }

  app.put('/v1/library/drafts/:id', async (c) => {
    const u = await requireReviewer(c)
    const id = libraryId(c.req.param('id'))
    const draft = await db.get<LibraryDoc & { reviewNotes?: string; checklist?: Record<string, boolean> }>(`libraryDrafts/${id}`)
    if (!draft) throw fail(404, 'Draft not found.')
    const patch = await body(c, libraryInput.partial().extend(reviewFields).partial())
    if (patch.spec && JSON.stringify(patch.spec).length > 300_000) throw fail(413, 'This model is too large to save.')
    const next = { ...draft, ...patch, ...(patch.spec ? { parts: Array.isArray(patch.spec.parts) ? patch.spec.parts.length : 0 } : {}) }
    await db.set(`libraryDrafts/${id}`, next)
    // the trail: what changed (a new picture alone is not worth a line)
    const by = await whoIs(u)
    const target = { type: 'draft' as const, id, title: next.title }
    if (patch.spec) await audit(by, 'changed the model', target, patch.score !== undefined ? `score ${draft.score} → ${patch.score}` : '')
    if (patch.title && patch.title !== draft.title) await audit(by, 'renamed', target, `${draft.title} → ${patch.title}`)
    if (patch.checklist) {
      const ticks = Object.entries(patch.checklist).filter(([k, v]) => draft.checklist?.[k] !== v)
      if (ticks.length) await audit(by, 'updated the checklist', target, ticks.map(([k, v]) => `${v ? 'ticked' : 'unticked'} ${k}`).join(', '))
    }
    if (patch.reviewNotes !== undefined && patch.reviewNotes !== (draft.reviewNotes ?? '')) await audit(by, 'wrote review notes', target, patch.reviewNotes)
    return c.json({ id, ...next })
  })

  /** the review queue, newest first, in full so the reviewer can open each one */
  app.get('/v1/library/drafts', async (c) => {
    await requireReviewer(c)
    const rows = await db.list<LibraryDoc>('libraryDrafts', { limit: 200 })
    return c.json({ drafts: rows.map((r) => ({ id: r.id, ...r.data })).sort((a, b) => b.createdAt - a.createdAt) })
  })

  app.post('/v1/library/drafts/:id/approve', async (c) => {
    const u = await requireReviewer(c)
    const id = libraryId(c.req.param('id'))
    const draft = await db.get<LibraryDoc>(`libraryDrafts/${id}`)
    if (!draft) throw fail(404, 'Draft not found.')
    const patch = await body(c, z.object({ title: libraryInput.shape.title.optional() }))
    // who checked it, and when, goes with it into the library
    const by = await whoIs(u)
    const reviewedBy = { uid: by.uid, name: by.name }
    const published = { ...draft, ...(patch.title ? { title: patch.title } : {}), reviewedBy, publishedAt: now() }
    await db.set(`library/${id}`, published)
    await db.delete(`libraryDrafts/${id}`)
    await audit(by, 'approved and published', { type: 'library', id, title: published.title }, `score ${draft.score}`)
    await embedOne(id, published)
    return c.json({ ok: true })
  })

  app.delete('/v1/library/drafts/:id', async (c) => {
    const u = await requireReviewer(c)
    const id = libraryId(c.req.param('id'))
    const draft = await db.get<LibraryDoc>(`libraryDrafts/${id}`)
    // a rejection keeps its reason, so the drafting can learn what goes wrong
    const reason = (c.req.query('reason') ?? '').trim().slice(0, 500)
    if (draft) await db.set(`libraryRejected/${id}`, { title: draft.title, prompt: draft.prompt, topic: draft.topic ?? '', reason, by: u.uid, at: now() })
    await db.delete(`libraryDrafts/${id}`)
    if (draft) await audit(await whoIs(u), 'rejected', { type: 'draft', id, title: draft.title }, reason)
    return c.json({ ok: true })
  })

  /** the audit trail, newest first, for admins: optionally one person's, one action's, or one model's */
  app.get('/v1/admin/audit', async (c) => {
    await requireAdmin(c)
    const by = c.req.query('by')
    const action = c.req.query('action')
    const target = c.req.query('target')
    const rows = (await db.list<AuditDoc>('audit', { limit: 5000 })).map((r) => r.data).sort(newestFirst)
    const people = [...new Map(rows.map((r) => [r.by.uid, r.by])).values()]
    const actions = [...new Set(rows.map((r) => r.action))].sort()
    const entries = rows.filter((r) => (!by || r.by.uid === by) && (!action || r.action === action) && (!target || r.target.id === target)).slice(0, 300)
    return c.json({ entries, people, actions })
  })

  /** one draft's (or published model's) history, for the reviewer deciding on it */
  app.get('/v1/review/history/:id', async (c) => {
    await requireReviewer(c)
    const id = libraryId(c.req.param('id'))
    const rows = (await db.list<AuditDoc>('audit', { limit: 5000 })).map((r) => r.data).filter((r) => r.target.id === id)
    return c.json({ entries: rows.sort(newestFirst) })
  })

  /** staff and their roles, for admins: owners (ADMIN_EMAILS), everyone given a role, and older reviewers */
  app.get('/v1/admin/people', async (c) => {
    await requireAdmin(c)
    const rows = await db.list<{ email: string; roles: StaffRole[]; at?: number; by?: Who }>('roles', { limit: 1000 })
    const emails = new Set([...config.adminEmails, ...rows.map((r) => r.data.email), ...(await getReviewers())])
    const people = await Promise.all(
      [...emails].map(async (email) => {
        const account = (await db.where<UserDoc>('users', 'email', email, { limit: 1 }))[0]
        return { email, roles: await rolesOfEmail(email), owner: isOwner(email), name: account?.data.displayName, uid: account?.id, joined: account?.data.createdAt }
      }),
    )
    return c.json({ people: people.filter((p) => p.roles.length).sort((a, b) => Number(b.owner) - Number(a.owner) || a.email.localeCompare(b.email)), roles: STAFF_ROLES })
  })

  /** give someone roles (by email, signed up or not), or take them away; an owner stays an admin */
  app.put('/v1/admin/people', async (c) => {
    const u = await requireAdmin(c)
    const { email, roles } = await body(c, z.object({ email: z.string().trim().toLowerCase().email().max(200), roles: z.array(z.enum(STAFF_ROLES)).max(STAFF_ROLES.length) }))
    const before = await rolesOfEmail(email)
    const wanted = [...new Set(roles)].filter((r) => !(r === 'admin' && isOwner(email)))
    if (isOwner(email) && !roles.includes('admin')) throw fail(400, 'This is an owner (set on the server): they are always an admin.')
    if (email === u.email?.toLowerCase() && can(before, 'admin') && !roles.includes('admin')) throw fail(400, 'You can’t remove your own admin role.')
    if (wanted.length) await db.set(`roles/${roleKey(email)}`, { email, roles: wanted, at: now(), by: await whoIs(u) })
    else await db.delete(`roles/${roleKey(email)}`)
    // older reviewer entries move into roles once someone's roles are set here
    const legacy = await getReviewers()
    if (legacy.includes(email)) await db.set('settings/reviewers', { emails: legacy.filter((e) => e !== email) })
    const after = await rolesOfEmail(email)
    if (after.join() !== before.join()) await audit(await whoIs(u), 'changed roles', { type: 'reviewers', title: email }, `${email}: ${before.join(', ') || 'none'} → ${after.join(', ') || 'none'}`)
    return c.json({ email, roles: after })
  })

  /*
   * Every account, for admins: searched, filtered, sorted and a page at a time (or all as CSV). Accounts are
   * read in one go and kept for 30 s per server, which is fine up to some tens of thousands of accounts.
   */
  let accountsCache: { at: number; rows: Row<UserDoc & { lastSeenAt?: number; referredBy?: string }>[] } | null = null
  const allAccounts = async () => {
    if (!accountsCache || now() - accountsCache.at > 30_000 || now() < accountsCache.at) accountsCache = { at: now(), rows: await db.list<UserDoc & { lastSeenAt?: number; referredBy?: string }>('users', { limit: 50_000 }) }
    return accountsCache.rows
  }
  const accountsQuery = z.object({
    q: z.string().trim().toLowerCase().max(200).default(''),
    type: z.enum(['all', 'student', 'teacher']).default('all'),
    // a staff role, "staff" (any), or "none"
    role: z.enum(['all', 'staff', 'none', ...STAFF_ROLES]).default('all'),
    active: z.enum(['all', '7', '30', 'inactive']).default('all'),
    sort: z.enum(['joined', 'seen', 'name', 'email']).default('joined'),
    dir: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    size: z.coerce.number().int().min(10).max(200).default(50),
  })
  const findAccounts = async (f: z.infer<typeof accountsQuery>) => {
    const staff = new Map<string, StaffRole[]>()
    for (const r of await db.list<{ email: string; roles: StaffRole[] }>('roles', { limit: 5000 })) staff.set(r.data.email, r.data.roles)
    for (const e of await getReviewers()) staff.set(e, [...new Set([...(staff.get(e) ?? []), 'reviewer' as StaffRole])])
    for (const e of config.adminEmails) staff.set(e, [...new Set(['admin' as StaffRole, ...(staff.get(e) ?? [])])])
    const t = now()
    const all = (await allAccounts()).map((r) => {
      const email = (r.data.email ?? '').toLowerCase()
      return {
        uid: r.id,
        email,
        name: r.data.displayName ?? '',
        type: r.data.role === 'teacher' ? ('teacher' as const) : ('student' as const),
        joined: r.data.createdAt ?? 0,
        lastSeen: r.data.lastSeenAt ?? null,
        roles: staff.get(email) ?? [],
        owner: isOwner(email),
        referredBy: r.data.referredBy ?? null,
      }
    })
    const seen = (a: (typeof all)[number]) => a.lastSeen ?? a.joined
    const rows = all.filter(
      (a) =>
        (!f.q || a.email.includes(f.q) || a.name.toLowerCase().includes(f.q) || a.uid === f.q) &&
        (f.type === 'all' || a.type === f.type) &&
        (f.role === 'all' || (f.role === 'staff' ? a.roles.length > 0 : f.role === 'none' ? a.roles.length === 0 : a.roles.includes(f.role))) &&
        (f.active === 'all' || (f.active === 'inactive' ? t - seen(a) > 30 * 86_400_000 : t - seen(a) <= Number(f.active) * 86_400_000)),
    )
    const key = { joined: (a: (typeof all)[number]) => a.joined, seen, name: (a: (typeof all)[number]) => a.name.toLowerCase(), email: (a: (typeof all)[number]) => a.email }[f.sort]
    rows.sort((x, y) => {
      const a = key(x)
      const b = key(y)
      const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
      return f.dir === 'asc' ? c : -c
    })
    const counts = {
      all: all.length,
      students: all.filter((a) => a.type === 'student').length,
      teachers: all.filter((a) => a.type === 'teacher').length,
      staff: all.filter((a) => a.roles.length).length,
      active7: all.filter((a) => t - seen(a) <= 7 * 86_400_000).length,
      new7: all.filter((a) => t - a.joined <= 7 * 86_400_000).length,
    }
    return { rows, counts }
  }
  app.get('/v1/admin/accounts', async (c) => {
    await requireAdmin(c)
    const f = accountsQuery.parse(c.req.query())
    const { rows, counts } = await findAccounts(f)
    const pages = Math.max(1, Math.ceil(rows.length / f.size))
    const page = Math.min(f.page, pages)
    return c.json({ accounts: rows.slice((page - 1) * f.size, page * f.size), total: rows.length, page, pages, size: f.size, counts })
  })
  app.get('/v1/admin/accounts.csv', async (c) => {
    await requireAdmin(c)
    const { rows } = await findAccounts(accountsQuery.parse(c.req.query()))
    const cell = (v: unknown) => {
      const t = v == null ? '' : String(v)
      // quoted, and never read as a formula by a spreadsheet
      return `"${(/^[=+\-@]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`
    }
    const iso = (n: number | null) => (n ? new Date(n).toISOString().slice(0, 10) : '')
    const lines = [['name', 'email', 'type', 'joined', 'last seen', 'roles', 'referred by'].join(','), ...rows.map((a) => [a.name, a.email, a.type, iso(a.joined), iso(a.lastSeen), a.roles.join(' '), a.referredBy].map(cell).join(','))]
    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', 'attachment; filename="solidify-accounts.csv"')
    return c.body(lines.join('\r\n'))
  })

  /** an account by email: profile, roles and today's use, for admins */
  app.get('/v1/admin/people/lookup', async (c) => {
    await requireAdmin(c)
    const email = (c.req.query('email') ?? '').trim().toLowerCase()
    if (!email) throw fail(400, 'Give an email.')
    const account = (await db.where<UserDoc>('users', 'email', email, { limit: 1 }))[0]
    const roles = await rolesOfEmail(email)
    if (!account) return c.json({ email, found: false, roles })
    const d = day(now())
    const used = async (bucket: string) => (await db.get<{ count: number }>(`${bucket}/${account.id}_${d}`))?.count ?? 0
    const models = (await db.list(`users/${account.id}/creations`, { limit: 100 })).length
    return c.json({
      email,
      found: true,
      roles,
      uid: account.id,
      name: account.data.displayName,
      role: account.data.role,
      joined: account.data.createdAt,
      today: { builds: await used('createUsage'), notePages: await used('noteUsage'), tutor: await used('tutorUsage'), libraryModels: await used('libraryFetchUsage') },
      models,
    })
  })

  /** the reviewer list, for admins */
  app.get('/v1/admin/reviewers', async (c) => {
    await requireAdmin(c)
    return c.json({ emails: await getReviewers() })
  })

  app.put('/v1/admin/reviewers', async (c) => {
    await requireAdmin(c)
    const { emails } = await body(c, z.object({ emails: z.array(z.string().trim().toLowerCase().email().max(200)).max(100) }))
    const unique = [...new Set(emails)]
    const before = await getReviewers()
    await db.set('settings/reviewers', { emails: unique })
    const by = await whoIs(await requireAdmin(c))
    for (const e of unique.filter((x) => !before.includes(x))) await audit(by, 'added a reviewer', { type: 'reviewers' }, e)
    for (const e of before.filter((x) => !unique.includes(x))) await audit(by, 'removed a reviewer', { type: 'reviewers' }, e)
    return c.json({ emails: unique })
  })

  /** the published models: cards only, anyone may read */
  /*
   * Some models are free to view signed out: those a curator marks so, or (until any is marked) the six best
   * scored. Opening any other one, or keeping a copy of any, needs an account.
   */
  const FREE_BY_DEFAULT = 6
  const freeIds = (rows: { id: string; data: LibraryDoc }[]) => {
    if (rows.some((r) => r.data.open === true)) return new Set(rows.filter((r) => r.data.open === true).map((r) => r.id))
    return new Set(
      rows
        .filter((r) => r.data.open !== false)
        .sort((a, b) => (b.data.score ?? 0) - (a.data.score ?? 0) || (b.data.publishedAt ?? 0) - (a.data.publishedAt ?? 0))
        .slice(0, FREE_BY_DEFAULT)
        .map((r) => r.id),
    )
  }
  app.get('/v1/library', async (c) => {
    const rows = await db.list<LibraryDoc>('library', { limit: 500 })
    const free = freeIds(rows)
    return c.json({ items: rows.map((r) => ({ ...libraryCard(r.data, r.id), free: free.has(r.id) })).sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)) })
  })

  app.get('/v1/library/:id', async (c) => {
    // the cards are public; the full model is for people signed in, up to a day's worth (staff are not counted),
    // except the few free to view, which anyone may open (a shared daily allowance for everyone signed out)
    const id = libraryId(c.req.param('id'))
    const u = c.get('user')
    if (!u) {
      if (!freeIds(await db.list<LibraryDoc>('library', { limit: 500 })).has(id)) throw fail(401, 'Sign in to open this model.')
      await spend('everyone', 'libraryPublicUsage', 3000, 'free library views')
    } else if (!can(await rolesOfEmail(u.email), 'review')) await spend(u.uid, 'libraryFetchUsage', 100, 'library models')
    const item = await db.get<LibraryDoc>(`library/${id}`)
    if (!item) throw fail(404, 'Not found.')
    const { checks: _c, embedding: _v, ...rest } = item
    void _c
    void _v
    return c.json({ id: c.req.param('id'), ...rest })
  })

  app.delete('/v1/library/:id', async (c) => {
    const u = await requirePerm(c, 'curate')
    const id = libraryId(c.req.param('id'))
    const item = await db.get<LibraryDoc>(`library/${id}`)
    await db.delete(`library/${id}`)
    dropIndex()
    if (item) await audit(await whoIs(u), 'unpublished', { type: 'library', id, title: item.title })
    return c.json({ ok: true })
  })

  /** an admin publishes a model straight to the library (from the workspace), skipping the queue */
  app.post('/v1/library', async (c) => {
    const u = await requirePerm(c, 'curate')
    const d = await body(c, libraryInput)
    if (JSON.stringify(d.spec).length > 300_000) throw fail(413, 'This model is too large to save.')
    const id = randomId()
    const by = await whoIs(u)
    const published = { ...d, parts: Array.isArray(d.spec.parts) ? d.spec.parts.length : 0, reviewedBy: { uid: by.uid, name: by.name }, createdAt: now(), publishedAt: now() }
    await db.set(`library/${id}`, published)
    await audit(by, 'published directly', { type: 'library', id, title: d.title }, `score ${d.score}`)
    await embedOne(id, published)
    return c.json({ id }, 201)
  })

  /** retitle or re-topic a published model */
  app.put('/v1/library/:id', async (c) => {
    const u = await requirePerm(c, 'curate')
    const id = libraryId(c.req.param('id'))
    const item = await db.get<LibraryDoc>(`library/${id}`)
    if (!item) throw fail(404, 'Not found.')
    const patch = await body(c, z.object({ title: libraryInput.shape.title, topic: z.string().trim().max(60), thumbnail: libraryInput.shape.thumbnail, open: z.boolean() }).partial())
    const next = { ...item, ...patch }
    await db.set(`library/${id}`, next)
    const changed = [
      patch.title && patch.title !== item.title ? `title: ${item.title} → ${patch.title}` : '',
      patch.topic !== undefined && patch.topic !== (item.topic ?? '') ? `subject: ${item.topic ?? '—'} → ${patch.topic || '—'}` : '',
      patch.open !== undefined && patch.open !== item.open ? (patch.open ? 'free to view signed out' : 'sign-in only') : '',
    ].filter(Boolean)
    if (changed.length) await audit(await whoIs(u), 'edited a published model', { type: 'library', id, title: next.title }, changed.join('; '))
    // a new title or subject changes what it matches
    if (patch.title || patch.topic !== undefined) await embedOne(id, next)
    return c.json({ ok: true })
  })

  /* ------------------------------------------------------------------ student ambassadors */

  /*
   * Students who bring their classmates and lecturers to Solidify. They apply on /ambassadors; an admin accepts
   * them (the ambassador role and a referral code); sign-ups from their link, and classes those people create,
   * are credited to them; their topic suggestions go into the drafting pool with their name.
   */
  interface AmbassadorDoc {
    [k: string]: unknown
    email: string
    name: string
    school: string
    code: string
    status: 'active' | 'paused'
    joinedAt: number
  }
  const ambassadorOf = async (email?: string | null) => (email ? db.get<AmbassadorDoc>(`ambassadors/${roleKey(email)}`) : null)
  const requireAmbassador = async (c: Context<Env>) => {
    const u = await requirePerm(c, 'ambassador')
    const a = await ambassadorOf(u.email)
    if (!a) throw fail(403, 'You are not an ambassador yet.')
    return { u, a }
  }
  /** a short code from the name, unique: "ada", "ada2" */
  const newCode = async (name: string) => {
    const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'friend'
    for (let i = 1; i < 500; i++) {
      const code = i === 1 ? base : `${base}${i}`
      if (!(await db.where('ambassadors', 'code', code, { limit: 1 })).length) return code
    }
    return `${base}${randomId().slice(0, 4)}`
  }
  /** what an ambassador has brought in: sign-ups, how many are active (seen in 14 days), teachers, classes */
  const ambassadorStats = async (code: string) => {
    const users = await db.where<UserDoc & { lastSeenAt?: number }>('users', 'referredBy', code, { limit: 5000 })
    const classes = await db.where('classes', 'referredBy', code, { limit: 5000 })
    const recent = now() - 14 * 86_400_000
    return {
      signups: users.length,
      active: users.filter((r) => (r.data.lastSeenAt ?? r.data.createdAt) >= recent).length,
      teachers: users.filter((r) => r.data.role === 'teacher').length,
      classes: classes.length,
      // first names only: an ambassador sees who joined, not their accounts
      latest: users
        .sort((a, b) => b.data.createdAt - a.data.createdAt)
        .slice(0, 10)
        .map((r) => ({ name: String(r.data.displayName ?? '').split(' ')[0] || 'Someone', role: r.data.role, joined: r.data.createdAt })),
    }
  }

  const applicationInput = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    school: z.string().trim().min(2).max(160),
    department: z.string().trim().max(160).default(''),
    level: z.string().trim().max(40).default(''),
    why: z.string().trim().min(20).max(2000),
    links: z.string().trim().max(500).default(''),
    website: z.string().max(0).optional(), // a field people never see: bots fill it in
  })

  /** anyone may apply (one application per email) */
  app.post('/v1/ambassadors/apply', async (c) => {
    const a = await body(c, applicationInput)
    if (a.website) return c.json({ ok: true }, 201)
    const { website: _w, ...entry } = a
    void _w
    await db.set(`ambassadorApplications/${roleKey(a.email)}`, { ...entry, status: 'new', at: now(), uid: c.get('user')?.uid ?? null })
    return c.json({ ok: true }, 201)
  })

  /** a signed-in person who arrived through a referral link: credited to that ambassador, if their account is new */
  app.post('/v1/me/referral', async (c) => {
    const u = requireUser(c)
    const { code } = await body(c, z.object({ code: z.string().trim().toLowerCase().regex(/^[a-z0-9]{2,20}$/) }))
    const p = await profile(u)
    // only brand-new accounts, and never twice, so nobody can claim people who were here already
    if (p.referredBy || now() - p.createdAt > 24 * 3_600_000) return c.json({ credited: false })
    const [amb] = await db.where<AmbassadorDoc>('ambassadors', 'code', code, { limit: 1 })
    if (!amb || amb.data.status !== 'active' || amb.data.email === u.email?.toLowerCase()) return c.json({ credited: false })
    await db.set(`users/${u.uid}`, { referredBy: code }, { merge: true })
    return c.json({ credited: true })
  })

  /** an ambassador's own dashboard */
  app.get('/v1/ambassador/me', async (c) => {
    const { a } = await requireAmbassador(c)
    const suggestions = ((await getTopics()) ?? []).filter((t) => t.suggestedBy === a.name)
    const drafted = await getDrafted()
    const published = (await db.list<LibraryDoc & { suggestedBy?: string }>('library', { limit: 1000 })).filter((r) => r.data.suggestedBy === a.name).map((r) => r.data.title)
    return c.json({
      ...a,
      stats: await ambassadorStats(a.code),
      suggestions: suggestions.map((t) => ({ ...t, drafted: drafted.has(draftedKey(t.prompt)) })),
      published,
    })
  })

  /** an ambassador suggests a model for the library: it joins the drafting pool with their name */
  app.post('/v1/ambassador/suggestions', async (c) => {
    const { u, a } = await requireAmbassador(c)
    const t = await body(c, z.object({ topic: z.string().trim().min(2).max(60), prompt: z.string().trim().min(12).max(400) }))
    await spend(u.uid, 'suggestionUsage', 20, 'suggestions')
    const pool = (await getTopics()) ?? []
    if (pool.some((x) => draftedKey(x.prompt) === draftedKey(t.prompt))) throw fail(409, 'That one is already in the list.')
    await db.set('settings/topics', { items: [...pool, { ...t, suggestedBy: a.name }].slice(-1000) })
    await audit(await whoIs(u), 'suggested a topic', { type: 'topics', title: t.prompt }, `${a.name} (${a.school})`)
    return c.json({ ok: true }, 201)
  })

  /** the programme, for admins: applications, and every ambassador with results */
  app.get('/v1/admin/ambassadors', async (c) => {
    await requireAdmin(c)
    const apps = (await db.list<Record<string, unknown> & { at: number; status: string }>('ambassadorApplications', { limit: 1000 })).map((r) => ({ id: r.id, ...r.data })).sort((x, y) => y.at - x.at)
    const ambs = await Promise.all((await db.list<AmbassadorDoc>('ambassadors', { limit: 1000 })).map(async (r) => ({ ...r.data, stats: await ambassadorStats(r.data.code) })))
    return c.json({ applications: apps, ambassadors: ambs.sort((x, y) => y.stats.active - x.stats.active || y.stats.signups - x.stats.signups) })
  })

  /** accept an application (makes them an ambassador), decline it, or pause or resume an ambassador */
  app.post('/v1/admin/ambassadors/decide', async (c) => {
    const u = await requireAdmin(c)
    const { email, decision } = await body(c, z.object({ email: z.string().trim().toLowerCase().email(), decision: z.enum(['accept', 'decline', 'pause', 'resume']) }))
    const by = await whoIs(u)
    if (decision === 'accept' || decision === 'decline') {
      const appl = await db.get<{ name: string; school: string }>(`ambassadorApplications/${roleKey(email)}`)
      if (!appl) throw fail(404, 'No application from that email.')
      await db.set(`ambassadorApplications/${roleKey(email)}`, { status: decision === 'accept' ? 'accepted' : 'declined', decidedAt: now() }, { merge: true })
      if (decision === 'accept') {
        const existing = await ambassadorOf(email)
        const code = existing?.code ?? (await newCode(appl.name))
        await db.set(`ambassadors/${roleKey(email)}`, { email, name: appl.name, school: appl.school, code, status: 'active', joinedAt: existing?.joinedAt ?? now() })
        const roles = (await db.get<{ roles: StaffRole[] }>(`roles/${roleKey(email)}`))?.roles ?? []
        if (!roles.includes('ambassador')) await db.set(`roles/${roleKey(email)}`, { email, roles: [...roles, 'ambassador'], at: now(), by })
      }
      await audit(by, decision === 'accept' ? 'accepted an ambassador' : 'declined an ambassador', { type: 'reviewers', title: email }, `${appl.name}, ${appl.school}`)
      return c.json({ ok: true })
    }
    const amb = await ambassadorOf(email)
    if (!amb) throw fail(404, 'Not an ambassador.')
    await db.set(`ambassadors/${roleKey(email)}`, { status: decision === 'pause' ? 'paused' : 'active' }, { merge: true })
    await audit(by, decision === 'pause' ? 'paused an ambassador' : 'resumed an ambassador', { type: 'reviewers', title: email }, amb.name)
    return c.json({ ok: true })
  })

  /* ------------------------------------------------------------------ creation lab */

  /** a student's saved models: everything they build in Create in 3D, to reopen and keep changing */
  const CREATION_LIMIT = 50
  const historyItem = z.object({ prompt: z.string().max(2000), response: z.string().max(4000) })
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
  /** a solved question's short form for lists (Exam practice's "Your questions"): the start of it and what it asks */
  const questionSummary = (spec: unknown) => {
    const q = (spec as { question?: { text?: unknown; find?: unknown } } | undefined)?.question
    const written = (spec as { answerOnly?: unknown } | undefined)?.answerOnly === true
    if (!q || typeof q.text !== 'string' || !q.text.trim()) return undefined
    const find = Array.isArray(q.find) ? q.find.filter((f): f is string => typeof f === 'string').slice(0, 4).map((f) => f.slice(0, 120)) : []
    return { text: q.text.trim().slice(0, 240), find, ...(written ? { written: true } : {}) }
  }

  app.get('/v1/creations', async (c) => {
    const u = requireUser(c)
    const rows = await db.list<CreationDoc>(`users/${u.uid}/creations`)
    const items = rows
      .map(({ id, data: d }) => ({ id, title: d.title, prompt: d.prompt, fromPhoto: d.fromPhoto, thumbnail: d.thumbnail, parts: d.parts, createdAt: d.createdAt, updatedAt: d.updatedAt, question: questionSummary(d.spec) }))
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
    const cls: ClassDoc = { name, teacherUid: u.uid, teacherName: p.displayName, code, createdAt: now(), ...(p.referredBy ? { referredBy: p.referredBy } : {}) }
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
    await requirePerm(c, 'support')
    const rows = await db.list<Record<string, unknown> & { createdAt: number }>('waitlist', { limit: 5000 })
    return c.json({ count: rows.length, entries: rows.map((r) => r.data).sort((a, b) => a.createdAt - b.createdAt) })
  })

  app.get('/v1/waitlist.csv', async (c) => {
    await requirePerm(c, 'support')
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

  /** support marks a message as dealt with (or back to new) */
  app.put('/v1/feedback/:id', async (c) => {
    const u = await requirePerm(c, 'support')
    const id = c.req.param('id')
    if (!/^[0-9]+_[a-z0-9]+$/.test(id)) throw fail(404, 'Not found.')
    const item = await db.get<Record<string, unknown>>(`feedback/${id}`)
    if (!item) throw fail(404, 'Not found.')
    const { status } = await body(c, z.object({ status: z.enum(['new', 'done']) }))
    await db.set(`feedback/${id}`, { status, statusBy: u.uid, statusAt: now() }, { merge: true })
    return c.json({ ok: true })
  })

  app.get('/v1/feedback', async (c) => {
    await requirePerm(c, 'support')
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
