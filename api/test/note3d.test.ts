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

describe('lab model matches', () => {
  it('keeps only real lab models', async () => {
    const { toLabMatch } = await import('../src/note3d.js')
    expect(toLabMatch('engine/four-stroke-diesel')).toEqual({ moduleId: 'engine', sceneId: 'four-stroke-diesel' })
    expect(toLabMatch('engine/made-up')).toBeUndefined()
    expect(toLabMatch(42)).toBeUndefined()
  })
})

describe('streamed builds', () => {
  const events = async (res: Response) =>
    (await res.text())
      .split('\n\n')
      .filter(Boolean)
      .map((block) => ({ event: /event: (\w+)/.exec(block)?.[1], data: JSON.parse(/data: (.*)/.exec(block)?.[1] ?? '{}') }))

  it('needs sign-in and spends the build allowance', async () => {
    expect((await post('/v1/create-3d/stream', { prompt: 'a shaft' }, null)).status).toBe(401)
    expect((await post('/v1/create-3d/stream', { prompt: 'a shaft' })).status).toBe(200)
    expect((await post('/v1/create-3d/stream', { prompt: 'a shaft' })).status).toBe(200)
    expect((await post('/v1/create-3d/stream', { prompt: 'a shaft' })).status).toBe(429)
  })

  it('streams the JSON as it is written, then the finished model', async () => {
    const evs = await events(await post('/v1/create-3d/stream', { prompt: 'a shaft with a gear' }))
    expect(evs[0]).toEqual({ event: 'meta', data: { remaining: 1 } })
    const deltas = evs.filter((e) => e.event === 'delta')
    expect(deltas.length).toBeGreaterThan(3)
    const done = evs.at(-1)!
    expect(done.event).toBe('done')
    expect(JSON.parse(deltas.map((d) => d.data.text).join('')).spec.parts).toHaveLength(2)
    expect(done.data.spec.parts.map((p: { id: string }) => p.id)).toEqual(['shaft', 'gear'])
    expect(done.data.isNewMachine).toBe(true)
  })

  it('answers a question about the current model without changing it', async () => {
    const currentSpec = { title: 'Shaft', parts: [{ id: 'shaft' }] }
    const evs = await events(await post('/v1/create-3d/stream', { prompt: 'why is the gear there?', currentSpec, history: [{ prompt: 'a shaft', response: 'Built a shaft' }] }))
    const done = evs.at(-1)!
    expect(done.data.isQuestion).toBe(true)
    expect(done.data.spec).toEqual(currentSpec)
    expect(done.data.explanation).toMatch(/why is the gear there/)
  })

  it('passes a written answer with nothing to build (a transportation problem) straight through, with no model', async () => {
    const answer = 'Given three plants and four markets.\n\n1. Balance supply and demand: $$\\sum s_i = \\sum d_j = 120$$\n\n**Minimum cost: 1 330**'
    vision.streamCreate3D = async function* () {
      yield JSON.stringify({ answerOnly: true, explanation: answer })
    }
    const done = (await events(await post('/v1/create-3d/stream', { prompt: 'Solve this transportation problem by the least-cost method' }))).at(-1)!
    expect(done.event).toBe('done')
    expect(done.data.answerOnly).toBe(true)
    expect(done.data.isQuestion).toBe(true)
    expect(done.data.explanation).toBe(answer)
    expect(done.data.spec).toEqual({})
  })

  it('reports an incomplete answer as an error event', async () => {
    vision.streamCreate3D = async function* () {
      yield '{"spec": {"parts": ['
    }
    const evs = await events(await post('/v1/create-3d/stream', { prompt: 'a shaft' }))
    expect(evs.at(-1)).toEqual({ event: 'error', data: { error: 'The model gave an incomplete answer. Please try again.' } })
  })
})
