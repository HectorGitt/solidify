import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, roundedBox, tube, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { FRONT_Y, KINGPIN_Z } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { ARMS, AXLE, BOX, C, KP_PLUS, RIM_INSET, RIM_R, SCRUB, ballAt, live, solveSteer, useSteer } from './model'

const INFO = {
  wheel: { summary: 'Steering wheel and column.', role: 'The driver’s input. Here about 1¼ turns each way swing the drop arm through its ±30°.', details: 'Box ratio 15 : 1 assumed.' },
  shaft: { summary: 'Steering shaft.', role: 'Carries the steering-wheel turn down to the steering box.' },
  box: { summary: 'Steering box.', role: 'A worm-and-peg or recirculating-ball box turns the column rotation into a small swing (about ±30°) of the rocker shaft, multiplying the driver’s effort.', details: 'Internals: see the Steering boxes scene. Check the box oil (SAE 90) every 200 h.' },
  drop: { summary: 'Drop arm (Pitman arm).', role: 'Splined to the box’s rocker shaft; swings fore and aft and moves the drag link.' },
  drag: { summary: 'Drag link.', role: 'Joins the drop arm to the steering arm on one stub axle, with ball joints at each end.' },
  steerArm: { summary: 'Steering arm.', role: 'Fixed to the stub axle (knuckle); the drag link turns it about the kingpin.' },
  trackArms: { summary: 'Track-rod arms.', role: 'One on each stub axle, angled inward so the inner wheel turns more than the outer on a bend.', details: 'Arm lines aimed near the rear-axle centre (Ackermann trapezoid).' },
  trackRod: { summary: 'Track rod with adjustable ends.', role: 'Joins the two steering arms so both wheels move together. Its length sets the toe-in; reset it whenever the track width is changed.', details: 'Threaded ends (one left-hand) with clamp bolts: turning the rod changes its length.' },
  gauge: { summary: 'Toe-in gauge.', role: 'Measure between the rims at hub height in front of (A) and behind (B) the axle: A should be 3–6 mm (⅛–¼ in) less than B.' },
}

const X_AXIS = new THREE.Vector3(1, 0, 0)
const tmpD = new THREE.Vector3()
/** Place a +X-aligned object at a, pointing to b (optionally stretched to |b − a| along X). */
function orientX(o: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3, stretch = false) {
  if (!o) return
  tmpD.subVectors(b, a)
  const L = tmpD.length()
  o.position.copy(a)
  o.quaternion.setFromUnitVectors(X_AXIS, tmpD.normalize())
  if (stretch) o.scale.set(L, 1, 1)
}

const unitX = (r: number) => xform(cylinder(r, 1, 14), mat4.c(mat4.t(0.5, 0, 0), mat4.rz(Math.PI / 2)))
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const COL_BOTTOM = v3(0.406, 1.297, 0)
const COL_AXIS = v3(-Math.sin(0.62), Math.cos(0.62), 0)

export function Steering3D() {
  const pose = useMemo(() => createTractorPose(), [])
  const G = useMemo(() => {
    const boxTop = v3(BOX.x, BOX.y + 0.09, BOX.z)
    const d = boxTop.clone().sub(COL_BOTTOM)
    const shaft = xform(unitX(0.014), new THREE.Matrix4().compose(COL_BOTTOM, new THREE.Quaternion().setFromUnitVectors(v3(1, 0, 0), d.clone().normalize()), v3(d.length(), 1, 1)))
    const rockerLen = BOX.armZ - BOX.z + 0.02
    return {
      shaft,
      housing: roundedBox(0.13, 0.17, 0.12, 0.02),
      rocker: xform(cylinder(0.022, rockerLen, 20), mat4.c(mat4.t(0, 0, rockerLen / 2), mat4.rx(Math.PI / 2))),
      drop: merge(xform(box(0.04, BOX.dropArm, 0.025), mat4.t(0, -BOX.dropArm / 2, 0)), xform(cylinder(0.035, 0.035, 20), mat4.rx(Math.PI / 2)), xform(new THREE.SphereGeometry(0.022, 16, 12), mat4.t(0, -BOX.dropArm, 0))),
      drag: merge(unitX(0.014), xform(unitX(0.02), mat4.c(mat4.t(0.03, 0, 0), mat4.t(0, 0, 0)))),
      ball: new THREE.SphereGeometry(0.024, 16, 12),
      steerArm: merge(xform(box(0.045, 0.03, ARMS.steerLen), mat4.t(0, ARMS.steerY - FRONT_Y, -ARMS.steerLen / 2)), xform(new THREE.SphereGeometry(0.022, 16, 12), mat4.t(0, ARMS.steerY - FRONT_Y, -ARMS.steerLen))),
      trackArm: (s: number) => {
        const a = AXLE.arm
        const b = AXLE.beta
        const m = new THREE.Matrix4().makeRotationY(Math.PI + s * b)
        return merge(xform(xform(box(a, 0.03, 0.035), mat4.t(a / 2, 0, 0)), new THREE.Matrix4().multiplyMatrices(mat4.t(0, ARMS.trackY - FRONT_Y, 0), m)), xform(new THREE.SphereGeometry(0.02, 14, 10), mat4.t(-a * Math.cos(b), ARMS.trackY - FRONT_Y, -s * a * Math.sin(b))))
      },
      rod: unitX(0.013),
      sleeve: xform(tube(0.021, 0.011, 0.16, 20), mat4.rz(Math.PI / 2)),
      clamp: merge(...[-0.07, 0.07].map((x) => xform(box(0.02, 0.05, 0.05), mat4.t(x, 0, 0)))),
      gauge: unitX(0.006),
      marker: merge(box(0.4, 0.012, 0.022), xform(box(0.03, 0.02, 0.05), mat4.t(0.19, 0, 0))),
    }
  }, [])
  const trackArmG = useMemo(() => ({ plus: G.trackArm(1), minus: G.trackArm(-1) }), [G])

  const wrap = useRef<THREE.Group>(null)
  const knuckles = useRef<{ plus: THREE.Object3D | null; minus: THREE.Object3D | null }>({ plus: null, minus: null })
  const r = {
    kpPlus: useRef<THREE.Group>(null),
    kpMinus: useRef<THREE.Group>(null),
    drop: useRef<THREE.Group>(null),
    rocker: useRef<THREE.Group>(null),
    drag: useRef<THREE.Group>(null),
    rod: useRef<THREE.Group>(null),
    sleeve: useRef<THREE.Group>(null),
    gaugeA: useRef<THREE.Group>(null),
    gaugeB: useRef<THREE.Group>(null),
    marker: useRef<THREE.Group>(null),
  }
  const markerBase = useMemo(() => new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), COL_AXIS), [])

  // runs after <Tractor>'s own frame callback (parent effects subscribe after the child's)
  useSimFrame((dt) => {
    const st = useSteer.getState()
    // auto sweep: lock to lock and back (about 1¼ turns each way)
    if (st.sweep) {
      live.phase += dt * 0.9
      live.wheel = 400 * Math.sin(live.phase)
    } else live.wheel = st.wheel
    const p = { ...st, wheel: live.wheel }
    const s = solveSteer(p)
    live.s = s
    const ex = p.exaggerate ? 9 : 0
    const dP = s.dPlus + ex * s.toe0
    const dM = s.dMinus - ex * s.toe0
    pose.steer = (dP + dM) / 2
    pose.frontTrack = TRACTOR.front.track + p.trackMM / 1000
    // the shared tractor draws ideal-Ackermann knuckles from pose.steer; set them to the linkage's angles
    const k = knuckles.current
    if ((!k.plus || !k.minus) && wrap.current) {
      wrap.current.traverse((o) => {
        if (o.children.length === 0) return
        if (Math.abs(o.position.x - TRACTOR.wheelbase) < 1e-6 && Math.abs(o.position.y - FRONT_Y) < 1e-6 && Math.abs(o.position.z) > 0.1) {
          if (o.position.z > 0) k.plus = o.children[0]
          else k.minus = o.children[0]
        }
      })
    }
    k.plus?.rotation.set(0, dP, 0)
    k.minus?.rotation.set(0, dM, 0)
    r.kpPlus.current?.rotation.set(0, dP, 0)
    r.kpMinus.current?.rotation.set(0, dM, 0)

    r.drop.current?.rotation.set(0, 0, -s.alpha)
    r.rocker.current?.rotation.set(0, 0, -s.alpha)
    const ball = ballAt(s.alpha)
    const sl = ARMS.steerLen
    const armEnd = v3(KP_PLUS.x - sl * Math.sin(dP), KP_PLUS.y, KP_PLUS.z - sl * Math.cos(dP))
    orientX(r.drag.current, v3(ball.x, ball.y, ball.z), armEnd, true)

    // track rod between the arm ends (world)
    const a = AXLE.arm
    const b = AXLE.beta
    const eP = v3(TRACTOR.wheelbase - a * Math.cos(b - dP), ARMS.trackY, KINGPIN_Z + a * Math.sin(dP - b))
    const eM = v3(TRACTOR.wheelbase - a * Math.cos(b + dM), ARMS.trackY, -KINGPIN_Z + a * Math.sin(dM + b))
    orientX(r.rod.current, eM, eP, true)
    orientX(r.sleeve.current, eM.clone().lerp(eP, 0.5), eP)

    // toe gauge at hub height between the inner rim flanges
    const rimPt = (side: 1 | -1, d: number, fore: 1 | -1) => {
      const c = v3(TRACTOR.wheelbase + SCRUB * Math.sin(d) * side, FRONT_Y, side * KINGPIN_Z + side * SCRUB * Math.cos(d))
      const off = v3(fore * RIM_R, 0, -side * RIM_INSET).applyAxisAngle(v3(0, 1, 0), d)
      return c.add(off)
    }
    orientX(r.gaugeA.current, rimPt(-1, dM, 1), rimPt(1, dP, 1), true)
    orientX(r.gaugeB.current, rimPt(-1, dM, -1), rimPt(1, dP, -1), true)

    if (r.marker.current) {
      r.marker.current.quaternion.copy(markerBase).multiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), (p.wheel * Math.PI) / 180))
    }
  })

  return (
    <group>
      <group ref={wrap}>
        <Tractor pose={pose} drawbar={false} internals={false} labels={false} />
      </group>
      <Part id="manual-steering" name="Manual steering linkage" role="moving" material="forged" info={{ summary: 'Manual steering linkage (Fig 44).', role: 'Steering wheel → box → drop arm → drag link → steering arm → stub axle; a track rod joins the two steering arms so both wheels move together.' }} cites={C.manual}>
        <Part id="steering-wheel" name="Steering wheel (turn marker)" material="paintYellow" info={INFO.wheel} cites={C.manual} cut={false}>
          <group position={[0.18, 1.635, 0]} ref={r.marker}>
            <PartMesh geometry={G.marker} />
          </group>
        </Part>
        <Part id="steering-shaft" name="Steering shaft" material="steel" info={INFO.shaft} cites={C.manual}>
          <PartMesh geometry={G.shaft} />
        </Part>
        <Part id="steering-box" name="Steering box" role="housing" material="castIron" info={INFO.box} cites={[...C.manual, ...C.box]} explode={[0, 0.15, 0.1]}>
          <PartMesh geometry={G.housing} position={[BOX.x, BOX.y, BOX.z]} />
          <group ref={r.rocker} position={[BOX.x, BOX.y - 0.03, BOX.z]}>
            <PartMesh geometry={G.rocker} material="steel" />
          </group>
        </Part>
        <Part id="drop-arm" name="Drop arm" info={INFO.drop} cites={C.manual} explode={[0, 0, 0.1]}>
          <group ref={r.drop} position={[BOX.x, BOX.y, BOX.armZ]}>
            <PartMesh geometry={G.drop} />
          </group>
        </Part>
        <Part id="drag-link" name="Drag link" material="steel" info={INFO.drag} cites={C.manual} explode={[0, 0, 0.15]}>
          <group ref={r.drag}>
            <PartMesh geometry={G.rod} />
          </group>
        </Part>
        <Part id="steering-arm" name="Steering arm" info={INFO.steerArm} cites={C.manual}>
          <group ref={r.kpPlus} position={[TRACTOR.wheelbase, FRONT_Y, KINGPIN_Z]}>
            <PartMesh geometry={G.steerArm} />
          </group>
        </Part>
        <Part id="track-rod-arms" name="Track-rod arms" info={INFO.trackArms} cites={C.manual} beyondNotes>
          <group ref={r.kpMinus} position={[TRACTOR.wheelbase, FRONT_Y, -KINGPIN_Z]}>
            <PartMesh geometry={trackArmG.minus} />
          </group>
          <TrackArmPlus parent={r.kpPlus} geometry={trackArmG.plus} />
        </Part>
        <Part id="track-rod" name="Track rod (adjustable)" material="steel" info={INFO.trackRod} cites={[...C.manual, ...C.toe, ...C.axle]} explode={[-0.1, -0.1, 0]}>
          <group ref={r.rod}>
            <PartMesh geometry={G.rod} />
          </group>
          <group ref={r.sleeve}>
            <PartMesh geometry={G.sleeve} material="forged" />
            <PartMesh geometry={G.clamp} material="steelDark" />
          </group>
        </Part>
      </Part>
      <Part id="toe-gauge" name="Toe-in gauge (A front, B rear)" material="paintYellow" role="static" info={INFO.gauge} cites={C.toe} cut={false}>
        <group ref={r.gaugeA}>
          <PartMesh geometry={G.gauge} />
        </group>
        <group ref={r.gaugeB}>
          <PartMesh geometry={G.gauge} material="paintOrange" />
        </group>
      </Part>
      <PartLabel partId="steering-box" at={[BOX.x, BOX.y + 0.2, BOX.z + 0.12]} />
      <PartLabel partId="drop-arm" at={[BOX.x - 0.05, BOX.y - 0.3, BOX.armZ + 0.1]} />
      <PartLabel partId="drag-link" at={[1.2, 0.72, 0.5]} />
      <PartLabel partId="steering-arm" at={[1.95, 0.62, 0.45]} />
      <PartLabel partId="track-rod" at={[1.7, 0.24, -0.1]} />
      <PartLabel partId="track-rod-arms" at={[1.7, 0.24, -0.55]} />
      <PartLabel partId="steering-wheel" at={[0.12, 1.78, 0.2]} />
      <PartLabel partId="toe-gauge" at={[TRACTOR.wheelbase + RIM_R, FRONT_Y + 0.06, 0.15]} text="A (front)" />
      <PartLabel partId="toe-gauge" at={[TRACTOR.wheelbase - RIM_R, FRONT_Y + 0.06, -0.15]} text="B (rear)" />
    </group>
  )
}

/** The +Z track-rod arm turns with the +Z kingpin group (shared with the steering arm). */
function TrackArmPlus({ parent, geometry }: { parent: React.RefObject<THREE.Group | null>; geometry: THREE.BufferGeometry }) {
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const p = parent.current
    if (p && ref.current) ref.current.rotation.copy(p.rotation)
  })
  return (
    <group ref={ref} position={[TRACTOR.wheelbase, FRONT_Y, KINGPIN_Z]}>
      <PartMesh geometry={geometry} />
    </group>
  )
}
