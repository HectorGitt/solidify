import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import * as L from '@/parts/lib/implements'

/** Shared implement parts (src/parts/lib/implements.ts) are closed and outward-facing. */

function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const pos = g.getAttribute('position')
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
  const edges = new Map<string, number>()
  const idx = g.index
  const n = idx ? idx.count : pos.count
  const at = (k: number) => (idx ? idx.getX(k) : k)
  for (let t = 0; t < n / 3; t++) {
    const k = [key(at(3 * t)), key(at(3 * t + 1)), key(at(3 * t + 2))]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue
    for (let e = 0; e < 3; e++) {
      const a = k[e]
      const b = k[(e + 1) % 3]
      const id = a < b ? `${a}|${b}` : `${b}|${a}`
      edges.set(id, (edges.get(id) ?? 0) + 1)
    }
  }
  let open = 0
  for (const c of edges.values()) if (c % 2 !== 0) open++
  return open
}

function volume(g: THREE.BufferGeometry) {
  const ng = g.index ? g.toNonIndexed() : g
  const p = ng.getAttribute('position')
  let v = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

describe('implement parts library: closed, outward-facing solids', () => {
  const cases: [string, () => THREE.BufferGeometry][] = [
    ['headstock', () => L.headstockGeometry()],
    ['A-frame mast', () => L.aFrameMast()],
    ['disc gang', () => L.discGang()],
    ['coulter disc', () => L.coulterDisc(0.2)],
    ['rigid tine', () => L.cultivatorTine({ x: 0, z: 0, floor: -0.5 }).shank],
    ['spring tine', () => L.cultivatorTine({ x: 0, z: 0, floor: -0.5, kind: 'spring' }).shank],
    ['chisel shank', () => L.chiselShank(0, 0, -0.5)],
    ['subsoiler shank', () => L.chiselShank(0, 0, -0.5, true)],
    ['ridger body', () => L.ridgerBody()],
    ['rotavator rotor', () => L.rotavatorRotor({ width: 1.2, R: 0.24, blades: 3, flanges: 3 })],
    ['fluted roller', () => L.flutedRoller()],
    ['cell plate', () => L.cellPlate(12)],
    ['auger', () => L.auger({ tubeR: 0.05, flightR: 0.15, z0: -0.5, z1: 0.5, turns: 3 })],
    ['toothed beater', () => L.toothedBeater(0.2, 1, 4, 5)],
    ['bladed rotor', () => L.bladedRotor({ r: 0.2, halfWidth: 0.5, blades: 4 })],
    ['ratchet wheel', () => L.ratchetWheel(24, 0.16, 0.018, 0.02)],
    ['spinner disc', () => L.spinnerDisc(0.25, 4)],
    ['cone hopper', () => L.coneHopper(0.08, 0.4, 0.2, 0.8)],
    ['spray boom frame', () => L.sprayBoomFrame(6)],
    ['cutter bar guards', () => L.cutterBar({ from: 0, to: -1.5 }).guards],
    ['sickle', () => L.sickle({ from: 0, to: -1.5 })],
    ['pitman wheel', () => L.pitmanWheel(0.038)],
    ['baler plunger', () => L.balerPlunger(0.35, 0.43, 0.33)],
    ['baler flywheel', () => L.balerFlywheel()],
    ['threshing drum', () => L.threshingDrum({ r: 0.3, halfWidth: 0.65, bars: 8 })],
    ['concave', () => L.concave({ r: 0.3, halfWidth: 0.65, clearance: 0.012 })],
    ['louvre sieve', () => L.louvreSieve({ x0: 1, x1: 0, y: 0, pitch: 0.04, tilt: 0.4, halfWidth: 0.6 })],
    ['digging blade (cassava)', () => L.diggingBlade('cassava', { tipX: 0, x1: -0.4, rise: 0.15, W: 1 })],
    ['root plough blade', () => L.rootPlough().blade],
  ]
  for (const [name, make] of cases)
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  it('mirrorZ keeps a solid outward-facing', () => {
    const g = L.ridgerBody()
    expect(volume(L.mirrorZ(g))).toBeCloseTo(volume(g), 6)
  })
})
