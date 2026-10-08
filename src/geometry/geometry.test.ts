import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { box, cam, csg, cylinder, gear, gearOutline, helixSpring, lathe, mat4, pipe, ringGear, tube } from './index'

/** Every edge of a closed 2-manifold is shared by exactly two triangles. */
function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const pos = g.getAttribute('position')
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
  const edges = new Map<string, number>()
  const tri = pos.count / 3
  for (let t = 0; t < tri; t++) {
    const k = [key(3 * t), key(3 * t + 1), key(3 * t + 2)]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue // degenerate
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

/** Signed volume via divergence theorem: positive for outward-facing closed meshes. */
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

describe('procedural geometry is watertight and outward-facing', () => {
  const cases: [string, () => THREE.BufferGeometry, number?][] = [
    ['cylinder', () => cylinder(0.05, 0.1), Math.PI * 0.05 ** 2 * 0.1],
    ['tube', () => tube(0.056, 0.05, 0.2), Math.PI * (0.056 ** 2 - 0.05 ** 2) * 0.2],
    ['box', () => box(0.1, 0.2, 0.3), 0.006],
    ['lathe piston', () => lathe([[0, 0], [0.05, 0], [0.05, 0.1], [0, 0.1]]), Math.PI * 0.05 ** 2 * 0.1],
    ['spur gear', () => gear({ teeth: 24, module: 0.004, width: 0.03, bore: 0.012 })],
    ['helical gear', () => gear({ teeth: 30, module: 0.003, width: 0.025, helixDeg: 20 })],
    ['ring gear', () => ringGear({ teeth: 72, module: 0.003, width: 0.03, rimOuter: 0.13 })],
    ['pipe', () => pipe(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.2, 0)), 0.02, 0.016), Math.PI * (0.02 ** 2 - 0.016 ** 2) * 0.2],
    ['spring', () => helixSpring(0.015, 0.002, 0.04, 6)],
    [
      'curved pipe (left-handed Frenet frames)',
      () =>
        pipe(
          new THREE.CatmullRomCurve3([new THREE.Vector3(0.08, 0.38, -0.034), new THREE.Vector3(0.145, 0.38, -0.044), new THREE.Vector3(0.18, 0.34, -0.064), new THREE.Vector3(0.2, 0.28, -0.074)]),
          0.017,
          0.014,
        ),
    ],
    [
      'curved solid port',
      () => pipe(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.008, -0.002, 0.024), new THREE.Vector3(-0.008, 0.02, 0.024), new THREE.Vector3(0.012, 0.048, 0.03), new THREE.Vector3(0.06, 0.062, 0.034), new THREE.Vector3(0.1, 0.064, 0.034)]), 0.0165, 0),
    ],
    ['cam', () => cam(0.018, (p) => 0.006 * Math.max(0, Math.cos(p)), 0.015)],
  ]
  for (const [name, make, expected] of cases) {
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      const v = volume(g)
      expect(v).toBeGreaterThan(0)
      if (expected) expect(Math.abs(v - expected) / expected).toBeLessThan(0.03)
    })
  }

  it('csg block: closed volume (CSG output may contain T-junctions, so only the volume is checked)', () => {
    const g = csg(box(0.2, 0.2, 0.2), [{ op: 'sub', geometry: cylinder(0.05, 0.3) }])
    const expected = 0.2 ** 3 - Math.PI * 0.05 ** 2 * 0.2
    expect(Math.abs(volume(g) - expected) / expected).toBeLessThan(0.01)
    void mat4
  })

  it('gear tooth thickness at the pitch circle is πm/2', () => {
    const z = 20
    const m = 0.005
    const pts = gearOutline(z, m)
    const r = (z * m) / 2
    // find the two flank crossings of the pitch circle for tooth 0
    const angs: number[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].length() - r
      const b = pts[i + 1].length() - r
      if (a * b < 0) {
        const t = a / (a - b)
        const p = pts[i].clone().lerp(pts[i + 1], t)
        const ang = Math.atan2(p.y, p.x)
        if (Math.abs(ang) < Math.PI / z) angs.push(ang)
      }
    }
    expect(angs.length).toBe(2)
    const thickness = Math.abs(angs[1] - angs[0]) * r
    expect(thickness).toBeCloseTo((Math.PI * m) / 2, 5)
  })
})
