import { describe, expect, it } from 'vitest'
import { CVT, TRACTOR, efficiencyAt, groundSpeed, leverForRatio, operate, outputRatio, planetOmega, powerFlow, ringRatio, speeds, swash } from './cvt'

const we = (2100 * 2 * Math.PI) / 60

describe('power-split CVT kinematics', () => {
  it('planetary teeth assemble with four planets', () => {
    expect(CVT.zr).toBe(CVT.zs + 2 * CVT.zp)
    expect((CVT.zs + CVT.zr) % 4).toBe(0)
  })

  it('active standstill: pump at zero displacement holds the output still with the engine running', () => {
    const s = speeds(0, we)
    expect(s.out).toBeCloseTo(0, 9)
    // all the carrier motion goes into the ring: ω_r = (z_s+z_r)/z_r·ω_e
    expect(s.ring / we).toBeCloseTo((CVT.zs + CVT.zr) / CVT.zr, 9)
  })

  it('pure gear drive at the top: motor at zero displacement stops ring and pump', () => {
    const s = speeds(2, we)
    expect(s.out / we).toBeCloseTo((CVT.zs + CVT.zr) / CVT.zs, 9)
    expect(s.ring).toBeCloseTo(0, 9)
    expect(s.pump).toBeCloseTo(0, 9)
  })

  it('satisfies Willis and oil continuity everywhere', () => {
    for (const L of [-0.3, 0.1, 0.5, 1, 1.4, 1.9]) {
      const s = speeds(L, we)
      expect(CVT.zs * s.out + CVT.zr * s.ring).toBeCloseTo((CVT.zs + CVT.zr) * we, 6)
      expect(s.alpha * CVT.V * s.pump).toBeCloseTo(s.beta * CVT.V * s.motor, 9)
    }
  })

  it('ratio rises monotonically with the lever and the lever inverts', () => {
    let prev = -Infinity
    for (let L = CVT.leverMin; L <= CVT.leverMax; L += 0.05) {
      const { alpha, beta } = swash(L)
      const r = outputRatio(alpha, beta)
      expect(r).toBeGreaterThan(prev)
      prev = r
    }
    for (const target of [-0.8, 0.2, 1, 2.5]) {
      const L = leverForRatio(target)
      const { alpha, beta } = swash(L)
      expect(outputRatio(alpha, beta)).toBeCloseTo(target, 6)
    }
  })

  it('reverse: pump swung negative turns the output backwards', () => {
    expect(speeds(-0.2, we).out).toBeLessThan(0)
  })

  it('ring ratio consistent with output ratio', () => {
    expect(ringRatio(1, 1)).toBeCloseTo((CVT.zs + CVT.zr - CVT.zs * outputRatio(1, 1)) / CVT.zr, 12)
  })

  it('planet spin: zero relative spin when sun and carrier turn together', () => {
    expect(planetOmega(10, 10)).toBeCloseTo(10, 12)
  })
})

describe('power-split CVT torque and power', () => {
  it('loss-free balance: T_o·ω_o = T_e·ω_e', () => {
    const ideal = { ...CVT, etaHyd: 1, etaMech: 1 }
    for (const L of [0.3, 1, 1.6]) {
      const r = powerFlow(L, we, 800, ideal)
      expect(r.To * r.out).toBeCloseTo(r.Te * we, 3)
      // pump power = motor power (ideal oil branch)
      expect(r.Tpump * r.pump).toBeCloseTo(r.Tmotor * r.motor, 3)
    }
  })

  it('hydraulic share: 0 in pure gear drive, falls as the lever advances', () => {
    expect(powerFlow(2, we, 500).hydShare).toBeCloseTo(0, 9)
    const a = powerFlow(0.4, we, 500).hydShare
    const b = powerFlow(1.2, we, 500).hydShare
    expect(a).toBeGreaterThan(b)
    expect(a).toBeLessThan(1)
  })

  it('power circulates in reverse (share above 100 %)', () => {
    expect(powerFlow(-0.2, we, -500).hydShare).toBeGreaterThan(1)
  })

  it('efficiency is highest in pure gear drive and equals the gear efficiency there', () => {
    expect(efficiencyAt(2)).toBeCloseTo(CVT.etaMech, 9)
    expect(efficiencyAt(0.5)).toBeLessThan(efficiencyAt(1.5))
  })

  it('loop pressure at standstill is what the motor needs to hold the output torque', () => {
    const r = powerFlow(0, we, 900)
    expect(r.dp).toBeCloseTo((2 * Math.PI * 900) / CVT.V, 0)
  })
})

describe('CVT tractor', () => {
  it('ranges top out at 30 and 60 km/h at rated speed', () => {
    const wo = outputRatio(1, 0) * we
    expect(groundSpeed(wo, 'field')).toBeCloseTo(30, 6)
    expect(groundSpeed(wo, 'road')).toBeCloseTo(60, 6)
  })

  it('reaches the requested speed when the engine has power to spare', () => {
    const r = operate({ rpm: 1800, range: 'field', target: 10, pull: 10e3 })
    expect(r.limited).toBe(false)
    expect(r.speed).toBeCloseTo(10, 2)
  })

  it('a heavy pull is limited by engine power, not stalled', () => {
    const r = operate({ rpm: 2100, range: 'field', target: 25, pull: 60e3 })
    expect(r.limited).toBe(true)
    expect(r.speed).toBeGreaterThan(0)
    expect(r.speed).toBeLessThan(25)
    expect(r.Pin).toBeLessThanOrEqual(TRACTOR.Prated * 1.001)
  })
})
