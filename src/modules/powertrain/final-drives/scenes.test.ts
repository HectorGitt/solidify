import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DriveGraph, brake, planetary } from '@/core/drive'
import { expandingShoeBrake } from '@/physics/transmission'
import { brakeGeometry } from '../brakes/geometry'
import { buildStatic as buildDiff } from '../differential/geometry'
import { SHOE, brakeTorque, DEFAULTS as BRAKE_DEFAULTS } from '../brakes/model'
import { hydroGeometry } from '../hydrostatic/geometry'
import { tcGeometry } from '../torque-converter/geometry'
import { finalGeometry } from './geometry'
import { DEFAULTS, EPI, chain } from './model'

/** Every edge of a closed 2-manifold is shared by exactly two triangles (copied from geometry.test.ts). */
function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const pos = g.getAttribute('position')
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
  const edges = new Map<string, number>()
  for (let t = 0; t < pos.count / 3; t++) {
    const k = [key(3 * t), key(3 * t + 1), key(3 * t + 2)]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue
    for (let e = 0; e < 3; e++) {
      const a = k[e]
      const b = k[(e + 1) % 3]
      const id = a < b ? `${a}|${b}` : `${b}|${a}`
      edges.set(id, (edges.get(id) ?? 0) + 1)
    }
  }
  let open = 0
  for (const c of edges.values()) if (c !== 2) open++
  return open
}

function volume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
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

describe('M2 scene geometry is closed and outward-facing (section caps)', () => {
  const h = hydroGeometry()
  const t = tcGeometry()
  const f = finalGeometry()
  const b = brakeGeometry()
  const solids: Record<string, THREE.BufferGeometry> = {
    'hydro block': h.block,
    'hydro valve plate': h.valvePlate,
    'hydro housing': h.housing,
    'hydro line A': h.pipeWall.A,
    'hydro piston': h.piston,
    'tc impeller shell': t.impellerShell,
    'tc turbine blades': t.turbineBlades,
    'tc cover': t.cover,
    'final crown wheel': f.crown,
    'final ring gear': f.ringG,
    'final MF trumpet': f.mfSet.trumpet,
    'final centre housing': f.centre,
    'brake drum': b.shoe.drum,
    'brake shoe': b.shoe.shoeL.metal,
    'disc housing': b.disc.housing,
    'wet housing': b.wet.housing,
  }
  for (const [name, g] of Object.entries(solids)) {
    it(name, () => {
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  }
})

describe('final drives — TTS p1/p10, PT p6', () => {
  it('MF axle preset: 2000 rpm engine → ≈ 20 rpm wheel (about 100 : 1)', () => {
    const rows = chain(DEFAULTS)
    expect(rows[2].overall).toBeGreaterThan(95)
    expect(rows[2].overall).toBeLessThan(115)
    expect(rows[2].rpm).toBeGreaterThan(17)
    expect(rows[2].rpm).toBeLessThan(22)
  })
  it('epicyclic with the ring held: carrier turns the same way as the sun, 1 + z_r/z_s slower (DriveGraph)', () => {
    const g = new DriveGraph()
    ;['sun', 'ring', 'carrier'].forEach((id) => g.body(id))
    g.add(planetary('p', 'sun', EPI.sun, 'ring', EPI.ring, 'carrier'))
    g.add(brake('ring', 'ring', () => true))
    g.drive('sun', 48)
    g.step(0.01)
    expect(g.get('carrier').omega).toBeCloseTo(48 / (1 + EPI.ring / EPI.sun), 9)
  })
})

describe('brakes scene', () => {
  it('the leading shoe of the expanding-shoe brake is self-energising but not self-locking', () => {
    const r = expandingShoeBrake(1000, SHOE)
    expect(r.selfLocking).toBe(false)
    expect(r.TLead).toBeGreaterThan(r.TTrail)
  })
  it('every brake type gives a torque that rises with pedal travel', () => {
    for (const type of ['shoe', 'disc', 'wet'] as const) {
      const lo = brakeTorque({ ...BRAKE_DEFAULTS, type, left: 0.3 }).T
      const hi = brakeTorque({ ...BRAKE_DEFAULTS, type, left: 0.8 }).T
      expect(hi).toBeGreaterThan(lo)
    }
  })
})

describe('differential geometry (worker build)', () => {
  it('builds every part, including the CSG cage and carrier', () => {
    const g = buildDiff()
    for (const [k, v] of Object.entries(g)) expect((v as THREE.BufferGeometry).getAttribute('position').count, k).toBeGreaterThan(0)
  })
})
