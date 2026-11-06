import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { FirebaseVerifier, FirestoreDb } from './firestore.js'
import { GeminiTutor } from './tutor.js'
import { GeminiNoteVision } from './note3d.js'
import { listPrice } from './prices.js'

const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d
  if (v === undefined) throw new Error(`Missing environment variable ${k}`)
  return v
}
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

const project = env('GOOGLE_CLOUD_PROJECT')

const app = createApp({
  db: new FirestoreDb(),
  verifier: new FirebaseVerifier(),
  tutor: new GeminiTutor(env('GEMINI_MODEL', 'gemini-3.8-flash'), project, env('GEMINI_LOCATION', 'global')),
  noteVision: new GeminiNoteVision(env('GEMINI_MODEL', 'gemini-3.8-flash'), project, env('GEMINI_LOCATION', 'global')),
  config: {
    allowedOrigins: list(env('ALLOWED_ORIGINS', 'https://solidify.studio,http://localhost:5173,http://localhost:5180')),
    tutorDailyLimit: Number(env('TUTOR_DAILY_LIMIT', '40')),
    adminEmails: list(env('ADMIN_EMAILS', 'ola@solidify.studio,admin@solidify.studio')),
    evalToken: process.env.EVAL_TOKEN,
    // a fine-grained GitHub token with Actions read and write on this repository only
    dispatchRun: process.env.GITHUB_DISPATCH_TOKEN
      ? async (inputs) => {
          const repo = env('GITHUB_REPO', 'HectorGitt/solidify')
          const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/nightly-evals.yml/dispatches`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'solidify-api' },
            body: JSON.stringify({ ref: 'main', inputs }),
          })
          if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`)
        }
      : undefined,
    // e.g. MODEL_PRICE=0.30,2.50 (input, output: US dollars per million tokens)
    // MODEL_PRICE=in,out overrides Google's list price for the model (built in for gemini-3.8-flash, changing on its dates)
    modelPrice: process.env.MODEL_PRICE ? (([i, o]) => ({ inputPerM: i, outputPerM: o }))(process.env.MODEL_PRICE.split(',').map(Number)) : (t: number) => listPrice(env('GEMINI_MODEL', 'gemini-3.8-flash'), t),
  },
})

const port = Number(env('PORT', '8080'))
serve({ fetch: app.fetch, port }, () => console.log(`solidify-api listening on :${port}`))
