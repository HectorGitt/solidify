import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { bandStrip, bentLeaf, brakeDrum, chainSprocket, circlip, coneClutch, flatPulley, hexNut, idlerPulley, linkPlate, multiDiscClutch, parallelKey, pillowBlock, plainBush, rollerChain, vSheave, VBELT_SECTIONS } from './elements'
import { annulusOil, cylinderBarrel, cylinderCap, directionalValve, gearPump, gearPumpCovers, oilColumn, pistonRod, ram, rodGland, sealedPiston, stabiliserParts, topLinkParts, vanePump } from './hydraulics'
import { ballJoint, dropArm, knuckleArm, linkRod, steeringWheel, trackRodAdjuster, worm, wormRocker } from './steeringBox'

/** Edges used by other than exactly two triangles (0 for a closed, manifold solid). */
function openEdges(g: THREE.BufferGeometry, eps = 1e-7) {
  const pos = g.getAttribute('position')
  const idx = g.index
  const n = idx ? idx.count : pos.count
  const at = (i: number) => (idx ? idx.getX(i) : i)
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
  const edges = new Map<string, number>()
  for (let t = 0; t < n; t += 3) {
    const k = [key(at(t)), key(at(t + 1)), key(at(t + 2))]
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
  const idx = g.index
  const n = idx ? idx.count : p.count
  const at = (i: number) => (idx ? idx.getX(i) : i)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let v = 0
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, at(i))
    b.fromBufferAttribute(p, at(i + 1))
    c.fromBufferAttribute(p, at(i + 2))
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

const solid = (name: string, g: THREE.BufferGeometry) => {
  expect(g.attributes.position.count, name).toBeGreaterThan(0)
  expect(volume(g), `${name} outward-facing`).toBeGreaterThan(0)
}

describe('machine-element builders (elements.ts)', () => {
  it('build closed, outward-facing solids', () => {
    const parts: Record<string, THREE.BufferGeometry> = {
      flatPulley: flatPulley(0.2, 0.08),
      vSheave: vSheave(0.1, 3, VBELT_SECTIONS.A, (38 * Math.PI) / 180).geometry,
      idler: idlerPulley(0.05, 0.03),
      pillow: pillowBlock(0.026, 0.12),
      bush: plainBush({ rIn: 0.02, rOut: 0.025, length: 0.03, flangeR: 0.032 }),
      key: parallelKey(0.02, 0.05),
      nut: hexNut(0.016),
      circlip: circlip(0.02),
      sprocket: chainSprocket(17, 0.0127, 2),
      linkPlate: linkPlate(0.0127, 0.011, 0.002, 0.0015),
      leaf: bentLeaf(0, 0.5, 0.008, 0.06, 0.1, (x) => 0.1 * x * x),
      drum: brakeDrum(180, 30),
      band: bandStrip([new THREE.Vector2(0, 0), new THREE.Vector2(0.1, 0.02), new THREE.Vector2(0.2, 0)], 0.004, 0.05),
      ...(() => {
        const c = rollerChain(0.0127, 1)
        return { roller: c.roller, bush2: c.bush, pin: c.pin, inner: c.inner }
      })(),
      ...(() => {
        const d = multiDiscClutch(100, 60)
        return { steel: d.steel, bronze: d.bronze, housing: d.housing }
      })(),
      cone: coneClutch(100, 80, 0.25).cone,
    }
    for (const [k, g] of Object.entries(parts)) solid(k, g)
    for (const k of ['flatPulley', 'idler', 'bush', 'nut', 'roller', 'drum', 'steel']) expect(openEdges(parts[k]), k).toBe(0)
  })
})

describe('hydraulic builders (hydraulics.ts)', () => {
  it('builds the pumps, valve and cylinder parts', () => {
    const spec = { module: 0.003, teeth: 12, width: 0.02, block: [0.105, 0.095, 0.02] as [number, number, number] }
    const gp = gearPump(spec)
    const gc = gearPumpCovers(spec)
    const vp = vanePump()
    const v = directionalValve()
    const p = sealedPiston({ R: 0.025, width: 0.025, grooveD: 0.003 })
    const gl = rodGland({ rodR: 0.0125, R: 0.025, Ro: 0.032, x0: 0.3, x1: 0.32, out: 0.01 })
    const r = ram({ bore: 0.09, barrelLen: 0.3, rodLen: 0.3 })
    const parts: Record<string, THREE.BufferGeometry> = {
      gpBody: gp.body,
      gpFront: gc.front,
      vpRotor: vp.rotor,
      vpRing: vp.ring,
      valve: v.body,
      spool: v.spool,
      barrel: cylinderBarrel({ R: 0.04, Ro: 0.049, length: 0.4, ports: [0.01, 0.38] }),
      cap: cylinderCap({ Ro: 0.049, capT: 0.026 }).cap,
      piston: p.piston,
      seals: p.seals,
      wear: p.wearRing,
      gland: gl.body,
      rod: pistonRod({ rodR: 0.02, length: 0.4 }).rod,
      oil: oilColumn(),
      ann: annulusOil(0.02, 0.04),
      ramBarrel: r.barrel,
      topEye: topLinkParts().eye,
      sleeve: stabiliserParts().sleeve,
    }
    for (const [k, g] of Object.entries(parts)) solid(k, g)
    for (const k of ['piston', 'seals', 'gland', 'rod', 'oil', 'ann']) expect(openEdges(parts[k]), k).toBe(0)
  })
})

describe('steering builders (steeringBox.ts)', () => {
  it('builds the worm box, wheel and linkage parts', () => {
    const w = worm(0.3)
    const wr = wormRocker()
    const sw = steeringWheel()
    const ta = trackRodAdjuster()
    const parts: Record<string, THREE.BufferGeometry> = {
      worm: w.body,
      wormShafts: w.shafts,
      rocker: wr.arm,
      peg: wr.peg,
      rim: sw.rim,
      spokes: sw.spokes,
      drop: dropArm(),
      dropLong: dropArm({ length: 0.2, bossR: 0.035, endR: 0.022, thick: 0.025, holeR: 0.022, ballR: 0.022, ballZ: 0 }),
      arm: knuckleArm({ length: 0.16, angle: Math.PI - 0.3 }),
      rod: linkRod(0.013),
      ball: ballJoint(),
      sleeve: ta.sleeve,
    }
    for (const [k, g] of Object.entries(parts)) solid(k, g)
    expect(openEdges(parts.ball)).toBe(0)
  })

  it('a knuckle arm ends at its ball joint', () => {
    const g = knuckleArm({ length: 0.16, angle: Math.PI - 0.3, y: 0.1 })
    g.computeBoundingBox()
    const end = new THREE.Vector3(0.16 * Math.cos(Math.PI - 0.3), 0.1, -0.16 * Math.sin(Math.PI - 0.3))
    expect(g.boundingBox!.min.x).toBeCloseTo(end.x - 0.02, 2)
  })
})
