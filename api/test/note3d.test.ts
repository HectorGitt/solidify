import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeNoteVision, ModelReplyError, parseModelJson } from '../src/note3d.js'
import { NOTE_CATALOG } from '../src/noteCatalog.js'
import { FakeTutor } from '../src/tutor.js'

let app: ReturnType<typeof createApp>
let vision: FakeNoteVision

beforeEach(() => {
  vision = new FakeNoteVision()
  app = createApp({
    db: new MemoryDb(),
    verifier: new FakeVerifier(),
    tutor: new FakeTutor(),
    noteVision: vision,
    config: { allowedOrigins: ['https://solidify.studio'], tutorDailyLimit: 3, noteDailyPageLimit: 2, createDailyLimit: 2, adminEmails: [], now: () => Date.UTC(2026, 10, 4, 10) },
  })
})

const post = (path: string, json: unknown, user: string | null = 'sam:Sam') =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer user:${user}` } : {}) }, body: JSON.stringify(json) })

const routes: [string, unknown][] = [
  ['/v1/notes/analyze', { pageText: 'A beam of span 3 m' }],
  ['/v1/notes/refine', { currentSpec: { parts: [] }, instruction: 'make the bore 30 mm' }],
  ['/v1/create-3d', { prompt: 'a bench vice' }],
]

describe('notes to 3D endpoints', () => {
  it('every model-backed route needs a signed-in user', async () => {
    for (const [path, json] of routes) expect((await post(path, json, null)).status, path).toBe(401)
  })

  it('page analysis has a daily allowance', async () => {
    expect((await post(routes[0][0], routes[0][1])).status).toBe(200)
    expect((await post(routes[0][0], routes[0][1])).status).toBe(200)
    const third = await post(routes[0][0], routes[0][1])
    expect(third.status).toBe(429)
  })

  it('building and refining share one daily allowance', async () => {
    expect((await post(routes[2][0], routes[2][1])).status).toBe(200)
    expect((await post(routes[1][0], routes[1][1])).status).toBe(200)
    expect((await post(routes[2][0], routes[2][1])).status).toBe(429)
  })

  it('allowances are per user', async () => {
    await post(routes[2][0], routes[2][1])
    await post(routes[2][0], routes[2][1])
    expect((await post(routes[2][0], routes[2][1], 'kim:Kim')).status).toBe(200)
  })

  it('an incomplete model reply is a clear 502, not a crash', async () => {
    vision.createOrEdit3D = async () => {
      throw new ModelReplyError('cut off')
    }
    const res = await post(routes[2][0], routes[2][1])
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: string }).error).toMatch(/incomplete/)
  })

  it('analysis returns figures with a confidence', async () => {
    const res = await post(routes[0][0], routes[0][1])
    const out = (await res.json()) as { figures: { confidence: number }[]; remainingPages: number }
    expect(out.figures[0].confidence).toBeGreaterThan(0)
    expect(out.remainingPages).toBe(1)
  })
})

describe('model replies', () => {
  it('reads JSON, with or without a code fence', () => {
    expect(parseModelJson<{ a: number }>('{"a":1}').a).toBe(1)
    expect(parseModelJson<{ a: number }>('```json\n{"a":2}\n```').a).toBe(2)
  })
  it('a cut-off reply is a ModelReplyError', () => {
    expect(() => parseModelJson('{"figures":[{"id":')).toThrow(ModelReplyError)
    expect(() => parseModelJson(undefined)).toThrow(ModelReplyError)
  })
  it('the prompt catalogue names real-looking scene ids', () => {
    for (const c of NOTE_CATALOG) expect(c.sceneId).toMatch(/^[a-z-]+$/)
  })
})
