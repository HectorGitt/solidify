import { useMemo } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, extrude, mat4, merge, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { hash } from '../_shared/fx'
import { C, channelOf, flowNow, halfWidth, live, useWaterway, type Channel } from './model'

/** Channel runs 40 m along X (downslope), cross-section in Z–Y, bed at y = 0. */
const LEN = 40
const along = mat4.c(mat4.t(-LEN / 2, 0, 0), mat4.ry(Math.PI / 2))

const INFO = {
  ground: { summary: 'Field ground either side of the waterway.', role: 'Runoff from terraces, contour furrows and diversions is led into the waterway and carried down the slope without channel or gully erosion.' },
  bed: { summary: 'Grass-lined channel.', role: 'Vegetation is the stable lining. Shape and grade keep the mean velocity below the permissible value for the grass and soil (Table 7.2).', details: 'Trapezoidal: blade-built, sides 4:1 or flatter for mowing and crossing. Parabolic: natural-like. Triangular: V-bottom. Under flow and deposition, trapezoids and triangles become parabolic.' },
  water: { summary: 'Flow at the current discharge.', role: 'Manning: v = R^(2/3)s^(1/2)/n with R = a/p; capacity q = a·v.' },
  grass: { summary: 'Grass lining (retardance).', role: 'At low flow the grass stands upright and n is high (0.3–0.5); as depth rises the blades bend and are submerged, and n falls to about 0.03–0.04. Velocity at the bed inside the grass stays below about 0.3 m/s.' },
  freeboard: { summary: 'Freeboard.', role: 'Design depth D = flow depth d + 0.1 m freeboard; T is the top width at D.' },
}

function crossSection(ch: Channel, depth: number, outer: number, base: number) {
  const N = ch.shape === 'parabolic' ? 24 : 1
  const right: THREE.Vector2[] = []
  if (ch.shape === 'trapezoidal') right.push(new THREE.Vector2(ch.b / 2, 0), new THREE.Vector2(halfWidth(ch, depth), depth))
  else if (ch.shape === 'triangular') right.push(new THREE.Vector2(0, 0), new THREE.Vector2(halfWidth(ch, depth), depth))
  else for (let i = 0; i <= N; i++) right.push(new THREE.Vector2(halfWidth(ch, (depth * i) / N), (depth * i) / N))
  const left = right.map((v) => new THREE.Vector2(-v.x, v.y)).reverse()
  if (outer > 0) {
    // ground block: outer box with the channel notch in its top
    const pts = [new THREE.Vector2(-outer, base), new THREE.Vector2(outer, base), new THREE.Vector2(outer, depth), ...right.slice().reverse(), ...right.map((v) => new THREE.Vector2(-v.x, v.y)), new THREE.Vector2(-outer, depth)]
    return new THREE.Shape(dedupe(pts))
  }
  return new THREE.Shape(dedupe([...left, ...right.slice(ch.shape === 'parabolic' ? 1 : 0)]))
}

function dedupe(pts: THREE.Vector2[]) {
  return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-6)
}

export function Scene3D() {
  const st = useWaterway()
  const ch = useMemo(() => channelOf(st), [st.shape, st.mode, st.Q, st.v, st.n, st.s, st.Z, st.freeboard, st.a, st.d]) // eslint-disable-line react-hooks/exhaustive-deps
  const now = useMemo(() => flowNow(ch, st), [ch, st.flowFrac]) // eslint-disable-line react-hooks/exhaustive-deps
  const outer = ch.T / 2 + 4
  const geo = useMemo(() => {
    const ground = xform(extrude(crossSection(ch, ch.D, outer, -0.8), LEN), along)
    const water = xform(extrude(crossSection(ch, now.d, 0, 0), LEN - 0.2), mat4.c(mat4.t(0.1, 0.002, 0), along))
    const rods = merge(...[-1, 1].map((sg) => xform(box(LEN, 0.04, 0.04), mat4.t(0, ch.D, (sg * ch.T) / 2))))
    const design = merge(...[-1, 1].map((sg) => xform(box(LEN, 0.03, 0.03), mat4.t(0, ch.d, (sg * ch.t) / 2))))
    // grass blades on the wetted boundary and banks; blades under water lean downstream
    const blades: THREE.BufferGeometry[] = []
    const blade = xform(box(0.02, 0.18, 0.05), mat4.t(0, 0.09, 0))
    const half = ch.T / 2
    for (let i = 0; i < 520; i++) {
      const x = -LEN / 2 + 0.5 + hash(i) * (LEN - 1)
      const zz = (hash(i + 77) * 2 - 1) * half
      // bed height under this z
      let y = 0
      const az = Math.abs(zz)
      if (ch.shape === 'trapezoidal') y = az <= ch.b / 2 ? 0 : (az - ch.b / 2) / ch.Z
      else if (ch.shape === 'triangular') y = az / ch.Z
      else y = ch.d * (az / (ch.t / 2)) ** 2
      const sub = Math.max(0, Math.min(1, (now.d - y) / 0.18))
      blades.push(xform(blade, mat4.c(mat4.t(x, y, zz), mat4.rz(-1.2 * sub), mat4.ry(hash(i + 5) * 3))))
    }
    return { ground, water, rods, design, grass: merge(...blades) }
  }, [ch, now.d, outer])

  // flow lines across the section: faster near the centre/surface (isovels)
  const lines = useMemo(() => {
    const out: { curve: THREE.LineCurve3; speed: number }[] = []
    for (const fz of [-0.6, -0.3, 0, 0.3, 0.6])
      for (const fy of [0.35, 0.8]) {
        const z = fz * halfWidth(ch, now.d)
        let yb = 0
        const az = Math.abs(z)
        if (ch.shape === 'trapezoidal') yb = az <= ch.b / 2 ? 0 : (az - ch.b / 2) / ch.Z
        else if (ch.shape === 'triangular') yb = az / ch.Z
        else yb = ch.d * (az / (ch.t / 2)) ** 2
        const local = Math.max(0, now.d - yb)
        const y = yb + local * fy
        const k = Math.pow(Math.max(0.05, local / now.d), 2 / 3) * (0.6 + 0.4 * fy)
        out.push({ curve: new THREE.LineCurve3(new THREE.Vector3(-LEN / 2 + 0.3, y, z), new THREE.Vector3(LEN / 2 - 0.3, y, z)), speed: (now.v * k) / LEN })
      }
    return out
  }, [ch, now])

  useSimFrame(() => {
    live.v = now.v
    live.d = now.d
    live.q = now.a * now.v
  })

  const tilt = -Math.atan(st.s / 100)
  return (
    <group rotation={[0, 0, tilt]}>
      <Part id="ground" name="Field ground" role="housing" material="soil" info={INFO.ground} cites={[C.vw('book p134 uses')]}>
        <PartMesh geometry={geo.ground} />
      </Part>
      <Part id="grass" name="Grass lining" role="static" material="crop" info={INFO.grass} cites={[C.vw('Fig. 7.2, Fig. 7.3, Table 7.3')]} cut={false}>
        <PartMesh geometry={geo.grass} />
      </Part>
      <Part id="flow" name="Flow" role="fluid" material="water" info={INFO.water} cites={[C.vw('Eq. 7.1–7.2')]}>
        <PartMesh geometry={geo.water} />
      </Part>
      <Part id="freeboard" name="Design depth D (freeboard)" role="static" material="paintYellow" info={INFO.freeboard} cites={[C.vw('Ex. 7.1 freeboard 0.1 m')]} cut={false}>
        <PartMesh geometry={geo.rods} />
        <PartMesh geometry={geo.design} material="paintBlue" />
      </Part>
      {lines.map((l, i) => (
        <Flow key={`${ch.shape}-${i}`} curve={l.curve} count={30} radius={0.05} color="#9fd8ff" speed={l.speed} spread={0.05} intensity={() => (useWaterway.getState().flowFrac > 0.02 ? 1 : 0)} />
      ))}
      <PartLabel partId="ground" at={[-LEN / 2 + 3, ch.D + 0.5, -outer + 1]} />
      <PartLabel partId="grass" at={[0, 0.6, ch.T / 2 - 0.5]} />
      <PartLabel partId="flow" at={[LEN / 4, now.d + 0.4, 0]} />
      <PartLabel partId="freeboard" at={[-LEN / 4, ch.D + 0.4, ch.T / 2]} />
    </group>
  )
}
