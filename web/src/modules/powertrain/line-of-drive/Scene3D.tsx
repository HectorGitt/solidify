import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, roundedBox } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { AXLE_Y, DRIVE_Y, FRONT_Y, PTO_Y, REAR_Z } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { CROWN_RATIO, FINAL_RATIO, FRONT_LEAD, PTO_RATIO, gearboxRatio, live, solve, useDrive } from './model'

const TAU = Math.PI * 2

/** Force arrow along +X (or −X) whose length follows a value each frame. */
function Arrow({ origin, dir, color, value, scale }: { origin: [number, number, number]; dir: 1 | -1; color: string; value: () => number; scale: number }) {
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const g = ref.current
    if (!g) return
    const L = Math.max(0.001, value() * scale)
    g.scale.set(L, 1, 1)
    g.visible = value() > 1e-3
  })
  const shaft = useMemo(() => {
    const c = new THREE.CylinderGeometry(0.018, 0.018, 1, 12)
    c.rotateZ(-Math.PI / 2)
    c.translate(0.5, 0, 0)
    return c
  }, [])
  const head = useMemo(() => {
    const c = new THREE.ConeGeometry(0.05, 0.12, 16)
    c.rotateZ(-Math.PI / 2)
    return c
  }, [])
  const tip = useRef<THREE.Mesh>(null)
  useSimFrame(() => {
    if (tip.current) tip.current.position.x = Math.max(0.001, value() * scale) + 0.06
  })
  return (
    <group position={origin} rotation={[0, dir < 0 ? Math.PI : 0, 0]}>
      <group ref={ref}>
        <mesh geometry={shaft}>
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={tip} geometry={head}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Soil strip with marks that move past at the true travel speed V (wheel surface moves at V0). */
function Ground() {
  const marks = useRef<THREE.InstancedMesh>(null)
  const N = 48
  const span = 6
  const off = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const strip = useMemo(() => {
    const g = box(span, 0.02, 2.2)
    g.translate(0.4, -0.012, 0)
    return g
  }, [])
  const markGeo = useMemo(() => new THREE.BoxGeometry(0.05, 0.006, 0.34), [])
  useSimFrame((dt) => {
    off.current = (off.current + live.V * dt) % (span / (N / 2))
    const m = marks.current
    if (!m) return
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1
      const k = Math.floor(i / 2)
      const x = 0.4 + span / 2 - ((k * span) / (N / 2) + off.current)
      dummy.position.set(x, 0.0, side * REAR_Z)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <Part id="ground" name="Soil" role="static" material="soil" info={{ summary: 'Field surface.', role: 'The tread marks move past at the true speed V; the tyre surface moves at V0. The difference is wheelslip, i = (V0 − V)/V0.' }} cites={[SRC.mech502('eq 2.5–2.6')]} cut={false}>
      <PartMesh geometry={strip} />
      <instancedMesh ref={marks} args={[markGeo, undefined, N]} frustumCulled={false}>
        <meshStandardMaterial color="#3e2c1f" roughness={1} />
      </instancedMesh>
    </Part>
  )
}

/** Front-wheel-assist driveline (shown only in 4WD). */
function FrontDrive() {
  const shaft = useRef<THREE.Group>(null)
  const prop = useMemo(() => {
    const c = cylinder(0.025, 1.3, 16)
    c.rotateZ(-Math.PI / 2)
    return c
  }, [])
  const diff = useMemo(() => roundedBox(0.2, 0.16, 0.22, 0.04), [])
  const transfer = useMemo(() => box(0.12, 0.14, 0.14), [])
  useSimFrame(() => {
    // propeller shaft runs at gearbox-output (bevel pinion) speed, geared ≈ 3 % fast
    if (shaft.current) shaft.current.rotation.x = pose.rearAngle * FINAL_RATIO * CROWN_RATIO * FRONT_LEAD
  })
  return (
    <Part id="front-drive" name="Front-wheel drive" role="static" material="castIron" info={{ summary: 'Front-wheel assist (MFWD) driveline.', role: 'A transfer drive under the gearbox sends part of the power forward through a propeller shaft to a front differential, so the front wheels pull too. The front axle is geared slightly faster (≈ 1–5 % lead) to avoid wind-up.', details: 'The notes compare 2WD, MFWD and 4WD efficiencies (Lecture27 Fig. 47) but do not describe the front driveline.' }} cites={[SRC.l27('Fig. 47, axle power delivery efficiency')]} beyondNotes>
      <PartMesh geometry={transfer} position={[0.36, 0.3, 0.12]} />
      <PartMesh geometry={diff} position={[TRACTOR.wheelbase - 0.16, FRONT_Y + 0.02, 0.12]} />
      <Part id="front-prop" name="Front propeller shaft" role="moving" material="steel">
        <group ref={shaft} position={[1.05, 0.3, 0.12]}>
          <PartMesh geometry={prop} />
        </group>
      </Part>
    </Part>
  )
}

export const pose = createTractorPose({ hitchHeight: 0.6 })

export function Scene3D() {
  const drive = useDrive((s) => s.drive)
  const flow = useDrive((s) => s.flow)
  const curves = useMemo(() => {
    const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
    const main = new THREE.CatmullRomCurve3([v(1.62, DRIVE_Y), v(0.8, DRIVE_Y), v(0.5, DRIVE_Y), v(0.47, DRIVE_Y - 0.08), v(0.42, DRIVE_Y - 0.15), v(0.32, DRIVE_Y - 0.15), v(0.29, DRIVE_Y - 0.06), v(0.2, DRIVE_Y), v(0.06, DRIVE_Y)], false, 'centripetal')
    const left = new THREE.CatmullRomCurve3([v(0.04, AXLE_Y, 0.02), v(0, AXLE_Y, 0.15), v(0, AXLE_Y, REAR_Z)])
    const right = new THREE.CatmullRomCurve3([v(0.04, AXLE_Y, -0.02), v(0, AXLE_Y, -0.15), v(0, AXLE_Y, -REAR_Z)])
    const pto = new THREE.CatmullRomCurve3([v(0.62, DRIVE_Y), v(0.55, DRIVE_Y - 0.08), v(0.5, PTO_Y), v(0, PTO_Y), v(-0.3, PTO_Y)], false, 'centripetal')
    const front = new THREE.CatmullRomCurve3([v(0.36, 0.42, 0.12), v(0.4, 0.3, 0.12), v(1.0, 0.3, 0.12), v(1.7, 0.3, 0.12), v(TRACTOR.wheelbase - 0.16, FRONT_Y, 0.12), v(TRACTOR.wheelbase, FRONT_Y, 0.6)], false, 'centripetal')
    return { main, left, right, pto, front }
  }, [])

  const solved = useRef(solve(useDrive.getState()))
  useSimFrame((dt, t) => {
    const st = useDrive.getState()
    const s = (solved.current = solve(st))
    if (s.stalled) {
      live.rpm = 0
      live.V = 0
      live.V0 = 0
      return
    }
    live.t = t
    live.rpm = s.rpm
    live.V0 = s.V0
    live.V = s.V
    pose.engineAngle += TAU * s.Ne * dt
    pose.rearAngle += TAU * s.Nw * dt
    // driven front wheels (4WD) turn with a small lead over the rear tyre surface speed; otherwise they just roll
    const frontSurface = st.drive === '4wd' ? s.V0 * FRONT_LEAD : s.V
    pose.frontAngle += (frontSurface / TRACTOR.front.radius) * dt
    pose.ptoAngle += (TAU * s.Ne * dt) / PTO_RATIO
  })

  const power = () => (flow && !solved.current.stalled ? Math.min(1, solved.current.Qe / 34000 + 0.25) : 0)
  const fs = 0.8
  const fourWd = drive === '4wd'
  const oneWd = drive === '1wd'
  const gear = useDrive((s) => s.gear)
  const q = solve({ ...useDrive.getState(), gear }).q
  return (
    <group>
      <Tractor pose={pose} drawbar internals gearRatio={gearboxRatio(q)} finalRatio={FINAL_RATIO} labels>
        {fourWd && <FrontDrive />}
      </Tractor>
      <Ground />
      <Flow curve={curves.main} count={70} radius={0.014} color="#f5b942" speed={fs} spread={0.02} intensity={power} />
      <Flow curve={curves.left} count={26} radius={0.013} color="#f5b942" speed={fs} spread={0.02} intensity={() => power() * (fourWd ? 0.7 : 1)} />
      {!oneWd && <Flow curve={curves.right} count={26} radius={0.013} color="#f5b942" speed={fs} spread={0.02} intensity={() => power() * (fourWd ? 0.7 : 1)} />}
      {fourWd && <Flow curve={curves.front} count={40} radius={0.012} color="#f5b942" speed={fs} spread={0.02} intensity={() => power() * 0.6} />}
      <Flow curve={curves.pto} count={30} radius={0.011} color="#6fb8ec" speed={fs} spread={0.015} intensity={() => (flow ? 0.6 : 0)} />
      {/* force arrows (MECH Fig 2.3): pull P rearward at the drawbar, H forward and R rearward at the contact patch */}
      <Arrow origin={[TRACTOR.drawbar.x - 0.05, TRACTOR.drawbar.y, 0]} dir={-1} color="#e8794f" scale={0.05} value={() => useDrive.getState().pull} />
      <Arrow origin={[-0.05, 0.03, REAR_Z + 0.3]} dir={1} color="#9bd17a" scale={0.05} value={() => useDrive.getState().pull + useDrive.getState().rolling} />
      <Arrow origin={[0.05, 0.1, REAR_Z + 0.3]} dir={-1} color="#6fb3e0" scale={0.05} value={() => useDrive.getState().rolling} />
      <PartLabel partId="ground" at={[2.6, 0.05, 1.0]} />
    </group>
  )
}
