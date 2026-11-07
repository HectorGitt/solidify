import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { FirebaseVerifier, FirestoreDb } from './firestore.js'
import { GeminiTutor } from './tutor.js'
import { GeminiNoteVision } from './note3d.js'
import { GeminiEmbedder } from './embed.js'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAppCheck as appCheckFor } from 'firebase-admin/app-check'

const getAppCheck = () => appCheckFor(getApps()[0] ?? initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT }))
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
  appChecker: { verify: async (token) => !!(await getAppCheck().verifyToken(token)) },
  db: new FirestoreDb(),
  verifier: new FirebaseVerifier(),
  tutor: new GeminiTutor(env('GEMINI_MODEL', 'gemini-3.8-flash'), project, env('GEMINI_LOCATION', 'global')),
  // matching requests to the library: the first region that serves the embedding model is kept
  embedder: new GeminiEmbedder(env('EMBED_MODEL', 'gemini-embedding-001'), project, [...new Set([env('EMBED_LOCATION', env('GEMINI_LOCATION', 'global')), 'us-central1', 'europe-west1'])]),
  noteVision: new GeminiNoteVision(env('GEMINI_MODEL', 'gemini-3.8-flash'), project, env('GEMINI_LOCATION', 'global')),
  config: {
    allowedOrigins: list(env('ALLOWED_ORIGINS', 'https://solidify.studio,http://localhost:5173,http://localhost:5180')),
    tutorDailyLimit: Number(env('TUTOR_DAILY_LIMIT', '40')),
    adminEmails: list(env('ADMIN_EMAILS', 'ola@solidify.studio,admin@solidify.studio')),
    evalToken: process.env.EVAL_TOKEN,
    // App Check: off until the site key is in the web app, then monitor for a few days, then enforce
    appCheck: (['off', 'monitor', 'enforce'] as const).find((m) => m === process.env.APP_CHECK) ?? 'off',
    // e.g. MODEL_PRICE=0.30,2.50 (input, output: US dollars per million tokens)
    // MODEL_PRICE=in,out overrides Google's list price for the model (built in for gemini-3.8-flash, changing on its dates)
    modelPrice: process.env.MODEL_PRICE ? (([i, o]) => ({ inputPerM: i, outputPerM: o }))(process.env.MODEL_PRICE.split(',').map(Number)) : (t: number) => listPrice(env('GEMINI_MODEL', 'gemini-3.8-flash'), t),
  },
})

const port = Number(env('PORT', '8080'))
serve({ fetch: app.fetch, port }, () => console.log(`solidify-api listening on :${port}`))
