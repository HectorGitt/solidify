import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { absorberCasing, absorberWater, cabMount, columnLoadCell, dashpot, operatorSeatMerged, strainLink, telescopicDamper, vanedRotor } from './chassis'
import {
  CRAWLER_TRACK,
  FARMLAND_FRONT,
  FARMLAND_REAR,
  resolveWheel,
  shoeReach,
  suitcaseWeight,
  trackIdler,
  trackLink,
  trackLoop,
  trackRoller,
  trackShoe,
  trackSprocket,
  wheel,
  wheelStations,
  wheelWeight,
  wheelWeightStack,
} from './wheels'

/** signed volume: > 0 for a closed, outward-facing solid */
function volume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  const idx = g.index
  let v = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = idx ? idx.count : p.count
  const at = (i: number) => (idx ? idx.getX(i) : i)
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, at(i))
    b.fromBufferAttribute(p, at(i + 1))
    c.fromBufferAttribute(p, at(i + 2))
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

/** edges not shared by exactly two triangles (0 for a closed single solid) */
function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const pos = g.getAttribute('position')
  const idx = g.index
  const n = idx ? idx.count : pos.count
  const at = (i: number) => (idx ? idx.getX(i) : i)
  const key = (i: number) => `${Math.round(pos.getX(at(i)) / eps)},${Math.round(pos.getY(at(i)) / eps)},${Math.round(pos.getZ(at(i)) / eps)}`
  const edges = new Map<string, number>()
  for (let t = 0; t < n / 3; t++) {
    const k = [key(3 * t), key(3 * t + 1), key(3 * t + 2)]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue
    for (let e = 0; e < 3; e++) {
      const x = k[e]
      const y = k[(e + 1) % 3]
      const id = x < y ? `${x}|${y}` : `${y}|${x}`
      edges.set(id, (edges.get(id) ?? 0) + 1)
    }
  }
  let open = 0
  for (const c of edges.values()) if (c !== 2) open++
  return open
}

describe('wheels library', () => {
  it('Farmland presets match the tractor dims (14.9-28 rear, 7.50-16 front)', () => {
    expect(FARMLAND_REAR.radius).toBe(0.66)
    expect(FARMLAND_REAR.rimRadius).toBe(0.356)
    expect(FARMLAND_FRONT.radius).toBe(0.39)
    expect(resolveWheel(FARMLAND_REAR).studs).toBe(10)
    expect(resolveWheel(FARMLAND_FRONT).studs).toBe(6)
  })
  it('wheel() builds tyre, rim and hub in the wheel frame (axle Z, outer face +Z) and caches', () => {
    const w = wheel(FARMLAND_REAR)
    expect(wheel(FARMLAND_REAR)).toBe(w)
    for (const g of [w.tyre, w.rim, w.hub!]) expect(volume(g)).toBeGreaterThan(0)
    w.tyre.computeBoundingBox()
    const bb = w.tyre.boundingBox!
    expect(bb.max.x).toBeCloseTo(0.66, 1)
    expect(bb.max.z - bb.min.z).toBeLessThan(0.45)
    w.hub!.computeBoundingBox()
    expect(w.hub!.boundingBox!.min.z).toBeGreaterThan(0)
  })
  it('dual-wheel stations and weight stacks sit outboard of the hub', () => {
    expect(wheelStations(1.8, FARMLAND_REAR, true)).toHaveLength(4)
    const zs = wheelWeightStack(FARMLAND_REAR, 3, 0.05)
    expect(zs[0]).toBeGreaterThan(resolveWheel(FARMLAND_REAR).dish)
    expect(zs[1] - zs[0]).toBeGreaterThan(0.05)
  })
  const closed: [string, () => THREE.BufferGeometry][] = [
    ['wheel weight', () => wheelWeight()],
    ['suitcase weight', () => suitcaseWeight()],
    ['track idler', () => trackIdler()],
    ['track roller', () => trackRoller(0.09)],
    ['cab mount', () => cabMount()],
    ['absorber casing', () => absorberCasing({ R: 0.26, half: 0.18, cav: 0.23, bore: 0.04, fins: [-0.135, -0.045, 0.045, 0.135], finTip: 0.205 })],
    ['absorber water', () => absorberWater({ R: 0.26, half: 0.18, cav: 0.23, bore: 0.04, fins: [-0.135, -0.045, 0.045, 0.135], finTip: 0.205 })],
  ]
  for (const [name, make] of closed)
    it(`${name} is closed and outward-facing`, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  const solids: [string, () => THREE.BufferGeometry][] = [
    ['track link', () => trackLink()],
    ['track shoe (open)', () => trackShoe('open')],
    ['track sprocket', () => trackSprocket()],
    ['vaned rotor', () => vanedRotor()],
    ['strain link', () => strainLink({ span: 0.3 })],
    ['column load cell', () => columnLoadCell()],
    ['operator seat', () => operatorSeatMerged()],
    ['damper body', () => telescopicDamper({ bodyR: 0.02, bodyL: 0.1, rodR: 0.008 }).body],
    ['dashpot cup', () => dashpot().cup],
  ]
  for (const [name, make] of solids) it(`${name} has positive volume`, () => expect(volume(make())).toBeGreaterThan(0))
  it('trackLoop closes the chain round sprocket and idler', () => {
    const t = trackLoop({ xs: -0.9, xi: 0.9 })
    expect(t.chain.getAttribute('position').count).toBeGreaterThan(0)
    t.shoes.computeBoundingBox()
    // grouser tips on the ground
    expect(t.shoes.boundingBox!.min.y).toBeCloseTo(0, 1)
    expect(t.top).toBeGreaterThan(2 * shoeReach('standard', CRAWLER_TRACK))
  })
})
