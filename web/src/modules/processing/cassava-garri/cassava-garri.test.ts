import { describe, expect, it } from 'vitest'
import { AFNOR_STANDARDS, DEFAULTS, calcGarriMassBalance } from './model'

describe('Cassava-Garri Mass Balance & Processing Line — GSTD / Codex STAN 151-1989', () => {
  it('conserves dry matter solids across the frying/garification stage', () => {
    const mb = calcGarriMassBalance(DEFAULTS)
    // Dry matter in sifted grits must equal dry matter in fried garri
    expect(mb.friedGarri.solids).toBeCloseTo(mb.siftedGrits.solids, 4)
    // Water evaporated as steam must equal mass loss across frying
    expect(mb.steamEvaporated).toBeCloseTo(mb.siftedGrits.mass - mb.friedGarri.mass, 4)
  })

  it('correctly calculates 1000 kg fresh root baseline mass flows and yield', () => {
    const mb = calcGarriMassBalance(DEFAULTS)
    // 1000 kg fresh roots @ 22% peel loss -> 220 kg peels, 780 kg peeled roots
    expect(mb.rootsIn.mass).toBe(1000)
    expect(mb.peelsOut.mass).toBe(220)
    expect(mb.peeledRoots.mass).toBe(780)

    // Extraction yield should be in the realistic 20-26% range
    expect(mb.extractionYieldPct).toBeGreaterThanOrEqual(20.0)
    expect(mb.extractionYieldPct).toBeLessThanOrEqual(26.0)

    // Bagging 50 kg sacks
    expect(mb.fullBags).toBeGreaterThanOrEqual(4)
  })

  it('accounts for dewatering press liquor removal and mass conservation', () => {
    const mb = calcGarriMassBalance(DEFAULTS)
    // Wet mash mass equals press cake mass + liquor expelled
    expect(mb.wetMash.mass).toBeCloseTo(mb.pressCake.mass + mb.liquorExpelled.mass, 4)
    // Dewatered press cake moisture matches specified parameter (47%)
    expect(mb.pressCake.moisture).toBeCloseTo(47.0, 1)
  })

  it('verifies Codex STAN 151-1989 standard compliance for standard commercial garri', () => {
    const mb = calcGarriMassBalance(DEFAULTS)
    // Moisture must be <= 12.0 %
    expect(mb.standards.moistureVal).toBeLessThanOrEqual(12.0)
    expect(mb.standards.moisturePass).toBe(true)

    // Acidity must be within 0.6 % to 1.0 % as lactic acid
    expect(mb.standards.acidityVal).toBeGreaterThanOrEqual(0.6)
    expect(mb.standards.acidityVal).toBeLessThanOrEqual(1.0)
    expect(mb.standards.acidityPass).toBe(true)

    // Crude fibre <= 2.0 % and ash <= 2.75 %
    expect(mb.standards.fibrePass).toBe(true)
    expect(mb.standards.ashPass).toBe(true)

    // Cyanide ≤ 2 mg/kg (Codex STAN 193 for gari)
    expect(mb.standards.cyanideVal).toBeLessThanOrEqual(2)
    expect(mb.standards.cyanidePass).toBe(true)

    expect(mb.standards.allPass).toBe(true)
  })

  it('fails standards compliance when finished moisture exceeds the 12.0% statutory maximum', () => {
    const wetBatch = calcGarriMassBalance({ ...DEFAULTS, targetMoisture: 14.5 })
    expect(wetBatch.standards.moistureVal).toBeGreaterThan(12.0)
    expect(wetBatch.standards.moisturePass).toBe(false)
    expect(wetBatch.standards.allPass).toBe(false)
  })

  it('calculates fermentation acidity development across different durations', () => {
    const shortFerm = calcGarriMassBalance({ ...DEFAULTS, fermentDays: 0.5 })
    expect(shortFerm.standards.acidityVal).toBeLessThan(0.6) // Under-fermented, insufficient sourness
    expect(shortFerm.standards.acidityPass).toBe(false)

    const sourIjebu = calcGarriMassBalance({ ...DEFAULTS, fermentDays: 4.0 })
    expect(sourIjebu.standards.acidityVal).toBeGreaterThan(0.9) // Sour garri within standard 0.6-1.0%
    expect(sourIjebu.standards.acidityPass).toBe(true)
  })

  it('computes thermal energy and specific heat duty for garification', () => {
    const mb = calcGarriMassBalance(DEFAULTS)
    // Total heat is sensible heating of grits + latent heat of vaporising water
    expect(mb.totalHeatKj).toBeCloseTo(mb.sensibleHeatKj + mb.latentHeatKj, 1)
    expect(mb.sensibleHeatKj).toBeGreaterThan(0)
    expect(mb.latentHeatKj).toBeGreaterThan(0)
    // Specific thermodynamic energy should be ~1500 - 2500 kJ/kg finished garri
    expect(mb.specificEnergyKjKg).toBeGreaterThan(1500)
    expect(mb.specificEnergyKjKg).toBeLessThan(2500)
  })

  it('contains valid AFNOR square-mesh sieves specs for all 4 standard grades', () => {
    expect(AFNOR_STANDARDS['extra-fine'].pass100mm).toBe(0.5)
    expect(AFNOR_STANDARDS['fine'].pass100mm).toBe(1.0)
    expect(AFNOR_STANDARDS['medium'].pass100mm).toBe(1.25)
    expect(AFNOR_STANDARDS['coarse'].pass100mm).toBe(2.0)
  })
})
