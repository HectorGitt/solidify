import { describe, expect, it } from 'vitest'
import { MODULES } from '@/modules/catalog'
import { RULE_ROUTES, detailLinks, sceneTitle } from './drilldown'
import fs from 'node:fs'

const built = (route: string) => {
  const [m, s] = route.split('/')
  const entry = MODULES.find((x) => x.id === m)?.scenes.find((x) => x.id === s)
  return !!entry && fs.existsSync(`src/modules/${m}/${entry.folder ?? entry.id}/index.tsx`)
}

const part = (id: string, name: string) => ({ id, name })
const routes = (id: string, name: string, here = 'field/field') => detailLinks(part(id, name), here).map((l) => l.route)

describe('drill-down links', () => {
  it('every rule points at a scene that exists', () => {
    const missing = RULE_ROUTES.filter((r) => !built(r))
    expect(missing).toEqual([])
  })

  it('tractor parts open the scene that explains them', () => {
    expect(routes('tractor-rear-wheel-l', 'Rear wheel (left)')[0]).toBe('traction/tyre')
    expect(routes('tractor-engine', 'Engine')[0]).toBe('engine/four-stroke-diesel')
    expect(routes('tractor-crown-wheel', 'Crown wheel and differential')[0]).toBe('powertrain/differential')
    expect(routes('tractor-centre-housing', 'Centre housing')[0]).toBe('powertrain/differential')
    expect(routes('tractor-clutch-housing', 'Clutch housing')[0]).toBe('powertrain/clutches')
    expect(routes('tractor-gearbox', 'Gearbox')[0]).toBe('powertrain/gearboxes')
    expect(routes('tractor-top-link', 'Top link')[0]).toBe('hydraulics/three-point')
    expect(routes('tractor-pto', 'PTO')[0]).toBe('pto/pto-types')
    expect(routes('tractor-radiator', 'Radiator')[0]).toBe('engine/cooling')
    expect(routes('tractor-front-axle', 'Front axle')[0]).toBe('steering/linkage')
    expect(routes('tractor-drawbar', 'Drawbar')[0]).toBe('chassis/hitches')
  })

  it('never links back to the scene you are in, and at most three', () => {
    const r = routes('tractor-rear-wheel-l', 'Rear wheel (left)', 'traction/tyre')
    expect(r).not.toContain('traction/tyre')
    expect(detailLinks(part('x', 'gearbox gears and shafts'), 'field/field').length).toBeLessThanOrEqual(3)
  })

  it('an explicit link on the part wins over the rules', () => {
    const r = detailLinks({ id: 'tractor-rear-wheel-l', name: 'Rear wheel', info: { detail: [{ route: 'traction/tracks', label: 'Tracks instead' }] } }, 'field/field')
    expect(r).toEqual([{ route: 'traction/tracks', title: 'Tracks instead' }])
  })

  it('parts with nothing deeper get no links', () => {
    expect(detailLinks(part('tractor-bonnet', 'Bonnet'), 'field/field')).toEqual([])
  })

  it('titles come from the catalogue', () => {
    expect(sceneTitle('traction/tyre')).toBe('Tyre construction')
    expect(sceneTitle('precision/variable-rate')).toBeNull()
  })
})
