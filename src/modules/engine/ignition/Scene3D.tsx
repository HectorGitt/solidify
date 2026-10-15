import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, mat4, xform } from '@/geometry'
import { ALTERNATOR, DYNAMO, chargeCurrent, dwellTime, primaryCurrent } from '@/physics/electrical'
import { TYPICAL_IMPULSE, impulseCoupling, magnetoKV, secondaryAvailableVolts } from '@/physics/engineExtra'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { capUniforms } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import {
  ALT_C,
  BAT_C,
  BATT,
  COIL_P,
  CRANK_P,
  DASH,
  DIST,
  DYN_C,
  HOT_X,
  COLD_X,
  MAG_C,
  PAWL_R,
  PINION_REST_Z,
  PLUG_BLOCK_TOP,
  RING_Z,
  R_ALT,
  R_CRANK,
  R_DYN,
  camLift,
  capAngle,
  getIgnitionGeometry,
} from './geometry'
import { Engine, PLUG_AXIS, plugTerminal, type EnginePartKey, type EnginePartOverride } from '@/machines/Engine'
import { COIL, ENGINE_SCALE, ENGINE_Y, FIRING, FLY_C, HATCH, HEAD_TOP, PINION_TEETH, PLUG_X, PLUG_Z, RING_TEETH, STARTER_ANGLE, STARTER_C, live, starterCmd, useIgn } from './model'

const { PI } = Math
const D2R = PI / 180

const C = {
  coil: [SRC.l4_509('battery (coil) ignition: 6/12 V, 200–300 / ≈21 000 turns, 4-corner breaker cam'), SRC.tb509('§5.2.1, Table 5.1, Fig 5.2')],
  mag: [SRC.supp509('magneto ignition system: components'), SRC.tb509('§5.2.2, Fig 5.3 impulse coupling')],
  plug: [SRC.tb509('§5.4, Fig 5.4 hot and cold plugs; gap ≈ 0.6 mm'), SRC.tb509('§5.5 ignition timing ≈ 25° BTDC')],
  start: [SRC.tb509('§5.6.4 starter, Fig 5.8')],
  bat: [SRC.tb509('§5.6.1 battery, Fig 5.5')],
  gen: [SRC.tb509('§5.6.2 dynamo, Fig 5.6; §5.6.3 alternator, Fig 5.7')],
}

/** Thin flexible cable along points (no end caps — cables are never sectioned). */
function wire(pts: [number, number, number][], r = 0.0025) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), Math.max(24, pts.length * 16), r, 8, false)
}
const curve = (pts: [number, number, number][]) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
const add = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

function Spark({ at, refFn, size = 0.0018 }: { at: [number, number, number]; refFn: (m: THREE.Mesh | null) => void; size?: number }) {
  const geo = useMemo(() => new THREE.SphereGeometry(size, 12, 8), [size])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d6ecff', transparent: true, opacity: 0.95 }), [])
  return <mesh ref={refFn} geometry={geo} material={mat} position={at} visible={false} />
}

/** the coil system's ids, names, cards and sources for the shared engine's parts */
const IGN_IDS: Partial<Record<EnginePartKey, string>> = { 'spark-plugs': 'plugs' }
const ignK = (key: EnginePartKey) => IGN_IDS[key] ?? key
const IGN_PARTS: Partial<Record<EnginePartKey, EnginePartOverride>> = {
  'spark-plugs': { name: 'Spark plugs (4)', info: { summary: 'One spark plug per cylinder.', role: 'The high-voltage current jumps the air gap (≈ 0.6 mm) between the electrodes and ignites the mixture.' }, cites: C.plug },
}
/** plug terminal in the scene, and the plug axis */
const plugTopAt = (c: number): [number, number, number] => {
  const p = plugTerminal(PLUG_Z[c - 1] / ENGINE_SCALE).multiplyScalar(ENGINE_SCALE)
  return [p.x, p.y + ENGINE_Y, p.z]
}

/* ======================================================================================
 * (a) Battery (coil) ignition — four-cylinder engine, firing order 1-3-4-2
 * ====================================================================================== */

function CoilSystem() {
  const g = getIgnitionGeometry().coil
  const sparkY = g.plug.sparkY
  const theta = useRef(0)
  const camRef = useRef<THREE.Group>(null)
  const rotorRef = useRef<THREE.Group>(null)
  const armRef = useRef<THREE.Group>(null)
  const needle = useRef<THREE.Group>(null)
  const sparks = useRef<(THREE.Mesh | null)[]>([])

  const tower = (c: number): [number, number, number] => add(DIST, [0.0235 * Math.cos(capAngle(c)), 0.053, -0.0235 * Math.sin(capAngle(c))])
  const W = useMemo(() => {
    const battPos = add(BATT, [-0.075, 0.115, -0.03])
    const battNeg = add(BATT, [0.075, 0.115, -0.03])
    const amm = add(DASH, [-0.035, 0, -0.006])
    const sw = add(DASH, [0.04, 0, -0.006])
    const coilPos = add(COIL_P, [0.017, 0.139, 0])
    const coilNeg = add(COIL_P, [-0.017, 0.139, 0])
    const coilHT = add(COIL_P, [0, 0.15, 0])
    const distLT = add(DIST, [0.03, -0.03, 0.012])
    const cond = add(DIST, [0.041, -0.015, -0.012])
    const capC = add(DIST, [0, 0.056, 0])
    const lt1: [number, number, number][] = [battPos, add(battPos, [0, 0.06, 0]), [0.31, 0.06, -0.13], add(amm, [0, -0.02, -0.01]), amm]
    const lt2: [number, number, number][] = [amm, add(amm, [0.03, -0.03, -0.012]), sw]
    const lt3: [number, number, number][] = [sw, add(sw, [0, -0.05, 0.02]), [0.3, 0.14, -0.02], add(coilPos, [0.01, 0.03, 0]), coilPos]
    const lt4: [number, number, number][] = [coilNeg, add(coilNeg, [-0.01, 0.02, 0.01]), [0.185, 0.03, 0.02], add(distLT, [0.012, 0, 0]), distLT]
    const condLead: [number, number, number][] = [add(cond, [0, 0.03, 0]), add(cond, [0.004, 0.04, 0.01]), distLT]
    const earth: [number, number, number][] = [battNeg, add(battNeg, [0, 0.05, 0]), [0.3, -0.12, 0.17], [0.08, -0.2, 0.15]]
    const ht0: [number, number, number][] = [coilHT, add(coilHT, [0, 0.03, 0]), [0.17, 0.12, 0], add(capC, [0, 0.03, 0]), capC]
    // up from the cap clear of the manifolds, over, and down each plug well onto the terminal
    const up = 0.24
    const ht = [1, 2, 3, 4].map((c) => {
      const a = tower(c)
      const b = plugTopAt(c)
      const above = add(b, PLUG_AXIS.clone().multiplyScalar(0.075).toArray())
      return [a, add(a, [0.004, 0.035, 0]), [a[0], up, (a[2] + b[2]) / 2], [(a[0] + above[0]) / 2, up + 0.01, b[2]], above, add(b, PLUG_AXIS.clone().multiplyScalar(0.02).toArray()), b] as [number, number, number][]
    })
    return { lt: [lt1, lt2, lt3, lt4], condLead, earth, ht0, ht }
  }, [])
  const geo = useMemo(
    () => ({
      lt: W.lt.map((p) => wire(p, 0.0022)),
      cond: wire(W.condLead, 0.0016),
      earth: wire(W.earth, 0.004),
      ht0: wire(W.ht0, 0.0034),
      ht: W.ht.map((p) => wire(p, 0.0034)),
      flowLT: curve([...W.lt[0], ...W.lt[1].slice(1), ...W.lt[2].slice(1)]),
      flowLT2: curve(W.lt[3]),
      flowHT0: curve(W.ht0),
      flowHT: W.ht.map(curve),
    }),
    [W],
  )

  useSimFrame((dt) => {
    const st = useIgn.getState()
    theta.current = (theta.current + st.rpm * 6 * dt) % 720
    const th = theta.current
    const rotor = th / 2
    const beta = rotor + st.advance / 2
    rotorRef.current?.rotation.set(0, beta * D2R, 0)
    camRef.current?.rotation.set(0, (beta + 18) * D2R, 0)
    const lift = camLift((beta + 18) * D2R)
    armRef.current?.rotation.set(0, lift / 0.017, 0)
    const closed = lift <= 1e-9
    // time the points have been closed (real engine time) → primary current
    const sinceClose = ((((beta + 18) % 90) + 90) % 90) - 18
    const closedFor = closed ? Math.max(0, (sinceClose * 2) / (6 * st.rpm)) : 0
    const I = closed ? primaryCurrent(closedFor, st.volts, COIL.R, COIL.L) : 0
    const Ibreak = primaryCurrent(dwellTime(st.rpm, 4, 0.6), st.volts, COIL.R, COIL.L)
    let sparkCyl = 0
    for (let c = 1; c <= 4; c++) {
      const s = (((FIRING[c - 1] - st.advance) % 720) + 720) % 720
      const d = (((th - s) % 720) + 720) % 720
      if (d < 10) sparkCyl = c
    }
    sparks.current.forEach((m, i) => {
      if (m) m.visible = sparkCyl === i + 1
    })
    needle.current?.rotation.set(0, 0, (I / (st.volts / COIL.R)) * 0.9)
    live.crank = th
    live.rotor = rotor % 360
    live.closed = closed
    live.current = I
    live.sparkCyl = sparkCyl
    live.kv = secondaryAvailableVolts(Ibreak, COIL.L, COIL.C, st.n1, st.n2, COIL.coupling) / 1000
  })

  const Imax = () => useIgn.getState().volts / COIL.R
  return (
    <Part id="coil-system" name="Battery (coil) ignition" role="housing" material="castIron" info={{ summary: 'Battery ignition for a four-cylinder petrol engine.', role: 'Primary circuit: battery, ammeter, switch, coil primary, contact breaker, condenser. Secondary: coil secondary, distributor rotor and cap, HT leads, spark plugs.' }} cites={C.coil}>
      <Part id="engine" name="Four-cylinder petrol engine" material="castIron" role="housing" info={{ summary: 'Four-cylinder petrol engine (67 × 83 mm), firing order 1-3-4-2 (cylinder 1 at the front), every part working.', role: 'Each spark is timed to arrive a little before its piston reaches top dead centre on the compression stroke.' }} cites={[SRC.tb509('§2.6.4')]}>
        <Engine
          firing={FIRING}
          ignition="spark"
          position={[0, ENGINE_Y, 0]}
          scale={ENGINE_SCALE}
          // the coil system counts each cylinder's firing angle from its compression TDC
          crankAngle={() => ((theta.current + 360) * PI) / 180}
          k={ignK}
          parts={IGN_PARTS}
          plugParts={(i) => <Spark at={[0, sparkY, 0]} size={0.0027} refFn={(m) => void (sparks.current[i] = m)} />}
        />
      </Part>
      <Part id="distributor" name="Distributor" material="aluminium" role="housing" info={{ summary: 'Distributor (driven at half engine speed).', role: 'Carries the contact breaker and its cam, and the rotor arm that sends each HT pulse to the right plug in firing order.' }} cites={C.coil}>
        <group position={DIST}>
          <PartMesh geometry={g.dist.body} />
          <PartMesh geometry={g.dist.bracket} />
          <PartMesh geometry={g.dist.plate} material="steel" />
          <Part id="dist-cap" name="Distributor cap" material="plastic" role="housing" info={{ summary: 'Insulating cap with a centre electrode (from the coil) and one segment per cylinder.' }} cites={C.coil} explode={[0, 0.07, 0]}>
            <PartMesh geometry={g.dist.cap} />
            <PartMesh geometry={g.dist.towers} />
            <PartMesh geometry={g.dist.segments} material="brass" />
          </Part>
          <Part id="breaker" name="Contact breaker (points)" material="steel" role="moving" info={{ summary: 'Contact-breaker points.', role: 'Interrupt the primary current at the desired time; when they open, the coil’s field collapses and induces the high voltage. The gap is drawn larger than real.' }} cites={C.coil}>
            <PartMesh geometry={g.dist.fixedContact} />
            <PartMesh geometry={g.dist.pivot} />
            <group ref={armRef} position={[0.013, -0.034, -0.017]}>
              <PartMesh geometry={g.dist.arm} />
            </group>
          </Part>
          <Part id="breaker-cam" name="Breaker cam (4 corners) & shaft" material="forged" role="moving" info={{ summary: 'Four-cornered breaker cam for a four-cylinder engine; a six-cylinder engine has a hexagonal cam.', role: 'Each corner opens the points once: four sparks per turn of the distributor, i.e. per two crank revolutions.' }} cites={[SRC.l4_509('contact breaker cam has 4 corners')]}>
            <group ref={camRef}>
              <PartMesh geometry={g.dist.cam} />
              <PartMesh geometry={g.dist.shaft} material="steel" />
            </group>
          </Part>
          <Part id="rotor" name="Rotor arm" material="plastic" role="moving" info={{ summary: 'Rotor arm.', role: 'Connects the centre electrode (from the coil) to each cap segment in turn, distributing the HT pulses in firing order.' }} cites={C.coil}>
            <group ref={rotorRef}>
              <PartMesh geometry={g.dist.rotor} />
              <PartMesh geometry={g.dist.rotorStrip} material="brass" />
            </group>
          </Part>
          <Part id="condenser" name="Condenser (capacitor)" material="aluminium" role="static" info={{ summary: 'Condenser.', role: 'Absorbs the current surge as the points open, reducing arcing at the points and speeding the collapse of the field.' }} cites={C.coil}>
            <PartMesh geometry={g.dist.condenser} position={[0.041, -0.045, -0.012]} />
          </Part>
        </group>
      </Part>
      <Part id="coil" name="Ignition coil" material="paintBlack" role="housing" info={{ summary: 'Ignition coil — a step-up (auto-)transformer.', role: 'Primary: 200–300 turns of 20 SWG wire. Secondary: about 21 000 turns of 40 SWG wire, its bottom end joined to the primary. Induces a high voltage in the secondary when the primary current is interrupted.' }} cites={C.coil}>
        <group position={COIL_P}>
          <PartMesh geometry={g.coil.can} />
          <PartMesh geometry={g.coil.top} material="plastic" />
          <PartMesh geometry={g.coil.terms} material="brass" />
          <Part id="coil-core" name="Laminated iron core" material="steelDark" role="static">
            <PartMesh geometry={g.coil.core} />
          </Part>
          <Part id="secondary" name="Secondary winding (≈21 000 turns)" material="copper" role="static" info={{ summary: 'Secondary winding: about 21 000 turns of fine 40 SWG wire.' }} cites={C.coil}>
            <PartMesh geometry={g.coil.secondary} />
          </Part>
          <Part id="primary" name="Primary winding (200–300 turns)" material="bronze" role="static" info={{ summary: 'Primary winding: 200–300 turns of 20 SWG wire — drawn with fewer, thicker turns.' }} cites={C.coil}>
            <PartMesh geometry={g.coil.primary} />
          </Part>
          <PartMesh geometry={g.coil.pedestal} material="paintGrey" />
        </group>
      </Part>
      <Part id="battery" name="Battery (12 V)" material="plastic" role="housing" cut={false} info={{ summary: '6 or 12 V battery.', role: 'Supplies the primary current to the coil.' }} cites={C.bat}>
        <group position={BATT}>
          <PartMesh geometry={g.batt.case} />
          <PartMesh geometry={g.batt.lid} />
          <PartMesh geometry={g.batt.caps} material="paintBlack" />
          <PartMesh geometry={g.batt.pos} material="paintRed" />
          <PartMesh geometry={g.batt.neg} material="galvanised" />
        </group>
      </Part>
      <Part id="dash" name="Ammeter & ignition switch" material="paintBlack" role="housing" cut={false} info={{ summary: 'Ammeter and ignition switch.', role: 'The switch connects the battery to the coil; the ammeter shows the current drawn.' }} cites={C.coil}>
        <group position={DASH}>
          <PartMesh geometry={g.dash.panel} />
          <PartMesh geometry={g.dash.post} />
          <PartMesh geometry={g.dash.ammeter} material="chrome" />
          <PartMesh geometry={g.dash.switchBody} material="chrome" />
          <PartMesh geometry={g.dash.key} material="brass" position={[0.04, 0, 0]} />
          <group ref={needle} position={[-0.035, -0.006, 0.0135]}>
            <PartMesh geometry={g.dash.needle} material="paintRed" />
          </group>
        </group>
      </Part>
      <Part id="leads" name="LT wiring & HT leads" material="rubber" role="static" cut={false} info={{ summary: 'Low-tension wiring (thin) and high-tension leads (thick) to each plug in firing order 1-3-4-2.' }} cites={C.coil}>
        {geo.lt.map((w, i) => (
          <PartMesh key={i} geometry={w} material="paintRed" />
        ))}
        <PartMesh geometry={geo.cond} material="paintRed" />
        <PartMesh geometry={geo.earth} material="paintBlack" />
        <PartMesh geometry={geo.ht0} />
        {geo.ht.map((w, i) => (
          <PartMesh key={i} geometry={w} />
        ))}
      </Part>
      <Flow curve={geo.flowLT} count={50} radius={0.0022} color="#6fb8ec" speed={0.6} spread={0.001} intensity={() => live.current / Imax()} />
      <Flow curve={geo.flowLT2} count={20} radius={0.0022} color="#6fb8ec" speed={0.6} spread={0.001} intensity={() => live.current / Imax()} />
      <Flow curve={geo.flowHT0} count={24} radius={0.0028} color="#e9f3ff" speed={6} spread={0.001} intensity={() => (live.sparkCyl ? 1 : 0)} emissive={1.2} />
      {geo.flowHT.map((c, i) => (
        <Flow key={i} curve={c} count={30} radius={0.0028} color="#e9f3ff" speed={6} spread={0.001} intensity={() => (live.sparkCyl === i + 1 ? 1 : 0)} emissive={1.2} />
      ))}
      <PartLabel partId="coil" at={add(COIL_P, [0.04, 0.12, 0.02])} />
      <PartLabel partId="distributor" at={add(DIST, [0.05, 0.07, 0.03])} />
      <PartLabel partId="breaker" at={add(DIST, [0.03, -0.03, 0.04])} />
      <PartLabel partId="condenser" at={add(DIST, [0.06, -0.02, -0.02])} />
      <PartLabel partId="battery" at={add(BATT, [0, 0.13, 0.06])} />
      <PartLabel partId="dash" at={add(DASH, [0, 0.06, 0])} />
      <PartLabel partId="plugs" at={[PLUG_X + 0.05, HEAD_TOP + 0.08, PLUG_Z[0]]} />
      <PartLabel partId="leads" at={[0.1, 0.13, 0.08]} />
    </Part>
  )
}

/* ======================================================================================
 * (b) Magneto with impulse coupling
 * ====================================================================================== */

const PLUG_M: [number, number, number] = [0.1, -0.2, 0]

function MagnetoSystem() {
  const g = getIgnitionGeometry()
  const m = g.magneto
  const drive = useRef(0)
  const sparkUntil = useRef(-1)
  const rotorRef = useRef<THREE.Group>(null)
  const camRef = useRef<THREE.Group>(null)
  const hubRef = useRef<THREE.Group>(null)
  const springRef = useRef<THREE.Group>(null)
  const armRef = useRef<THREE.Group>(null)
  const pawls = useRef<(THREE.Group | null)[]>([])
  const spark = useRef<THREE.Mesh | null>(null)
  const lead = useMemo(() => wire([add(MAG_C, [0, 0.091, 0]), add(MAG_C, [0.01, 0.13, 0.01]), [0.08, -0.05, 0.02], add(PLUG_M, [0, 0.1, 0]), add(PLUG_M, [0, 0.072, 0])], 0.0034), [])
  const stand = useMemo(() => ({ clamp: xform(box(0.026, 0.008, 0.02), mat4.t(PLUG_M[0] + 0.019, PLUG_M[1] + 0.012, 0)), pillar: xform(box(0.012, PLUG_M[1] + 0.008 - -0.25, 0.012), mat4.t(PLUG_M[0] + 0.028, (PLUG_M[1] + 0.008 - 0.25) / 2, 0)) }), [])
  const htFlow = useMemo(() => curve([add(MAG_C, [0, 0.091, 0]), add(MAG_C, [0.01, 0.13, 0.01]), [0.08, -0.05, 0.02], add(PLUG_M, [0, 0.1, 0]), add(PLUG_M, [0, 0.072, 0])]), [])

  useSimFrame((dt) => {
    const st = useIgn.getState()
    drive.current += st.crankRpm * 6 * dt
    const imp = impulseCoupling(drive.current, st.crankRpm, TYPICAL_IMPULSE)
    const rot = imp.rotorDeg
    rotorRef.current?.rotation.set(0, 0, rot * D2R)
    camRef.current?.rotation.set(0, 0, (rot - 25) * D2R)
    hubRef.current?.rotation.set(0, 0, drive.current * D2R)
    springRef.current?.rotation.set(0, 0, (rot + imp.springDeg * 0.5) * D2R)
    const phi = (rot - 25) * D2R
    const lift = 0.0007 * Math.max(0, Math.cos(2 * phi) - 0.8) / 0.2
    armRef.current?.rotation.set(0, 0, lift / 0.02)
    const r180 = ((rot % 180) + 180) % 180
    const speed = st.crankRpm * imp.speedFactor
    if (r180 > 6 && r180 < 12 && sparkUntil.current < drive.current && magnetoKV(Math.max(speed, st.crankRpm)) >= 10) sparkUntil.current = drive.current + 5
    if (spark.current) spark.current.visible = drive.current < sparkUntil.current
    pawls.current.forEach((p, k) => {
      if (!p) return
      const alpha = k * PI
      const world = (((rot + k * 180) % 360) + 360) % 360
      const atTop = world < 1 || world > 359
      const swing = imp.phase === 'wind-up' && atTop ? 60 : imp.phase === 'follow' ? 20 : 0
      p.rotation.set(0, 0, alpha + PI - swing * D2R)
    })
    live.drive = drive.current % 360
    live.mrotor = ((rot % 360) + 360) % 360
    live.phase = imp.phase
    live.spring = imp.springDeg
    if (imp.phase === 'snap' || imp.phase === 'solid' || imp.phase === 'follow') live.mkv = magnetoKV(speed)
  })

  return (
    <Part id="magneto-system" name="Magneto with impulse coupling" role="housing" material="paintRed" info={{ summary: 'Tractor magneto: generates its own ignition current — no battery.', role: 'Components: frame, permanent magnet, armature with primary and secondary windings, soft-iron field, rotor, breaker points, condenser.' }} cites={C.mag}>
      <group position={MAG_C}>
        <Part id="mag-frame" name="Frame (housing)" material="paintRed" role="housing" info={{ summary: 'Magneto frame.' }} cites={C.mag}>
          <PartMesh geometry={m.housing} />
          <PartMesh geometry={m.base} material="castIron" />
          <PartMesh geometry={m.terminal} material="brass" />
        </Part>
        <Part id="field" name="Soft-iron field (pole shoes)" material="steelDark" role="static" info={{ summary: 'Soft-iron pole shoes.', role: 'Carry the magnet’s flux up through the armature core; as the magnet turns, the flux through the armature reverses every half revolution.' }} cites={C.mag}>
          <PartMesh geometry={m.shoes} />
        </Part>
        <Part id="armature" name="Armature (primary & secondary)" material="steelDark" role="static" info={{ summary: 'Armature: iron core with a primary and a secondary winding.', role: 'When the primary current peaks the breaker opens it; the collapse induces a very high voltage in the secondary which jumps the plug gap.' }} cites={C.mag}>
          <PartMesh geometry={m.coreBar} />
          <PartMesh geometry={m.primary} material="bronze" />
          <PartMesh geometry={m.secondary} material="copper" />
        </Part>
        <Part id="mag-rotor" name="Rotating magnet & shaft" material="paintRed" role="moving" info={{ summary: 'Permanent-magnet rotor (N red, S grey).', role: 'Turned by the engine through the impulse coupling.' }} cites={C.mag}>
          <group ref={rotorRef}>
            <PartMesh geometry={m.north} />
            <PartMesh geometry={m.south} material="paintGrey" />
            <PartMesh geometry={m.shaft} material="steel" />
            <Part id="pawls" name="Impulse-coupling pawls (1, 2)" material="forged" info={{ summary: 'Pawls 1 and 2 on the magneto side of the coupling.', role: 'At cranking speed a pawl drops out and catches the stop pin, holding the magneto rotor while the spring winds up.' }} cites={C.mag}>
              <PartMesh geometry={m.plate} material="steel" />
              {[0, 1].map((k) => (
                <group key={k} ref={(el) => void (pawls.current[k] = el)} position={[-PAWL_R * Math.sin(k * PI), PAWL_R * Math.cos(k * PI), 0.05]}>
                  <PartMesh geometry={m.pawl} />
                </group>
              ))}
            </Part>
          </group>
        </Part>
        <Part id="mag-breaker" name="Breaker points & 2-lobe cam" material="steel" role="moving" info={{ summary: 'Contact breaker with a two-lobe cam: two sparks per revolution.', role: 'Opens the primary just as the impulse spring flings the rotor past the firing position.' }} cites={C.mag}>
          <group ref={camRef} position={[0, 0, 0]}>
            <PartMesh geometry={m.cam} material="forged" />
          </group>
          <PartMesh geometry={m.fixedContact} />
          <group ref={armRef} position={[-0.02, 0.0126, -0.05]}>
            <PartMesh geometry={m.arm} />
          </group>
          <PartMesh geometry={m.condenser} material="aluminium" />
        </Part>
        <Part id="stop-pin" name="Stop pin" material="steel" role="static" info={{ summary: 'Stop pin (3) fixed to the magneto frame.', role: 'Catches the engaged pawl so the rotor is held while the drive keeps turning.' }} cites={C.mag}>
          <PartMesh geometry={m.stopPin} />
        </Part>
        <Part id="impulse-hub" name="Impulse-coupling drive hub & spring" material="steelDark" role="moving" info={{ summary: 'Drive hub with spring.', role: 'Most tractor magnetos use an impulse coupling: the spring is wound up, then released at a set point to turn the magneto quickly and make starting easier. Kick-off lugs knock the pawl clear.' }} cites={C.mag}>
          <group ref={hubRef}>
            <PartMesh geometry={m.hub} />
          </group>
          <group ref={springRef}>
            <PartMesh geometry={m.spiral} material="steel" />
          </group>
        </Part>
      </group>
      <Part id="mag-plug" name="Spark plug" material="steel" role="housing" info={{ summary: 'Spark plug fed by the magneto’s HT lead.' }} cites={C.plug}>
        <group position={PLUG_M}>
          <PartMesh geometry={g.coil.plug.shell} />
          <PartMesh geometry={g.coil.plug.insulator} material="ceramic" />
          <PartMesh geometry={g.coil.plug.centre} material="steelDark" />
          <PartMesh geometry={g.coil.plug.terminal} material="brass" />
          <PartMesh geometry={g.coil.plug.ground} material="steelDark" />
          <Spark at={[0, g.coil.plug.sparkY, 0]} refFn={(el) => void (spark.current = el)} />
        </group>
        <PartMesh geometry={stand.clamp} material="paintGrey" />
        <PartMesh geometry={stand.pillar} material="paintGrey" />
        <PartMesh geometry={lead} material="rubber" />
      </Part>
      <Flow curve={htFlow} count={30} radius={0.0028} color="#e9f3ff" speed={5} spread={0.001} intensity={() => (spark.current?.visible ? 1 : 0)} emissive={1.2} />
      <PartLabel partId="armature" at={add(MAG_C, [0.04, 0.1, 0.03])} />
      <PartLabel partId="mag-rotor" at={add(MAG_C, [0.05, -0.01, 0.03])} />
      <PartLabel partId="impulse-hub" at={add(MAG_C, [0.04, 0.03, 0.08])} />
      <PartLabel partId="pawls" at={add(MAG_C, [-0.04, 0.035, 0.06])} />
      <PartLabel partId="stop-pin" at={add(MAG_C, [-0.03, 0.05, 0.05])} />
      <PartLabel partId="mag-breaker" at={add(MAG_C, [-0.03, 0.03, -0.06])} />
      <PartLabel partId="mag-plug" at={add(PLUG_M, [0.02, 0.09, 0])} />
    </Part>
  )
}

/* ======================================================================================
 * (c) Spark plugs: hot vs cold
 * ====================================================================================== */

function PlugSystem() {
  const p = getIgnitionGeometry().plug
  const gauge = useIgn((s) => s.gauge)
  const theta = useRef(0)
  const sparks = useRef<(THREE.Mesh | null)[]>([])
  const y0 = PLUG_BLOCK_TOP - 0.0195
  const heat = useMemo(
    () =>
      [
        [HOT_X, 0.016],
        [COLD_X, 0.006],
      ].map(([x, seat]) =>
        curve([
          [x + 0.0016, y0 + 0.0008, -0.0006],
          [x + 0.0035, y0 + seat * 0.6, -0.0006],
          [x + 0.0048, y0 + seat, -0.0006],
          [x + 0.0062, y0 + seat + 0.002, -0.0006],
          [x + 0.0068, y0 + 0.008, -0.0006],
          [x + 0.0095, PLUG_BLOCK_TOP - 0.004, -0.0006],
          [x + 0.016, PLUG_BLOCK_TOP - 0.012, -0.0006],
        ]),
      ),
    [y0],
  )
  useSimFrame((dt) => {
    const st = useIgn.getState()
    theta.current = (theta.current + st.rpm * 6 * dt) % 720
    const on = (((theta.current - (360 - st.advance)) % 360) + 360) % 360 < 8
    sparks.current.forEach((m) => {
      if (m) m.visible = on
    })
  })
  const load = () => useIgn.getState().load
  return (
    <Part id="plug-bench" name="Hot and cold spark plugs" role="housing" material="aluminium" info={{ summary: 'Two plugs in a sectioned cylinder-head block.', role: 'A hot plug has a longer porcelain nose, which keeps heat in — for engines on lighter loads; a cold plug has a shorter nose and suits heavier loads.' }} cites={C.plug}>
      <Part id="head-block" name="Cylinder-head section" material="aluminium" role="housing" info={{ summary: 'Piece of cylinder head; heat leaves the plug through the shell thread into the head.' }}>
        <PartMesh geometry={p.block} />
      </Part>
      {(
        [
          ['hot', HOT_X, p.hot, 'Hot plug (long nose)', 'Longer length of porcelain: the heat path from the tip to the shell is long, so the tip runs hotter and burns off deposits on light loads.'],
          ['cold', COLD_X, p.cold, 'Cold plug (short nose)', 'Short porcelain nose: heat escapes quickly to the shell, so the tip stays cooler under heavy loads.'],
        ] as const
      ).map(([id, x, geo, name, role], i) => (
        <Part key={id} id={`plug-${id}`} name={name} material="steel" role="housing" info={{ summary: name, role, details: 'Parts: terminal nut, insulator, shell, insulated (centre) electrode, earthed electrode, spark gap.' }} cites={C.plug}>
          <group position={[x, y0, 0]}>
            <PartMesh geometry={geo.shell} />
            <Part id={`insulator-${id}`} name={`Porcelain insulator (${id})`} material="ceramic" role="static" info={{ summary: 'Porcelain insulator — heat-resistant, keeps the HV centre electrode insulated from the shell.' }} cites={C.plug}>
              <PartMesh geometry={geo.insulator} />
            </Part>
            <PartMesh geometry={geo.centre} material="steelDark" />
            <PartMesh geometry={geo.terminal} material="brass" />
            <PartMesh geometry={geo.ground} material="steelDark" />
            <Spark at={[0, geo.sparkY, 0]} refFn={(m) => void (sparks.current[i] = m)} size={0.0009} />
          </group>
        </Part>
      ))}
      {gauge ? (
        <Part id="feeler" name="Feeler gauge (0.6 mm)" material="chrome" role="moving" cut={false} info={{ summary: 'Feeler-gauge blade, 0.6 mm.', role: 'A feeler gauge is used to measure the gap between the electrodes and set it to the correct width, usually about 0.6 mm.' }} cites={C.plug}>
          <PartMesh geometry={p.gauge} position={[HOT_X - 0.0024, y0 + p.hot.sparkY, 0]} rotation={[0, -PI / 2, 0]} />
        </Part>
      ) : null}
      {heat.map((c, i) => (
        <Flow key={i} curve={c} count={i === 0 ? 26 : 14} radius={0.00045} color="#ff9a52" speed={i === 0 ? 0.25 : 0.6} spread={0.0004} emissive={1} intensity={() => 0.25 + 0.75 * load()} />
      ))}
      <PartLabel partId="plug-hot" at={[HOT_X - 0.012, PLUG_BLOCK_TOP + 0.06, 0.005]} />
      <PartLabel partId="plug-cold" at={[COLD_X + 0.012, PLUG_BLOCK_TOP + 0.06, 0.005]} />
      <PartLabel partId="insulator-hot" at={[HOT_X - 0.014, PLUG_BLOCK_TOP - 0.01, 0.004]} />
      {gauge ? <PartLabel partId="feeler" at={[HOT_X, PLUG_BLOCK_TOP - 0.024, 0.03]} /> : null}
    </Part>
  )
}

/* ======================================================================================
 * (d) Starter motor and flywheel ring gear
 * ====================================================================================== */

const LEVER = { pivot: [0, 0.0365, -0.0213] as const, rest: 14.8, engaged: -18.7 }

function StarterSystem() {
  const g = getIgnitionGeometry()
  const s = g.starter
  const fly = useRef<THREE.Group>(null)
  const pinion = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const plunger = useRef<THREE.Group>(null)
  const lever = useRef<THREE.Group>(null)
  const st8 = useRef({ e: 0, motor: 0, fly: 0, F: 0, armA: 0, pin: 0, run: false, crankT: 0 })
  const gamma = STARTER_ANGLE
  const cable = useMemo(() => {
    const term = add([STARTER_C[0], STARTER_C[1], 0], [0.009, s.SY + 0.004, -0.139])
    const bp = add([0.3, -0.165, -0.1], [-0.075, 0.115, -0.03])
    return { geo: wire([bp, add(bp, [0, 0.05, 0]), [0.22, 0.0, -0.17], add(term, [0, 0.02, -0.03]), term], 0.005), curve: curve([bp, add(bp, [0, 0.05, 0]), [0.22, 0.0, -0.17], add(term, [0, 0.02, -0.03]), term]) }
  }, [s.SY])

  useSimFrame((dt) => {
    const st = useIgn.getState()
    const S = st8.current
    if (starterCmd.stop) {
      S.run = false
      S.crankT = 0
      starterCmd.stop = false
    }
    S.e = st.key ? Math.min(1, S.e + dt / 0.03) : Math.max(0, S.e - dt / 0.04)
    const contacts = st.key && S.e > 0.97
    const k = 1 - Math.exp(-dt / 0.08)
    S.motor += ((contacts ? 2000 : 0) - S.motor) * (contacts ? k : 1 - Math.exp(-dt / 0.3))
    const ratio = RING_TEETH / PINION_TEETH
    if (!S.run) {
      if (S.e > 0.5) S.fly = S.motor / ratio
      else S.fly *= Math.exp(-dt / 0.5)
      if (contacts) S.crankT += dt
      if (S.crankT > 0.8 && S.fly > 120) S.run = true
    } else {
      S.fly += (750 - S.fly) * (1 - Math.exp(-dt / 0.4))
    }
    S.F += (S.fly * 2 * PI * dt) / 60
    S.armA += (S.motor * 2 * PI * dt) / 60
    const meshed = S.e > 0.5
    if (meshed) S.pin = gamma + PI - PI / PINION_TEETH - ratio * S.F
    else S.pin += (-S.motor * 2 * PI * dt) / 60
    fly.current?.rotation.set(0, 0, S.F + gamma)
    if (pinion.current) {
      pinion.current.position.z = PINION_REST_Z + S.e * 0.022
      pinion.current.rotation.set(0, 0, S.pin)
    }
    arm.current?.rotation.set(0, 0, -S.armA)
    if (plunger.current) plunger.current.position.z = -0.018 - 0.019 * S.e
    lever.current?.rotation.set((LEVER.rest + (LEVER.engaged - LEVER.rest) * S.e) * D2R, 0, 0)
    live.engage = S.e
    live.motorRpm = S.motor
    live.flyRpm = S.fly
    live.stage = S.run ? (meshed ? 'overrun' : 'running') : contacts ? 'cranking' : S.e > 0.02 ? (st.key ? 'pull-in' : 'retract') : 'rest'
  })

  return (
    <Part id="starter-system" name="Starter motor & flywheel" role="housing" material="paintBlack" info={{ summary: 'Electric starter: a 12 V (24 V on large diesels) motor that cranks the engine through a small pinion geared to the flywheel.' }} cites={C.start}>
      <Part id="flywheel" name="Flywheel & ring gear" material="castIron" role="moving" info={{ summary: `Flywheel with a ${RING_TEETH}-tooth ring gear.`, role: `The ${PINION_TEETH}-tooth pinion turns it ${RING_TEETH / PINION_TEETH} : 1 slower than the motor.` }} cites={C.start}>
        <group ref={fly} position={[FLY_C[0], FLY_C[1], 0]}>
          <PartMesh geometry={s.fly} />
          <PartMesh geometry={s.ring} material="steelDark" position={[0, 0, RING_Z]} />
          <PartMesh geometry={s.crankStub} material="forged" />
        </group>
      </Part>
      <Part id="pedestal" name="Crankshaft bearing support" material="paintGrey" role="housing">
        <PartMesh geometry={s.pedestal} />
      </Part>
      <group position={[STARTER_C[0], STARTER_C[1], 0]}>
        <Part id="yoke" name="Starter yoke & end frames" material="paintBlack" role="housing" info={{ summary: 'Motor housing (yoke) with commutator-end and drive-end frames.' }} cites={C.start}>
          <PartMesh geometry={s.yoke} />
          <PartMesh geometry={s.ceFrame} material="aluminium" />
          <PartMesh geometry={s.deFrame} material="aluminium" />
          <PartMesh geometry={s.mount} material="paintGrey" />
        </Part>
        <Part id="field-coils" name="Field coils & pole shoes" material="copper" role="static" info={{ summary: 'Field coils on four pole shoes.', role: 'Produce the magnetic field the armature turns in.' }} cites={C.start}>
          <PartMesh geometry={s.fields} />
          <PartMesh geometry={s.poles} material="steelDark" />
        </Part>
        <Part id="brushes" name="Carbon brushes" material="plastic" role="static" info={{ summary: 'Brushes rubbing on the commutator.' }} cites={C.start}>
          <PartMesh geometry={s.brushes} />
        </Part>
        <Part id="armature-s" name="Armature & commutator" material="steelDark" role="moving" info={{ summary: 'Armature (laminated core with windings) and commutator.', role: 'Very powerful motor — it can drain the battery quickly if used for long.' }} cites={C.start}>
          <group ref={arm}>
            <PartMesh geometry={s.armature} />
            <PartMesh geometry={s.endTurns} material="copper" />
            <PartMesh geometry={s.commutator} material="copper" />
            <PartMesh geometry={s.shaft} material="steel" />
          </group>
        </Part>
        <Part id="pinion" name={`Drive pinion (${PINION_TEETH} teeth)`} material="steel" role="moving" info={{ summary: 'Drive pinion and engagement collar.', role: 'Thrown along the shaft into mesh with the flywheel ring gear by the solenoid lever, and retracted once the engine starts and the switch is released. An overrunning clutch (not drawn) protects the motor if the engine over-runs it.' }} cites={C.start}>
          <group ref={pinion}>
            <PartMesh geometry={s.pinion} />
            <PartMesh geometry={s.collar} material="steelDark" />
          </group>
        </Part>
        <Part id="solenoid" name="Solenoid (engagement switch)" material="galvanised" role="housing" info={{ summary: 'Solenoid.', role: 'A special switch called a solenoid is used to engage the pinion to drive the flywheel. Its plunger pulls the shift lever, then closes the heavy main contacts to the motor.' }} cites={C.start}>
          <PartMesh geometry={s.solBody} />
          <PartMesh geometry={s.solCoil} material="copper" />
          <PartMesh geometry={s.solTerms} material="brass" />
          <group ref={plunger} position={[0, s.SY, -0.018]}>
            <Part id="plunger" name="Solenoid plunger" material="steel" role="moving">
              <PartMesh geometry={s.plunger} />
            </Part>
          </group>
          <group ref={lever} position={[...LEVER.pivot]}>
            <Part id="shift-lever" name="Shift lever" material="forged" role="moving" info={{ summary: 'Shift lever (fork).', role: 'Turns the plunger’s pull into a push that slides the pinion into mesh.' }}>
              <PartMesh geometry={s.lever} />
            </Part>
          </group>
        </Part>
      </group>
      <Part id="starter-battery" name="Battery & starter cable" material="plastic" role="housing" cut={false} info={{ summary: 'Battery and heavy starter cable.' }} cites={C.bat}>
        <group position={[0.3, -0.165, -0.1]}>
          <PartMesh geometry={g.coil.batt.case} />
          <PartMesh geometry={g.coil.batt.lid} />
          <PartMesh geometry={g.coil.batt.caps} material="paintBlack" />
          <PartMesh geometry={g.coil.batt.pos} material="paintRed" />
          <PartMesh geometry={g.coil.batt.neg} material="galvanised" />
        </group>
        <PartMesh geometry={cable.geo} material="paintRed" />
      </Part>
      <Flow curve={cable.curve} count={40} radius={0.0035} color="#6fb8ec" speed={1.2} spread={0.002} intensity={() => (live.stage === 'cranking' || live.stage === 'overrun' ? 1 : live.stage === 'pull-in' ? 0.3 : 0)} />
      <PartLabel partId="pinion" at={[STARTER_C[0] + 0.03, STARTER_C[1] - 0.03, 0.03]} />
      <PartLabel partId="solenoid" at={[STARTER_C[0] + 0.04, STARTER_C[1] + 0.1, -0.08]} />
      <PartLabel partId="flywheel" at={[-0.1, 0.1, 0.04]} />
      <PartLabel partId="armature-s" at={[STARTER_C[0] + 0.05, STARTER_C[1], -0.1]} />
      <PartLabel partId="shift-lever" at={[STARTER_C[0] + 0.03, STARTER_C[1] + 0.04, -0.02]} />
      <PartLabel partId="brushes" at={[STARTER_C[0] + 0.04, STARTER_C[1] + 0.03, -0.14]} />
    </Part>
  )
}

/* ======================================================================================
 * (e) Battery, dynamo and alternator
 * ====================================================================================== */

function ChargingSystem() {
  const g = getIgnitionGeometry().charging
  const ang = useRef({ crank: 0 })
  const crankRef = useRef<THREE.Group>(null)
  const dynRef = useRef<THREE.Group>(null)
  const altRef = useRef<THREE.Group>(null)
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff4cf', emissive: '#ffd27a', emissiveIntensity: 0, transparent: true, opacity: 0.85 }), [])
  const LAMP: [number, number, number] = [-0.24, 0.08, 0.02]
  const W = useMemo(() => {
    const bp = add(BAT_C, [-0.09, 0.107, -0.045])
    const dynOut = add(DYN_C, [0, 0.075, -0.02])
    const altOut = add(ALT_C, [0, 0.03, 0.05])
    const toBattD: [number, number, number][] = [dynOut, add(dynOut, [-0.03, 0.06, 0]), [-0.12, 0.08, -0.05], add(bp, [0, 0.04, 0]), bp]
    const toBattA: [number, number, number][] = [altOut, add(altOut, [0, 0.07, 0]), [0.0, 0.12, -0.02], add(bp, [0.02, 0.06, 0]), bp]
    const toLamp: [number, number, number][] = [bp, add(bp, [-0.02, 0.06, 0.02]), add(LAMP, [-0.03, 0.0, -0.02]), add(LAMP, [0, 0, -0.002])]
    return { toBattD, toBattA, toLamp }
  }, [LAMP])
  const geo = useMemo(() => ({ d: wire(W.toBattD, 0.003), a: wire(W.toBattA, 0.003), l: wire(W.toLamp, 0.0025) }), [W])
  const flows = useMemo(() => ({ d: curve(W.toBattD), a: curve(W.toBattA), l: curve(W.toLamp) }), [W])

  useSimFrame((dt) => {
    const st = useIgn.getState()
    const A = ang.current
    A.crank += (st.rpm * 2 * PI * dt) / 60
    crankRef.current?.rotation.set(0, 0, A.crank)
    dynRef.current?.rotation.set(0, 0, (A.crank * R_CRANK) / R_DYN)
    altRef.current?.rotation.set(0, 0, (A.crank * R_CRANK) / R_ALT)
    const vb = 12.6
    const iD = chargeCurrent((st.rpm * R_CRANK) / R_DYN, vb, DYNAMO)
    const iA = chargeCurrent((st.rpm * R_CRANK) / R_ALT, vb, ALTERNATOR)
    const iC = st.gen === 'dynamo' ? iD : iA
    // time-lapse: 1 s of sim time = 10 min of battery time (100 Ah battery)
    live.soc = Math.max(0, Math.min(1, live.soc + ((iC - st.loadA) * dt * 600) / (100 * 3600)))
    lampMat.emissiveIntensity = st.loadA > 0 && live.soc > 0.02 ? 1.4 : 0
    live.chargeA = iC
    live.netA = iC - st.loadA
  })
  const gen = () => useIgn.getState().gen
  return (
    <Part id="charging-system" name="Battery, dynamo & alternator" role="housing" material="aluminium" info={{ summary: 'The battery stores electricity by chemical action; a dynamo or an alternator, driven by the fan belt, recharges it.' }} cites={[...C.bat, ...C.gen]}>
      <Part id="battery-x" name="12 V lead-acid battery (cutaway)" material="plastic" role="housing" info={{ summary: '12 V tractor battery: six 2 V cells.', role: 'Positive plates of lead dioxide (PbO₂) and negative plates of spongy lead (Pb), kept apart by separators in dilute sulphuric acid — SG 1.27 when fully charged (≈36 % acid, 64 % water). Capacity in ampere-hours: 100 Ah ≈ 5 A for 20 h.' }} cites={C.bat}>
        <group position={BAT_C}>
          <PartMesh geometry={g.battery.case} />
          <PartMesh geometry={g.battery.lid} />
          <PartMesh geometry={g.battery.partitions} />
          <PartMesh geometry={g.battery.caps} material="paintBlack" />
          <Part id="pos-plates" name="Positive plates (PbO₂)" material="friction" role="static" info={{ summary: 'Positive plate group — lead dioxide (PbO₂).' }} cites={C.bat}>
            <PartMesh geometry={g.battery.pos} />
          </Part>
          <Part id="neg-plates" name="Negative plates (spongy Pb)" material="steelDark" role="static" info={{ summary: 'Negative plate group — spongy lead (Pb).' }} cites={C.bat}>
            <PartMesh geometry={g.battery.neg} />
          </Part>
          <Part id="separators" name="Separators" material="nylon" role="static" info={{ summary: 'Separators keep the positive and negative plates apart.' }} cites={C.bat}>
            <PartMesh geometry={g.battery.sep} />
          </Part>
          <Part id="straps" name="Plate straps & posts" material="galvanised" role="static" info={{ summary: 'All the negative plates of a cell are joined, as are all the positives; the cells are connected in series to give one positive and one negative terminal.' }} cites={C.bat}>
            <PartMesh geometry={g.battery.straps} />
            <PartMesh geometry={g.battery.posPost} material="paintRed" />
            <PartMesh geometry={g.battery.negPost} />
          </Part>
          <Part id="electrolyte" name="Electrolyte (dilute H₂SO₄)" material="water" role="fluid" info={{ summary: 'Dilute sulphuric acid, SG 1.27 when fully charged.', role: 'Must cover the plates. Hydrogen is given off on charge — keep naked flames away.' }} cites={C.bat}>
            <PartMesh geometry={g.battery.electrolyte} />
          </Part>
        </group>
      </Part>
      <Part id="dynamo" name="Dynamo" material="paintBlack" role="housing" info={{ summary: 'Dynamo.', role: 'An armature rotates between field poles; the commutator and carbon brushes turn its alternating current into direct current. A cut-out disconnects the battery when the engine is stopped or slow, so it cannot discharge into the dynamo.' }} cites={C.gen}>
        <group position={DYN_C}>
          <PartMesh geometry={g.dynamo.yoke} />
          <PartMesh geometry={g.dynamo.ends} material="aluminium" />
          <PartMesh geometry={g.dynamo.poles} material="steelDark" />
          <PartMesh geometry={g.dynamo.field} material="copper" />
          <PartMesh geometry={g.dynamo.brushes} material="plastic" />
          <PartMesh geometry={g.dynamo.springs} material="steel" />
          <group ref={dynRef}>
            <Part id="dyn-armature" name="Dynamo armature & commutator" material="steelDark" role="moving" info={{ summary: 'Armature (coil wound on an iron core) and copper commutator segments.' }} cites={C.gen}>
              <PartMesh geometry={g.dynamo.armature} />
              <PartMesh geometry={g.dynamo.commutator} material="copper" />
              <PartMesh geometry={g.dynamo.shaft} material="steel" />
              <PartMesh geometry={g.dynamo.pulley} material="castIron" />
            </Part>
          </group>
        </group>
        <Part id="regulator" name="Cut-out & regulator" material="paintBlack" role="housing" cut={false} info={{ summary: 'Cut-out and voltage/current regulator.', role: 'Automatically balance the dynamo output to the needs of the battery.' }} cites={C.gen}>
          <PartMesh geometry={g.regulator} />
        </Part>
      </Part>
      <Part id="alternator" name="Alternator" material="aluminium" role="housing" info={{ summary: 'Alternator.', role: 'A rotating field (claw-pole rotor) inside a stationary stator coil; its AC is converted to DC by diodes. No commutator, fewer maintenance problems, and higher output at lower engine speeds.' }} cites={C.gen}>
        <group position={ALT_C}>
          <PartMesh geometry={g.alternator.housings} />
          <Part id="stator" name="Stator & windings" material="steelDark" role="static" info={{ summary: 'Stator (laminated, slotted) with its windings.' }} cites={C.gen}>
            <PartMesh geometry={g.alternator.stator} />
            <PartMesh geometry={g.alternator.statorWind} material="copper" />
          </Part>
          <Part id="diodes" name="Diode assembly" material="aluminium" role="static" info={{ summary: 'Diode assembly — converts AC to DC.' }} cites={C.gen}>
            <PartMesh geometry={g.alternator.diodes} />
          </Part>
          <group ref={altRef}>
            <Part id="claw-rotor" name="Claw-pole rotor" material="forged" role="moving" info={{ summary: 'Interlocking halves of the rotor, which do not touch, containing the rotor windings.' }} cites={C.gen}>
              <PartMesh geometry={g.alternator.claws} />
              <PartMesh geometry={g.alternator.rotorCore} />
              <PartMesh geometry={g.alternator.rotorWind} material="copper" />
              <PartMesh geometry={g.alternator.shaft} material="steel" />
              <PartMesh geometry={g.alternator.fan} material="aluminium" />
              <PartMesh geometry={g.alternator.pulley} material="castIron" />
            </Part>
          </group>
        </group>
      </Part>
      <Part id="belt-drive" name="Crankshaft pulley & fan belts" material="rubber" role="moving" cut={false} info={{ summary: 'Both generators are driven by belts from the crankshaft pulley; adequate belt tension is essential to keep the battery charged.' }} cites={C.gen}>
        <group ref={crankRef} position={[CRANK_P[0], CRANK_P[1], 0]}>
          <PartMesh geometry={g.crank} material="castIron" />
        </group>
        <PartMesh geometry={g.belts} />
        <PartMesh geometry={g.stand} material="paintGrey" />
        <PartMesh geometry={g.mounts} material="paintGrey" />
      </Part>
      <Part id="lamp" name="Head lamp (load)" material="chrome" role="housing" cut={false} info={{ summary: 'Lighting load drawn from the battery.' }} cites={[SRC.tb509('§5.6.5 lights, Fig 5.9')]}>
        <group position={LAMP}>
          <PartMesh geometry={g.lamp} />
          <mesh geometry={g.lens} material={lampMat} />
        </group>
        <PartMesh geometry={geo.l} material="paintRed" />
      </Part>
      <Part id="charge-leads" name="Charging leads" material="paintRed" role="static" cut={false}>
        <PartMesh geometry={geo.d} />
        <PartMesh geometry={geo.a} />
      </Part>
      <Flow curve={flows.d} count={30} radius={0.0026} color="#9bd17a" speed={0.8} spread={0.002} intensity={() => (gen() === 'dynamo' ? live.chargeA / DYNAMO.maxCurrent : 0)} />
      <Flow curve={flows.a} count={30} radius={0.0026} color="#9bd17a" speed={0.8} spread={0.002} intensity={() => (gen() === 'alternator' ? live.chargeA / ALTERNATOR.maxCurrent : 0)} />
      <Flow curve={flows.l} count={24} radius={0.0024} color="#f5c25a" speed={0.8} spread={0.002} intensity={() => useIgn.getState().loadA / 40} />
      <PartLabel partId="battery-x" at={add(BAT_C, [0, 0.15, 0.06])} />
      <PartLabel partId="pos-plates" at={add(BAT_C, [-0.08, 0.02, 0.06])} />
      <PartLabel partId="electrolyte" at={add(BAT_C, [0.06, 0.08, 0.06])} />
      <PartLabel partId="dynamo" at={add(DYN_C, [0, 0.11, 0.04])} />
      <PartLabel partId="alternator" at={add(ALT_C, [0.03, 0.08, 0.04])} />
      <PartLabel partId="claw-rotor" at={add(ALT_C, [0.06, 0.0, 0.04])} />
      <PartLabel partId="dyn-armature" at={add(DYN_C, [0.06, -0.02, 0.05])} />
      <PartLabel partId="belt-drive" at={add(CRANK_P, [0.07, -0.02, -0.05])} />
    </Part>
  )
}

/* ------------------------------ root ------------------------------ */

export function Ignition3D() {
  const sub = useIgn((s) => s.sub)
  useEffect(() => {
    capUniforms.uHatchScale.value = HATCH[sub]
    return () => {
      capUniforms.uHatchScale.value = HATCH.coil
    }
  }, [sub])
  if (sub === 'coil') return <CoilSystem />
  if (sub === 'magneto') return <MagnetoSystem />
  if (sub === 'plug') return <PlugSystem />
  if (sub === 'starter') return <StarterSystem />
  return <ChargingSystem />
}

