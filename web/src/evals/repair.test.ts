import { describe, expect, it } from 'vitest'
import { repairRequest, seriousFaults } from './faults'
import { buildWithRepair, type BuiltReply } from './repair'

const Z = [Math.PI / 2, 0, 0]
const base = { id: 'base', name: 'Base plate', role: 'housing', position: [0, -0.1, 0], shapes: [{ kind: 'box', sx: 0.4, sy: 0.02, sz: 0.2 }] }
const shaft = { id: 'shaft', name: 'Shaft', role: 'moving', position: [0, 0, 0], rotation: Z, shapes: [{ kind: 'cylinder', r: 0.012, h: 0.18 }], motion: { kind: 'rotate', axis: 'y', speed: 2 } }
const post = { kind: 'box', position: [0, 0.05, 0.08], sx: 0.03, sy: 0.1, sz: 0.02 }
const model = (held: boolean) => ({
  explanation: 'A shaft on a base.',
  ms: 1000,
  usage: { input: 100, output: 50 },
  spec: { title: 'Shaft on a base', parameters: [{ id: 'd', label: 'Diameter', value: 24, min: 10, max: 40, step: 1, unit: 'mm' }], calculations: [{ id: 'r', label: 'Radius', formula: 'd / 2', unit: 'mm' }], annotations: [], parts: [{ ...base, shapes: held ? [...base.shapes, post] : base.shapes }, shaft] },
})

describe('building with repair', () => {
  it('sends a build that fails a serious check back with the fault named, and keeps the repaired one', async () => {
    const asked: string[] = []
    const build = async (req: { prompt: string; currentSpec?: Record<string, unknown> }): Promise<BuiltReply> => {
      asked.push(req.prompt)
      return model(!!req.currentSpec)
    }
    const out = await buildWithRepair(build, 'A shaft on a base plate')
    expect(out.repairs).toBe(1)
    expect(seriousFaults(out.checks)).toEqual([])
    expect(asked).toHaveLength(2)
    expect(asked[1]).toMatch(/every part held: Shaft is not held by anything/)
    // both builds are counted
    expect(out.tokensIn).toBe(200)
  })
  it('costs one build when the first passes', async () => {
    let calls = 0
    const out = await buildWithRepair(async () => (calls++, model(true)), 'A shaft on a base plate')
    expect(calls).toBe(1)
    expect(out.repairs).toBe(0)
  })
  it('stops after two repairs and keeps the best attempt', async () => {
    let calls = 0
    const out = await buildWithRepair(async () => (calls++, model(false)), 'A shaft on a base plate')
    expect(calls).toBe(3)
    expect(out.repairs).toBe(2)
    expect(seriousFaults(out.checks).map((x) => x.name)).toContain('every part held')
  })
  it('says how to fix each kind of fault', () => {
    const text = repairRequest([{ name: 'every part held', ok: false, detail: 'Gear is not held by anything' }, { name: 'labels clear', ok: false }])
    expect(text).toMatch(/Gear is not held by anything/)
    expect(text).not.toMatch(/labels clear/)
    expect(text).toMatch(/pedestal/)
  })
})
