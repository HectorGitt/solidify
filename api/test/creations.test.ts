import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeNoteVision } from '../src/note3d.js'
import { FakeTutor } from '../src/tutor.js'

let app: ReturnType<typeof createApp>
let t = Date.UTC(2026, 10, 6, 10)

beforeEach(() => {
  t = Date.UTC(2026, 10, 6, 10)
  app = createApp({
    db: new MemoryDb(),
    verifier: new FakeVerifier(),
    tutor: new FakeTutor(),
    noteVision: new FakeNoteVision(),
    config: { allowedOrigins: ['https://solidify.studio'], tutorDailyLimit: 3, adminEmails: [], now: () => (t += 1000) },
  })
})

const call = (method: string, path: string, json?: unknown, user: string | null = 'sam:Sam') =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer user:${user}` } : {}) },
    body: json === undefined ? undefined : JSON.stringify(json),
  })

const model = (title = 'Hex nut') => ({
  title,
  prompt: 'A hex nut',
  spec: { title, parts: [{ id: 'nut', shapes: [{ kind: 'hexNut', d: 0.1 }] }] },
  params: { d: 10 },
  history: [{ prompt: 'A hex nut', response: 'Built a hex nut.' }],
  thumbnail: 'data:image/jpeg;base64,AAAA',
})

describe('creation lab', () => {
  it('lets the web app send updates (PUT) from another origin', async () => {
    const pre = await app.request('/v1/creations/abcdef123456', { method: 'OPTIONS', headers: { Origin: 'https://solidify.studio', 'Access-Control-Request-Method': 'PUT' } })
    expect(pre.headers.get('Access-Control-Allow-Methods')).toMatch(/PUT/)
  })

  it('needs sign-in for every route', async () => {
    expect((await call('GET', '/v1/creations', undefined, null)).status).toBe(401)
    expect((await call('POST', '/v1/creations', model(), null)).status).toBe(401)
    expect((await call('PUT', '/v1/creations/abcdef123456', { title: 'x' }, null)).status).toBe(401)
    expect((await call('DELETE', '/v1/creations/abcdef123456', undefined, null)).status).toBe(401)
  })

  it('saves, lists newest first without the heavy fields, reopens, updates and deletes', async () => {
    const a = (await (await call('POST', '/v1/creations', model('First'))).json()) as { id: string }
    const b = (await (await call('POST', '/v1/creations', model('Second'))).json()) as { id: string }
    const list = (await (await call('GET', '/v1/creations')).json()) as { items: Record<string, unknown>[] }
    expect(list.items.map((i) => i.title)).toEqual(['Second', 'First'])
    expect(list.items[0]).not.toHaveProperty('spec')
    expect(list.items[0]).not.toHaveProperty('history')
    expect(list.items[0].parts).toBe(1)

    expect((await call('PUT', `/v1/creations/${a.id}`, { title: 'Renamed', params: { d: 12 } })).status).toBe(204)
    const full = (await (await call('GET', `/v1/creations/${a.id}`)).json()) as Record<string, unknown>
    expect(full.title).toBe('Renamed')
    expect(full.params).toEqual({ d: 12 })
    expect(full.spec).toEqual({ title: 'First', parts: model().spec.parts })
    const relist = (await (await call('GET', '/v1/creations')).json()) as { items: { title: string }[] }
    expect(relist.items[0].title).toBe('Renamed')

    expect((await call('DELETE', `/v1/creations/${b.id}`)).status).toBe(204)
    expect((await call('GET', `/v1/creations/${b.id}`)).status).toBe(404)
  })

  it('lists a solved question with the start of it and what it asks, and plain models without', async () => {
    const q = { ...model('Beam reactions'), spec: { title: 'Beam reactions', question: { text: 'A beam of span 6 m carries 20 kN. ' + 'x'.repeat(400), find: ['the reactions at A and B', 7] }, parts: [{ id: 'b', shapes: [{ kind: 'box', sx: 6, sy: 0.2, sz: 0.2 }] }] } }
    expect((await call('POST', '/v1/creations', q)).status).toBe(201)
    expect((await call('POST', '/v1/creations', model('Plain nut'))).status).toBe(201)
    const { items } = (await (await call('GET', '/v1/creations')).json()) as { items: { title: string; question?: { text: string; find: string[] } }[] }
    const solved = items.find((i) => i.title === 'Beam reactions')!
    expect(solved.question?.text.startsWith('A beam of span 6 m')).toBe(true)
    expect(solved.question?.text.length).toBeLessThanOrEqual(240)
    expect(solved.question?.find).toEqual(['the reactions at A and B'])
    expect(items.find((i) => i.title === 'Plain nut')!.question).toBeUndefined()
  })

  it('an update changes only what it sends', async () => {
    const a = (await (await call('POST', '/v1/creations', model())).json()) as { id: string }
    expect((await call('PUT', `/v1/creations/${a.id}`, { thumbnail: 'data:image/jpeg;base64,BBBB' })).status).toBe(204)
    const full = (await (await call('GET', `/v1/creations/${a.id}`)).json()) as Record<string, unknown>
    expect(full.params).toEqual({ d: 10 })
    expect(full.history).toEqual(model().history)
    expect(full.prompt).toBe('A hex nut')
    expect(full.thumbnail).toBe('data:image/jpeg;base64,BBBB')
  })

  it('keeps each student to their own models', async () => {
    const a = (await (await call('POST', '/v1/creations', model())).json()) as { id: string }
    expect((await call('GET', `/v1/creations/${a.id}`, undefined, 'kim:Kim')).status).toBe(404)
    expect((await call('PUT', `/v1/creations/${a.id}`, { title: 'mine' }, 'kim:Kim')).status).toBe(404)
    expect(((await (await call('GET', '/v1/creations', undefined, 'kim:Kim')).json()) as { items: unknown[] }).items).toEqual([])
  })

  it('rejects bad input and caps how many a student can keep', async () => {
    expect((await call('POST', '/v1/creations', { ...model(), thumbnail: 'javascript:alert(1)' })).status).toBe(400)
    expect((await call('POST', '/v1/creations', { ...model(), spec: { parts: [], blob: 'x'.repeat(310_000) } })).status).toBe(413)
    expect((await call('GET', '/v1/creations/..%2Fother')).status).toBe(404)
    for (let i = 0; i < 50; i++) expect((await call('POST', '/v1/creations', model(`M${i}`))).status).toBe(201)
    const over = await call('POST', '/v1/creations', model('One too many'))
    expect(over.status).toBe(409)
    expect(((await over.json()) as { error: string }).error).toMatch(/50 saved models/)
  })
})
