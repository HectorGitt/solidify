import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { DriveGraph, hookeJoint } from '@/core/drive'
import { box, cylinder, mat4, merge, roundedBox, xform } from '@/geometry'
import { rim, tyre } from '@/geometry/parts'
import { PTO_STANDARDS } from '@/physics/linkageControl'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { LINKAGE } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { UJ as J, lemonTube, ujCross, ujCups, ujYoke } from '@/parts/lib/driveline'
import { crossQuaternion } from '../shared/cardan'
import { C, END, J1, MOWER_J2, driveline, live, overlap, tubeLengths, usePtoShaft } from './model'

const INFO = {
  ptoYoke: { summary: 'PTO yoke (3) on the tractor PTO (1).', role: 'Slides onto the splined stub and locks with a spring pin: 6 splines Ø35 mm at 540 rpm, 21 splines Ø44 mm at 1000 rpm.' },
  cross: { summary: 'Hooke’s joint cross (spider) with needle-roller cups.', role: 'Lets the drive turn through an angle. The output speed varies twice per revolution unless a second joint cancels it.' },
  outer: { summary: 'Telescopic shaft — outer “lemon-profile” tube (5).', role: 'The lemon section transmits torque while the inner tube slides inside it, so the shaft length follows the hitch as the implement rises, falls and turns.' },
  inner: { summary: 'Telescopic shaft — inner lemon-profile tube (5).', role: 'Slides in the outer tube. Keep enough overlap at the longest position, and never let it bottom at the shortest.', details: 'Overlap and bottoming limits here are typical practice.' },
  picYoke: { summary: 'Implement (PIC) yoke (4) on the power input connection (2).', role: 'Drives the implement’s input shaft — here a mower gearbox.' },
  guards: { summary: 'Guard cones (6) and shaft guard tubes.', role: 'Plastic shields on bearing bushes stay still while the shaft turns, so clothing cannot be caught. A 540 rpm shaft wraps 7 ft of string in 1 s.' },
  pic: { summary: 'Implement gearbox (rotary mower).', role: 'Bevel gearbox turning the drive down to the blade carrier. Its input shaft is guarded up to the first bearing.' },
  trailer: { summary: 'Trailed PTO machine on the drawbar.', role: 'Pivots on the drawbar pin in turns. BS 1495: put the pin midway between the two joints so their angles stay equal.' },
}

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const m4 = new THREE.Matrix4()
const tq = new THREE.Quaternion()

/** Quaternion with local X → ax and local Y → ay (ay ⟂ ax). */
function basis(ax: THREE.Vector3, ay: THREE.Vector3, out: THREE.Quaternion) {
  const az = new THREE.Vector3().crossVectors(ax, ay)
  m4.makeBasis(ax, ay, az)
  return out.setFromRotationMatrix(m4)
}

export function PtoShaft3D() {
  const mode = usePtoShaft((s) => s.mode)
  const guards = usePtoShaft((s) => s.guards)
  const pose = useMemo(() => createTractorPose({ hitchHeight: 0.45 }), [])
  const G = useMemo(() => {
    const cone = new THREE.CylinderGeometry(0.075, 0.04, 0.17, 28, 1, true)
    cone.rotateZ(-Math.PI / 2)
    cone.translate(0.05, 0, 0)
    const guardTube = new THREE.CylinderGeometry(0.0375, 0.0375, 1, 24, 1, true)
    guardTube.rotateZ(-Math.PI / 2)
    guardTube.translate(0.5, 0, 0)
    const guardTubeIn = new THREE.CylinderGeometry(0.032, 0.032, 1, 24, 1, true)
    guardTubeIn.rotateZ(-Math.PI / 2)
    guardTubeIn.translate(0.5, 0, 0)
    return {
      yoke: ujYoke(),
      cross: ujCross(),
      cups: ujCups(),
      hub: xform(cylinder(0.03, 0.09, 24), mat4.c(mat4.t(-J.hubEnd - 0.03, 0, 0), mat4.rz(Math.PI / 2))),
      outer: lemonTube(0.03, 0.02, 0.004),
      inner: lemonTube(0.024, 0.0145, 0.004),
      cone,
      guardTube,
      guardTubeIn,
      gearbox: merge(roundedBox(0.24, 0.2, 0.22, 0.03), xform(cylinder(0.035, 0.12, 20), mat4.c(mat4.t(0.14, 0, 0), mat4.rz(Math.PI / 2)))),
      deck: merge(xform(cylinder(0.75, 0.025, 48), mat4.t(0, 0, 0)), xform(box(0.06, 0.3, 0.06), mat4.t(0, 0.15, 0))),
      frame: merge(...[1, -1].map((s) => xform(box(0.06, 0.06, 0.6), mat4.t(-0.25, 0, s * 0.12))), xform(box(0.6, 0.06, 0.06), mat4.t(-0.3, 0, 0)), xform(box(0.05, LINKAGE.mastHeight, 0.05), mat4.t(0, LINKAGE.mastHeight / 2, 0)), xform(cylinder(0.025, 2 * LINKAGE.hitchSpread + 0.1, 16), mat4.rx(Math.PI / 2))),
      tongue: xform(box(1.3, 0.07, 0.07), mat4.t(-0.65, 0, 0)),
      axle: xform(cylinder(0.03, 1.3, 16), mat4.c(mat4.t(-1.25, -0.15, 0), mat4.rx(Math.PI / 2))),
      tyre: tyre({ radius: 0.3, width: 0.14, rimRadius: 0.16 } as Parameters<typeof tyre>[0]),
      rim: rim(0.16, 0.13),
    }
  }, [])

  const graph = useMemo(() => {
    const d = new DriveGraph()
    d.body('pto')
    d.body('mid')
    d.body('input')
    d.addMap(hookeJoint('j1', 'pto', 'mid', () => live.beta1))
    d.addMap(hookeJoint('j2', 'mid', 'input', () => live.beta2, Math.PI / 2 + (usePtoShaft.getState().phaseErr * Math.PI) / 180))
    return d
  }, [])

  const r = {
    inYoke: useRef<THREE.Group>(null),
    cross1: useRef<THREE.Group>(null),
    midYoke1: useRef<THREE.Group>(null),
    midYoke2: useRef<THREE.Group>(null),
    cross2: useRef<THREE.Group>(null),
    outYoke: useRef<THREE.Group>(null),
    outer: useRef<THREE.Group>(null),
    inner: useRef<THREE.Group>(null),
    cone1: useRef<THREE.Group>(null),
    cone2: useRef<THREE.Group>(null),
    gt1: useRef<THREE.Group>(null),
    gt2: useRef<THREE.Group>(null),
    trailer: useRef<THREE.Group>(null),
  }
  const q = useMemo(() => new THREE.Quaternion(), [])

  useSimFrame((dt) => {
    const p = usePtoShaft.getState()
    const d = driveline(p)
    live.beta1 = d.beta1
    live.beta2 = d.beta2
    live.length = d.length
    live.overlap = overlap(p, d.length)
    pose.hitchHeight = p.mode === 'mounted' ? p.hitch : 0.75
    const rpm = PTO_STANDARDS[p.std].rpm
    graph.drive('pto', (2 * Math.PI * rpm) / 60)
    if (dt > 0) graph.step(dt)
    const th = graph.get('pto').theta
    pose.ptoAngle = th
    live.theta = th
    live.nIn = rpm
    live.nMid = (graph.get('mid').omega * 60) / (2 * Math.PI)
    live.nOut = (graph.get('input').omega * 60) / (2 * Math.PI)
    r.trailer.current?.rotation.set(0, (p.gamma * Math.PI) / 180, 0)

    // exact joint kinematics from the pins: θ = 0 puts the driving pin in the plane of the shafts
    const { aIn, aMid, aOut, J2 } = d
    const ref = aMid.clone().addScaledVector(aIn, -aMid.dot(aIn))
    if (ref.lengthSq() < 1e-8) ref.copy(Y)
    ref.normalize()
    const u1 = ref.clone().applyAxisAngle(aIn, th)
    const u2 = new THREE.Vector3().crossVectors(aMid, u1).normalize()
    const u2b = u2.clone().applyAxisAngle(aMid, (p.phaseErr * Math.PI) / 180)
    const u3 = new THREE.Vector3().crossVectors(aOut.clone().negate(), u2b).normalize()
    const place = (o: THREE.Group | null, at: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3) => {
      if (!o) return
      o.position.copy(at)
      basis(ax, ay, o.quaternion)
    }
    place(r.inYoke.current, J1, aIn, u1)
    place(r.midYoke1.current, J1, aMid.clone().negate(), u2)
    place(r.midYoke2.current, J2, aMid, u2b)
    place(r.outYoke.current, J2, aOut.clone().negate(), u3)
    if (r.cross1.current) {
      r.cross1.current.position.copy(J1)
      r.cross1.current.quaternion.copy(crossQuaternion(u1, u2, q))
    }
    if (r.cross2.current) {
      r.cross2.current.position.copy(J2)
      r.cross2.current.quaternion.copy(crossQuaternion(u2b, u3, tq))
    }
    const t = tubeLengths(p)
    const free = d.length - 2 * END
    const lo = Math.min(t.outer, free)
    const li = Math.min(t.inner, free)
    if (r.outer.current) {
      place(r.outer.current, J1.clone().addScaledVector(aMid, END), aMid, u2)
      r.outer.current.scale.set(lo, 1, 1)
    }
    if (r.inner.current) {
      place(r.inner.current, J2.clone().addScaledVector(aMid, -END), aMid.clone().negate(), u2b)
      r.inner.current.scale.set(li, 1, 1)
    }
    // guards do not turn
    const up = Math.abs(aMid.y) > 0.9 ? X : Y
    const side = new THREE.Vector3().crossVectors(aMid, up).cross(aMid).normalize().negate()
    place(r.cone1.current, J1.clone().addScaledVector(aMid, -0.02), aMid, side)
    place(r.cone2.current, J2.clone().addScaledVector(aMid, 0.02), aMid.clone().negate(), side)
    if (r.gt1.current) {
      place(r.gt1.current, J1.clone().addScaledVector(aMid, END + 0.03), aMid, side)
      r.gt1.current.scale.set(Math.max(0.01, lo - 0.02), 1, 1)
    }
    if (r.gt2.current) {
      place(r.gt2.current, J2.clone().addScaledVector(aMid, -END - 0.03), aMid.clone().negate(), side)
      r.gt2.current.scale.set(Math.max(0.01, li - 0.02), 1, 1)
    }
  })

  const mower = (
    <Part id="implement" name="Rotary mower gearbox" role="housing" material="paintOrange" info={INFO.pic} cites={C.shaft} beyondNotes>
      <PartMesh geometry={G.frame} material="paintGrey" />
      <PartMesh geometry={G.gearbox} position={[MOWER_J2.x - END - 0.17, MOWER_J2.y, 0]} />
      <PartMesh geometry={G.deck} position={[MOWER_J2.x - 0.3, -0.36, 0]} />
    </Part>
  )
  const trailer = (
    <group ref={r.trailer}>
      <Part id="implement" name="Trailed PTO machine" role="housing" material="paintOrange" info={INFO.trailer} cites={C.uj}>
        <PartMesh geometry={G.tongue} material="paintGrey" />
        <PartMesh geometry={G.axle} material="steelDark" />
        <PartMesh geometry={G.gearbox} position={[-0.4, 0.05, 0]} />
        {[1, -1].map((s) => (
          <group key={s} position={[-1.25, -0.15, s * 0.65]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <PartMesh geometry={G.tyre} material="rubber" />
            <PartMesh geometry={G.rim} material="paintGrey" />
          </group>
        ))}
      </Part>
    </group>
  )

  return (
    <group>
      <Tractor pose={pose} internals={false} labels={false} mounted={mode === 'mounted' ? mower : undefined} trailed={mode === 'trailed' ? trailer : undefined} />
      <Part id="pto-driveline" name="PTO drive shaft (Fig A2.7)" role="moving" material="forged" info={{ summary: 'Telescopic PTO drive shaft, Fig A2.7.', role: '(1) tractor PTO, (2) implement power input connection, (3) PTO yoke, (4) PIC yoke, (5) lemon-profile telescopic tubes, (6) guard cones.' }} cites={C.shaft}>
        <Part id="pto-yoke" name="PTO yoke (3)" info={INFO.ptoYoke} cites={C.std}>
          <group ref={r.inYoke}>
            <PartMesh geometry={G.yoke} />
            <PartMesh geometry={G.hub} />
          </group>
        </Part>
        <Part id="crosses" name="Joint crosses" material="steel" info={INFO.cross} cites={C.uj}>
          <group ref={r.cross1}>
            <PartMesh geometry={G.cross} />
            <PartMesh geometry={G.cups} material="bearing" />
          </group>
          <group ref={r.cross2}>
            <PartMesh geometry={G.cross} />
            <PartMesh geometry={G.cups} material="bearing" />
          </group>
        </Part>
        <Part id="outer-tube" name="Outer lemon tube (5)" material="steel" info={INFO.outer} cites={C.shaft}>
          <group ref={r.midYoke1}>
            <PartMesh geometry={G.yoke} material="forged" />
          </group>
          <group ref={r.outer}>
            <PartMesh geometry={G.outer} />
          </group>
        </Part>
        <Part id="inner-tube" name="Inner lemon tube (5)" material="chrome" info={INFO.inner} cites={C.shaft}>
          <group ref={r.midYoke2}>
            <PartMesh geometry={G.yoke} material="forged" />
          </group>
          <group ref={r.inner}>
            <PartMesh geometry={G.inner} />
          </group>
        </Part>
        <Part id="pic-yoke" name="PIC yoke (4)" info={INFO.picYoke} cites={C.shaft}>
          <group ref={r.outYoke}>
            <PartMesh geometry={G.yoke} />
            <PartMesh geometry={G.hub} />
          </group>
        </Part>
      </Part>
      {guards && (
        <Part id="guards" name="Guard cones & tubes (6)" role="static" material="paintYellow" info={INFO.guards} cites={C.guard} cut={false} explode={[0, 0.25, 0]}>
          <group ref={r.cone1}>
            <PartMesh geometry={G.cone} />
          </group>
          <group ref={r.cone2}>
            <PartMesh geometry={G.cone} />
          </group>
          <group ref={r.gt1}>
            <PartMesh geometry={G.guardTube} material="plastic" />
          </group>
          <group ref={r.gt2}>
            <PartMesh geometry={G.guardTubeIn} material="plastic" />
          </group>
        </Part>
      )}
      <PartLabel partId="pto-yoke" at={[-0.4, 0.68, 0.12]} />
      <PartLabel partId="crosses" at={[-0.4, 0.38, 0.15]} />
      <PartLabel partId="outer-tube" at={[-0.75, 0.72, 0.12]} />
      <PartLabel partId="inner-tube" at={[-1.05, 0.75, 0.12]} />
      <PartLabel partId="pic-yoke" at={[-1.3, 0.45, 0.15]} />
      {guards && <PartLabel partId="guards" at={[-0.6, 0.85, 0]} />}
      <PartLabel partId="implement" at={[-1.7, 0.9, 0.4]} />
      <PartLabel partId="tractor-pto-shield" at={[-0.3, 0.75, -0.2]} />
    </group>
  )
}
