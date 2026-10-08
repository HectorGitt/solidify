import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { Arrow, setArrow } from '@/modules/vibration/_shared/ui'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { POS, coolantPath, dynoGeometry, waterPath } from './geometry'
import { C, PTO_RATIO, SHAFT_Y, SPEC, live, solve, useDyno, type DynoKind } from './model'

const { PI } = Math
const Y = SHAFT_Y
/** PTO set-up: tractor rear faces +X; stub end at x = −0.7, cart input at x = −0.08. */
const PTO = { tractorX: -1.0, stubX: -0.7, cartX: -0.08, y: 0.5 }

const INFO = {
  bed: { summary: 'Engine test bed.', role: 'A heavy bedplate holding the engine and dynamometer in line so the output shaft can be coupled straight to the absorber.' },
  engine: {
    summary: 'Test engine — the “Farmland” tractor engine (Leyland 253 diesel).',
    role: 'Runs at full throttle; the dynamometer load pulls its speed down the full-load torque curve (max 173 N·m at 1300 rpm; governor run-out above 2250 rpm; 2390 rpm high idle).',
    details: 'Drawn as a simple block: only its torque–speed curve matters here — to the dynamometer the engine is just "torque × speed".',
  },
  output: { summary: 'Output shaft and flange coupling.', role: 'Transmits the engine torque T at speed n into the dynamometer.' },
  pulley: { summary: 'Brake wheel (pulley) b on the engine shaft.', role: 'Turns inside the stationary wooden blocks; the friction torque it must overcome is the engine torque.' },
  blocks: { summary: 'Wooden brake blocks a.', role: 'Clamped round the wheel; friction between blocks and wheel absorbs the power as heat.' },
  band: { summary: 'Strap and clamp holding the blocks.', role: 'Carries the blocks and the lever arm d; it would turn with the wheel if the arm did not bear on the scale.' },
  handwheel: { summary: 'Handwheel c.', role: 'Tightens the blocks on the wheel — this is how the load (torque) is controlled.' },
  arm: { summary: 'Torque arm of length l.', role: 'Converts the reaction torque into a force F on the scale: T = F·l, P = 2πlFn/60 000 kW.' },
  scale: { summary: 'Scale (spring balance) e.', role: 'Measures the arm force F. A tachometer measures n.' },
  casing: {
    summary: 'Outer casing (stator) on ball cradle bearings.',
    role: 'Free to turn about the shaft, it is held only by the torque arm, so the arm force measures all the torque passed to the water (bearing friction excepted). Stator vanes between the rotors throw the water back.',
  },
  rotors: { summary: 'Rotors on the dynamometer shaft.', role: 'Vaned discs that churn the water against the casing vanes; the water friction converts the engine work into heat.' },
  water: { summary: 'Working water.', role: 'Circulates through the casing and leaves hotter than it came in — all the absorbed power ends up as heat in the water.' },
  cradles: { summary: 'Ball cradle bearings.', role: 'Let the casing (or field frame) swing freely so that its reaction torque goes to the torque arm.' },
  plumbing: {
    summary: 'Intake, needle valves to each rotor, exhaust control.',
    role: 'The intake needle valves and exhaust control set how much water is in the casing — the load control. Capacity varies about as N³D⁵.',
  },
  gauge: { summary: 'Pressure gauge.', role: 'Shows the water pressure in the casing.' },
  thermo: { summary: 'Thermometer on the exhaust.', role: 'Shows the water outlet temperature; the rise depends on power and water flow.' },
  stator: { summary: 'Stator, mounted in bearings.', role: 'Carries the DC field coils; the eddy currents induced in it drag on the rotor. Its reaction goes to the torque arm. Coolant is circulated to carry the heat away.' },
  eddyRotor: { summary: 'Solid steel rotor with tapered teeth.', role: 'The teeth act as poles; turning them through the field sets up eddy currents in the stator.' },
  coils: { summary: 'DC field-excitation coils.', role: 'The excitation current sets the torque — the load control of an eddy-current machine. They glow brighter here as the load rises.' },
  dcFrame: { summary: 'Field frame of the DC dynamometer, cradle-mounted.', role: 'Shunt-wound generator with separate excitation: any effort to turn the armature makes the field try to revolve, so the reaction is measured on the scales. Accuracy within 0.25 %.' },
  armature: { summary: 'Armature and commutator.', role: 'Driven by the engine; generates current that is dumped in the resistor bank. As a motor it can turn the engine over to measure friction power.' },
  bank: { summary: 'Resistor bank (load).', role: 'Absorbs the generated electrical power as heat.' },
  cart: { summary: 'Shop-type (agricultural) PTO dynamometer on a wheeled cart.', role: 'Portable absorber driven from the tractor PTO, for use in the field or a dealer’s workshop to check engine condition.' },
  cartAbsorber: { summary: 'Absorber unit (hydraulic type).', role: 'Works like a hydraulic or Prony brake; its casing reacts on a torque arm.' },
  cartArm: { summary: 'Torque arm and hydraulic load cylinder.', role: 'The arm force is read as pressure on a gauge; a direct-reading indicator shows PTO speed.' },
  ptoShaft: { summary: 'PTO drive shaft with two Hooke’s joints.', role: 'Couples the tractor PTO stub (540 rpm) to the dynamometer.' },
} as const

function useParams() {
  return { kind: useDyno((s) => s.kind), arm: useDyno((s) => s.arm) }
}

export function Scene3D() {
  const g = dynoGeometry()
  const { kind, arm } = useParams()
  const pose = useMemo(() => createTractorPose({ hitchHeight: 0.6 }), [])
  const shaft = useRef<THREE.Group>(null)
  const ptoShaftRef = useRef<THREE.Group>(null)
  const cartRotor = useRef<THREE.Group>(null)
  const fArrow = useRef<THREE.Group>(null)
  const needleA = useRef<THREE.Group>(null)
  const needleB = useRef<THREE.Group>(null)
  const st = useRef({ theta: 0, n: 0, key: '', sol: solve(useDyno.getState()) })
  const coil = useMemo(() => createDynamicCutMaterial({ color: '#b8653a', hatch: 'bronze', metalness: 1, roughness: 0.35, emissive: '#000000' }), [])
  const water = useMemo(() => waterPath(), [])
  const coolant = useMemo(() => coolantPath(), [])

  useSimFrame((dt) => {
    const p = useDyno.getState()
    const key = `${p.kind}|${p.load}|${p.arm}`
    if (key !== st.current.key) {
      st.current.key = key
      st.current.sol = solve(p)
    }
    const sol = st.current.sol
    const s = st.current
    // engine speed settles on the operating point (fast lag, in sim time)
    s.n += (sol.n - s.n) * (1 - Math.exp(-dt / 0.08))
    s.theta += ((s.n * 2 * PI) / 60) * dt
    const nDyno = p.kind === 'pto' ? s.n / PTO_RATIO : s.n
    if (shaft.current) shaft.current.rotation.x = s.theta
    pose.engineAngle = s.theta
    pose.ptoAngle = s.theta / PTO_RATIO
    if (ptoShaftRef.current) ptoShaftRef.current.rotation.x = pose.ptoAngle
    if (cartRotor.current) cartRotor.current.rotation.x = pose.ptoAngle
    const frac = sol.n > 0 ? s.n / sol.n : 0
    const F = sol.F * Math.min(1, frac)
    const Fmax = SPEC[p.kind].Tmax / p.arm
    // force on the scale / load cell at the arm end
    const L = 0.38 * Math.min(1.2, F / Math.max(1, Fmax))
    if (p.kind === 'prony') setArrow(fArrow.current, new THREE.Vector3(POS.pulleyX, Y + 0.03, p.arm), new THREE.Vector3(0, 1, 0), L)
    else if (p.kind === 'pto') setArrow(fArrow.current, new THREE.Vector3(PTO.cartX + 0.35, PTO.y + 0.03 + L, 0.42), new THREE.Vector3(0, -1, 0), L)
    else {
      const x = p.kind === 'dc' ? POS.dcX : POS.casingX
      setArrow(fArrow.current, new THREE.Vector3(x, Y + 0.03 + L, p.arm), new THREE.Vector3(0, -1, 0), L)
    }
    if (needleA.current) needleA.current.rotation.z = -Math.min(1, F / Math.max(1, Fmax)) * PI * 1.4 + PI * 0.7
    if (needleB.current) needleB.current.rotation.z = -Math.min(1, nDyno / 1000) * PI * 1.4 + PI * 0.7
    const glow = p.kind === 'eddy' ? p.load * p.load : 0
    coil.material.emissive.setRGB(0.9 * glow, 0.35 * glow, 0.05 * glow)
    live.n = s.n
    live.nDyno = nDyno
    live.T = sol.T * Math.min(1, frac)
    live.P = sol.P * Math.min(1, frac)
    live.F = F
    live.waterOut = p.waterIn + (p.kind === 'hydraulic' || p.kind === 'pto' ? sol.Pdyno / (4.18 * p.waterFlow) : 0)
  })

  const flowOn = () => Math.min(1, 0.25 + live.P / 30)

  return (
    <group>
      {kind === 'pto' ? (
        <PtoSetup pose={pose} ptoShaftRef={ptoShaftRef} cartRotor={cartRotor} needleA={needleA} needleB={needleB} />
      ) : (
        <Part id="test-bed" name="Engine test bed" role="housing" material="castIron" info={INFO.bed} cites={[C.tests('p4 dynamometer classes')]}>
          <PartMesh geometry={g.bed} />
          <Part id="test-engine" name="Test engine" material="paintGreen" info={INFO.engine} cites={[C.engine]} cut={false} explode={[-0.3, 0, 0]}>
            <PartMesh geometry={g.engine} />
            <PartMesh geometry={g.cover} material="paintBlack" />
            <PartMesh geometry={g.bell} material="castIron" />
            <PartMesh geometry={g.exhaust} material="steelDark" />
          </Part>
          <Part id="output-shaft" name="Output shaft & coupling" role="moving" material="steel" info={INFO.output} cites={[C.tests('p5 eq 4')]}>
            <group ref={shaft} position={[0, Y, 0]}>
              <PartMesh geometry={g.output} />
              {kind === 'prony' ? (
                <Part id="brake-wheel" name="Brake wheel b" material="castIron" info={INFO.pulley} cites={[C.prony]}>
                  <PartMesh geometry={g.prony.pulley} />
                </Part>
              ) : null}
              {kind === 'hydraulic' ? (
                <Part id="rotors" name="Rotors" material="bronze" info={INFO.rotors} cites={[C.hydraulic]}>
                  <PartMesh geometry={g.hydraulic.rotors} />
                  <PartMesh geometry={g.hydraulic.shaft} material="steel" />
                </Part>
              ) : null}
              {kind === 'eddy' ? (
                <Part id="eddy-rotor" name="Toothed rotor" material="steelDark" info={INFO.eddyRotor} cites={[C.eddy]}>
                  <PartMesh geometry={g.eddy.rotor} />
                </Part>
              ) : null}
              {kind === 'dc' ? (
                <Part id="armature" name="Armature & commutator" material="copper" info={INFO.armature} cites={[C.dc]}>
                  <PartMesh geometry={g.dc.armature} />
                </Part>
              ) : null}
            </group>
          </Part>
          {kind === 'prony' ? <Prony arm={arm} /> : null}
          {kind === 'hydraulic' ? <Hydraulic arm={arm} needle={needleA} /> : null}
          {kind === 'eddy' ? <Eddy arm={arm} coil={coil.material} /> : null}
          {kind === 'dc' ? <Dc arm={arm} /> : null}
        </Part>
      )}

      {kind === 'hydraulic' ? <Flow curve={water} count={110} radius={0.007} color="#5aa6e0" speed={0.25} spread={0.02} intensity={flowOn} /> : null}
      {kind === 'eddy' ? <Flow curve={coolant} count={50} radius={0.006} color="#3fa9cf" speed={0.3} spread={0.01} intensity={flowOn} /> : null}
      <Arrow ref={fArrow} color="#f08a3c" radius={0.01} />
      <Labels kind={kind} arm={arm} />
    </group>
  )
}

function ArmAndCell({ x, r, arm, scale }: { x: number; r: number; arm: number; scale: 'cell' | 'balance' }) {
  const g = dynoGeometry()
  const len = Math.max(0.05, arm - r)
  return (
    <>
      <Part id="torque-arm" name="Torque arm (length l)" material="forged" role="static" info={INFO.arm} cites={[C.prony, C.dc]} cut={false}>
        <PartMesh geometry={g.arm} position={[x, Y, r]} scale={[1, 1, len]} />
      </Part>
      {scale === 'cell' ? (
        <Part id="scale" name="Scale / load cell" material="paintGrey" role="static" info={{ ...INFO.scale, summary: 'Scale (load cell) under the arm end.' }} cites={[C.dc]} cut={false}>
          <PartMesh geometry={g.loadCell} position={[x, Y - 0.03, arm]} />
        </Part>
      ) : (
        <Part id="scale" name="Scale (spring balance) e" material="paintGrey" role="static" info={INFO.scale} cites={[C.prony]} cut={false}>
          <PartMesh geometry={g.springBalance.body} position={[x, Y, arm]} />
          <PartMesh geometry={g.springBalance.rods} material="steel" position={[x, Y, arm]} />
          <PartMesh geometry={g.gantry} material="paintBlack" position={[x, 0, arm]} />
        </Part>
      )}
    </>
  )
}

function Prony({ arm }: { arm: number }) {
  const g = dynoGeometry().prony
  return (
    <Part id="prony" name="Prony brake (Fig 15.2)" role="housing" material="wood" info={{ summary: 'Prony brake — the simplest absorption dynamometer.', role: 'Wheel b turns inside wooden blocks a tightened by handwheel c; arm d of length l bears on scale e.' }} cites={[C.prony]}>
      <Part id="brake-blocks" name="Wooden blocks a" material="wood" role="static" info={INFO.blocks} cites={[C.prony]}>
        <PartMesh geometry={g.blocks} />
      </Part>
      <Part id="brake-band" name="Strap & clamp" material="steelDark" role="static" info={INFO.band} cites={[C.prony]}>
        <PartMesh geometry={g.band} />
      </Part>
      <Part id="handwheel" name="Handwheel c" material="paintRed" role="static" info={INFO.handwheel} cites={[C.prony]} cut={false}>
        <PartMesh geometry={g.wheel} />
        <PartMesh geometry={g.screw} material="steel" />
      </Part>
      <Part id="brake-bearing" name="Outboard bearing" material="castIron" info={{ summary: 'Pedestal bearing.', role: 'Supports the overhung brake wheel.' }} beyondNotes>
        <PartMesh geometry={g.bearing} />
      </Part>
      <ArmAndCell x={POS.pulleyX} r={0.247} arm={arm} scale="balance" />
    </Part>
  )
}

function Hydraulic({ arm, needle }: { arm: number; needle: RefObject<THREE.Group | null> }) {
  const g = dynoGeometry().hydraulic
  const top = Y + POS.casingR
  return (
    <Part id="hydraulic" name="Hydraulic dynamometer (Fig 15.3)" role="housing" material="castIron" info={{ summary: 'Hydraulic (water-brake) dynamometer, shown in section.', role: 'Converts the engine work into heat in water; error about 0.5 %.' }} cites={[C.hydraulic]}>
      <Part id="casing" name="Casing (stator)" material="castIron" info={INFO.casing} cites={[C.hydraulic]}>
        <PartMesh geometry={g.casing} />
      </Part>
      <Part id="water" name="Water" material="water" role="fluid" info={INFO.water} cites={[C.hydraulic]}>
        <PartMesh geometry={g.water} />
      </Part>
      <Part id="cradle-bearings" name="Ball cradle bearings" material="bearing" role="static" info={INFO.cradles} cites={[C.hydraulic]}>
        <PartMesh geometry={g.cradles} />
        <PartMesh geometry={g.peds} material="castIron" />
      </Part>
      <Part id="plumbing" name="Intake, needle valves & exhaust" material="brass" role="static" info={INFO.plumbing} cites={[C.hydraulic]} cut={false}>
        <PartMesh geometry={g.intake} />
        <PartMesh geometry={g.exhaustCtl} material="paintRed" />
        <PartMesh geometry={g.outlet} material="galvanised" />
      </Part>
      <Part id="gauge" name="Pressure gauge" material="brass" role="static" info={INFO.gauge} cites={[C.hydraulic]} cut={false}>
        <PartMesh geometry={g.gauge} />
        <group ref={needle} position={[POS.casingX + 0.1, top + 0.12, 0.137]}>
          <PartMesh geometry={dynoGeometry().dialNeedle} material="paintRed" />
        </group>
      </Part>
      <Part id="thermometer" name="Thermometer" material="glass" role="static" info={INFO.thermo} cites={[C.hydraulic]} cut={false}>
        <PartMesh geometry={g.thermo} />
      </Part>
      <ArmAndCell x={POS.casingX} r={POS.casingR} arm={arm} scale="cell" />
    </Part>
  )
}

function Eddy({ arm, coil }: { arm: number; coil: THREE.Material }) {
  const g = dynoGeometry().eddy
  return (
    <Part id="eddy" name="Eddy-current dynamometer" role="housing" material="castIron" info={{ summary: 'Eddy-current dynamometer.', role: 'Torque is set by the field excitation; the heat is carried off by circulated coolant.' }} cites={[C.eddy]}>
      <Part id="stator" name="Stator (in bearings)" material="castIron" info={INFO.stator} cites={[C.eddy]}>
        <PartMesh geometry={g.stator} />
      </Part>
      <Part id="field-coils" name="Field coils" role="static" info={INFO.coils} cites={[C.eddy]}>
        <PartMesh geometry={g.coils} customMaterial={coil} />
      </Part>
      <Part id="stator-bearings" name="Stator bearings" material="bearing" role="static" info={INFO.cradles} cites={[C.eddy]}>
        <PartMesh geometry={g.cradles} />
        <PartMesh geometry={g.peds} material="castIron" />
      </Part>
      <Part id="coolant-pipes" name="Coolant pipes" material="copper" role="static" info={{ summary: 'Coolant supply and return.', role: 'Circulated coolant removes the heat generated by the eddy currents.' }} cites={[C.eddy]} cut={false}>
        <PartMesh geometry={g.pipes} />
      </Part>
      <ArmAndCell x={POS.casingX} r={0.27} arm={arm} scale="cell" />
    </Part>
  )
}

function Dc({ arm }: { arm: number }) {
  const g = dynoGeometry().dc
  return (
    <Part id="dc-dyno" name="DC cradle dynamometer (Fig 15.4)" role="housing" material="paintGrey" info={{ summary: 'Direct-current cradle-mounted dynamometer.', role: 'A generator whose field frame is cradled; it absorbs power into a resistor bank, or motors the engine to measure friction power.' }} cites={[C.dc]}>
      <Part id="field-frame" name="Field frame (cradled)" material="paintGrey" info={INFO.dcFrame} cites={[C.dc]}>
        <PartMesh geometry={g.frame} />
        <PartMesh geometry={g.poles} material="steelDark" />
        <PartMesh geometry={g.grille} material="paintBlack" />
      </Part>
      <Part id="dc-cradle" name="Cradle bearings" material="bearing" role="static" info={INFO.cradles} cites={[C.dc]}>
        <PartMesh geometry={g.cradles} />
        <PartMesh geometry={g.peds} material="castIron" />
      </Part>
      <Part id="resistor-bank" name="Resistor bank" material="galvanised" role="static" info={INFO.bank} cites={[SRC.pm502('cradled DC electric dynamometer')]} cut={false} beyondNotes>
        <PartMesh geometry={g.bank} />
        <PartMesh geometry={g.cable} material="rubber" />
      </Part>
      <ArmAndCell x={POS.dcX} r={0.3} arm={arm} scale="cell" />
    </Part>
  )
}

function PtoSetup({
  pose,
  ptoShaftRef,
  cartRotor,
  needleA,
  needleB,
}: {
  pose: ReturnType<typeof createTractorPose>
  ptoShaftRef: RefObject<THREE.Group | null>
  cartRotor: RefObject<THREE.Group | null>
  needleA: RefObject<THREE.Group | null>
  needleB: RefObject<THREE.Group | null>
}) {
  const g = dynoGeometry()
  const c = g.cart
  return (
    <group>
      <Tractor pose={pose} position={[PTO.tractorX, 0, 0]} rotation={[0, PI, 0]} labels={false} linkage={false} />
      <Part id="pto-drive-shaft" name="PTO drive shaft" role="moving" material="steel" info={INFO.ptoShaft} cites={[SRC.pto502('540 rpm, 6-spline'), SRC.uj502('Hooke’s joint')]} cut={false}>
        <group ref={ptoShaftRef} position={[PTO.stubX, PTO.y, 0]}>
          <PartMesh geometry={g.ptoShaft} />
        </group>
      </Part>
      <group position={[PTO.cartX, PTO.y, 0]}>
        <Part id="pto-dyno" name="Shop-type PTO dynamometer (Fig 15.5)" role="housing" material="paintYellow" info={INFO.cart} cites={[C.pto]}>
          <Part id="cart-absorber" name="Absorber" material="castIron" info={INFO.cartAbsorber} cites={[C.pto]}>
            <PartMesh geometry={c.absorber} />
            <Part id="cart-water" name="Absorber water" material="water" role="fluid" info={INFO.water} cites={[C.pto]}>
              <PartMesh geometry={c.water} />
            </Part>
          </Part>
          <Part id="cart-rotor" name="Absorber rotor" material="bronze" role="moving" info={INFO.rotors} cites={[C.pto]}>
            <group ref={cartRotor}>
              <PartMesh geometry={c.rotor} />
            </group>
          </Part>
          <Part id="cart-frame" name="Cart frame & wheels" material="paintYellow" role="static" info={{ summary: 'Wheeled cart.', role: 'Makes the dynamometer portable — the point of a shop-type unit.' }} cites={[C.pto]} cut={false}>
            <PartMesh geometry={c.frame} />
            <PartMesh geometry={c.wheels} material="rubber" />
            <PartMesh geometry={c.handle} material="steelDark" />
          </Part>
          <Part id="cart-arm" name="Torque arm & load cylinder" material="forged" role="static" info={INFO.cartArm} cites={[C.pto]} cut={false}>
            <PartMesh geometry={g.arm} position={[0.35, 0, 0.2]} scale={[1, 1, 0.22]} />
            <PartMesh geometry={c.armCyl} material="steel" />
          </Part>
          <Part id="cart-panel" name="Gauges: force (pressure) and PTO speed" material="paintBlack" role="static" info={{ summary: 'Pressure gauge and direct-reading speed indicator.', role: 'Left dial: pressure from the torque-arm cylinder (∝ force); right dial: PTO rpm. Some units read power directly from the pressure gauge, corrected for PTO speed.' }} cites={[C.pto]} cut={false}>
            <PartMesh geometry={c.panel} />
            <PartMesh geometry={c.dials} material="ceramic" />
            <group ref={needleA} position={[0.34, 0.46, -0.257]} rotation={[0, PI, 0]}>
              <PartMesh geometry={g.dialNeedle} material="paintRed" />
            </group>
            <group ref={needleB} position={[0.5, 0.46, -0.257]} rotation={[0, PI, 0]}>
              <PartMesh geometry={g.dialNeedle} material="paintRed" />
            </group>
          </Part>
        </Part>
      </group>
    </group>
  )
}

function Labels({ kind, arm }: { kind: DynoKind; arm: number }) {
  if (kind === 'pto')
    return (
      <>
        <PartLabel partId="pto-dyno" at={[PTO.cartX + 0.4, 1.25, 0.2]} />
        <PartLabel partId="pto-drive-shaft" at={[PTO.stubX + 0.3, 0.62, 0.08]} />
        <PartLabel partId="cart-panel" at={[PTO.cartX + 0.42, 1.12, -0.3]} />
        <PartLabel partId="cart-arm" at={[PTO.cartX + 0.35, 0.62, 0.48]} />
        <PartLabel partId="tractor" at={[-2.2, 2.1, 0.4]} />
      </>
    )
  const x = kind === 'dc' ? POS.dcX : kind === 'prony' ? POS.pulleyX : POS.casingX
  return (
    <>
      <PartLabel partId="test-engine" at={[-0.86, Y + 0.5, 0.18]} />
      <PartLabel partId="output-shaft" at={[-0.32, Y + 0.12, 0.08]} />
      <PartLabel partId="torque-arm" at={[x, Y + 0.08, (arm + 0.3) / 2]} />
      <PartLabel partId="scale" at={[x + 0.1, Y + 0.3, arm]} />
      {kind === 'prony' ? (
        <>
          <PartLabel partId="brake-blocks" at={[x, Y + 0.3, 0.1]} />
          <PartLabel partId="handwheel" at={[x, Y + 0.12, -0.46]} />
          <PartLabel partId="brake-wheel" at={[x + 0.08, Y - 0.1, 0.12]} />
        </>
      ) : null}
      {kind === 'hydraulic' ? (
        <>
          <PartLabel partId="rotors" at={[x, Y + 0.12, 0.05]} />
          <PartLabel partId="casing" at={[x - 0.2, Y + 0.25, 0.1]} />
          <PartLabel partId="plumbing" at={[x + 0.16, Y + POS.casingR + 0.5, 0.05]} />
          <PartLabel partId="cradle-bearings" at={[x + POS.casingHalf + 0.05, Y - 0.12, 0.15]} />
          <PartLabel partId="thermometer" at={[x + 0.38, Y - 0.2, 0.05]} />
          <PartLabel partId="gauge" at={[x + 0.1, Y + POS.casingR + 0.2, 0.15]} />
        </>
      ) : null}
      {kind === 'eddy' ? (
        <>
          <PartLabel partId="field-coils" at={[x + 0.08, Y + 0.22, 0.05]} />
          <PartLabel partId="eddy-rotor" at={[x, Y + 0.05, 0.1]} />
          <PartLabel partId="coolant-pipes" at={[x + 0.2, Y + 0.6, 0.05]} />
        </>
      ) : null}
      {kind === 'dc' ? (
        <>
          <PartLabel partId="field-frame" at={[x, Y + 0.34, 0.15]} />
          <PartLabel partId="armature" at={[x, Y + 0.05, 0.1]} />
          <PartLabel partId="resistor-bank" at={[0.35, 1.1, -0.7]} />
        </>
      ) : null}
    </>
  )
}
