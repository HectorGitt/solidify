import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { instrument, useResetOnChange, useRunDriver } from '@/lab/run'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { BALANCE_PROC, SHAFT, analyse, balanceRun, live, useBalance } from './model'

export const FLOOR = -0.42
const MM = 0.0016
const along = mat4.rz(Math.PI / 2)
const LEN = SHAFT * MM
const X0 = -LEN / 2

/** a block on the shaft, with its eccentric disc at radius r */
function massGeo(r: number, m: number, angle: number) {
  const size = 0.02 + Math.cbrt(m) * 0.012
  const R = 0.04 + r * MM
  const a = (angle * Math.PI) / 180
  const arm = xform(box(0.03, R, 0.018), mat4.c(mat4.rx(a), mat4.t(0, R / 2, 0)))
  const disc = xform(cylinder(size, 0.036, 28), mat4.c(mat4.rx(a), mat4.c(mat4.t(0, R, 0), along)))
  return merge(arm, disc)
}

export function Balancing3D() {
  const p = useBalance()
  const a = useMemo(() => analyse(p), [p])
  const shaft = useRef<THREE.Group>(null)
  const plate = useRef<THREE.Group>(null)
  const phase = useRef(0)
  useResetOnChange(balanceRun, JSON.stringify([p.rows, p.correction, p.rpm, p.rb]))
  useRunDriver(
    balanceRun,
    BALANCE_PROC,
    (f) => {
      live.f = f
    },
    (step, f) => {
      const st = useBalance.getState()
      const q = analyse(st)
      const rpm = st.rpm * f
      const w = (rpm * 2 * Math.PI) / 60
      balanceRun.getState().log([rpm, instrument(q.leftMr * w * w, 0.02, step), instrument(q.couple * w * w, 0.02, step + 30)])
    },
  )

  const geo = useMemo(
    () => ({
      shaft: xform(cylinder(0.018, LEN + 0.12, 32), along),
      collar: xform(tube(0.044, 0.018, 0.05, 32), along),
      base: xform(box(LEN + 0.26, 0.022, 0.42), mat4.t(0, -0.24, 0)),
      housing: merge(...[0, LEN].map((x) => merge(xform(box(0.07, 0.2, 0.1), mat4.t(X0 + x, -0.13, 0)), xform(tube(0.048, 0.018, 0.08, 32), mat4.c(mat4.t(X0 + x, 0, 0), along))))),
      springs: merge(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => xform(cylinder(0.026, FLOOR * -1 - 0.26, 16), mat4.t((sx * (LEN + 0.12)) / 2, (FLOOR - 0.25) / 2, (sz * 0.16)))))),
      floor: xform(box(LEN + 0.4, 0.024, 0.56), mat4.t(0, FLOOR + 0.012, 0)),
      pulley: xform(cylinder(0.06, 0.03, 40), mat4.c(mat4.t(X0 - 0.06, 0, 0), along)),
    }),
    [],
  )
  const masses = useMemo(() => p.rows.map((r) => massGeo(r.r, r.m, r.angle)), [p.rows])
  const corrections = useMemo(
    () =>
      a.added.map((q) => {
        const scale = (q.m * q.r * 1000) / Math.max(p.rb, 1)
        return { z: q.z ?? 0, geo: massGeo(p.rb, Math.max(0.3, scale), (q.angle * 180) / Math.PI) }
      }),
    [a.added, p.rb],
  )

  useSimFrame((dt) => {
    const st = useBalance.getState()
    // at full speed while interactive; a test brings it up from rest
    if (balanceRun.getState().status === 'idle') live.f = 1
    const w = ((st.rpm * live.f * 2 * Math.PI) / 60)
    phase.current += w * dt
    const t = phase.current
    live.theta = t
    shaft.current?.rotation.set(t, 0, 0)
    // the plate on its springs shakes in line with the out-of-balance force, and rocks with the couple
    const shake = Math.min(0.012, a.leftMr * w * w * 2e-5 * 0.05)
    const rock = Math.min(0.025, a.couple * w * w * 2e-5 * 0.25)
    if (plate.current) {
      plate.current.position.y = shake * Math.sin(t + a.leftAngle)
      plate.current.position.z = shake * Math.cos(t + a.leftAngle)
      plate.current.rotation.z = rock * Math.sin(t)
    }
  })

  return (
    <group>
      <Part id="floor" name="Bench" role="static" material="paintGrey" info={{ summary: 'What the plate stands on.', role: 'Anything left unbalanced would be passed into it through the springs.' }} cut={false}>
        <PartMesh geometry={geo.floor} />
        <PartMesh geometry={geo.springs} material="rubber" />
      </Part>
      <group ref={plate}>
        <Part id="plate" name="Sprung plate and bearings" role="static" material="aluminium" info={{ summary: 'Carries the shaft on resilient feet.', role: 'Free to vibrate, so out-of-balance shows up as visible shaking and rocking.' }} cut={false}>
          <PartMesh geometry={geo.base} />
          <PartMesh geometry={geo.housing} material="castIron" />
        </Part>
        <group ref={shaft}>
          <Part id="shaft" name="Shaft" role="moving" material="chrome" info={{ summary: 'Runs in ball bearings, belt-driven.', role: 'Carries the out-of-balance blocks and turns them about its own axis.' }}>
            <PartMesh geometry={geo.shaft} />
            <PartMesh geometry={geo.pulley} material="paintGrey" />
          </Part>
          {p.rows.map((r, i) => (
            <group key={i} position={[X0 + r.z * MM, 0, 0]}>
              <Part id={`mass-${i}`} name={`Block ${i + 1}`} role="moving" material="paintOrange" info={{ summary: 'A block with an eccentric disc.', role: 'Its out-of-balance is m r: a bigger disc or a larger radius. At speed the force is m r ω².' }} explode={[0, 0, 0.14]}>
                <PartMesh geometry={geo.collar} material="steelDark" />
                <PartMesh geometry={masses[i]} />
              </Part>
            </group>
          ))}
          {corrections.map((c, i) => (
            <group key={i} position={[X0 + c.z * 1000 * MM, 0, 0]}>
              <Part id={`balance-${i}`} name={`Balance mass ${i + 1}`} role="moving" material="paintGreen" info={{ summary: 'The correction.', role: 'Set opposite the resultant: one mass cancels the force, but it takes two planes to cancel the couple as well.' }}>
                <PartMesh geometry={geo.collar} material="steelDark" />
                <PartMesh geometry={c.geo} />
              </Part>
            </group>
          ))}
        </group>
      </group>
      <PartLabel partId="plate" at={[X0 - 0.12, -0.2, 0.2]} />
      <PartLabel partId="shaft" at={[X0 + LEN + 0.1, 0.05, 0.05]} />
    </group>
  )
}
