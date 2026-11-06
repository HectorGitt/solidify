import { it } from 'vitest'
import { EVAL_CASES } from './cases'
import { scoreBuild, type EvalCheck } from './score'

/**
 * The nightly test run: builds every case through the live API (the same Gemini prompt students get),
 * scores each with score.ts, and posts the night's results for the quality page.
 *   EVAL_API    the API's address (https://solidify-api-…run.app)
 *   EVAL_TOKEN  the API's EVAL_TOKEN
 *   EVAL_LIMIT  build only the first n cases (a cheap trial)
 *   EVAL_DRY=1  score and print, but do not post
 * Run: npx vitest run --config vitest.eval.config.ts
 */
const API = process.env.EVAL_API ?? ''
const TOKEN = process.env.EVAL_TOKEN ?? ''
const LIMIT = Number(process.env.EVAL_LIMIT ?? EVAL_CASES.length)
const DRY = process.env.EVAL_DRY === '1'

interface CaseResult {
  id: string
  prompt: string
  score: number
  seconds: number
  checks: EvalCheck[]
  error?: string
}

async function buildOne(prompt: string): Promise<{ reply: Record<string, unknown>; seconds: number }> {
  const t0 = Date.now()
  const res = await fetch(`${API}/v1/evals/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-eval-token': TOKEN },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(240_000),
  })
  if (!res.ok) throw new Error(`build ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return { reply: (await res.json()) as Record<string, unknown>, seconds: (Date.now() - t0) / 1000 }
}

it('nightly test run', { timeout: 60 * 60_000 }, async () => {
  if (!API || !TOKEN) throw new Error('Set EVAL_API and EVAL_TOKEN.')
  const cases = EVAL_CASES.slice(0, LIMIT)
  const results: CaseResult[] = []
  // three at a time: quick enough for a nightly job, gentle on the model's rate limits
  let next = 0
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < cases.length) {
        const c = cases[next++]
        try {
          const { reply, seconds } = await buildOne(c.prompt)
          const { score, checks } = scoreBuild(c, reply, seconds)
          results.push({ id: c.id, prompt: c.prompt, score, seconds: Math.round(seconds), checks })
        } catch (e) {
          results.push({ id: c.id, prompt: c.prompt, score: 0, seconds: 0, checks: [{ name: 'builds', ok: false, detail: String(e).slice(0, 300) }], error: String(e).slice(0, 300) })
        }
        const r = results.at(-1)!
        console.log(`${String(r.score).padStart(3)}  ${r.id}${r.checks.filter((x) => !x.ok).map((x) => `\n       ✗ ${x.name}${x.detail ? `: ${x.detail}` : ''}`).join('')}`)
      }
    }),
  )
  results.sort((a, b) => cases.findIndex((c) => c.id === a.id) - cases.findIndex((c) => c.id === b.id))
  const summary = {
    score: Math.round(results.reduce((n, r) => n + r.score, 0) / Math.max(1, results.length)),
    passed: results.filter((r) => r.score === 100).length,
    total: results.length,
  }
  console.log(`\nnight's score ${summary.score} · ${summary.passed} of ${summary.total} builds perfect`)
  if (DRY) return
  const res = await fetch(`${API}/v1/evals/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-eval-token': TOKEN },
    body: JSON.stringify({ runAt: Date.now(), label: process.env.EVAL_LABEL, cases: results, summary }),
  })
  if (!res.ok) throw new Error(`posting results: ${res.status} ${(await res.text()).slice(0, 200)}`)
})
