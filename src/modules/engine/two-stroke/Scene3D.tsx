import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { pipe } from '@/geometry'
import { twoStrokeState } from '@/physics/engineExtra'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { EXHAUST_FLOW, INLET_FLOW, MIST_FLOW, MUFFLER_AT, TANK_AT, TRANSFER_FLOW, getTwoStrokeGeometry } from './geometry'
import { DIM, GAS, HEAD_Y, PORTS, SC, SPARK_BTDC, kinematics, live, useTwoStroke } from './model'

const { PI } = Math
const FLYWHEEL_Z = -0.047
/** magneto armature position on the flywheel circle (deg from +Y, towards −X) */
const COIL_DEG = 45
/** magnet placed so it sweeps the armature at the spark angle (TDC − 25°) */
const MAGNET_DEG = COIL_DEG + SPARK_BTDC

const C = {
  tb: [SRC.tb509('§2.6.2, Fig 2.4 two-stroke petrol engine')],
  l3: [SRC.l3_509('two-stroke engine; 4-stroke vs 2-stroke table')],
  addn: [SRC.add509('combustion in a two-stroke engine; petroil (mist) lubrication')],
  lube: [SRC.tb509('§6.3.3 oil mist (petroil) system'), SRC.add509('petroil 2–3 %')],
  ign: [SRC.tb509('§5.2.2 magneto, p29 — built into the flywheel on single-cylinder engines'), SRC.tb509('§5.4 spark plug, gap ≈ 0.6 mm')],
}

const INFO = {
  engine: {
    summary: 'Air-cooled, single-cylinder, three-port two-stroke petrol engine with a deflector piston. 50 × 51 mm, 100 cm³ — the size of a typical lawn-mower engine.',
    details: 'One cycle per revolution: the piston uncovers ports in the cylinder wall instead of working valves, and the sealed crankcase below it acts as a charge pump.',
  },
  barrel: {
    summary: 'Finned cylinder barrel with the three ports.',
    role: 'The piston itself opens and closes the exhaust, transfer and inlet ports as it moves. Fins give the large surface needed for air cooling.',
    details: 'Port heights are typical values; the timing diagram in Controls is computed from them.',
  },
  exhaustPort: { summary: 'Exhaust port (+X side).', role: 'Uncovered first on the down-stroke, so the burnt gas starts to escape (blow-down) before the transfer port opens.' },
  transfer: {
    summary: 'Transfer passage and port (−X side).',
    role: 'Carries the fresh charge, already compressed in the crankcase, up into the cylinder once the piston uncovers the port near BDC.',
  },
  inlet: { summary: 'Inlet port into the crankcase (rear).', role: 'Uncovered by the bottom of the piston skirt near TDC, so the rising piston draws fresh petroil mixture into the sealed crankcase.' },
  head: { summary: 'Finned cylinder head.', role: 'Closes the cylinder and carries the spark plug. Flat face; the clearance gives a compression ratio of 8 : 1 (typical for petrol engines).' },
  crankcase: {
    summary: 'Crankcase in two halves, split on the crank centre-line.',
    role: 'Unlike a four-stroke, it must be fully closed and airtight: its volume changes as the piston moves, so it sucks in and then pre-compresses each fresh charge.',
  },
  bearings: { summary: 'Main ball bearings.', role: 'Rolling bearings on the crankshaft, lubricated only by the oil mist in the charge.' },
  crank: {
    summary: 'Full-circle crankshaft.',
    role: 'Disc webs fill most of the crankcase, keeping its volume small so the crankcase compression is high enough to push the charge through the transfer port.',
  },
  flywheel: {
    summary: 'Flywheel with fan vanes, magneto magnet and starter ring gear.',
    role: 'Comparatively small, because there is a power stroke every revolution. The vanes blow cooling air over the fins and the magnet induces the spark current as it sweeps past the armature.',
  },
  coil: { summary: 'Flywheel-magneto armature (coil).', role: 'Primary and secondary windings on an iron core; the passing magnet induces the high voltage for the plug (see the Ignition scene).' },
  plug: { summary: 'Spark plug (gap ≈ 0.6 mm).', role: 'Fires about 25° before TDC so the mixture has time to burn.' },
  rod: { summary: 'Connecting rod.', role: 'Big end on a needle-roller bearing in a typical small two-stroke; small end on the gudgeon pin.' },
  piston: {
    summary: 'Deflector piston.',
    role: 'The ridge on the crown turns the incoming charge upward, so it sweeps up and over the head and pushes the exhaust out of the far side (cross scavenging). The piston works on both faces: above, it compresses the charge in the cylinder; below, the charge in the crankcase.',
  },
  rings: { summary: 'Two compression rings.', role: 'A two-stroke has only compression rings — no oil-control ring, because the oil is in the fuel.' },
  carb: { summary: 'Carburettor and air filter.', role: 'Meters petroil into the air drawn through to the inlet port.' },
  exhaust: { summary: 'Exhaust pipe and silencer.' },
  tank: { summary: 'Fuel tank with petroil.', role: 'Petrol with the lubricating oil already mixed in: 16 : 1 for larger, 24 : 1 for smaller engines, or 2–3 % oil.' },
  gas: {
    summary: 'Charge above the piston.',
    role: 'Teal = fresh charge from the transfer port; colours warm with compression, flash white-orange after the spark, then fade as the exhaust blows down.',
  },
}

function tempColor(T: number, out: THREE.Color) {
  const t = Math.max(0, Math.min(1, (T - 300) / 2300))
  const stops: [number, number, number, number][] = [
    [0, 0.3, 0.62, 0.72],
    [0.25, 0.62, 0.66, 0.42],
    [0.55, 0.93, 0.5, 0.16],
    [1, 1, 0.93, 0.72],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t <= b[0]) {
      const u = (t - a[0]) / (b[0] - a[0])
      return out.setRGB(a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u)
    }
  }
  return out.setRGB(1, 0.93, 0.72)
}

export function TwoStroke3D() {
  const g = getTwoStrokeGeometry()
  const flows = useTwoStroke((s) => s.flows)
  const mist = useTwoStroke((s) => s.mist)
  const theta = useRef(0)
  const crank = useRef<THREE.Group>(null)
  const rod = useRef<THREE.Group>(null)
  const piston = useRef<THREE.Group>(null)
  const column = useRef<THREE.Mesh>(null)
  const spark = useRef<THREE.Mesh>(null)
  const gas = useMemo(() => createDynamicCutMaterial({ color: '#4c9fb8', hatch: 'fluid', roughness: 0.6, emissive: '#000000' }), [])
  const col = useMemo(() => new THREE.Color(), [])
  const coilPos = useMemo(() => {
    const a = (COIL_DEG * PI) / 180
    return [-0.089 * Math.sin(a), 0.089 * Math.cos(a), FLYWHEEL_Z - 0.009] as [number, number, number]
  }, [])
  const lead = useMemo(
    () =>
      pipe(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(coilPos[0] - 0.006, coilPos[1] + 0.01, coilPos[2] - 0.004),
          new THREE.Vector3(-0.085, 0.13, -0.075),
          new THREE.Vector3(-0.05, HEAD_Y + 0.085, -0.03),
          new THREE.Vector3(0, HEAD_Y + 0.08, 0),
        ]),
        0.0028,
        0,
        48,
        10,
      ),
    [coilPos],
  )
  const sparkGeo = useMemo(() => new THREE.SphereGeometry(0.0016, 12, 8), [])
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.95 }), [])

  useSimFrame((dt) => {
    const st = useTwoStroke.getState()
    theta.current = (theta.current + st.rpm * 6 * dt) % 360
    const th = theta.current
    const k = kinematics(th)
    crank.current?.rotation.set(0, 0, k.a)
    const R = DIM.crankR
    if (rod.current) {
      rod.current.position.set(-R * Math.sin(k.a), R * Math.cos(k.a), 0)
      rod.current.rotation.set(0, 0, -Math.asin((R * Math.sin(k.a)) / DIM.rodL))
    }
    piston.current?.position.set(0, k.pin, 0)
    const crown = k.pin + DIM.pistonComp
    if (column.current) {
      column.current.position.y = crown
      column.current.scale.y = Math.max(1e-4, HEAD_Y - crown)
    }
    const s = twoStrokeState(th, SC, PORTS, GAS)
    tempColor(s.T, col)
    if (s.phase === 'scavenging' || s.phase === 'compression') {
      const fresh = s.phase === 'scavenging' ? Math.min(1, (th - 117) / 60) : 1
      col.lerp(new THREE.Color('#4c9fb8'), s.phase === 'scavenging' ? 0.5 * fresh : 0.35)
    }
    gas.material.color.copy(col)
    gas.capColor.copy(col)
    const glow = s.phase === 'expansion' ? Math.max(0, (s.T - 1200) / 1600) : 0
    gas.material.emissive.setRGB(col.r * glow, col.g * glow * 0.8, col.b * glow * 0.5)
    gas.material.clipIntersection = useView.getState().cut.intersection
    const sparking = th > 360 - SPARK_BTDC - 1 && th < 360 - SPARK_BTDC + 7
    if (spark.current) spark.current.visible = sparking

    live.theta = th
    live.x = k.x
    live.pCyl = s.pCyl
    live.pCase = s.pCase
    live.T = s.T
    live.phase = s.phase
    live.casePhase = s.casePhase
    live.exhaust = k.open.exhaust
    live.transfer = k.open.transfer
    live.inlet = k.open.inlet
    live.spark = sparking
  })

  return (
    <group>
      <Part id="engine" name="Two-stroke petrol engine" role="housing" material="aluminium" info={INFO.engine} cites={[...C.tb, ...C.l3]}>
        <Part id="barrel" name="Cylinder barrel & ports" material="castIron" role="housing" info={INFO.barrel} cites={[...C.tb, ...C.addn]} explode={[0, 0.06, 0]}>
          <PartMesh geometry={g.barrel} />
        </Part>
        <Part id="head-assembly" name="Head & spark plug" role="housing" explode={[0, 0.14, 0]}>
          <group position={[0, HEAD_Y, 0]}>
            <Part id="head" name="Cylinder head" material="aluminium" role="housing" info={INFO.head} cites={[SRC.misc509('p2 — petrol CR ≈ 8 : 1')]}>
              <PartMesh geometry={g.head} />
            </Part>
            <Part id="plug" name="Spark plug" material="steel" role="static" info={INFO.plug} cites={C.ign} explode={[0, 0.05, 0]}>
              <PartMesh geometry={g.plug.shell} />
              <PartMesh geometry={g.plug.insulator} material="ceramic" />
              <PartMesh geometry={g.plug.centre} material="steelDark" />
              <PartMesh geometry={g.plug.terminal} material="brass" />
              <PartMesh geometry={g.plug.ground} material="steelDark" />
              <mesh ref={spark} geometry={sparkGeo} material={sparkMat} position={[0, g.plug.sparkY, 0]} visible={false} />
            </Part>
          </group>
        </Part>
        <Part id="crankcase" name="Crankcase (sealed)" material="aluminium" role="housing" info={INFO.crankcase} cites={C.l3}>
          <Part id="case-back" name="Crankcase half (flywheel side)" explode={[0, 0, -0.08]}>
            <PartMesh geometry={g.caseBack} />
          </Part>
          <Part id="case-front" name="Crankcase half (drive side)" explode={[0, 0, 0.08]}>
            <PartMesh geometry={g.caseFront} />
          </Part>
          <Part id="bearings" name="Main bearings" material="bearing" role="static" info={INFO.bearings}>
            <PartMesh geometry={g.bearings} />
          </Part>
        </Part>
        <Part id="induction" name="Carburettor & air filter" material="aluminium" role="housing" cut={false} info={INFO.carb} cites={[SRC.tb509('Fig 2.4 intake port from carburettor')]} explode={[0, 0, -0.08]}>
          <PartMesh geometry={g.induction.duct} />
          <PartMesh geometry={g.induction.carb} />
          <PartMesh geometry={g.induction.filter} material="paintBlack" />
        </Part>
        <Part id="exhaust" name="Exhaust pipe & silencer" material="steelDark" role="housing" cut={false} info={INFO.exhaust} explode={[0.08, 0, 0]}>
          <PartMesh geometry={g.exhaust.stub} />
          <PartMesh geometry={g.exhaust.muffler} material="paintBlack" />
        </Part>
        <Part id="tank" name="Fuel tank (petroil)" material="paintRed" role="housing" info={INFO.tank} cites={C.lube} explode={[-0.06, 0.1, -0.04]}>
          <group position={TANK_AT}>
            <PartMesh geometry={g.tank.shell} />
            <PartMesh geometry={g.tank.cap} material="paintBlack" />
            <Part id="petroil" name="Petroil mixture" material="fuel" role="fluid" info={INFO.tank} cites={C.lube}>
              <PartMesh geometry={g.tank.petroil} />
            </Part>
          </group>
          <PartMesh geometry={g.tank.line} material="rubber" />
        </Part>
        <Part id="magneto" name="Flywheel magneto armature" material="steelDark" role="static" cut={false} info={INFO.coil} cites={C.ign} explode={[-0.04, 0.04, -0.06]}>
          <group position={coilPos} rotation={[0, 0, (COIL_DEG * PI) / 180]}>
            <PartMesh geometry={g.coil.core} />
            <PartMesh geometry={g.coil.coil} material="copper" />
          </group>
          <PartMesh geometry={lead} material="rubber" />
        </Part>

        <Part id="crank-assembly" name="Crankshaft & flywheel" role="moving" material="forged" info={INFO.crank} cites={C.addn}>
          <group ref={crank}>
            <Part id="crankshaft" name="Crankshaft" material="forged" info={INFO.crank} cites={C.addn} explode={[0, -0.1, 0]}>
              <PartMesh geometry={g.crank} />
            </Part>
            <Part id="flywheel" name="Flywheel, fan & magnet" material="aluminium" info={INFO.flywheel} cites={[...C.l3, SRC.tb509('Fig 7.1 air cooling')]} explode={[0, -0.1, -0.1]}>
              <group position={[0, 0, FLYWHEEL_Z]}>
                <PartMesh geometry={g.flywheel.disc} />
                <PartMesh geometry={g.flywheel.ring} material="steelDark" />
                <PartMesh geometry={g.flywheel.fan} />
                <group rotation={[0, 0, (MAGNET_DEG * PI) / 180]}>
                  <PartMesh geometry={g.flywheel.magnet} material="paintBlack" />
                </group>
              </group>
            </Part>
          </group>
        </Part>
        <Part id="conrod" name="Connecting rod" material="forged" role="moving" info={INFO.rod} explode={[0, -0.04, 0.1]}>
          <group ref={rod}>
            <PartMesh geometry={g.rod.body} />
            <PartMesh geometry={g.rod.bearing} material="bearing" />
            <PartMesh geometry={g.rod.bush} material="bronze" />
          </group>
        </Part>
        <Part id="piston-assembly" name="Deflector piston" role="moving" material="aluminium" info={INFO.piston} cites={[...C.addn, ...C.tb]} explode={[0, 0.08, 0.1]}>
          <group ref={piston}>
            <Part id="piston" name="Piston & deflector" info={INFO.piston} cites={[...C.addn, ...C.tb]}>
              <PartMesh geometry={g.piston.body} />
              <PartMesh geometry={g.piston.deflector} />
            </Part>
            <Part id="rings" name="Piston rings (2)" material="steelDark" info={INFO.rings} cites={[SRC.l4_509('rings: 2-stroke has 2')]} explode={[0, 0.02, 0]}>
              <PartMesh geometry={g.piston.rings} />
            </Part>
            <PartMesh geometry={g.piston.pin} material="steel" />
          </group>
        </Part>
        <Part id="gas" name="Cylinder charge" role="fluid" info={INFO.gas} cites={C.addn}>
          <PartMesh ref={column} geometry={g.gas} customMaterial={gas.material} castShadow={false} />
        </Part>

        {flows ? (
          <>
            <Flow curve={INLET_FLOW} count={60} radius={0.0017} color="#7cc4ea" speed={0.8} spread={0.007} intensity={() => live.inlet} />
            <Flow curve={TRANSFER_FLOW} count={70} radius={0.0017} color="#9fe0d0" speed={1.6} spread={0.006} intensity={() => live.transfer} />
            <Flow curve={EXHAUST_FLOW} count={70} radius={0.0019} color="#e8794f" speed={1.4} spread={0.007} intensity={() => live.exhaust} />
          </>
        ) : null}
        {mist ? <Flow curve={MIST_FLOW} count={90} radius={0.0009} color="#e2b14c" speed={0.35} spread={0.008} emissive={0.3} intensity={() => 0.8} /> : null}
      </Part>

      <PartLabel partId="barrel" at={[0.07, 0.14, 0.04]} />
      <PartLabel partId="piston" at={[0.03, 0.12, 0.03]} />
      <PartLabel partId="crankcase" at={[0.06, -0.03, 0.04]} />
      <PartLabel partId="crankshaft" at={[0.03, 0.0, 0.03]} />
      <PartLabel partId="plug" at={[0.02, HEAD_Y + 0.08, 0.01]} />
      <PartLabel partId="exhaust" at={[MUFFLER_AT[0] + 0.03, MUFFLER_AT[1] + 0.07, MUFFLER_AT[2]]} />
      <PartLabel partId="induction" at={[0.03, 0.11, -0.13]} />
      <PartLabel partId="tank" at={[TANK_AT[0], TANK_AT[1] + 0.05, TANK_AT[2]]} />
      <PartLabel partId="flywheel" at={[-0.07, -0.04, FLYWHEEL_Z - 0.02]} />
      <PartLabel partId="conrod" at={[0.025, 0.06, 0.01]} />
    </group>
  )
}
