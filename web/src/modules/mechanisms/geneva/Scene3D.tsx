import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { cylinder, extrude, mat4, merge, xform } from '@/geometry'
import { genevaAngle, genevaHalfEngagement, genevaStep } from '@/physics/linkages'
import { instrument, useAutoRun, useRunDriver } from '@/lab/run'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { BenchPlate, flatBar, polarShape } from '../_shared/rig'
import { CENTRES, GENEVA_PROC, genevaRun, live, pinRadius, useGeneva } from './model'

export const FLOOR = -0.42
const axial = mat4.rx(Math.PI / 2)
const THICK = 0.016
const X0 = -CENTRES / 2 - 0.06

/** the locking disc on the driver: its radius, as a share of the pin radius */
const lockRadius = (a: number) => a * 0.66

/** The star: n slots, and a concave arc between each pair that the driver's locking disc rides on. */
function wheelShape(n: number, closed: boolean) {
  const a = pinRadius(n)
  const c = CENTRES
  const R = Math.sqrt(c * c - a * a) + 0.004
  const lock = lockRadius(a) + 0.0015
  const step = (2 * Math.PI) / n
  const halfWidth = 0.0115
  const bottom = c - a - 0.008
  const s = new THREE.Shape()
  const radiusAt = (phi: number) => {
    // the ray from the wheel centre, against the locking circle centred half way between two slots
    const d = (((phi - step / 2) % step) + step) % step
    const off = d > step / 2 ? d - step : d
    const b = c * Math.cos(off)
    const disc = lock * lock - c * c * Math.sin(off) ** 2
    return disc >= 0 ? Math.min(R, b - Math.sqrt(disc)) : R
  }
  const at = (phi: number, r: number): [number, number] => [r * Math.cos(phi), r * Math.sin(phi)]
  const local = (phi: number, along: number, across: number): [number, number] => [along * Math.cos(phi) - across * Math.sin(phi), along * Math.sin(phi) + across * Math.cos(phi)]
  for (let i = 0; i < n; i++) {
    const phi = i * step
    const edge = Math.asin(halfWidth / R)
    const start = local(phi, radiusAt(phi + edge), -halfWidth)
    if (i === 0) s.moveTo(...start)
    else s.lineTo(...start)
    // a stop has its last slot left solid: the pin can go no further
    if (!(closed && i === n - 1)) {
      s.lineTo(...local(phi, bottom, -halfWidth))
      for (let k = 1; k < 10; k++) {
        const q = (k / 10) * Math.PI
        s.lineTo(...local(phi, bottom - halfWidth * Math.sin(q), -halfWidth * Math.cos(q)))
      }
      s.lineTo(...local(phi, bottom, halfWidth))
    }
    s.lineTo(...local(phi, radiusAt(phi + edge), halfWidth))
    // round the rim to the next slot
    for (let k = 1; k < 40; k++) {
      const q = phi + edge + ((step - 2 * edge) * k) / 40
      s.lineTo(...at(q, radiusAt(q)))
    }
  }
  s.closePath()
  const bore = new THREE.Path()
  bore.absarc(0, 0, 0.016, 0, Math.PI * 2, true)
  s.holes.push(bore)
  return s
}

/** The driver's locking disc, with the relief that lets the wheel turn past while the pin is engaged. */
function lockShape(n: number) {
  const a = pinRadius(n)
  const c = CENTRES
  const R = Math.sqrt(c * c - a * a) + 0.006
  const r0 = lockRadius(a)
  return polarShape((psi) => {
    const cos = Math.cos(psi)
    if (cos <= 0) return r0
    const disc = R * R - c * c * Math.sin(psi) ** 2
    if (disc < 0) return r0
    return Math.max(0.03, Math.min(r0, c * cos - Math.sqrt(disc)))
  }, 240)
}

export function Geneva3D() {
  const slots = useGeneva((s) => s.slots)
  const stop = useGeneva((s) => s.stop)
  const a = pinRadius(slots)
  const refs = { driver: useRef<THREE.Group>(null), wheel: useRef<THREE.Group>(null) }
  const geo = useMemo(
    () => ({
      wheel: extrude(wheelShape(slots, stop), THICK, { curveSegments: 12 }),
      lock: extrude(lockShape(slots), THICK),
      arm: flatBar(a, 0.044, 0.01),
      pin: xform(cylinder(0.0095, 0.03, 24), mat4.c(mat4.t(a, 0, 0.002), axial)),
      shaft: xform(cylinder(0.015, 0.05, 28), mat4.c(mat4.t(0, 0, 0.004), axial)),
      fixed: merge(...[0, CENTRES].map((x) => xform(cylinder(0.03, 0.02, 32), mat4.c(mat4.t(x, 0, -0.016), axial)))),
    }),
    [slots, stop, a],
  )

  const phase = useRef(0)
  useAutoRun(genevaRun, JSON.stringify([slots, stop]))
  useRunDriver(
    genevaRun,
    GENEVA_PROC,
    (f) => {
      phase.current = f * Math.PI
    },
    (step, f) => {
      const n = useGeneva.getState().slots
      const out = (genevaAngle(n, f * Math.PI) * 180) / Math.PI
      genevaRun.getState().log([f * 180, out > 0.01 ? instrument(out, 0.004, step) : 0])
    },
  )
  useSimFrame((dt) => {
    const st = useGeneva.getState()
    if (genevaRun.getState().status !== 'running') phase.current += (st.rpm * 2 * Math.PI * dt) / 60
    // with a stop, the pin comes up against the closed slot after n − 1 steps, and everything stops
    if (st.stop) phase.current = Math.min(phase.current, (st.slots - 1) * 2 * Math.PI - 0.05)
    const t = phase.current
    live.theta = t
    const half = genevaHalfEngagement(st.slots)
    // the pin angle from the line of centres; θ = 0 is the pin entering a slot
    refs.driver.current?.rotation.set(0, 0, t - half)
    // a slot lies along the pin's approach at θ = 0, and the wheel turns the other way
    refs.wheel.current?.rotation.set(0, 0, Math.PI + genevaStep(st.slots) / 2 - genevaAngle(st.slots, t))
  })

  return (
    <group>
      <BenchPlate width={1.26} height={0.8} floor={FLOOR} />
      <group position={[X0, 0, 0]}>
        <Part id="bearings" name="Bearings" role="static" material="steelDark" info={{ summary: 'One for each shaft.', role: 'Hold the shafts at the design centre distance, c = a / sin(π/n).' }} cut={false}>
          <PartMesh geometry={geo.fixed} />
        </Part>
        <group ref={refs.driver} position={[0, 0, 0.014]}>
          <Part id="driver" name="Driver and locking disc" role="moving" material="paintOrange" info={{ summary: 'Turns at steady speed.', role: 'Its curved disc holds the wheel still between steps, and the relief lets the wheel turn while the pin is in a slot.' }} explode={[0, 0, 0.03]}>
            <PartMesh geometry={geo.lock} />
            <group position={[0, 0, 0.012]}>
              <PartMesh geometry={geo.arm} material="steel" />
            </group>
          </Part>
          <Part id="pin" name="Driving pin" role="moving" material="chrome" info={{ summary: 'Enters a slot on the tangent.', role: 'It meets the slot square-on to the wheel’s radius, so the wheel starts from rest: this is why the shock of engagement is small.' }} explode={[0, 0, 0.06]}>
            <PartMesh geometry={geo.pin} />
          </Part>
          <PartMesh geometry={geo.shaft} material="chrome" />
        </group>
        <group ref={refs.wheel} position={[CENTRES, 0, 0.014]}>
          <Part id="wheel" name="Geneva wheel" role="moving" material="paintBlue" info={{ summary: 'The stepping output.', role: 'Moves one slot, 360°/n, for each driver turn, and is locked between steps.' }} explode={[0, 0, -0.03]}>
            <PartMesh geometry={geo.wheel} />
            <PartMesh geometry={geo.shaft} material="chrome" />
          </Part>
        </group>
        <PartLabel partId="driver" at={[-0.02, -a - 0.05, 0.06]} />
        <PartLabel partId="wheel" at={[CENTRES + 0.12, 0.25, 0.06]} />
      </group>
    </group>
  )
}
