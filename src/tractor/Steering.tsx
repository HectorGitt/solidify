import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { BALL, SCREW_PHASE, ballBoxKinematics, ballCircuit, steeringWheel } from '@/parts/lib/steeringBox'
import type { PartInfo } from '@/parts/registry'
import { getMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import type { DriveAngles } from './DrivelineInternals'
import { TRACTOR } from './dims'
import { FRONT_Y, KINGPIN_Z } from './geometry'
import { prepareSystems, systemsReady, type SystemsGeometry } from './systems.geometry'

/**
 * The steering system, in place: steering wheel and column, recirculating-ball box on top of the
 * clutch housing (the steering-boxes scene's box, from the shared library), drop arm, a drag link
 * down the left side to the steering arm on the left kingpin, and the track rod joining the two
 * steering arms. The drop-arm angle is solved each frame so the drag link keeps its length as the
 * wheels steer, and the wheel angle follows from the box's own kinematics.
 * Frame as the tractor: +X forward, Y up, +Z right.
 */

const { PI } = Math
/** the column leans back 0.62 rad; its axis points up towards the driver, (−sin, cos) */
const TILT = 0.62
/** steering-box screw centre (on the column axis, above the clutch housing, under the tank) */
const BOX = new THREE.Vector3(0.62, 0.998, 0)
/** box frame: +X along the column (towards the wheel), turned over so the rocker hangs below the screw */
const BOX_ROT = PI / 2 + TILT
/** rocker-shaft axis in the tractor frame, and the drop arm on its outer (left) end */
// (0, eY) in the box frame → flipped (0, −eY) → turned by BOX_ROT
const ROCKER = BOX.clone().add(new THREE.Vector3(BALL.eY * Math.sin(BOX_ROT), -BALL.eY * Math.cos(BOX_ROT), 0))
const DROP_Z = -0.27
const DROP_LEN = 0.13
/** steering arms: back from each kingpin and angled in (Ackermann: towards the rear-axle centre) */
const ARM_LEN = 0.11
const ARM_IN = ARM_LEN * Math.tan(Math.atan(KINGPIN_Z / TRACTOR.wheelbase))
const armVec = (side: 1 | -1) => new THREE.Vector3(-ARM_LEN, 0.05, -side * ARM_IN)
const kingpin = (side: 1 | -1) => new THREE.Vector3(TRACTOR.wheelbase, FRONT_Y, side * KINGPIN_Z)
const WHEEL = new THREE.Vector3(0.18, 1.62, 0)

const armEnd = (side: 1 | -1, angle: number, out = new THREE.Vector3()) => out.copy(armVec(side)).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(kingpin(side))
const dropBall = (theta: number, out = new THREE.Vector3()) => out.set(ROCKER.x + DROP_LEN * Math.sin(theta), ROCKER.y - DROP_LEN * Math.cos(theta), DROP_Z + 0.016)
/** drag-link length, set at straight ahead */
const DRAG = dropBall(0).distanceTo(armEnd(-1, 0))

/** bisection for a monotonic f on [lo, hi] */
function solve(f: (x: number) => number, lo: number, hi: number) {
  let flo = f(lo)
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid
      flo = fm
    } else hi = mid
  }
  return (lo + hi) / 2
}

const INFO: Record<string, PartInfo> = {
  wheel: { summary: 'Steering wheel and column.', role: 'Turned by the driver; the column ends in the ball-screw thread inside the steering box.' },
  box: { summary: 'Recirculating-ball steering box.', role: 'Turns about four turns of the wheel, lock to lock, into a ±30° swing of the drop arm, through a nut that runs on a stream of steel balls.' },
  nut: { summary: 'Ball nut, balls and transfer tube.', role: 'The nut moves along the thread as the wheel turns; the balls roll in the grooves and return through the tube.' },
  rocker: { summary: 'Rocker arm and shaft.', role: 'The peg on the nut swings the rocker; its shaft carries the drop arm outside the box.' },
  drop: { summary: 'Drop arm.', role: 'Swings fore and aft with the rocker shaft, pushing or pulling the drag link.' },
  drag: { summary: 'Drag link.', role: 'Runs down the left side of the tractor from the drop arm to the steering arm on the left front wheel.' },
  arms: { summary: 'Steering arms.', role: 'Fixed to each kingpin knuckle. Angled in towards the rear axle so the inner wheel turns more than the outer (Ackermann geometry).' },
  track: { summary: 'Track rod.', role: 'Joins the two steering arms so both front wheels steer together; its length sets the toe-in.' },
}

export function Steering({ a, k }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const [g, setG] = useState<SystemsGeometry | null>(systemsReady)
  useEffect(() => {
    if (!g) void prepareSystems().then(setG)
  }, [g])
  if (!g) return null
  return <SteeringSystem g={g} a={a} k={k} />
}

function SteeringSystem({ g, a, k }: { g: SystemsGeometry; a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const s = g.steering
  const local = useMemo(() => {
    const rod = (r: number) => xform(cylinder(r, 1, 16), mat4.t(0, 0.5, 0))
    // the shared steering wheel (axis X) at this tractor's size, turned so its axis is local Y
    const sw = steeringWheel({ R: 0.2, rimR: 0.014, spokeR: 0.008, hubR: 0.03, hubL: 0.05 })
    const wheel = merge(sw.rim, sw.hub, sw.spokes).rotateZ(PI / 2)
    const arm = xform(box(ARM_LEN + 0.03, 0.022, 0.03), mat4.t(-ARM_LEN / 2, 0.05, 0))
    // rocker shaft carried out of the box to the drop arm
    const shaftExt = xform(cylinder(0.0125, Math.abs(DROP_Z) - 0.05, 20), mat4.c(mat4.t(ROCKER.x, ROCKER.y, (DROP_Z - 0.05) / 2), mat4.rx(PI / 2)))
    return { rod: rod(0.012), trackRod: rod(0.014), wheel, arm, shaftExt }
  }, [])
  const circuit = useMemo(() => ballCircuit(), [])

  const screw = useRef<THREE.Group>(null)
  const nut = useRef<THREE.Group>(null)
  const rocker = useRef<THREE.Group>(null)
  const drop = useRef<THREE.Group>(null)
  const wheel = useRef<THREE.Group>(null)
  const drag = useRef<THREE.Group>(null)
  const track = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const balls = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ e: new THREE.Vector3(), f: new THREE.Vector3(), b: new THREE.Vector3(), o: new THREE.Object3D(), up: new THREE.Vector3(0, 1, 0) }), [])

  /** stretch a unit rod (along +Y from its origin) between two points */
  const between = (grp: THREE.Group | null, p: THREE.Vector3, q: THREE.Vector3) => {
    if (!grp) return
    grp.position.copy(p)
    const d = tmp.f.copy(q).sub(p)
    grp.quaternion.setFromUnitVectors(tmp.up, d.clone().normalize())
    grp.scale.set(1, d.length(), 1)
  }

  useSimFrame(() => {
    const { steerLeft, steerRight } = a.current
    // drop arm: the angle at which the drag link reaches the left steering arm
    const e = armEnd(-1, steerLeft, tmp.e)
    const theta = solve((th) => dropBall(th, tmp.b).distanceTo(e) - DRAG, -0.8, 0.8)
    // steering wheel: the angle at which the box gives that drop-arm angle
    const w = solve((x) => ballBoxKinematics(x).phi - theta, -6 * PI, 6 * PI)
    const kin = ballBoxKinematics(w)
    screw.current?.rotation.set(w + SCREW_PHASE, 0, 0)
    nut.current?.position.set(kin.x, 0, 0)
    rocker.current?.rotation.set(0, 0, -kin.phi)
    drop.current?.rotation.set(0, 0, theta)
    wheel.current?.rotation.set(0, w, 0)
    armL.current?.rotation.set(0, steerLeft, 0)
    armR.current?.rotation.set(0, steerRight, 0)
    between(drag.current, dropBall(theta, tmp.b), e)
    between(track.current, armEnd(-1, steerLeft, tmp.e), armEnd(1, steerRight, tmp.b))
    // balls round the circuit, moving with the thread
    const mesh = balls.current
    if (mesh) {
      const off = ((w / 2) * circuit.helixArc) / circuit.curve.getLength()
      for (let i = 0; i < BALL.balls; i++) {
        let u = (i / BALL.balls + off) % 1
        if (u < 0) u += 1
        circuit.curve.getPointAt(u, tmp.o.position)
        tmp.o.updateMatrix()
        mesh.setMatrixAt(i, tmp.o.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  const ballMat = useMemo(() => getMaterial('chrome', { variant: 'solid', highlight: 'none', intersection: false }), [])

  return (
    <>
      <Part id={k('steer-wheel')} name="Steering wheel & column" role="moving" material="paintBlack" info={INFO.wheel}>
        <group position={WHEEL} rotation={[0, 0, TILT]}>
          <group ref={wheel}>
            <PartMesh geometry={local.wheel} />
          </group>
        </group>
      </Part>
      <group position={BOX} rotation={[0, 0, BOX_ROT]}>
        <group rotation={[PI, 0, 0]}>
          <Part id={k('steer-box')} name="Steering box" role="housing" material="castIron" info={INFO.box} explode={[0, -0.12, 0]}>
            <PartMesh geometry={s.housing} />
          </Part>
          <Part id={k('steer-screw')} name="Ball screw & column shaft" role="moving" material="steel" info={INFO.wheel}>
            <group ref={screw}>
              <PartMesh geometry={s.screw.thread} />
              <PartMesh geometry={s.screw.shafts} />
            </group>
          </Part>
          <Part id={k('steer-nut')} name="Ball nut & balls" role="moving" material="steel" info={INFO.nut}>
            <group ref={nut}>
              <PartMesh geometry={s.nut.nut} />
              <PartMesh geometry={s.nut.peg} />
              <PartMesh geometry={s.tube} material="steelDark" />
              <instancedMesh ref={balls} args={[s.ball, ballMat, BALL.balls]} />
            </group>
          </Part>
          <Part id={k('steer-rocker')} name="Rocker arm & shaft" role="moving" material="forged" info={INFO.rocker}>
            <group position={[0, BALL.eY, 0]} ref={rocker}>
              <PartMesh geometry={s.rocker.arm} />
              <PartMesh geometry={s.rocker.shaft} material="steel" />
            </group>
          </Part>
        </group>
      </group>
      <Part id={k('steer-drop')} name="Drop arm" role="moving" material="forged" info={INFO.drop}>
        <group position={[ROCKER.x, ROCKER.y, DROP_Z]} ref={drop}>
          <PartMesh geometry={s.drop} />
        </group>
        <PartMesh geometry={local.shaftExt} material="steel" />
      </Part>
      <Part id={k('steer-drag')} name="Drag link" role="moving" material="forged" info={INFO.drag}>
        <group ref={drag}>
          <PartMesh geometry={local.rod} />
        </group>
      </Part>
      <Part id={k('steer-arms')} name="Steering arms" role="moving" material="forged" info={INFO.arms}>
        <group position={kingpin(-1)} ref={armL}>
          <group rotation={[0, Math.atan2(ARM_IN, ARM_LEN), 0]}>
            <PartMesh geometry={local.arm} />
          </group>
        </group>
        <group position={kingpin(1)} ref={armR}>
          <group rotation={[0, -Math.atan2(ARM_IN, ARM_LEN), 0]}>
            <PartMesh geometry={local.arm} />
          </group>
        </group>
      </Part>
      <Part id={k('steer-track')} name="Track rod" role="moving" material="forged" info={INFO.track}>
        <group ref={track}>
          <PartMesh geometry={local.trackRod} />
        </group>
      </Part>
    </>
  )
}
