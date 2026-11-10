import { describe, expect, it } from 'vitest'
import { sanitizeGeneratedSpec } from './sanitize'
import type { NoteSceneSpec } from './schema'
import { SLFY_VERSION, fromSlfy, toSlfy, validateSlfy } from './slfyFormat'

const spec: NoteSceneSpec = {
  id: 'shaft-rev123',
  title: 'Stepped shaft',
  summary: 'A shaft with a shoulder.',
  units: 'mm',
  extent: 0.4,
  floorY: -0.1,
  camera: { position: [0.4, 0.3, 0.5], target: [0, 0, 0] },
  recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0 },
  parameters: [{ id: 'd', label: 'Diameter', symbol: 'd', value: 40, min: 20, max: 80, step: 1, unit: 'mm' }],
  parts: [{ id: 'shaft', name: 'Shaft', material: 'steel', shapes: [{ kind: 'cylinder', r: 'd / 2000', h: 0.3 }] }],
  calculations: [{ id: 'A', label: 'Area', symbol: 'A', formula: 'pi * d^2 / 4', unit: 'mm²' }],
}

describe('the .slfy file', () => {
  it('splits what the model is from how it is first shown, and passes its own schema', () => {
    const file = toSlfy(spec, { generator: 'test' })
    expect(file.format).toBe('slfy')
    expect(file.version).toBe(SLFY_VERSION)
    expect(file.model.id).toBe('shaft')
    expect(file.view?.cut).toEqual(spec.recommendedCut)
    expect('camera' in file.model).toBe(false)
    expect(validateSlfy(JSON.parse(JSON.stringify(file)))).toEqual({ ok: true })
  })

  it('reads back to the same model', () => {
    const back = fromSlfy(JSON.parse(JSON.stringify(toSlfy(spec))))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.spec.recommendedCut).toEqual(spec.recommendedCut)
    expect(back.spec.camera).toEqual(spec.camera)
    expect(back.spec.parts).toEqual(spec.parts)
    expect(back.spec.calculations).toEqual(spec.calculations)
    expect(back.warnings).toEqual([])
    const clean = sanitizeGeneratedSpec(back.spec, 'x')
    expect(clean?.title).toBe('Stepped shaft')
    expect(clean?.parts).toHaveLength(1)
  })

  it('opens older downloads: a bare spec and an admin export', () => {
    const bare = fromSlfy({ ...spec })
    const exported = fromSlfy({ id: 'x', title: 'Export', spec: { ...spec } })
    expect(bare.ok && exported.ok).toBe(true)
    if (bare.ok) expect(bare.warnings[0]).toMatch(/older/)
  })

  it('says plainly what is wrong with a bad file, and never throws', () => {
    for (const bad of [null, 3, 'text', [], {}, { format: 'slfy', version: '0.1' }, { format: 'slfy', version: '0.1', model: { parts: [] } }]) {
      const r = fromSlfy(bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(10)
    }
  })

  it('warns about a newer major version and about extensions it skips', () => {
    const file = { ...toSlfy(spec), version: '2.0', extensions: { 'acme.fea': {} } }
    const r = fromSlfy(file)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings.join(' ')).toMatch(/version 2\.0.*acme\.fea|acme\.fea[\s\S]*|version 2\.0/)
    if (r.ok) expect(r.warnings).toHaveLength(2)
  })

  it('lists schema problems for the validator', () => {
    const r = validateSlfy({ format: 'slfy', version: 'one', model: { id: 'a' } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.join('\n')).toMatch(/version/)
  })
})
