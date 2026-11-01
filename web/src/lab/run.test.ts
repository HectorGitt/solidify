import { describe, expect, it } from 'vitest'
import { createRun, instrument, settle, slopeThroughOrigin } from './run'

describe('a test run', () => {
  it('starts clean, logs, and resets', () => {
    const r = createRun()
    r.getState().start()
    expect(r.getState().status).toBe('running')
    r.getState().log([1, 2])
    expect(r.getState().rows).toHaveLength(1)
    r.getState().start()
    expect(r.getState().rows).toHaveLength(0)
    r.getState().log([1, 2])
    r.getState().reset()
    expect(r.getState().status).toBe('idle')
    expect(r.getState().rows).toHaveLength(0)
  })
  it('can only pause while running, and resume while paused', () => {
    const r = createRun()
    r.getState().pause()
    expect(r.getState().status).toBe('idle')
    r.getState().start()
    r.getState().pause()
    expect(r.getState().status).toBe('paused')
    r.getState().resume()
    expect(r.getState().status).toBe('running')
  })
  it('a failure carries its reason', () => {
    const r = createRun()
    r.getState().start()
    r.getState().fail('yielded')
    expect(r.getState().status).toBe('failed')
    expect(r.getState().message).toBe('yielded')
  })
})

describe('instruments', () => {
  it('scatter stays in its band, and is repeatable', () => {
    for (let i = 0; i < 200; i++) {
      const v = instrument(100, 0.01, i)
      expect(Math.abs(v - 100)).toBeLessThanOrEqual(1.0000001)
      expect(v).toBe(instrument(100, 0.01, i))
    }
  })
  it('a straight-line fit gets back the true slope, despite the scatter', () => {
    const xs = Array.from({ length: 10 }, (_, i) => i + 1)
    const ys = xs.map((x, i) => instrument(3 * x, 0.01, i))
    expect(slopeThroughOrigin(xs, ys)).toBeCloseTo(3, 1)
  })
  it('a settling move starts and ends at rest', () => {
    expect(settle(0)).toBe(0)
    expect(settle(1)).toBe(1)
    expect(settle(0.5)).toBeCloseTo(0.5, 9)
  })
})
