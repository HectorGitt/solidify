import { describe, expect, it } from 'vitest'
import {
  CACL2_BELL,
  LIQUID_BALLAST_CHART,
  PSI_PER_BAR,
  RECOMMENDED_PRESSURE_BAR,
  SLIP_TABLE,
  ballastLb,
  fillAtValveClock,
  frontWeightFraction,
  huntingSprocketRadius,
  levelForFill,
  liquidBallast,
  liquidHeadPsiPerFt,
  rearWeightRange,
  slipVerdict,
  toothEngaged,
  weightPerHp,
  cavityVolumeBelow,
  cavityVolume,
  CONVENTIONAL_ASPECT,
  RECOMMENDED_SAG,
  circumference,
  decodeTyreSize,
  rollingRadiusFromStatic,
  sagFromSlack,
  slackFromSag,
  slipFromRevs,
  strandTension,
  tensionState,
  trackGroundPressure,
  tyreContactArea,
} from './tyres'

describe('tyre size codes — AEE510 Tires and Tracks p5 (Fig 7)', () => {
  it('"24.5-32" = 24.5 in section width on a 32 in rim, bias ply', () => {
    const t = decodeTyreSize('24.5-32')!
    expect(t.widthIn).toBeCloseTo(24.5, 6)
    expect(t.rimIn).toBe(32)
    expect(t.construction).toBe('bias')
    expect(t.aspectAssumed).toBe(true)
    expect(t.aspect).toBe(CONVENTIONAL_ASPECT)
  })
  it('dual sizing "12.4/11-28" gives the new (12.4 in) and old (11 in) widths', () => {
    const t = decodeTyreSize('12.4/11-28')!
    expect(t.widthIn).toBeCloseTo(12.4, 6)
    expect(t.oldWidthIn).toBe(11)
    expect(t.rimIn).toBe(28)
  })
  it('"20.8R42" (L27 duals example) is a radial on a 42 in rim', () => {
    const t = decodeTyreSize('20.8R42')!
    expect(t.construction).toBe('radial')
    expect(t.rimMm).toBeCloseTo(1066.8, 3)
  })
  it('metric "710/70R38" (L27 p32): 710 mm wide, h = 497 mm, d = 965.2 + 2·497 = 1959.2 mm', () => {
    const t = decodeTyreSize('710/70R38')!
    expect(t.system).toBe('metric')
    expect(t.widthMm).toBe(710)
    expect(t.aspectAssumed).toBe(false)
    expect(t.sectionHeightMm).toBeCloseTo(497, 6)
    expect(t.overallDiaMm).toBeCloseTo(1959.2, 6)
  })
  it('accepts lower case and spaces; rejects nonsense', () => {
    expect(decodeTyreSize(' 520/70 r38 ')?.widthMm).toBe(520)
    expect(decodeTyreSize('hello')).toBeNull()
    expect(decodeTyreSize('16.9')).toBeNull()
  })
})

describe('rolling and contact', () => {
  it('rolling radius ≈ 1.06 × static loaded radius (L27 p6)', () => {
    expect(rollingRadiusFromStatic(0.8)).toBeCloseTo(0.848, 6)
  })
  it('circumference π·d', () => {
    expect(circumference(1.9592)).toBeCloseTo(6.155, 3)
  })
  it('ground pressure ≈ inflation pressure (L27 p39): 20 kN at 100 kPa needs 0.2 m²', () => {
    expect(tyreContactArea(20e3, 100e3)).toBeCloseTo(0.2, 6)
  })
  it('chalk-mark slip (TT p9–10): 9 unloaded revs for 10 loaded → 10 %, 8½ → 15 %', () => {
    expect(slipFromRevs(9, 10)).toBeCloseTo(0.1, 6)
    expect(slipFromRevs(8.5, 10)).toBeCloseTo(0.15, 6)
    expect(slipFromRevs(10, 10)).toBe(0)
  })
})

describe('tracks (standard statics; sag guide from TT p30–31)', () => {
  it('ground pressure p = W/(2bL): 10 t on 0.5 m shoes, 2.4 m on the ground → 40.9 kPa', () => {
    const r = trackGroundPressure(10_000 * 9.81, 0.5, 2.4)
    expect(r.area).toBeCloseTo(2.4, 6)
    expect(r.pressurePa / 1000).toBeCloseTo(40.9, 1)
  })
  it('sag and slack are inverse (parabolic strand)', () => {
    const s = 1.2
    expect(sagFromSlack(s, slackFromSag(s, 0.025))).toBeCloseTo(0.025, 9)
    expect(sagFromSlack(s, 0)).toBe(0)
  })
  it('tension T = w·s²/8δ falls as the sag grows; straight strand is infinitely tight', () => {
    expect(strandTension(800, 1.2, 0.025)).toBeCloseTo((800 * 1.44) / 0.2, 6)
    expect(strandTension(800, 1.2, 0.05)).toBeLessThan(strandTension(800, 1.2, 0.025))
    expect(strandTension(800, 1.2, 0)).toBe(Infinity)
  })
  it('about 1 in of sag is correct (TT Fig 11–12)', () => {
    expect(RECOMMENDED_SAG).toBeCloseTo(0.0254, 6)
    expect(tensionState(0.025)).toBe('correct')
    expect(tensionState(0.005)).toBe('too tight')
    expect(tensionState(0.06)).toBe('too loose')
  })
})

describe('inflation (Bell TTS p14; TT p7)', () => {
  it('guide pressures: front 1.7/2.1/2.7 bar, rear 0.8/1.0 bar ≈ 25/30/40 and 12/15 psi', () => {
    expect(RECOMMENDED_PRESSURE_BAR.front.field * PSI_PER_BAR).toBeCloseTo(25, 0)
    expect(RECOMMENDED_PRESSURE_BAR.front.loader * PSI_PER_BAR).toBeCloseTo(39, 0)
    expect(RECOMMENDED_PRESSURE_BAR.rear.field * PSI_PER_BAR).toBeCloseTo(11.6, 1)
    expect(RECOMMENDED_PRESSURE_BAR.rear.road * PSI_PER_BAR).toBeCloseTo(14.5, 1)
  })
  it('liquid head correction is "about ½ lb per foot" (water 0.43, CaCl₂ solution 0.61 psi/ft)', () => {
    expect(liquidHeadPsiPerFt(1)).toBeCloseTo(0.434, 2)
    expect(liquidHeadPsiPerFt(11.84 / 8.34)).toBeCloseTo(0.615, 2)
  })
})

describe('chalk-mark slip test — TT p9–10', () => {
  it('10 loaded revs vs 10/9½/9/8½/8/7½/7 no-load → 0/5/10/15/20/25/30 % slip', () => {
    for (const [r1, pct] of SLIP_TABLE) expect(slipFromRevs(r1, 10) * 100).toBeCloseTo(pct, 9)
  })
  it('9 and 8½ revs are proper ballast, 9½ remove, 8 add', () => {
    expect(slipVerdict(slipFromRevs(9, 10))).toBe('proper ballast')
    expect(slipVerdict(slipFromRevs(8.5, 10))).toBe('proper ballast')
    expect(slipVerdict(slipFromRevs(9.5, 10))).toBe('remove ballast')
    expect(slipVerdict(slipFromRevs(8, 10))).toBe('add ballast')
  })
})

describe('tractor weight guide — TT p11 worked example', () => {
  const g = weightPerHp('semi-integral', 'firm', 5.3)
  it('semi-integral, firm soil, 5.3 mph → 84–100 lb per PTO hp (Fig 17, read ±3)', () => {
    expect(Math.abs(g.lo - 84)).toBeLessThan(3)
    expect(Math.abs(g.hi - 100)).toBeLessThan(3)
  })
  it('120 hp × 84 = 10,080 ≈ "10,100" lb; 120 × 100 = 12,000 lb', () => {
    const r = rearWeightRange(120, { lo: 84, hi: 100 })
    expect(r.lo).toBe(10_080)
    expect(r.hi).toBe(12_000)
  })
  it('¾ load (90 hp): 90 × 84 = 7,560 lb (notes print 7,550 — arithmetic slip) to 9,000 lb', () => {
    const r = rearWeightRange(120, { lo: 84, hi: 100 }, 0.75)
    expect(r.lo).toBe(7_560)
    expect(r.hi).toBe(9_000)
  })
  it('more weight on tilled soil, for towed implements and at low speed', () => {
    expect(weightPerHp('semi-integral', 'tilled', 5).lo).toBeGreaterThan(weightPerHp('semi-integral', 'firm', 5).lo)
    expect(weightPerHp('towed', 'firm', 5).lo).toBeGreaterThan(weightPerHp('integral', 'firm', 5).lo)
    expect(weightPerHp('integral', 'firm', 3).lo).toBeGreaterThan(weightPerHp('integral', 'firm', 6).lo)
  })
  it('front ballast = ½ rear (integral), ⅓ rear (towed) — TT p10', () => {
    expect(frontWeightFraction('integral')).toBe(0.5)
    expect(frontWeightFraction('towed')).toBeCloseTo(1 / 3, 12)
  })
})

describe('liquid ballast — TT p12–13, Bell TTS p15', () => {
  it('chart: 188 gal = 2226 lb (18.4-38) and 292 gal = 3458 lb (24.5-32) at 11.84 lb/gal', () => {
    expect(ballastLb(188)).toBeCloseTo(2226, -1)
    expect(ballastLb(292)).toBeCloseTo(3458, -1)
    for (const row of LIQUID_BALLAST_CHART) expect(Math.abs(ballastLb(row.gal) - row.lb) / row.lb).toBeLessThan(0.005)
  })
  it('cavity model reproduces the chart volumes (read as a pair of tyres) to ±10 %', () => {
    for (const code of ['18.4-38', '24.5-32', '13.6-38', '16.9-34']) {
      const row = LIQUID_BALLAST_CHART.find((r) => r.size === code)!
      const pair = 2 * liquidBallast(decodeTyreSize(code)!, 0.75).gal
      expect(Math.abs(pair - row.gal) / row.gal, code).toBeLessThan(0.1)
    }
  })
  it('13.6/12-36 at 75 % with 1 kg CaCl₂ per 5 L ≈ 190 kg (±10 %)', () => {
    const m = liquidBallast(decodeTyreSize('13.6/12-36')!, 0.75, CACL2_BELL).massKg
    expect(Math.abs(m - 190) / 190).toBeLessThan(0.1)
  })
  it('draining a full tyre to the valve at 12 o’clock leaves ≈ 75 % ("75 percent or valve level")', () => {
    expect(fillAtValveClock(decodeTyreSize('18.4-38')!, 12)).toBeCloseTo(0.75, 1)
    expect(fillAtValveClock(decodeTyreSize('18.4-38')!, 10)).toBeLessThan(0.7)
  })
  it('levelForFill inverts the fill fraction', () => {
    const s = decodeTyreSize('18.4-38')!
    const y = levelForFill(s, 0.6)
    expect(cavityVolumeBelow(s, y) / cavityVolume(s)).toBeCloseTo(0.6, 2)
  })
})

describe('hunting-tooth sprocket — TT p50', () => {
  it('odd tooth count: each tooth carries a bushing only on alternate revolutions', () => {
    const z = 25
    for (let i = 0; i < z; i++) {
      expect(toothEngaged(z, i, 0)).not.toBe(toothEngaged(z, i, 1))
      expect(toothEngaged(z, i, 0)).toBe(toothEngaged(z, i, 2))
    }
  })
  it('pitch radius with bushings on every other tooth', () => {
    expect(huntingSprocketRadius(25, 0.2)).toBeCloseTo(0.2 / (2 * Math.sin((2 * Math.PI) / 25)), 12)
  })
})
