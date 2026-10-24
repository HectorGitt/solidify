import { useMemo, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { pipe } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import {
  AX,
  A_ANN,
  A_CAP,
  CYL,
  L_AT_LEFT_LOCK,
  L_AT_RIGHT_LOCK,
  LEFT,
  ST,
  angleForLength,
  armEnd,
  cylLength,
  gerotorPose,
  live,
  rightAngle,
  toeAngle,
  turnsLockToLock,
  useSteer,
} from './model'
import { GLAND_IN, LAY, PISTON_W, RAM_BARREL, RAM_ROD, steeringParts } from './parts'

const { PI } = Math

const CITE = {
  hydro: [ST('p2–3 (book pp91–92), Fig 45: hydrostatic steering')],
  assist: [ST('p2 (book p91): power-assisted steering')],
  manual: [ST('p1–2, Fig 44: manual linkage')],
  toe: [ST('p5 (book p94), Fig 47: toe-in')],
}

const INFO = {
  system: {
    summary: 'Front axle with hydrostatic (or power-assisted) steering.',
    role: 'Hydrostatic: no mechanical link between steering wheel and wheels — an engine-driven pump, a control (metering) valve on the steering column, a double-acting steering cylinder and pipes. Power-assisted: the normal manual linkage with a pump, reservoir and double-acting ram added.',
  },
  beam: { summary: 'Front axle beam.', role: 'Carries the front of the tractor and the two kingpins; pivots at its centre so the front wheels follow uneven ground.' },
  kingpin: { summary: 'Kingpin (swivel) housings.', role: 'Each stub axle turns about its kingpin when the wheel is steered.' },
  wheels: { summary: 'Front wheels on stub axles.', role: 'F-2 single-rib steering tyres. The inner wheel turns more than the outer on a turn.' },
  arms: { summary: 'Steering arms.', role: 'Fixed to the stub axles. Angled inwards so their lines meet near the rear axle (Ackermann layout) — the inner wheel then turns more than the outer.' },
  trackRod: {
    summary: 'Track rod (tie rod).',
    role: 'Joins the two steering arms so both wheels move together. Its threaded ends set the toe-in, and it must be reset when the front track width is changed.',
  },
  cylinder: { summary: 'Double-acting steering cylinder.', role: 'Oil into one end pushes, into the other pulls the left steering arm; the track rod takes the right wheel with it.' },
  capOil: { summary: 'Cap-end oil.', role: 'Red while pressurised (steering right).' },
  annOil: { summary: 'Rod-end (annulus) oil.', role: 'Red while pressurised (steering left).' },
  mu: {
    summary: 'Steering control (metering) unit on the column — gerotor type.',
    role: 'A rotary valve plus a small gerotor "meter": every turn of the steering wheel sends a fixed volume of oil (its displacement) to the cylinder, so the wheels follow the steering wheel without any mechanical link. When the wheel is still, the open-centre valve returns the pump flow to the tank.',
    details: 'The gerotor type is standard practice; it is also called the control valve on the steering column.',
  },
  rotor: { summary: 'Gerotor rotor (6 teeth).', role: 'Turned by the steering shaft. Its centre orbits six times per turn inside the 7-roller ring, opening and closing the oil pockets that meter the flow.' },
  stator: { summary: 'Gerotor ring with 7 rollers.' },
  sleeve: { summary: 'Valve spool/sleeve.', role: 'Twists slightly against centring springs when the wheel is turned, opening the ports to the pump and to the chosen cylinder end.' },
  pump: { summary: 'Engine-driven pump.', role: 'Supplies oil to the steering valve. Belt-driven from the fan pulley on many power-assisted systems. With the engine off there is no flow — a hydrostatic system cannot then be steered.' },
  tank: { summary: 'Reservoir.' },
  wheel: { summary: 'Steering wheel and column.' },
  box: { summary: 'Steering box (manual).', role: 'Worm-and-peg or recirculating-ball box; see the Steering boxes scene. In the power-assisted system the ram’s control valve is worked by a linkage from the box.' },
  drop: { summary: 'Drop arm.', role: 'Swings fore-and-aft on the rocker shaft of the steering box.' },
  drag: { summary: 'Drag link.', role: 'Carries the drop-arm movement to the steering arm on the left stub axle.' },
  upper: { summary: 'Upper steering arm (left).' },
  hoses: { summary: 'Hoses.', role: 'Pressure line from the pump, return line to the tank, and the two cylinder lines.' },
}

const RED = new THREE.Color('#d8452e')
const AMBER = new THREE.Color('#c99a2e')
const tmp = new THREE.Vector3()
const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
function bar(m: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3, t: number, d: number) {
  if (!m) return
  tmp.subVectors(b, a)
  const len = tmp.length()
  m.quaternion.setFromUnitVectors(X, tmp.normalize())
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.scale.set(len, t, d)
}
function rodTo(m: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3, d: number) {
  if (!m) return
  tmp.subVectors(b, a)
  const len = tmp.length()
  m.quaternion.setFromUnitVectors(Y, tmp.normalize())
  m.position.copy(a)
  m.scale.set(d, len, d)
}
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const ARM_Y = AX.y - 0.06

/** World position of a point (local x along the cylinder, up = y) for a cylinder at length L. */
function cylFrame(dL: number) {
  const P = armEnd(1, dL, CYL.frac)
  const ang = Math.atan2(P.z - CYL.anchor.z, P.x - CYL.anchor.x)
  return { P, ang, at: (s: number, up: number) => v3(CYL.anchor.x + s * Math.cos(ang), CYL.y + up, CYL.anchor.z + s * Math.sin(ang)) }
}

export function Steering3D() {
  const g = steeringParts()
  const variant = useSteer((s) => s.variant)
  const flows = useSteer((s) => s.flows)
  const hydro = variant === 'hydrostatic'

  const capMat = useMemo(() => createDynamicCutMaterial({ color: '#c99a2e', hatch: 'fluid', roughness: 0.2 }), [])
  const annMat = useMemo(() => createDynamicCutMaterial({ color: '#c99a2e', hatch: 'fluid', roughness: 0.2 }), [])

  const hoses = useMemo(() => {
    const f = cylFrame(0)
    const R = CYL.bore / 2 + 0.007
    const capPort = f.at(0.03, R)
    const rodPort = f.at(RAM_BARREL - 0.035, R)
    const src = hydro ? v3(LAY.mu.x, LAY.mu.y - 0.05, 0) : v3(LAY.box.x + 0.12, LAY.box.y + 0.08, 0)
    const pump = v3(LAY.pump.x, LAY.pump.y, LAY.pump.z)
    const tank = v3(LAY.tank.x, LAY.tank.y + 0.02, LAY.tank.z)
    const run = (a: THREE.Vector3, b: THREE.Vector3, dz: number, y = 0.62) =>
      new THREE.CatmullRomCurve3([a, a.clone().add(v3(0.05, -0.1, dz)), v3(a.x + 0.25, y, a.z + dz), v3(b.x - 0.25, y, b.z + dz * 0.5), b.clone().add(v3(-0.05, 0.06, 0)), b])
    const P = run(pump, src, -0.08)
    const T = run(tank, src, 0.08, 0.66)
    const toCap = run(src, capPort, -0.03, 0.58)
    const toRod = run(src, rodPort, 0.03, 0.6)
    // flow paths go source → destination; P from pump to valve, T from valve to tank
    const PFlow = P
    const TFlow = new THREE.CatmullRomCurve3(T.points.slice().reverse())
    const rev = (c: THREE.CatmullRomCurve3) => new THREE.CatmullRomCurve3(c.points.slice().reverse())
    const mk = (c: THREE.Curve<THREE.Vector3>) => pipe(c, 0.009, 0.0062, 60, 12)
    return { geo: [P, T, toCap, toRod].map(mk), PFlow, TFlow, toCap, capBack: rev(toCap), toRod, rodBack: rev(toRod) }
  }, [hydro])

  const st = useRef({ wheel: 0, len: cylLength(0), t: 0 })
  const wheelL = useRef<THREE.Group>(null)
  const wheelR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Mesh>(null)
  const armR = useRef<THREE.Mesh>(null)
  const track = useRef<THREE.Mesh>(null)
  const ballL = useRef<THREE.Mesh>(null)
  const ballR = useRef<THREE.Mesh>(null)
  const stud = useRef<THREE.Mesh>(null)
  const cyl = useRef<THREE.Group>(null)
  const piston = useRef<THREE.Group>(null)
  const capOil = useRef<THREE.Mesh>(null)
  const annOil = useRef<THREE.Mesh>(null)
  const swheel = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)
  const sleeve = useRef<THREE.Group>(null)
  const drop = useRef<THREE.Mesh>(null)
  const drag = useRef<THREE.Mesh>(null)
  const upper = useRef<THREE.Mesh>(null)

  useSimFrame((dt) => {
    const p = useSteer.getState()
    const s = st.current
    s.t += dt
    const turns = turnsLockToLock(p.D)
    const amp = p.variant === 'hydrostatic' ? (turns / 2) * 360 * 1.08 : p.ratio * ((LEFT.max * 180) / PI) * 1.02
    const target = p.auto ? amp * Math.sin((2 * PI * s.t) / 9) : p.wheel
    const maxRate = 300 * dt
    const prev = s.wheel
    s.wheel += Math.max(-maxRate, Math.min(maxRate, target - s.wheel))
    const dW = s.wheel - prev // degrees, + = left

    let dL: number
    let blocked = false
    let atLock = false
    let qCyl = 0
    if (p.variant === 'hydrostatic') {
      if (!p.engineOn) {
        blocked = Math.abs(dW) > 1e-9
      } else if (dW !== 0) {
        const vol = (Math.abs(dW) / 360) * p.D * 1e-6
        const dLen = dW > 0 ? -vol / A_ANN : vol / A_CAP
        const next = Math.min(L_AT_RIGHT_LOCK, Math.max(L_AT_LEFT_LOCK, s.len + dLen))
        atLock = next !== s.len + dLen
        if (dt > 0) qCyl = (Math.sign(dW) * vol * 60000) / dt
        s.len = next
      }
      dL = angleForLength(s.len)
    } else {
      const want = ((s.wheel / p.ratio) * PI) / 180
      dL = Math.min(LEFT.max, Math.max(LEFT.min, want))
      atLock = dL !== want
      const newLen = cylLength(dL)
      if (dt > 0 && p.engineOn) qCyl = (-(newLen - s.len) * (newLen < s.len ? A_ANN : A_CAP) * 60000) / dt
      s.len = newLen
    }
    const dR = rightAngle(dL)
    const toe = p.showToe ? toeAngle(p.toe) * 20 : toeAngle(p.toe)
    wheelL.current?.rotation.set(0, -(dL - toe), 0)
    wheelR.current?.rotation.set(0, -(dR + toe), 0)

    const PL = armEnd(1, dL)
    const PR = armEnd(-1, dR)
    bar(armL.current, v3(0, ARM_Y, AX.kpZ), v3(PL.x, ARM_Y, PL.z), 0.04, 0.03)
    bar(armR.current, v3(0, ARM_Y, -AX.kpZ), v3(PR.x, ARM_Y, PR.z), 0.04, 0.03)
    rodTo(track.current, v3(PR.x, ARM_Y, PR.z), v3(PL.x, ARM_Y, PL.z), 0.032)
    ballL.current?.position.set(PL.x, ARM_Y, PL.z)
    ballR.current?.position.set(PR.x, ARM_Y, PR.z)

    const f = cylFrame(dL)
    rodTo(stud.current, v3(f.P.x, ARM_Y, f.P.z), v3(f.P.x, CYL.y, f.P.z), 0.024)
    cyl.current?.rotation.set(0, -f.ang, 0)
    const len = Math.hypot(f.P.x - CYL.anchor.x, f.P.z - CYL.anchor.z)
    const sp = len - RAM_ROD
    piston.current?.position.set(sp, 0, 0)
    if (capOil.current) capOil.current.scale.x = Math.max(1e-4, sp)
    if (annOil.current) {
      annOil.current.position.x = sp + PISTON_W
      annOil.current.scale.x = Math.max(1e-4, RAM_BARREL - GLAND_IN - sp - PISTON_W)
    }
    const left = qCyl > 0.05
    const right = qCyl < -0.05
    const capCol = right ? RED : AMBER
    const annCol = left ? RED : AMBER
    capMat.material.color.copy(capCol)
    capMat.capColor.copy(capCol)
    annMat.material.color.copy(annCol)
    annMat.capColor.copy(annCol)
    const inter = useView.getState().cut.intersection
    capMat.material.clipIntersection = inter
    annMat.material.clipIntersection = inter

    swheel.current?.rotation.set(0, -(s.wheel * PI) / 180, 0)
    const gp = gerotorPose((s.wheel * PI) / 180)
    rotor.current?.position.set(gp.cx, 0, gp.cy)
    rotor.current?.rotation.set(0, -gp.spin, 0)
    sleeve.current?.rotation.set(0, -gp.spin, 0)

    // manual linkage of the power-assisted variant
    const kp = v3(0, LAY.upperY, AX.kpZ)
    const ue = v3(LAY.upperArm * Math.sin(dL), LAY.upperY, AX.kpZ - LAY.upperArm * Math.cos(dL))
    bar(upper.current, kp, ue, 0.035, 0.025)
    const gam = Math.asin(Math.max(-1, Math.min(1, (LAY.upperArm * Math.sin(dL)) / LAY.dropLen)))
    const pivot = v3(LAY.box.x, LAY.box.y, LAY.dropZ)
    const de = v3(LAY.box.x + LAY.dropLen * Math.sin(gam), LAY.box.y - LAY.dropLen * Math.cos(gam), LAY.dropZ)
    bar(drop.current, pivot, de, 0.04, 0.03)
    rodTo(drag.current, de, ue, 0.028)

    live.wheel = s.wheel
    live.left = dL
    live.right = dR
    live.cylLen = len
    live.qCyl = qCyl
    live.qTank = p.engineOn ? Math.max(0, p.Q - Math.abs(qCyl)) : 0
    live.atLock = atLock
    live.blocked = blocked
  })

  const on = () => useSteer.getState().engineOn
  const k = (q: number) => Math.min(1, Math.abs(q) / 12) * 0.8 + 0.2

  const wheelAssembly = (side: 1 | -1, ref: Ref<THREE.Group>) => (
    <group ref={ref} position={[0, AX.y, side * AX.kpZ]}>
      <PartMesh geometry={g.stub} material="forged" position={[0, 0, (side * (AX.wheelZ - AX.kpZ)) / 2]} />
      <group position={[0, 0, side * (AX.wheelZ - AX.kpZ)]} rotation={[0, side > 0 ? 0 : PI, 0]}>
        <PartMesh geometry={g.tyre} material="rubber" />
        <PartMesh geometry={g.rim} material="paintRed" />
      </group>
    </group>
  )

  return (
    <group>
      <Part id="steering" name="Steering system" role="housing" material="paintRed" info={INFO.system} cites={hydro ? CITE.hydro : CITE.assist}>
        <Part id="axle-beam" name="Front axle beam" material="paintRed" role="housing" info={INFO.beam} cites={CITE.manual}>
          <PartMesh geometry={g.beam} position={[0, AX.y, 0]} />
          <Part id="kingpins" name="Kingpin housings" material="castIron" role="housing" info={INFO.kingpin} cites={CITE.manual}>
            <PartMesh geometry={g.kingpin} position={[0, AX.y, AX.kpZ]} />
            <PartMesh geometry={g.kingpin} position={[0, AX.y, -AX.kpZ]} />
          </Part>
        </Part>
        <Part id="front-wheels" name="Front wheels & stub axles" role="moving" material="rubber" info={INFO.wheels} cites={CITE.manual} explode={[0.25, 0, 0]}>
          {wheelAssembly(1, wheelL)}
          {wheelAssembly(-1, wheelR)}
        </Part>
        <Part id="steering-arms" name="Steering arms" material="forged" role="moving" info={INFO.arms} cites={CITE.manual} beyondNotes>
          <PartMesh ref={armL} geometry={g.bar} />
          <PartMesh ref={armR} geometry={g.bar} />
        </Part>
        <Part id="track-rod" name="Track rod" material="steel" role="moving" info={INFO.trackRod} cites={[...CITE.manual, ...CITE.toe]} explode={[-0.15, 0, 0]}>
          <PartMesh ref={track} geometry={g.rodBar} />
          <PartMesh ref={ballL} geometry={g.ballJoint} material="steelDark" />
          <PartMesh ref={ballR} geometry={g.ballJoint} material="steelDark" />
          <PartMesh ref={stud} geometry={g.rodBar} material="steelDark" />
        </Part>

        <group position={[CYL.anchor.x, CYL.y, CYL.anchor.z]}>
          <group ref={cyl}>
            <Part id="steer-cylinder" name="Steering cylinder" material="paintBlack" role="static" info={INFO.cylinder} cites={hydro ? CITE.hydro : CITE.assist} explode={[0, 0.2, 0]}>
              <PartMesh geometry={g.cyl.barrel} />
              <Part id="steer-gland" name="Gland and rod seals" material="steelDark" info={{ summary: 'Gland (rod-end head).', role: 'Guides the rod; its seal holds the rod-end pressure and the wiper keeps dirt out.' }}>
                <PartMesh geometry={g.cyl.gland.body} />
                <PartMesh geometry={g.cyl.gland.rodSeal} material="rubber" />
                <PartMesh geometry={g.cyl.gland.wiper} material="rubber" />
              </Part>
              <Part id="cap-oil" name="Cap-end oil" role="fluid" info={INFO.capOil}>
                <PartMesh ref={capOil} geometry={g.cyl.unitOil} customMaterial={capMat.material} castShadow={false} />
              </Part>
              <Part id="ann-oil" name="Rod-end oil" role="fluid" info={INFO.annOil}>
                <PartMesh ref={annOil} geometry={g.cyl.annOil} customMaterial={annMat.material} castShadow={false} />
              </Part>
              <group ref={piston}>
                <Part id="steer-piston" name="Piston & rod" material="chrome" role="moving" info={{ summary: 'Piston and rod.', role: 'The rod end is pinned to the left steering arm.' }}>
                  <PartMesh geometry={g.cyl.piston} material="steel" />
                  <PartMesh geometry={g.cyl.seals} material="rubber" />
                  <PartMesh geometry={g.cyl.rod} />
                </Part>
              </group>
            </Part>
          </group>
        </group>

        <Part id="pump" name="Pump" material="aluminium" role="static" info={INFO.pump} cites={hydro ? CITE.hydro : CITE.assist} explode={[0.15, 0.1, -0.1]}>
          <PartMesh geometry={g.pump} position={[LAY.pump.x, LAY.pump.y, LAY.pump.z]} />
        </Part>
        <Part id="tank" name="Reservoir" material="paintBlack" role="housing" info={INFO.tank} cites={CITE.assist} explode={[0.15, 0.1, 0.1]}>
          <PartMesh geometry={g.tank} position={[LAY.tank.x, LAY.tank.y - 0.1, LAY.tank.z]} />
          <PartMesh geometry={g.tankOil} material="hydraulicOil" position={[LAY.tank.x, LAY.tank.y - 0.1, LAY.tank.z]} />
        </Part>

        <Part id="steering-wheel" name="Steering wheel & column" material="plastic" role="moving" info={INFO.wheel} cites={CITE.manual}>
          <group ref={swheel} position={[LAY.mu.x, LAY.wheelY, 0]}>
            <PartMesh geometry={g.rimRing} />
            <PartMesh geometry={g.spokes} material="steelDark" />
            <PartMesh geometry={g.hub} material="paintBlack" />
          </group>
          {hydro ? (
            <PartMesh geometry={g.column} material="steel" position={[LAY.mu.x, (LAY.mu.y + 0.06 + LAY.wheelY) / 2, 0]} />
          ) : (
            <PartMesh geometry={g.rodBar} material="steel" position={[LAY.box.x, LAY.box.y, 0]} scale={[0.032, LAY.wheelY - LAY.box.y, 0.032]} />
          )}
        </Part>

        {hydro ? (
          <group position={[LAY.mu.x, LAY.mu.y, LAY.mu.z]}>
            <Part id="metering-unit" name="Steering control unit (metering valve)" material="castIron" role="housing" info={INFO.mu} cites={CITE.hydro} beyondNotes explode={[0, 0.12, 0.25]}>
              <PartMesh geometry={g.mu.housing} />
              <Part id="gerotor-ring" name="Gerotor ring & rollers" material="steelDark" role="static" info={INFO.stator} beyondNotes>
                <PartMesh geometry={g.mu.stator} position={[0, -0.022, 0]} />
                <PartMesh geometry={g.mu.rollers} material="steel" position={[0, -0.022, 0]} />
              </Part>
              <Part id="gerotor-rotor" name="Gerotor rotor" material="steel" role="moving" info={INFO.rotor} beyondNotes>
                <group position={[0, -0.022, 0]}>
                  <group ref={rotor}>
                    <PartMesh geometry={g.mu.rotor} />
                  </group>
                </group>
              </Part>
              <Part id="valve-sleeve" name="Valve spool & sleeve" material="chrome" role="moving" info={INFO.sleeve} beyondNotes>
                <group ref={sleeve}>
                  <PartMesh geometry={g.mu.sleeve} />
                </group>
              </Part>
            </Part>
          </group>
        ) : (
          <Part id="manual-linkage" name="Steering box & manual linkage" material="castIron" role="static" info={INFO.box} cites={CITE.assist}>
            <PartMesh geometry={g.box} position={[LAY.box.x, LAY.box.y, 0]} />
            <PartMesh geometry={g.valveBlock} material="aluminium" position={[LAY.box.x + 0.115, LAY.box.y + 0.05, 0]} />
            <PartMesh geometry={g.sectorShaft} material="steel" position={[LAY.box.x, LAY.box.y, 0]} />
            <Part id="drop-arm" name="Drop arm" material="forged" role="moving" info={INFO.drop} cites={CITE.manual}>
              <PartMesh ref={drop} geometry={g.bar} />
            </Part>
            <Part id="drag-link" name="Drag link" material="steel" role="moving" info={INFO.drag} cites={CITE.manual}>
              <PartMesh ref={drag} geometry={g.rodBar} />
            </Part>
            <Part id="upper-arm" name="Upper steering arm" material="forged" role="moving" info={INFO.upper} cites={CITE.manual}>
              <PartMesh ref={upper} geometry={g.bar} />
            </Part>
          </Part>
        )}

        <Part id="hoses" name="Hoses" material="rubber" role="static" cut={false} info={INFO.hoses}>
          {hoses.geo.map((h, i) => (
            <PartMesh key={`${variant}${i}`} geometry={h} />
          ))}
        </Part>

        {flows ? (
          <>
            <Flow curve={hoses.PFlow} count={70} radius={0.007} color="#ff6a4a" speed={0.35} spread={0.005} intensity={() => (on() ? 0.8 : 0)} />
            <Flow curve={hoses.TFlow} count={70} radius={0.007} color="#f2c14e" speed={0.35} spread={0.005} intensity={() => (live.qTank > 0.5 || live.qCyl !== 0 ? 0.8 : 0)} />
            <Flow curve={hoses.toRod} count={60} radius={0.007} color="#ff6a4a" speed={0.4} spread={0.005} intensity={() => (live.qCyl > 0.05 ? k(live.qCyl) : 0)} />
            <Flow curve={hoses.capBack} count={60} radius={0.007} color="#f2c14e" speed={0.4} spread={0.005} intensity={() => (live.qCyl > 0.05 ? k(live.qCyl) : 0)} />
            <Flow curve={hoses.toCap} count={60} radius={0.007} color="#ff6a4a" speed={0.4} spread={0.005} intensity={() => (live.qCyl < -0.05 ? k(live.qCyl) : 0)} />
            <Flow curve={hoses.rodBack} count={60} radius={0.007} color="#f2c14e" speed={0.4} spread={0.005} intensity={() => (live.qCyl < -0.05 ? k(live.qCyl) : 0)} />
          </>
        ) : null}
      </Part>

      <PartLabel partId="axle-beam" at={[0.06, AX.y + 0.1, 0.3]} />
      <PartLabel partId="front-wheels" at={[0.2, AX.y + 0.42, AX.wheelZ]} />
      <PartLabel partId="track-rod" at={[-0.2, ARM_Y - 0.05, -0.3]} />
      <PartLabel partId="steering-arms" at={[-0.15, ARM_Y, AX.kpZ + 0.05]} />
      <PartLabel partId="steer-cylinder" at={[-0.1, CYL.y + 0.07, 0.15]} />
      <PartLabel partId="pump" at={[LAY.pump.x, LAY.pump.y + 0.1, LAY.pump.z]} />
      <PartLabel partId="tank" at={[LAY.tank.x, LAY.tank.y + 0.14, LAY.tank.z]} />
      <PartLabel partId="steering-wheel" at={[LAY.mu.x, LAY.wheelY + 0.08, 0.2]} />
      {hydro ? <PartLabel partId="metering-unit" at={[LAY.mu.x + 0.08, LAY.mu.y, 0.08]} /> : <PartLabel partId="drag-link" at={[-0.7, LAY.upperY + 0.06, 0.55]} />}
      <PartLabel partId="hoses" at={[-0.7, 0.66, -0.1]} />
    </group>
  )
}
