import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { FirebaseVerifier, FirestoreDb } from './firestore.js'
import { GeminiTutor } from './tutor.js'
import { GeminiNoteVision } from './note3d.js'

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
  },
})

const port = Number(env('PORT', '8080'))
serve({ fetch: app.fetch, port }, () => console.log(`solidify-api listening on :${port}`))
