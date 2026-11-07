import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeEmbedder } from '../src/embed.js'
import { FakeNoteVision, createParts, type Create3dRequest } from '../src/note3d.js'
import { FakeTutor } from '../src/tutor.js'

/** remembers what each build was asked, reference included */
class Spy extends FakeNoteVision {
  seen: Create3dRequest[] = []
  async createOrEdit3D(req: Create3dRequest) {
    this.seen.push(req)
    return super.createOrEdit3D(req)
  }
}

const boss = { Authorization: 'Bearer user:boss:Boss' }
const setup = () => {
  const vision = new Spy()
  const app = createApp({
    db: new MemoryDb(),
    verifier: new FakeVerifier(),
    tutor: new FakeTutor(),
    noteVision: vision,
    embedder: new FakeEmbedder(),
    // the word-count stand-in scores lower than real embeddings
    config: { allowedOrigins: [], tutorDailyLimit: 3, createDailyLimit: 5, adminEmails: ['boss@example.test'], matchMin: 0.3, referenceMin: 0.5 },
  })
  const req = (method: string, path: string, json?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: json === undefined ? undefined : JSON.stringify(json) })
  const publish = (title: string, topic: string, prompt: string) => req('POST', '/v1/library', { title, topic, prompt, spec: { title, parts: [{ id: 'a' }] }, score: 100 }, boss)
  return { vision, req, publish }
}

describe('matching requests to the library', () => {
  it('offers the closest checked models to anyone, without their spec or vectors', async () => {
    const { req, publish } = setup()
    await publish('Worm gear reducer', 'Gears and drives', 'A worm and worm wheel reducer, 30 : 1, on a steel shaft')
    await publish('Propped cantilever', 'Strength of materials', 'A propped cantilever beam with a uniformly distributed load')
    await publish('Centrifugal pump', 'Fluids', 'A single-stage centrifugal pump with a volute casing')
    const res = await req('GET', `/v1/library/match?q=${encodeURIComponent('worm wheel reducer gearbox')}`)
    expect(res.status).toBe(200)
    const { matches } = (await res.json()) as { matches: Record<string, unknown>[] }
    expect(matches[0]).toMatchObject({ title: 'Worm gear reducer' })
    expect(matches[0].score).toBeGreaterThan(0.3)
    expect(matches[0].spec).toBeUndefined()
    expect(matches[0].embedding).toBeUndefined()
    expect(matches.map((m) => m.title)).not.toContain('Centrifugal pump')
    // too short to search
    expect(((await (await req('GET', '/v1/library/match?q=pump')).json()) as { matches: unknown[] }).matches).toEqual([])
  })

  it('starts a new build from the closest checked model, and only when it is close', async () => {
    const { vision, req, publish } = setup()
    await publish('Worm gear reducer', 'Gears and drives', 'A worm and worm wheel reducer, 30 : 1, on a steel shaft')
    const sam = { Authorization: 'Bearer user:sam:Sam' }
    await req('POST', '/v1/create-3d', { prompt: 'A worm and worm wheel reducer, 40 : 1, on a steel shaft' }, sam)
    expect(vision.seen.at(-1)!.reference?.title).toBe('Worm gear reducer')
    await req('POST', '/v1/create-3d', { prompt: 'A three-blade wind turbine on a tower' }, sam)
    expect(vision.seen.at(-1)!.reference).toBeUndefined()
    // a change to a model never gets one, and a client cannot send one
    await req('POST', '/v1/create-3d', { prompt: 'make the worm longer', currentSpec: { title: 'x', parts: [] } }, sam)
    expect(vision.seen.at(-1)!.reference).toBeUndefined()
    await req('POST', '/v1/create-3d', { prompt: 'A wind turbine', reference: { title: 'Injected', spec: {} } }, sam)
    expect(vision.seen.at(-1)!.reference).toBeUndefined()
  })

  it('puts the checked model in what Gemini is sent', () => {
    const parts = createParts({ prompt: 'A 40 : 1 worm reducer', reference: { title: 'Worm gear reducer', spec: { title: 'Worm gear reducer', parts: [{ id: 'worm' }] } } })
    const text = (parts.at(-1) as { text: string }).text
    expect(text).toContain('A 40 : 1 worm reducer')
    expect(text).toContain('"Worm gear reducer"')
    expect(text).toContain('"id":"worm"')
  })
})
