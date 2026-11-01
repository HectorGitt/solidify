import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, helixSpring, mat4, merge, tube, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { placeBetween, unitRod } from '../_shared/strut'
import { equilibrium, live, useGov } from './model'

export const FLOOR = -0.52
const SCALE = 0.0022
const TOP = 0.44
/** Hartnell: how far under the head the bell cranks are hung */
const PIVOT_DROP = 0.3

/** one side of the mechanism, in the x–y plane of the spindle, mirrored by side = ±1 */
function Side({ side, refs }: { side: 1 | -1; refs: { upper: React.RefObject<THREE.Group | null>; lower: React.RefObject<THREE.Group | null>; ball: React.RefObject<THREE.Group | null> } }) {
  const arm = useMemo(() => unitRod(0.009), [])
  const ballGeo = useMemo(() => new THREE.SphereGeometry(0.05, 36, 24), [])
  const key = side > 0 ? 'r' : 'l'
  return (
    <>
      <group ref={refs.upper}>
        <Part id={`upper-${key}`} name={side > 0 ? 'Upper arm (right)' : 'Upper arm (left)'} role="moving" material="steel" info={{ summary: 'Hangs the ball from the spindle head.', role: 'Its lean sets the height of the ball above the sleeve.' }} cut={false}>
          <PartMesh geometry={arm} />
        </Part>
      </group>
      <group ref={refs.lower}>
        <Part id={`lower-${key}`} name={side > 0 ? 'Lower arm (right)' : 'Lower arm (left)'} role="moving" material="steel" info={{ summary: 'Joins the ball to the sleeve.', role: 'As the ball rises it lifts the sleeve, which moves the throttle.' }} cut={false}>
          <PartMesh geometry={arm} />
        </Part>
      </group>
      <group ref={refs.ball}>
        <Part id={`ball-${key}`} name={side > 0 ? 'Ball (right)' : 'Ball (left)'} role="moving" material="chrome" info={{ summary: 'A rotating mass.', role: 'Pulled outward by the speed, pulled inward by the load or spring. It rests where they balance.' }} cut={false}>
          <PartMesh geometry={ballGeo} />
        </Part>
      </group>
    </>
  )
}

export function Governor3D() {
  const kind = useGov((s) => s.kind)
  const offsetMm = useGov((s) => s.offset)
  const armMm = useGov((s) => s.arm)
  const spin = useRef<THREE.Group>(null)
  const sleeve = useRef<THREE.Group>(null)
  const spring = useRef<THREE.Group>(null)
  const refs = {
    r: { upper: useRef<THREE.Group>(null), lower: useRef<THREE.Group>(null), ball: useRef<THREE.Group>(null) },
    l: { upper: useRef<THREE.Group>(null), lower: useRef<THREE.Group>(null), ball: useRef<THREE.Group>(null) },
  }
  const phase = useRef(0)
  const geo = useMemo(
    () => ({
      spindle: xform(cylinder(0.014, TOP - FLOOR + 0.04, 28), mat4.t(0, (TOP + FLOOR) / 2, 0)),
      head: xform(box(0.2, 0.024, 0.05), mat4.t(0, TOP, 0)),
      base: merge(xform(box(0.5, 0.04, 0.4), mat4.t(0, FLOOR + 0.02, 0)), xform(cylinder(0.05, 0.12, 28), mat4.t(0, FLOOR + 0.1, 0))),
      sleeve: tube(0.03, 0.015, 0.05, 32),
      load: tube(0.09, 0.015, 0.09, 48),
      collar: xform(tube(0.11, 0.095, 0.012, 48), mat4.t(0, 0, 0)),
      spring: helixSpring(0.032, 0.005, 0.2, 7),
      bracket: merge(xform(box(0.62, 0.024, 0.05), mat4.t(0, TOP, 0)), ...[-1, 1].map((s) => xform(box(0.02, PIVOT_DROP, 0.03), mat4.t(s * 0.264, TOP - PIVOT_DROP / 2, 0)))),
    }),
    [],
  )

  useSimFrame((dt) => {
    const p = useGov.getState()
    phase.current += ((p.rpm * 2 * Math.PI) / 60) * dt
    live.theta = phase.current
    spin.current?.rotation.set(0, phase.current, 0)
    const s = equilibrium(p)
    const armLen = p.arm * SCALE
    for (const [side, q] of [[1, refs.r], [-1, refs.l]] as [1 | -1, typeof refs.r][]) {
      if (p.kind === 'hartnell') {
        // the bell crank: pivoted on a hanger, the ball arm down and the sleeve arm in towards the spindle
        const a = p.a * SCALE
        const b = p.b * SCALE
        const px = p.r0 * SCALE
        const py = TOP - PIVOT_DROP
        const pivot: [number, number, number] = [side * px, py, 0]
        const ball: [number, number, number] = [side * (px + a * Math.sin(s.alpha)), py - a * Math.cos(s.alpha), 0]
        const toSleeve: [number, number, number] = [side * (px - b * Math.cos(s.alpha)), py + b * Math.sin(s.alpha), 0]
        placeBetween(q.upper.current, pivot, ball)
        placeBetween(q.lower.current, pivot, toSleeve)
        q.ball.current?.position.set(...ball)
        if (side === 1) {
          sleeve.current?.position.set(0, toSleeve[1], 0)
          // the spring presses down on the sleeve from a collar under the head
          const top = TOP - 0.02
          const len = top - toSleeve[1] - 0.025
          if (spring.current) {
            spring.current.position.set(0, toSleeve[1] + 0.025 + len / 2, 0)
            spring.current.scale.set(1, len / 0.2, 1)
          }
        }
        continue
      }
      const off = p.kind === 'watt' ? 0 : p.offset * SCALE
      const sin = Math.sin(s.alpha)
      const cos = Math.cos(s.alpha)
      const top: [number, number, number] = [side * off, TOP, 0]
      const ball: [number, number, number] = [side * (off + armLen * sin), TOP - armLen * cos, 0]
      const sleeveY = p.kind === 'watt' ? ball[1] - 0.09 : TOP - 2 * armLen * cos
      const low: [number, number, number] = [side * (off + 0.02), sleeveY, 0]
      placeBetween(q.upper.current, top, ball)
      if (p.kind === 'watt') placeBetween(q.lower.current, ball, [side * 0.02, sleeveY, 0])
      else placeBetween(q.lower.current, ball, low)
      q.ball.current?.position.set(...ball)
      if (side === 1) sleeve.current?.position.set(0, sleeveY, 0)
    }
  })

  void offsetMm
  void armMm
  return (
    <group>
      <Part id="base" name="Base and drive" role="static" material="castIron" info={{ summary: 'Carries the spindle.', role: 'The spindle is driven from the engine, so it runs at a fixed multiple of engine speed.' }} cut={false}>
        <PartMesh geometry={geo.base} />
      </Part>
      <group ref={spin}>
        <Part id="spindle" name="Spindle" role="moving" material="chrome" info={{ summary: 'Turns the whole governor.', role: 'Its speed is what the governor measures.' }}>
          <PartMesh geometry={geo.spindle} />
          <PartMesh geometry={geo.head} material="steelDark" />
          {kind === 'hartnell' ? <PartMesh geometry={geo.bracket} material="steelDark" /> : null}
        </Part>
        <Side side={1} refs={refs.r} />
        <Side side={-1} refs={refs.l} />
        <group ref={sleeve}>
          <Part id="sleeve" name="Sleeve" role="moving" material="brass" info={{ summary: 'Slides on the spindle.', role: 'Its height is the governor’s output: it moves the throttle through a lever.' }}>
            <PartMesh geometry={geo.sleeve} />
          </Part>
          {kind === 'porter' ? (
            <Part id="load" name="Central load" role="moving" material="castIron" info={{ summary: 'The heavy weight on the sleeve.', role: 'It adds to the downward pull, so the governor runs faster and acts more strongly than a Watt with the same balls.' }}>
              <group position={[0, -0.07, 0]}>
                <PartMesh geometry={geo.load} />
              </group>
            </Part>
          ) : null}
        </group>
        {kind === 'hartnell' ? (
          <group ref={spring}>
            <Part id="spring" name="Spring" role="moving" material="steelDark" info={{ summary: 'Presses down on the sleeve.', role: 'Replaces a central load: much stronger for its size, and it works in any position.' }} cut={false}>
              <PartMesh geometry={geo.spring} />
            </Part>
          </group>
        ) : null}
      </group>
      <PartLabel partId="sleeve" at={[0.12, -0.2, 0.08]} />
      <PartLabel partId="spindle" at={[0.03, TOP + 0.08, 0]} />
    </group>
  )
}
