import { it } from 'vitest'
import { EVAL_CASES } from './cases'
import { scoreBuild, type EvalCheck } from './score'
import { DRAFT_TOPICS, topicsFor, type DraftTopic } from './topics'

/**
 * The nightly test run: builds every case through the live API (the same Gemini prompt students get),
 * scores each with score.ts, and posts the night's results for the quality page.
 *   EVAL_API    the API's address (https://solidify-api-…run.app)
 *   EVAL_TOKEN  the API's EVAL_TOKEN
 *   EVAL_LIMIT  build only the first n cases (a cheap trial)
 *   EVAL_DRY=1  score and print, but do not post
 *   EVAL_DRAFTS how many new library models to draft tonight; those scoring EVAL_DRAFT_MIN or more go to
 *               the review queue. Both default to the admin page's settings (3 and 85 until changed there),
 *               which also hold the topic list and can pause the scheduled run (EVAL_LABEL=nightly).
 * Run: npx vitest run --config vitest.eval.config.ts
 */
const API = process.env.EVAL_API ?? ''
const TOKEN = process.env.EVAL_TOKEN ?? ''
const LIMIT = Number(process.env.EVAL_LIMIT || EVAL_CASES.length)
const DRY = process.env.EVAL_DRY === '1'

interface NightSettings {
  paused: boolean
  draftsPerNight: number
  draftMin: number
}

/** the admin page's settings; the built-in defaults if the API can't say */
async function nightSettings(): Promise<{ settings: NightSettings; topics: DraftTopic[] }> {
  const fallback = { settings: { paused: false, draftsPerNight: 3, draftMin: 85 }, topics: DRAFT_TOPICS }
  try {
    const res = await fetch(`${API}/v1/evals/settings`, { headers: { 'x-eval-token': TOKEN } })
    if (!res.ok) return fallback
    const got = (await res.json()) as { settings: NightSettings; topics: DraftTopic[] | null }
    return { settings: got.settings, topics: got.topics?.length ? got.topics : DRAFT_TOPICS }
  } catch {
    return fallback
  }
}

/** runs `work` over `items` three at a time: quick enough for a nightly job, gentle on the model's rate limits */
async function pool<T>(items: T[], work: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < items.length) await work(items[next++])
  }))
}

const post = async (path: string, json: unknown) => {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-eval-token': TOKEN }, body: JSON.stringify(json) })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 200)}`)
}

interface CaseResult {
  id: string
  prompt: string
  score: number
  seconds: number
  checks: EvalCheck[]
  error?: string
  tokensIn?: number
  tokensOut?: number
}

/** one build; if the model is still busy after the API's own retries, one more try half a minute later (timed from that try) */
async function buildOne(prompt: string): Promise<{ reply: Record<string, unknown>; seconds: number }> {
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now()
    const res = await fetch(`${API}/v1/evals/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-eval-token': TOKEN },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(240_000),
    })
    if (res.ok) return { reply: (await res.json()) as Record<string, unknown>, seconds: (Date.now() - t0) / 1000 }
    if (attempt === 0 && (res.status === 503 || res.status === 429)) {
      await new Promise((r) => setTimeout(r, 30_000))
      continue
    }
    throw new Error(`build ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
}

it('nightly test run', { timeout: 60 * 60_000 }, async () => {
  if (!API || !TOKEN) throw new Error('Set EVAL_API and EVAL_TOKEN.')
  const { settings, topics: topicList } = await nightSettings()
  if (settings.paused && process.env.EVAL_LABEL === 'nightly') {
    console.log('Nightly runs are paused on the admin page.')
    return
  }
  const DRAFTS = process.env.EVAL_DRAFTS ? Number(process.env.EVAL_DRAFTS) : settings.draftsPerNight
  const DRAFT_MIN = process.env.EVAL_DRAFT_MIN ? Number(process.env.EVAL_DRAFT_MIN) : settings.draftMin
  const cases = EVAL_CASES.slice(0, LIMIT)
  const results: CaseResult[] = []
  await pool(cases, async (c) => {
    try {
      const { reply, seconds } = await buildOne(c.prompt)
      const { score, checks } = scoreBuild(c, reply, seconds)
      const usage = reply.usage as { input?: number; output?: number } | undefined
      results.push({ id: c.id, prompt: c.prompt, score, seconds: Math.round(seconds), checks, tokensIn: usage?.input, tokensOut: usage?.output })
    } catch (e) {
      results.push({ id: c.id, prompt: c.prompt, score: 0, seconds: 0, checks: [{ name: 'builds', ok: false, detail: String(e).slice(0, 300) }], error: String(e).slice(0, 300) })
    }
    const r = results.at(-1)!
    console.log(`${String(r.score).padStart(3)}  ${r.id}${r.checks.filter((x) => !x.ok).map((x) => `\n       ✗ ${x.name}${x.detail ? `: ${x.detail}` : ''}`).join('')}`)
  })
  results.sort((a, b) => cases.findIndex((c) => c.id === a.id) - cases.findIndex((c) => c.id === b.id))
  const summary = {
    score: Math.round(results.reduce((n, r) => n + r.score, 0) / Math.max(1, results.length)),
    passed: results.filter((r) => r.score === 100).length,
    total: results.length,
    tokensIn: results.reduce((n, r) => n + (r.tokensIn ?? 0), 0),
    tokensOut: results.reduce((n, r) => n + (r.tokensOut ?? 0), 0),
  }
  console.log(`\nnight's score ${summary.score} · ${summary.passed} of ${summary.total} builds perfect · ${summary.tokensIn.toLocaleString()} tokens in, ${summary.tokensOut.toLocaleString()} out`)
  if (!DRY) await post('/v1/evals/runs', { runAt: Date.now(), label: process.env.EVAL_LABEL, cases: results, summary })

  // new models for the library: built and scored the same way, and only the good ones queued for review
  const topics = topicsFor(Math.floor(Date.now() / 86_400_000), DRAFTS, topicList)
  if (topics.length) console.log(`\ndrafting ${topics.length} new models`)
  await pool(topics, async (t) => {
    try {
      const { reply, seconds } = await buildOne(t.prompt)
      const { score, checks, spec: clean } = scoreBuild({ id: 'draft', prompt: t.prompt }, reply, seconds)
      // the cleaned model, as the app would build it, not Gemini's raw answer
      const spec = clean as unknown as Record<string, unknown> | null
      const queued = score >= DRAFT_MIN && !!spec
      console.log(`${String(score).padStart(3)}  ${queued ? 'queued ' : 'dropped'}  ${t.prompt}`)
      if (queued && !DRY) {
        const title = typeof spec.title === 'string' && spec.title.trim() ? spec.title.trim().slice(0, 120) : t.prompt.slice(0, 120)
        await post('/v1/library/drafts', { title, prompt: t.prompt, topic: t.topic, spec, explanation: typeof reply.explanation === 'string' ? reply.explanation.slice(0, 4000) : undefined, score, checks })
      }
    } catch (e) {
      console.log(`  0  failed   ${t.prompt}: ${String(e).slice(0, 200)}`)
    }
  })
})
