import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { FakeVerifier } from '../src/auth.js'
import { MemoryDb } from '../src/db.js'
import { FakeNoteVision, type Create3dRequest } from '../src/note3d.js'
import { isBusy } from '../src/retry.js'
import { FakeTutor } from '../src/tutor.js'

/** the model service saying it is overloaded, as @google/genai reports it */
const busy = () => Object.assign(new Error('{"error":{"code":429,"message":"Resource exhausted. Please try again later.","status":"RESOURCE_EXHAUSTED"}}'), { status: 429 })

/** turns the first `n` calls away as busy, then answers */
class BusyThenFine extends FakeNoteVision {
  calls = 0
  constructor(private n: number) {
    super()
  }
  async createOrEdit3D(req: Create3dRequest) {
    if (this.calls++ < this.n) throw busy()
    return super.createOrEdit3D(req)
  }
  async *streamCreate3D(req: Create3dRequest, signal?: AbortSignal, onUsage?: (u: { input: number; output: number }) => void) {
    if (this.calls++ < this.n) throw busy()
    yield* super.streamCreate3D(req, signal, onUsage)
  }
}

const TOKEN = 'nightly-token-0123456789abcdef'
const appWith = (vision: FakeNoteVision) =>
  createApp({ db: new MemoryDb(), verifier: new FakeVerifier(), tutor: new FakeTutor(), noteVision: vision, config: { allowedOrigins: [], tutorDailyLimit: 3, createDailyLimit: 5, adminEmails: [], evalToken: TOKEN, retryWaits: [0, 0, 0] } })
const post = (app: ReturnType<typeof createApp>, path: string, body: unknown, headers: Record<string, string>) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

describe('when the model is busy', () => {
  it('recognises a rate limit or overload, and nothing else', () => {
    expect(isBusy(busy())).toBe(true)
    expect(isBusy(new Error('503 Service Unavailable'))).toBe(true)
    expect(isBusy(new Error('Invalid JSON'))).toBe(false)
  })

  it('waits and tries again, so a short spell of load does not fail the build', async () => {
    const vision = new BusyThenFine(2)
    const res = await post(appWith(vision), '/v1/evals/build', { prompt: 'a nut' }, { 'x-eval-token': TOKEN })
    expect(res.status).toBe(200)
    expect(vision.calls).toBe(3)
  })

  it('gives up after three retries with a message that says why', async () => {
    const res = await post(appWith(new BusyThenFine(99)), '/v1/evals/build', { prompt: 'a nut' }, { 'x-eval-token': TOKEN })
    expect(res.status).toBe(503)
    expect(((await res.json()) as { error: string }).error).toMatch(/busy/)
  })

  it('retries a streamed build that was turned away before its first word', async () => {
    const res = await post(appWith(new BusyThenFine(1)), '/v1/create-3d/stream', { prompt: 'a nut' }, { Authorization: 'Bearer user:sam:Sam' })
    const body = await res.text()
    expect(body).toContain('event: done')
    expect(body).not.toContain('event: error')
  })
})
