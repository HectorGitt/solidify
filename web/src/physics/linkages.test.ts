import { describe, expect, it } from 'vitest'
import { deadCentres, genevaAccelerationRatio, genevaAngle, genevaHalfEngagement, genevaMovingFraction, genevaOutput, genevaStep, genevaVelocityRatio, oldhamCentre, quickReturnRatio, sliderAcceleration, sliderAccelerationApprox, sliderDisplacement, sliderExact, sliderVelocity, sliderVelocityApprox, stroke, yokeAcceleration, yokeDisplacement, yokeVelocity } from './linkages'

const rad = (d: number) => (d * Math.PI) / 180

describe('scotch yoke: true simple harmonic motion', () => {
  it('x = r − r cos θ; stroke 2r', () => {
    expect(yokeDisplacement(25, 0)).toBeCloseTo(0, 9)
    expect(yokeDisplacement(25, Math.PI / 2)).toBeCloseTo(25, 9)
    expect(yokeDisplacement(25, Math.PI)).toBeCloseTo(50, 9)
  })
  it('velocity is greatest at 90°, acceleration at the ends', () => {
    expect(yokeVelocity(25, 2, Math.PI / 2)).toBeCloseTo(50, 9)
    expect(yokeVelocity(25, 2, 0)).toBeCloseTo(0, 9)
    expect(yokeAcceleration(25, 2, 0)).toBeCloseTo(100, 9)
    expect(yokeAcceleration(25, 2, Math.PI / 2)).toBeCloseTo(0, 9)
  })
})

describe('slider-crank', () => {
  const m = { r: 25, l: 100, e: 0 }
  it('the offset formula reduces to the textbook one with no offset', () => {
    for (const t of [0.3, 1.2, 2.2, 3.5, 5]) expect(sliderDisplacement(m, t)).toBeCloseTo(sliderExact(25, 4, t), 9)
  })
  it('half way along the stroke is not at 90°: at 90° it has gone further than r', () => {
    // the rod’s swing: x = r(n + 1 − √(n² − 1))
    const x = sliderExact(25, 4, Math.PI / 2)
    expect(x).toBeCloseTo(25 * (5 - Math.sqrt(15)), 9)
    expect(x).toBeGreaterThan(25)
  })
  it('a longer rod comes nearer the sinusoid', () => {
    const dev = (n: number) => Math.abs(sliderExact(25, n, Math.PI / 2) - 25)
    expect(dev(8)).toBeLessThan(dev(4))
    expect(dev(4)).toBeLessThan(dev(2))
  })
  it('the exact velocity is the derivative of displacement', () => {
    const h = 1e-6
    const off = { r: 25, l: 100, e: 25 }
    for (const t of [0.5, 1.5, 2.5, 4, 5.5]) {
      const d = (sliderDisplacement(off, t + h) - sliderDisplacement(off, t - h)) / (2 * h)
      expect(sliderVelocity(off, 1, t)).toBeCloseTo(d, 4)
    }
  })
  it('the approximate velocity and acceleration stay close for n = 4', () => {
    for (const t of [0.4, 1, 1.6, 2.5, 4]) {
      expect(Math.abs(sliderVelocity(m, 1, t))).toBeCloseTo(Math.abs(sliderVelocityApprox(25, 4, 1, t)), 0)
      expect(Math.abs(sliderAcceleration(m, 1, t) - sliderAccelerationApprox(25, 4, 1, t))).toBeLessThan(1)
    }
  })
  it('no offset: stroke 2r and equal strokes out and back', () => {
    expect(stroke(m)).toBeCloseTo(50, 9)
    expect(quickReturnRatio(m)).toBeCloseTo(1, 9)
  })
  it('an offset lengthens the stroke and gives a quick return', () => {
    const off = { r: 25, l: 100, e: 25 }
    expect(stroke(off)).toBeGreaterThan(50)
    expect(quickReturnRatio(off)).toBeGreaterThan(1)
    // the displacement really is zero at the outer dead centre, and a full stroke at the inner one
    const d = deadCentres(off)
    expect(sliderDisplacement(off, d.tdc)).toBeCloseTo(0, 9)
    expect(sliderDisplacement(off, d.bdc)).toBeCloseTo(stroke(off), 9)
  })
})

describe('Geneva wheel', () => {
  it('six slots: 60° a step, and it moves for a third of each turn (as the lab rig: 0° to 60° over 120°)', () => {
    expect((genevaStep(6) * 180) / Math.PI).toBeCloseTo(60, 9)
    expect(genevaMovingFraction(6)).toBeCloseTo(1 / 3, 9)
    expect((2 * genevaHalfEngagement(6) * 180) / Math.PI).toBeCloseTo(120, 9)
  })
  it('five output steps: 72° each', () => expect((genevaStep(5) * 180) / Math.PI).toBeCloseTo(72, 9))
  it('the step ends exactly a step apart', () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const a = genevaHalfEngagement(n)
      expect(genevaOutput(n, a) - genevaOutput(n, -a)).toBeCloseTo(genevaStep(n), 9)
    }
  })
  it('it enters and leaves at zero speed: the shock is small', () => {
    for (const n of [3, 4, 6, 8]) expect(genevaVelocityRatio(n, genevaHalfEngagement(n))).toBeCloseTo(0, 9)
  })
  it('peak speed at the line of centres, λ/(1 − λ): 1 for six slots', () => {
    expect(genevaVelocityRatio(6, 0)).toBeCloseTo(1, 9)
    expect(genevaVelocityRatio(4, 0)).toBeCloseTo(Math.SQRT1_2 / (1 - Math.SQRT1_2), 9)
  })
  it('velocity and acceleration are the derivatives of the output', () => {
    const h = 1e-6
    for (const a of [-0.8, -0.3, 0.2, 0.7]) {
      expect(genevaVelocityRatio(6, a)).toBeCloseTo((genevaOutput(6, a + h) - genevaOutput(6, a - h)) / (2 * h), 5)
      expect(genevaAccelerationRatio(6, a)).toBeCloseTo((genevaVelocityRatio(6, a + h) - genevaVelocityRatio(6, a - h)) / (2 * h), 5)
    }
  })
  it('the running angle dwells between steps and never goes backwards', () => {
    let last = genevaAngle(6, 0)
    expect(last).toBeCloseTo(0, 9)
    for (let t = 0; t < 4 * Math.PI; t += 0.01) {
      const v = genevaAngle(6, t)
      expect(v).toBeGreaterThanOrEqual(last - 1e-9)
      last = v
    }
    expect(genevaAngle(6, rad(120))).toBeCloseTo(rad(60), 6)
    expect(genevaAngle(6, rad(300))).toBeCloseTo(rad(60), 6)
    expect(genevaAngle(6, rad(360))).toBeCloseTo(rad(60), 6)
  })
})

describe('Oldham coupling', () => {
  it('the disc centre runs on a circle of diameter d, through both shaft axes, twice a turn', () => {
    const d = 10
    for (let t = 0; t < Math.PI; t += 0.1) {
      const [x, y] = oldhamCentre(d, t)
      expect(Math.hypot(x - 5, y)).toBeCloseTo(5, 9)
    }
    expect(oldhamCentre(d, 0)[0]).toBeCloseTo(0, 9)
    expect(oldhamCentre(d, Math.PI / 2)[0]).toBeCloseTo(10, 9)
    expect(oldhamCentre(d, Math.PI)[0]).toBeCloseTo(0, 9)
  })
})
