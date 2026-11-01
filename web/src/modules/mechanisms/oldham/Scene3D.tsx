import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, mat4, merge, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Trace } from '../_shared/rig'
import { MM, live, useOldham } from './model'

export const FLOOR = -0.24
const axial = mat4.rx(Math.PI / 2)
const R = 0.12
/** thickness of a shaft-end disc, of its tongue, and of the central disc */
const FLANGE = 0.024
const TONGUE = 0.016
const DISC = 0.05
const Z_FACE = DISC / 2 + 0.002

/** a shaft with its disc and tongue, its tongue facing +z in its own frame, along its own x */
function shaftEnd() {
  const flange = xform(cylinder(R, FLANGE, 64), mat4.c(mat4.t(0, 0, -FLANGE / 2), axial))
  const shaft = xform(cylinder(0.03, 0.2, 40), mat4.c(mat4.t(0, 0, -FLANGE - 0.1), axial))
  const tongue = xform(box(2 * R, 0.044, TONGUE), mat4.t(0, 0, TONGUE / 2))
  return { steel: merge(flange, shaft), tongue }
}

/** the central disc: two grooves across its faces, at right angles */
function centralDisc() {
  const rad = R - 0.004
  const grooveHalf = 0.0235
  const core = xform(cylinder(rad, DISC - 2 * TONGUE, 72), axial)
  // the land each side of a groove: the part of the circle beyond the groove's edge
  const land = () => {
    const a0 = Math.asin(grooveHalf / rad)
    const sh = new THREE.Shape()
    sh.moveTo(rad * Math.cos(a0), grooveHalf)
    sh.absarc(0, 0, rad, a0, Math.PI - a0, false)
    sh.closePath()
    return extrude(sh, TONGUE)
  }
  const z = DISC / 2 - TONGUE / 2
  const face = (zz: number, turn: number) => [0, Math.PI].map((f) => xform(land(), mat4.c(mat4.t(0, 0, zz), mat4.rz(turn + f))))
  return merge(core, ...face(z, 0), ...face(-z, Math.PI / 2))
}

export function Oldham3D() {
  const dmm = useOldham((s) => s.d)
  const trace = useOldham((s) => s.trace)
  const d = dmm * MM
  const X0 = -d / 2
  const refs = { a: useRef<THREE.Group>(null), b: useRef<THREE.Group>(null), disc: useRef<THREE.Group>(null), dot: useRef<THREE.Mesh>(null) }
  const geo = useMemo(
    () => ({
      end: shaftEnd(),
      disc: centralDisc(),
      block: xform(box(0.1, 0.12, 0.1), mat4.t(0, -0.075, 0)),
      foot: xform(box(0.2, 0.024, 0.14), mat4.t(0, FLOOR + 0.012, 0)),
      ball: new THREE.SphereGeometry(0.008, 18, 12),
    }),
    [],
  )
  const circle = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * 2 * Math.PI
      pts.push([d / 2 + (d / 2) * Math.cos(a), (d / 2) * Math.sin(a), Z_FACE + DISC / 2 + FLANGE + 0.02])
    }
    return pts
  }, [d])

  const phase = useRef(0.4)
  useSimFrame((dt) => {
    const st = useOldham.getState()
    phase.current += (st.rpm * 2 * Math.PI * dt) / 60
    const t = phase.current
    live.theta = t
    refs.a.current?.rotation.set(0, 0, t)
    refs.b.current?.rotation.set(0, 0, t)
    // the disc's centre lies on both tongues: the foot of the perpendicular from B on to A's tongue
    const c = d * Math.cos(t)
    const cx = c * Math.cos(t)
    const cy = c * Math.sin(t)
    refs.disc.current?.position.set(cx, cy, 0)
    refs.disc.current?.rotation.set(0, 0, t)
    refs.dot.current?.position.set(cx, cy, Z_FACE + DISC / 2 + FLANGE + 0.02)
  })

  const zA = -DISC / 2 - TONGUE * 0
  const zB = DISC / 2
  return (
    <group position={[X0, 0, 0]}>
      <Part id="stands" name="Bearing stands" role="static" material="paintGrey" info={{ summary: 'Hold the two shafts parallel, out of line.', role: 'The offset is fixed. Each shaft runs in its own bearing; only the central disc moves sideways.' }} cut={false}>
        <group position={[0, -0.03, -0.2]}>
          <PartMesh geometry={geo.block} />
        </group>
        <group position={[d, -0.03, 0.2]}>
          <PartMesh geometry={geo.block} />
        </group>
        <group position={[0, 0, -0.2]}>
          <PartMesh geometry={geo.foot} />
        </group>
        <group position={[d, 0, 0.2]}>
          <PartMesh geometry={geo.foot} />
        </group>
      </Part>
      <group position={[0, 0, zA - FLANGE * 0 - TONGUE]}>
        <group ref={refs.a}>
          <Part id="driving" name="Driving shaft" role="moving" material="steel" info={{ summary: 'A disc on the shaft end, with one tongue across a diameter.', role: 'Its tongue slides in one groove of the central disc.' }} explode={[0, 0, -0.12]}>
            <PartMesh geometry={geo.end.steel} />
            <PartMesh geometry={geo.end.tongue} material="paintOrange" />
          </Part>
        </group>
      </group>
      <group ref={refs.disc}>
        <Part id="disc" name="Central disc" role="moving" material="bronze" info={{ summary: 'Grooved across both faces, at right angles.', role: 'It turns at shaft speed while its centre runs round a circle whose diameter is the shaft offset, twice per turn.' }} explode={[0, 0.16, 0]}>
          <PartMesh geometry={geo.disc} />
        </Part>
      </group>
      <group position={[d, 0, zB + TONGUE]}>
        <group ref={refs.b}>
          {/* the far shaft faces the other way, and its tongue lies square to the first */}
          <group rotation={[0, Math.PI, Math.PI / 2]}>
            <Part id="driven" name="Driven shaft" role="moving" material="steel" info={{ summary: 'The same disc and tongue, at right angles to the first.', role: 'Its tongue slides in the other groove, so it must turn at exactly the driving shaft’s speed.' }} explode={[0, 0, -0.12]}>
              <PartMesh geometry={geo.end.steel} />
              <PartMesh geometry={geo.end.tongue} material="paintBlue" />
            </Part>
          </group>
        </group>
      </group>
      {trace ? (
        <>
          <Trace points={circle} />
          <mesh ref={refs.dot} geometry={geo.ball}>
            <meshBasicMaterial color="#d0631c" toneMapped={false} />
          </mesh>
        </>
      ) : null}
      <PartLabel partId="disc" at={[d / 2, R + 0.03, 0]} />
      <PartLabel partId="driving" at={[0, 0.06, -0.2]} />
      <PartLabel partId="driven" at={[d, 0.06, 0.2]} />
    </group>
  )
}
