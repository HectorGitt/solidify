import { describe, expect, it } from 'vitest'
import { checkDesign } from './check'
import { solveDesign } from './solve'
import { parseDesign, pitchDiameter, type Design } from './spec'
import { TEMPLATES, template } from './templates'

const copy = (id: string): Design => structuredClone(template(id)!.design)
const errors = (d: Design) => checkDesign(d).filter((p) => p.level === 'error')
const rpmToRad = (rpm: number) => (rpm * 2 * Math.PI) / 60

describe('templates', () => {
  it.each(TEMPLATES.map((x) => [x.id, x] as const))('%s passes every check', (_, x) => {
    expect(checkDesign(x.design)).toEqual([])
    const s = solveDesign(x.design)
    expect(s.idle).toEqual([])
    expect(s.conflicts).toEqual([])
  })
})

describe('parseDesign', () => {
  it('rejects bad input with readable paths', () => {
    const r = parseDesign({ version: 1, name: 'x', shafts: [{ id: 'A', x: 0, y: 0, length: 100, diameter: 20 }], parts: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/^shafts\.0\.id:/)
  })
  it('rejects a non-standard chain pitch', () => {
    const d = copy('chain-drive') as unknown as { parts: { pitch?: number }[] }
    d.parts[1].pitch = 20
    expect(parseDesign(d).ok).toBe(false)
  })
  it('fills defaults', () => {
    const r = parseDesign({ version: 1, name: 'x', shafts: [{ id: 'a', x: 0, y: 0, length: 100, diameter: 20 }], parts: [] })
    expect(r.ok && r.design.links).toEqual([])
  })
})

describe('checkDesign', () => {
  it('catches a wrong centre distance', () => {
    const d = copy('gear-reducer')
    d.shafts[1].x = 152
    expect(errors(d).map((p) => p.message).join()).toMatch(/152 mm apart but these gears need 150 mm/)
  })
  it('catches a module mismatch', () => {
    const d = copy('gear-reducer')
    const g = d.parts.find((p) => p.id === 'g1')!
    if (g.kind === 'spur') g.module = 2.5
    expect(errors(d).some((p) => /same module/.test(p.message))).toBe(true)
  })
  it('catches helical gears of the same hand', () => {
    const d = copy('gear-reducer')
    d.parts = d.parts.map((p) => (p.id === 'p1' || p.id === 'g1') && p.kind === 'spur' ? { ...p, kind: 'helical', helix: 20, hand: 'right' } : p)
    d.shafts[1].x = (pitchDiameter(d.parts[1])! + pitchDiameter(d.parts[2])!) / 2
    d.shafts[2].x = d.shafts[1].x + 216
    const e = errors(d)
    expect(e).toHaveLength(1)
    expect(e[0].message).toMatch(/opposite hands/)
  })
  it('catches a missing motor and a part off the end of its shaft', () => {
    const d = copy('belt-drive')
    d.parts = d.parts.filter((p) => p.kind !== 'motor')
    d.parts[0].at = 150
    const m = errors(d).map((p) => p.message)
    expect(m).toContain('Add a motor to drive the design.')
    expect(m.some((x) => /hangs off the end/.test(x))).toBe(true)
  })
  it('catches a gear too small for its shaft', () => {
    const d = copy('gear-reducer')
    d.shafts[0].diameter = 40
    expect(errors(d).some((p) => p.ids.includes('p1') && /too small/.test(p.message))).toBe(true)
  })
  it('catches overlapping pulleys and warns on a short belt', () => {
    const d = copy('belt-drive')
    d.shafts[1].x = 300
    expect(checkDesign(d).some((p) => p.level === 'warning' && /very short/.test(p.message))).toBe(true)
    d.shafts[1].x = 200
    expect(errors(d).some((p) => /overlap/.test(p.message))).toBe(true)
  })
  it('catches duplicate ids and links to missing parts', () => {
    const d = copy('chain-drive')
    d.parts[4].id = 'b-1'
    d.links.push({ kind: 'chain', a: 'small', b: 'ghost' })
    const m = errors(d).map((p) => p.message).join('\n')
    expect(m).toMatch(/Two things are called “b-1”/)
    expect(m).toMatch(/ghost doesn't exist/)
  })
})

describe('solveDesign', () => {
  it('works speeds, directions and torques through a two-stage reducer', () => {
    const s = solveDesign(copy('gear-reducer'))
    expect(s.shafts.counter.rpm).toBeCloseTo(-362.5, 6)
    expect(s.shafts.output.rpm).toBeCloseTo(72.5, 6)
    expect(s.ratio.output).toBeCloseTo(20, 9)
    expect(s.shafts.output.stages).toBe(2)
    expect(s.shafts.output.power).toBeCloseTo(15 * 0.98 * 0.98, 9)
    expect(s.shafts.output.torque).toBeCloseTo((15000 * 0.98 ** 2) / rpmToRad(72.5), 6)
    expect(s.shafts.input.torque).toBeCloseTo(15000 / rpmToRad(1450), 6)
  })
  it('keeps the direction through a belt unless it is crossed', () => {
    const d = copy('belt-drive')
    expect(solveDesign(d).shafts.driven.rpm).toBeCloseTo((1440 * 125) / 315, 6)
    d.links[0] = { kind: 'belt', a: 'small', b: 'large', crossed: true }
    expect(solveDesign(d).shafts.driven.rpm).toBeCloseTo((-1440 * 125) / 315, 6)
  })
  it('works a chain drive by tooth counts', () => {
    const s = solveDesign(copy('chain-drive'))
    expect(s.shafts.driven.rpm).toBeCloseTo(100, 9)
    expect(s.shafts.driven.power).toBeCloseTo(4 * 0.97, 9)
  })
  it('lists undriven shafts as idle', () => {
    const d = copy('gear-reducer')
    d.links.pop()
    expect(solveDesign(d).idle).toEqual(['output'])
  })
  it('reports a locked drive', () => {
    const d = copy('belt-drive')
    d.parts.push({ id: 'small-2', kind: 'pulley', shaft: 'motor-shaft', at: 60, diameter: 100, width: 30, belt: 'v', grooves: 1 })
    d.parts.push({ id: 'large-2', kind: 'pulley', shaft: 'driven', at: 30, diameter: 300, width: 30, belt: 'v', grooves: 1 })
    d.links.push({ kind: 'belt', a: 'small-2', b: 'large-2', crossed: false })
    expect(solveDesign(d).conflicts[0]).toMatch(/locked/)
  })
})
