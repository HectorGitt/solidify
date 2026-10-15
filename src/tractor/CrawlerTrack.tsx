import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { mat4, merge, xform } from '@/geometry'
import { loopPath } from '@/geometry/parts'
import { InstancedPartMesh } from '@/render/InstancedPartMesh'
import { PartMesh } from '@/render/Part'
import { CRAWLER_TRACK, shoeReach, trackBushing, trackIdler, trackLink, trackPin, trackRoller, trackShoe, trackSprocket, trackSprocketRadius, type ShoeType, type TrackSpec } from '@/parts/lib/wheels'

/**
 * One side of a crawler's running gear, working: the rear drive sprocket, front idler and bottom
 * rollers from the parts library with the chain (links, bushings, pins) and shoes travelling round
 * them. Side view in XY (+X forward, Y up), track centred on z = 0, grouser tips on y = 0.
 *
 * The sprocket size is set by its centre height (it sits on the axle), the chain pitch is trimmed
 * so a whole number of links closes the loop, and the shoes move with `travel` (metres run forward).
 */

export interface CrawlerTrackOpts {
  /** sprocket centre (rear) x and height */
  xs: number
  ys: number
  /** idler centre x (front) and pitch radius */
  xi: number
  idlerR: number
  /** number of bottom rollers */
  rollers?: number
  shoe?: ShoeType
  /** shoe width and chain proportions (defaults: the library's medium crawler) */
  spec?: Partial<TrackSpec>
}

/** Solve the track: sprocket teeth for its height, the loop, and a pitch that closes it in whole links. */
export function crawlerTrackLayout(o: CrawlerTrackOpts) {
  const base = { ...CRAWLER_TRACK, ...o.spec }
  const shoe = o.shoe ?? 'standard'
  let t: TrackSpec = { ...base, idlerR: o.idlerR }
  let path: THREE.CurvePath<THREE.Vector3> | null = null
  let N = 0
  let L = 0
  for (let i = 0; i < 4; i++) {
    const yb = shoeReach(shoe, t)
    // an odd (hunting) tooth count that puts the sprocket's pitch circle on the bottom strand
    const want = ((o.ys - yb) * 4 * Math.PI) / t.pitch
    const teeth = 2 * Math.round((want - 1) / 2) + 1
    t = { ...t, teeth }
    const RS = trackSprocketRadius(t)
    path = loopPath(new THREE.Vector2(o.xs, yb + RS), RS, new THREE.Vector2(o.xi, yb + o.idlerR), o.idlerR).path
    L = path.getLength()
    N = Math.max(8, Math.round(L / base.pitch))
    t = { ...t, pitch: L / N }
  }
  const p = path!
  // a clockwise walk: the top strand runs forward, the bottom strand back (outward = left-hand normal)
  const pts = p.getSpacedPoints(64)
  let area = 0
  for (let i = 0; i < pts.length - 1; i++) area += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y
  const wrap = (u: number) => ((u % 1) + 1) % 1
  const at = (u: number) => p.getPointAt(area > 0 ? wrap(1 - u) : wrap(u))
  const yb = shoeReach(shoe, t)
  const RS = trackSprocketRadius(t)
  return { spec: t, shoe, N, length: L, at, yb, sprocketR: RS, idlerR: o.idlerR, sprocketC: new THREE.Vector2(o.xs, yb + RS), idlerC: new THREE.Vector2(o.xi, yb + o.idlerR), top: Math.max(yb + 2 * RS, yb + 2 * o.idlerR) + shoeReach(shoe, t) }
}
export type CrawlerTrackLayout = ReturnType<typeof crawlerTrackLayout>

export function crawlerTrackGeometry(T: CrawlerTrackLayout, rollers = 5) {
  const t = T.spec
  const roller = trackRoller(t.rollerR, t)
  const x0 = T.sprocketC.x + T.sprocketR * 0.9
  const x1 = T.idlerC.x - T.idlerR * 0.9
  const rollerY = T.yb + t.rail + t.rollerR
  return {
    sprocket: trackSprocket(t),
    idler: trackIdler(t),
    rollers: merge(...Array.from({ length: rollers }, (_, i) => xform(roller, mat4.t(x0 + ((x1 - x0) * (i + 0.5)) / rollers, rollerY, 0)))),
    rollerXs: Array.from({ length: rollers }, (_, i) => x0 + ((x1 - x0) * (i + 0.5)) / rollers),
    /** one link-frame unit: link pair, bushing and pin (pitch line on y = 0) */
    chain: merge(trackLink(t), trackBushing('interlocking', t), trackPin(t)),
    shoe: trackShoe(T.shoe, t),
  }
}

/**
 * Both tracks of a crawler at ±z, animated. `travel()` is the distance run forward (m); `turn()`
 * optionally the extra distance the right track runs over the left (skid steering).
 */
export function CrawlerTracks({ layout: T, geometry: g, z, travel, turn }: { layout: CrawlerTrackLayout; geometry: ReturnType<typeof crawlerTrackGeometry>; z: number; travel: () => number; turn?: () => number }) {
  const shoes = useRef<THREE.InstancedMesh>(null)
  const links = useRef<THREE.InstancedMesh>(null)
  const sprockets = useRef<(THREE.Group | null)[]>([])
  const idlers = useRef<(THREE.Group | null)[]>([])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const tg = useMemo(() => new THREE.Vector3(), [])
  const n = useMemo(() => new THREE.Vector3(), [])
  useSimFrame(() => {
    const d = travel()
    const dt = turn?.() ?? 0
    let k = 0
    for (const s of [1, -1] as const) {
      // right track (+z) runs d + dt/2, left d − dt/2
      const run = d + (s * dt) / 2
      sprockets.current[s > 0 ? 0 : 1]?.rotation.set(0, 0, -run / T.sprocketR)
      idlers.current[s > 0 ? 0 : 1]?.rotation.set(0, 0, -run / T.idlerR)
      const u0 = run / T.length
      for (let i = 0; i < T.N; i++) {
        const A = T.at(i / T.N + u0)
        const B = T.at((i + 1) / T.N + u0)
        tg.set(B.x - A.x, B.y - A.y, 0).normalize()
        n.set(-tg.y, tg.x, 0)
        m.makeBasis(tg, n, zAxis).setPosition((A.x + B.x) / 2, (A.y + B.y) / 2, s * z)
        shoes.current?.setMatrixAt(k, m)
        links.current?.setMatrixAt(k, m)
        k++
      }
    }
    if (shoes.current) shoes.current.instanceMatrix.needsUpdate = true
    if (links.current) links.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      {[1, -1].map((s, i) => (
        <group key={s} position={[0, 0, s * z]}>
          <group position={[T.sprocketC.x, T.sprocketC.y, 0]} ref={(el) => void (sprockets.current[i] = el)}>
            <PartMesh geometry={g.sprocket} material="steelDark" />
          </group>
          <group position={[T.idlerC.x, T.idlerC.y, 0]} ref={(el) => void (idlers.current[i] = el)}>
            <PartMesh geometry={g.idler} material="steel" />
          </group>
          <PartMesh geometry={g.rollers} material="steel" />
        </group>
      ))}
      <InstancedPartMesh ref={shoes} geometry={g.shoe} count={2 * T.N} />
      <InstancedPartMesh ref={links} geometry={g.chain} count={2 * T.N} material="forged" />
    </>
  )
}
