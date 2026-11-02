import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { useResetOnChange, useRunDriver } from '@/lab/run'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { placeBetween, unitRod } from '../_shared/strut'
import { INERTIA_PROC, REACTION, conditionsOf, inertiaRun, live, truePeriod, useInertia } from './model'

export const FLOOR = -1.02
const TOP = 0.86
const axial = mat4.rx(Math.PI / 2)
/** how far the rig is set swinging */
const SWING = 0.16
const TWIST = 0.42

export function Inertia3D() {
  const p = useInertia()
  const swing = useRef<THREE.Group>(null)
  const plat = useRef<THREE.Group>(null)
  const wires = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const pendulum = p.mode === 'pendulum'
  const n = p.mode === 'trifilar' ? 3 : 2

  const gantry = useMemo(() => {
    const post = (x: number) => xform(box(0.07, TOP - FLOOR, 0.07), mat4.t(x, (TOP + FLOOR) / 2, 0))
    const foot = (x: number) => xform(box(0.1, 0.03, 0.7), mat4.t(x, FLOOR + 0.015, 0))
    return merge(post(-0.75), post(0.75), foot(-0.75), foot(0.75), xform(box(1.57, 0.07, 0.09), mat4.t(0, TOP + 0.035, 0)))
  }, [])
  const bar = useMemo(() => {
    // the bar hangs from a knife-edge; holes down it give the different pivot distances
    return merge(xform(box(0.06, p.length, 0.03), mat4.t(0, -p.h, 0)))
  }, [p.length, p.h])
  const knife = useMemo(() => xform(cylinder(0.012, 0.12, 20), axial), [])
  const platform = useMemo(() => xform(cylinder(p.r * 1.1, 0.014, 72), mat4.t(0, -0.007, 0)), [p.r])
  const block = useMemo(() => xform(cylinder(p.rBlock, 0.07, 56), mat4.t(0, 0.035, 0)), [p.rBlock])
  const ring = useMemo(() => tube(p.r * 1.1 + 0.002, p.r * 1.1 - 0.012, 0.016, 72), [p.r])
  const rod = useMemo(() => unitRod(0.0028), [])

  const platY = TOP - p.L
  useResetOnChange(inertiaRun, conditionsOf(p))
  useRunDriver(
    inertiaRun,
    INERTIA_PROC,
    (f) => {
      // the stopwatch runs on through each set of 20
      const within = (f * INERTIA_PROC.steps) % 1
      const T = truePeriod(useInertia.getState())
      live.watch = within * 20 * T
      live.swings = Math.floor(within * 20)
    },
    (step) => {
      const T = truePeriod(useInertia.getState()) * (1 + REACTION[(step - 1) % REACTION.length])
      live.watch = 20 * T
      live.swings = 20
      inertiaRun.getState().log([step, 20 * T, T])
    },
  )

  useSimFrame((_dt, t) => {
    const st = useInertia.getState()
    live.t = t
    const T = truePeriod(st)
    const a = Math.cos((2 * Math.PI * t) / T)
    if (st.mode === 'pendulum') {
      swing.current?.rotation.set(0, 0, SWING * a)
      return
    }
    const th = TWIST * a
    plat.current?.rotation.set(0, th, 0)
    const count = st.mode === 'trifilar' ? 3 : 2
    for (let i = 0; i < count; i++) {
      const phi = (i * 2 * Math.PI) / count
      placeBetween(wires[i].current, [st.r * Math.cos(phi), TOP, st.r * Math.sin(phi)], [st.r * Math.cos(phi - th), TOP - st.L, st.r * Math.sin(phi - th)])
    }
  })

  return (
    <group>
      <Part id="gantry" name="Support frame" role="static" material="paintGrey" info={{ summary: 'A rigid frame to hang things from.', role: 'It must not move: any give in the top adds its own swing to the reading.' }} cut={false} explode={[0, 0, -0.25]}>
        <PartMesh geometry={gantry} />
      </Part>
      {pendulum ? (
        <group position={[0, TOP - 0.04, 0]} ref={swing}>
          <Part id="pendulum" name="Pendulum bar" role="moving" material="steel" info={{ summary: 'A uniform bar hung off-centre.', role: 'A compound pendulum. Timing its swing gives its inertia about the pivot: I = m g h (T/2π)².' }}>
            <PartMesh geometry={bar} />
          </Part>
          <Part id="knife" name="Knife-edge pivot" role="static" material="chrome" info={{ summary: 'The pivot.', role: 'Very nearly frictionless, so the swing dies away slowly and 20 can be counted.' }} cut={false}>
            <PartMesh geometry={knife} />
          </Part>
        </group>
      ) : (
        <>
          <Part id="wires" name={n === 3 ? 'Three wires' : 'Two wires'} role="moving" material="chrome" info={{ summary: 'Equal, parallel, at radius r from the axis.', role: 'When the platform twists they lean, which lifts it slightly. Gravity then swings it back: that is the restoring torque.' }} cut={false}>
            {wires.slice(0, n).map((w, i) => (
              <mesh key={i} ref={w} geometry={rod}>
                <meshStandardMaterial color="#d7dde2" metalness={0.8} roughness={0.3} />
              </mesh>
            ))}
          </Part>
          <group position={[0, platY, 0]} ref={plat}>
            <Part id="platform" name="Platform" role="moving" material="aluminium" info={{ summary: 'Takes bodies that cannot be swung on their own.', role: 'Time it empty, then with the body on. The difference in inertia is the body’s.' }}>
              <PartMesh geometry={platform} />
              <PartMesh geometry={ring} material="steelDark" />
            </Part>
            {p.block ? (
              <Part id="block" name="Test block" role="moving" material="castIron" info={{ summary: 'The body being measured.', role: 'Its centre of gravity must be set exactly on the axis, or it adds a swing of its own.' }}>
                <PartMesh geometry={block} />
              </Part>
            ) : null}
          </group>
        </>
      )}
      {pendulum ? <PartLabel partId="pendulum" at={[0.08, TOP - p.h, 0.04]} /> : <PartLabel partId="platform" at={[p.r * 1.1 + 0.05, platY, 0]} />}
    </group>
  )
}
