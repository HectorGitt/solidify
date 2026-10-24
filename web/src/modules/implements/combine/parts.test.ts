import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import * as P from './parts'
import { D } from './model'

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
  for (const c of edges.values()) if (c % 2 !== 0) open++
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

const tris = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3

describe('combine geometry is closed and outward-facing', () => {
  const cases: [string, () => THREE.BufferGeometry][] = [
    ['header', P.headerGeometry],
    ['cutter bar', P.cutterBarGeometry],
    ['knife', P.knifeGeometry],
    ['header auger', P.headerAugerGeometry],
    ['reel spider', P.reelSpiderGeometry],
    ['reel bat', P.reelBatGeometry],
    ['reel arms', P.reelArmsGeometry],
    ['feeder housing', P.feederHousingGeometry],
    ['feeder sprockets', P.feederSprocketsGeometry],
    ['slat', P.slatGeometry],
    ['cylinder', P.cylinderGeometry],
    ['concave', () => P.concaveGeometry(12)],
    ['beater', P.beaterGeometry],
    ['walker', P.walkerGeometry],
    ['walker crank', P.walkerCrankGeometry],
    ['pans', P.pansGeometry],
    ['chaffer', () => P.sieveGeometry(D.shoe.x0, D.shoe.x1, D.shoe.chafferY, 0.045, 0.45)],
    ['fan rotor', P.fanRotorGeometry],
    ['fan housing', P.fanHousingGeometry],
    ['cross auger', P.crossAugerGeometry],
    ['trough', () => P.troughGeometry(0, 0)],
    ['elevators', P.elevatorsGeometry],
    ['body', P.bodyGeometry],
    ['tank', P.tankGeometry],
    ['tank auger', P.tankAugerGeometry],
    ['unloading auger', P.unloadGeometry],
    ['cab', P.cabFrameGeometry],
    ['engine', P.engineGeometry],
    ['chopper', P.strawChopperGeometry],
    ['axles', P.axlesGeometry],
    ['stalk', P.stalkGeometry],
    ['ear', P.earGeometry],
  ]
  let total = 0
  for (const [name, make] of cases) {
    it(name, () => {
      const g = make()
      total += tris(g)
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  }
  it('static triangle budget (excluding wheels and the crop field) stays under ~110k', () => {
    const w = P.wheel(D.front.r, D.front.w, 22, 'R1')
    const r = P.wheel(D.rear.r, D.rear.w, 0, 'F2')
    const wheels = 2 * (tris(w.tyre) + tris(w.rim) + tris(r.tyre) + tris(r.rim))
    // walkers ×4, reel bats ×5, cross augers ×2
    const extra = 3 * tris(P.walkerGeometry()) + 4 * tris(P.reelBatGeometry()) + tris(P.crossAugerGeometry())
    expect(total + extra).toBeLessThan(110_000)
    expect(total + extra + wheels).toBeLessThan(150_000)
  })
})
