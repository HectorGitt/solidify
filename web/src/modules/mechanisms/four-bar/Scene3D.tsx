import { Line } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, mat4, merge, roundedBox, tube, xform } from '@/geometry'
import { instrument, useAutoRun, useRunDriver } from '@/lab/run'
import { classify, sweep } from '@/physics/fourbar'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { CM, FOUR_BAR_PROC, crankAt, deg, fourBarRun, lengths, live, rad, solve, sweepAngle, useFourBar } from './model'

const WIDTH = 0.028
const THICK = 0.007
/** the bars ride in layers off the board, so they pass over one another */
const Z = { frame: 0.006, rocker: 0.014, coupler: 0.022, crank: 0.03 }
const axial = mat4.rx(Math.PI / 2)
export const FLOOR = -0.24

/** a flat steel bar from its pivot along +x, drilled every centimetre like the rig's links */
function barGeometry(lengthCm: number) {
  const L = lengthCm * CM
  const r = WIDTH / 2
  const s = new THREE.Shape()
  s.moveTo(0, -r)
  s.lineTo(L, -r)
  s.absarc(L, 0, r, -Math.PI / 2, Math.PI / 2, false)
  s.lineTo(0, r)
  s.absarc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false)
  for (let cm = 0; cm <= Math.floor(lengthCm + 1e-6); cm += 1) {
    const h = new THREE.Path()
    h.absarc(cm * CM, 0, 0.0028, 0, Math.PI * 2, true)
    s.holes.push(h)
  }
  return extrude(s, THICK, { curveSegments: 12 })
}

/** the rig's pegboard: a grid of dark holes on the plate */
function Pegs() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.CircleGeometry(0.0032, 12), [])
  const N = { x: 34, y: 23 }
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const d = new THREE.Object3D()
    for (let i = 0; i < N.x * N.y; i++) {
      d.position.set((i % N.x) * 0.02 - ((N.x - 1) * 0.02) / 2, Math.floor(i / N.x) * 0.02 - ((N.y - 1) * 0.02) / 2, -0.0058)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [N.x, N.y])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, N.x * N.y]} frustumCulled={false}>
      <meshStandardMaterial color="#20262b" roughness={0.9} />
    </instancedMesh>
  )
}

function Link({ id, name, lengthCm, z, material, info, angle, at, children, explodeZ }: { id: string; name: string; lengthCm: number; z: number; material: 'steel' | 'paintGrey' | 'paintRed' | 'paintBlue' | 'paintOrange'; info: { summary: string; role: string }; angle: React.RefObject<THREE.Group | null>; at?: [number, number]; children?: ReactNode; explodeZ: number }) {
  const geo = useMemo(() => barGeometry(lengthCm), [lengthCm])
  return (
    <group ref={angle} position={[at?.[0] ?? 0, at?.[1] ?? 0, z]}>
      <Part id={id} name={name} role="moving" material={material} info={info} explode={[0, 0, explodeZ]}>
        <PartMesh geometry={geo} />
        {children}
      </Part>
    </group>
  )
}

/** a protractor behind the output lever's pivot, ticked every 10° */
function Protractor() {
  const geo = useMemo(() => {
    const ring = xform(tube(0.13, 0.098, 0.002, 96), axial)
    const ticks = Array.from({ length: 36 }, (_, i) => {
      const a = (i * Math.PI) / 18
      const long = i % 3 === 0
      const len = long ? 0.022 : 0.012
      const m = mat4.c(mat4.rz(a), mat4.t(0.127 - len / 2, 0, 0.0014))
      return xform(box(len, 0.0016, 0.0012), m)
    })
    return { ring, ticks: merge(...ticks) }
  }, [])
  return (
    <Part id="protractor" name="Protractor" role="static" material="plastic" info={{ summary: 'Scale behind the output pivot.', role: 'Reads the output lever’s angle, so its swing can be measured for each set-up.' }} cut={false} explode={[0, 0, -0.04]}>
      <PartMesh geometry={geo.ring} />
      <PartMesh geometry={geo.ticks} material="paintBlack" />
    </Part>
  )
}

const pin = () => xform(cylinder(0.0055, 0.04, 20), mat4.c(mat4.t(0, 0, 0.016), axial))
const head = () => xform(cylinder(0.0095, 0.004, 24), mat4.c(mat4.t(0, 0, 0.0365), axial))

export function FourBar3D() {
  const frame = useFourBar((s) => s.frame)
  const crank = useFourBar((s) => s.crank)
  const coupler = useFourBar((s) => s.coupler)
  const rocker = useFourBar((s) => s.rocker)
  const branch = useFourBar((s) => s.branch)
  const trace = useFourBar((s) => s.trace)
  const l = useMemo(() => ({ frame, crank, coupler, rocker }), [frame, crank, coupler, rocker])

  const refs = {
    crank: useRef<THREE.Group>(null),
    coupler: useRef<THREE.Group>(null),
    rocker: useRef<THREE.Group>(null),
    pinB: useRef<THREE.Group>(null),
    pinC: useRef<THREE.Group>(null),
    mid: useRef<THREE.Mesh>(null),
  }
  const phase = useRef(0.6)
  const testAngle = useRef(0)
  useAutoRun(fourBarRun, JSON.stringify([frame, crank, coupler, rocker, branch]))
  useRunDriver(
    fourBarRun,
    FOUR_BAR_PROC,
    (f) => {
      testAngle.current = sweepAngle(lengths(useFourBar.getState()), f)
    },
    (step, f) => {
      const st = useFourBar.getState()
      const cur = lengths(st)
      const t = sweepAngle(cur, f)
      const q = solve(cur, t, st.branch)
      if (q) fourBarRun.getState().log([deg(t), instrument(deg(q.theta4), 0.002, step), instrument(deg(q.gamma), 0.003, step + 50)])
    },
  )

  const geo = useMemo(
    () => ({
      board: xform(roundedBox(0.72, 0.5, 0.012, 0.012), mat4.t(0, 0, -0.012)),
      feet: merge(...[-0.24, 0.24].map((x) => xform(box(0.05, 0.016, 0.16), mat4.t(x, FLOOR + 0.008, -0.012))), ...[-0.24, 0.24].map((x) => xform(box(0.03, 0.02, 0.012), mat4.t(x, FLOOR + 0.022, -0.012)))),
      pin: merge(pin(), head()),
      ball: new THREE.SphereGeometry(0.009, 20, 14),
    }),
    [],
  )

  // the point at the middle of the coupler traces the linkage's coupler curve
  const curve = useMemo(() => {
    if (classify(l).kind === 'impossible') return null
    const pts: [number, number, number][] = []
    const s = sweep(l, 241)
    for (const q of s) {
      const p = solve(l, rad(q.theta2), branch)
      if (p) pts.push([((p.B[0] + p.C[0]) / 2) * CM, ((p.B[1] + p.C[1]) / 2) * CM, Z.crank + 0.006])
    }
    return pts.length > 2 ? pts : null
  }, [l, branch])

  useSimFrame((dt) => {
    const st = useFourBar.getState()
    const cur = lengths(st)
    phase.current += (st.rpm * 2 * Math.PI * dt) / 60
    // during a test the crank is set by hand, a step at a time; otherwise it runs
    const theta = fourBarRun.getState().status === 'running' ? testAngle.current : crankAt(cur, phase.current)
    const p = solve(cur, theta, st.branch)
    live.theta = theta
    live.pose = p
    if (!p) return
    refs.crank.current?.rotation.set(0, 0, p.theta2)
    refs.pinB.current?.position.set(p.B[0] * CM, p.B[1] * CM, 0)
    refs.coupler.current?.position.set(p.B[0] * CM, p.B[1] * CM, Z.coupler)
    refs.coupler.current?.rotation.set(0, 0, p.theta3)
    refs.rocker.current?.rotation.set(0, 0, p.theta4)
    refs.pinC.current?.position.set(p.C[0] * CM, p.C[1] * CM, 0)
    refs.mid.current?.position.set(((p.B[0] + p.C[0]) / 2) * CM, ((p.B[1] + p.C[1]) / 2) * CM, Z.crank + 0.006)
  })

  const D = frame * CM
  return (
    <group position={[-D / 2, 0, 0]}>
      <group position={[D / 2, 0, 0]}>
        <Part id="board" name="Baseboard" role="static" material="aluminium" info={{ summary: 'The rig’s upright pegboard.', role: 'Holds the fixed pivots at the frame length and carries the protractor.' }} cut={false} explode={[0, 0, -0.1]}>
          <PartMesh geometry={geo.board} />
          <PartMesh geometry={geo.feet} material="paintGrey" />
          <Pegs />
        </Part>
      </group>
      <Link id="frame" name="Frame (link 1)" lengthCm={frame} z={Z.frame} material="paintGrey" angle={useRef(null)} explodeZ={-0.03} info={{ summary: 'The fixed link, A to D.', role: 'The frame of reference: every other motion is measured from it. Fixing a different link of the same chain gives a different mechanism, an inversion.' }} />
      <Link id="crank" name="Crank (link 2)" lengthCm={crank} z={Z.crank} material="paintOrange" angle={refs.crank} explodeZ={0.03} info={{ summary: 'The driver, turned about A.', role: 'The input. It turns right round only if Grashof’s law lets it.' }} />
      <Link id="rocker" name="Output lever (link 4)" lengthCm={rocker} z={Z.rocker} at={[D, 0]} material="paintBlue" angle={refs.rocker} explodeZ={0.03} info={{ summary: 'The driven link, about D.', role: 'The output. Its angle to the coupler is the transmission angle, the measure of how well force gets through.' }} />
      <Link id="coupler" name="Coupler (link 3)" lengthCm={coupler} z={Z.coupler} material="paintRed" angle={refs.coupler} explodeZ={0.06} info={{ summary: 'The connecting rod, B to C.', role: 'Carries force from crank to output lever. Each point on it traces its own coupler curve.' }} />
      <group position={[D, 0, 0]}>
        <Protractor />
      </group>
      <Part id="pins" name="Pivot pins" role="moving" material="chrome" info={{ summary: 'Four turning pairs: A, B, C and D.', role: 'Each pin allows one link to turn on the next and nothing else, so the chain has one degree of freedom.' }} cut={false} explode={[0, 0, 0.1]}>
        <PartMesh geometry={geo.pin} />
        <group position={[D, 0, 0]}>
          <PartMesh geometry={geo.pin} />
        </group>
        <group ref={refs.pinB}>
          <PartMesh geometry={geo.pin} />
        </group>
        <group ref={refs.pinC}>
          <PartMesh geometry={geo.pin} />
        </group>
      </Part>
      {trace && curve ? (
        <>
          <Line points={curve} color="#d0631c" lineWidth={2} />
          <mesh ref={refs.mid} geometry={geo.ball}>
            <meshBasicMaterial color="#d0631c" toneMapped={false} />
          </mesh>
        </>
      ) : null}
      <PartLabel partId="crank" at={[0, 0.05, 0.05]} />
      <PartLabel partId="rocker" at={[D, 0.05, 0.05]} />
      <PartLabel partId="frame" at={[D / 2, -0.05, 0.03]} />
      <PartLabel partId="protractor" at={[D + 0.13, -0.04, 0.02]} />
    </group>
  )
}
