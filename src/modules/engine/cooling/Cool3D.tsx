import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSim, useSimFrame } from '@/core/sim'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { Engine, type EnginePartKey, type EnginePartOverride } from '@/machines/Engine'
import { HEAD_PASSAGE } from '@/machines/layout'
import { AIR_PATHS, HOSES, THERMO_TURN, TUBE_X, buildCoolingGeometry } from './geometry'
import { AIRC, CAP, CRANK_Y, ENGINE_Z, ENG, FAN, FIRING, PULLEY_Z, PUMP, RAD, SPEC, THERMO, advance, coolantColor, finColor, live, restartLive, useCool } from './model'

const { PI } = Math
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const path = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3)

const C = {
  forced: [SRC.tb509('Ch 7, Fig 7.3 combined (forced) system'), SRC.supp509('cooling system')],
  siphon: [SRC.tb509('Ch 7 thermosiphon'), SRC.l4_509('cooling system')],
  radiator: [SRC.tb509('Fig 7.4 radiator')],
  air: [SRC.tb509('Fig 7.1 air cooling')],
  engine: [SRC.l4_509('parts; cooling 60–93 °C'), SRC.tb509('Fig 2.1')],
}

const INFO = {
  engine: { summary: 'Three-cylinder liquid-cooled tractor diesel (100 × 124 mm), every part working.', details: 'Combustion gas reaches about 1600 °C; the cooling system keeps the metal at a safe working temperature — 60–93 °C coolant, typically about 90 °C.' },
  block: { summary: 'Cylinder block with water jacket.', role: 'The jacket surrounds the cylinder liners so coolant can take heat from the cylinder walls.' },
  coolant: { summary: 'Coolant in the water jacket and head passages.', role: 'Colour shows its temperature. Heat flows from the hot cylinder walls into the coolant, which carries it to the radiator.' },
  head: { summary: 'Cylinder head with its own water passages.', role: 'Coolant rises from the block through holes in the head-gasket face and leaves at the front through the thermostat housing — hot water rises.' },
  thermostat: { summary: 'Thermostat (wax element).', role: 'Shut when the engine is cold so the coolant recirculates through the bypass and the engine warms up quickly; opens progressively as the coolant reaches working temperature, sending it to the radiator.', details: 'Typical values: starts to open ≈ 80 °C, fully open ≈ 92 °C. A thermostat stuck shut causes overheating; stuck open, the engine runs cold.' },
  pump: { summary: 'Centrifugal water pump.', role: 'Belt-driven impeller that forces coolant from the bottom of the radiator into the block (forced circulation). A thermosiphon system has none.' },
  fan: { summary: 'Belt-driven fan.', role: 'Pulls air through the radiator core even when the tractor is standing still. A slack fan belt slips, slowing the fan and the pump.' },
  belt: { summary: 'Fan belt (V-belt).', role: 'Drives the fan and water pump from the crankshaft pulley. A loose belt is a common cause of overheating.' },
  radiator: { summary: 'Radiator: header (top) tank, finned tubes, bottom tank.', role: 'Hot coolant enters the top tank and falls through many thin tubes; air passing the fins cools it before it collects in the bottom tank.' },
  core: { summary: 'Radiator core — thin tubes with fins.', role: 'Large surface area in a small space; the fins carry heat from the tubes into the air stream. Scale inside and dirt outside reduce the heat transfer.' },
  cap: { summary: 'Pressure cap.', role: 'Seals the system so it runs under pressure, which raises the boiling point of the coolant (≈ 119 °C at 0.9 bar). Its vacuum valve lets air back in as the system cools.' },
  hoses: { summary: 'Radiator hoses.', role: 'Top hose: hot coolant from the thermostat to the top tank. Bottom hose: cooled coolant from the bottom tank to the pump (or straight to the block in a thermosiphon system).' },
  bypass: { summary: 'Bypass hose.', role: 'While the thermostat is shut, coolant circulates from the head straight back to the pump, so the engine warms up evenly without cooling in the radiator.' },
  airEngine: { summary: 'Air-cooled engine.', role: 'A finned cylinder inside a cowling; fan blades on the flywheel blow air over the fins. No water, pump, radiator or hoses.' },
  fins: { summary: 'Cooling fins on the cylinder and head.', role: 'Increase the surface area so the air can carry the heat away. Their colour shows the fin-root temperature.' },
  cowl: { summary: 'Cowling (air duct).', role: 'Guides the air from the flywheel fan over all the fins and out the far side.' },
  flyFan: { summary: 'Flywheel fan.', role: 'Vanes cast on the flywheel act as a centrifugal blower — the flywheel doubles as the fan.' },
} as const

/** the scene's ids, names, cards and sources for the shared engine's parts */
const IDS: Partial<Record<EnginePartKey, string>> = { pulley: 'crank-pulley' }
const ek = (key: EnginePartKey) => IDS[key] ?? key
const PARTS: Partial<Record<EnginePartKey, EnginePartOverride>> = {
  block: { name: 'Cylinder block & water jacket', info: INFO.block, cites: C.forced },
  coolant: { name: 'Coolant (jacket & head)', info: INFO.coolant, cites: C.forced },
  head: { info: INFO.head, cites: C.forced },
  pulley: { info: { summary: 'Crankshaft pulley.', role: 'Drives the fan belt.' } },
}

export function Cool3D() {
  const g = buildCoolingGeometry()
  const mode = useCool((s) => s.mode)
  const flows = useCool((s) => s.flows)
  const restart = useCool((s) => s.restart)
  const air = mode === 'air'

  useEffect(() => {
    restartLive(useCool.getState())
  }, [restart, mode])

  const hot = useMemo(() => createDynamicCutMaterial({ color: '#2b8fb3', hatch: 'fluid', roughness: 0.15 }), [])
  const mid = useMemo(() => createDynamicCutMaterial({ color: '#2b8fb3', hatch: 'fluid', roughness: 0.15 }), [])
  const cold = useMemo(() => createDynamicCutMaterial({ color: '#2b8fb3', hatch: 'fluid', roughness: 0.15 }), [])
  const fin = useMemo(() => createDynamicCutMaterial({ color: '#b8bcc2', hatch: 'light', metalness: 0.85, roughness: 0.4 }), [])
  const rgb = useMemo(() => ({ r: 0, g: 0, b: 0 }), [])

  const theta = useRef(0)
  const fanG = useRef<THREE.Group>(null)
  const valve = useRef<THREE.Group>(null)
  const spring = useRef<THREE.Mesh>(null)
  const capValve = useRef<THREE.Group>(null)
  const capSpring = useRef<THREE.Mesh>(null)
  const flyFan = useRef<THREE.Group>(null)

  /* ---------- flow paths ---------- */
  const jacketPaths = useMemo(
    () =>
      [-1, 1].map((s) => {
        const zf = ENG.cylZ[0]
        const zr = ENG.cylZ[ENG.cylZ.length - 1]
        const inY = PUMP.y - 0.04
        const passY = ENG.deck + (HEAD_PASSAGE.y0 + HEAD_PASSAGE.y1) / 2
        return path([
          V(0, inY, ENG.z1 + 0.012),
          V(0.015 * s, inY, zf + 0.06),
          V(0.06 * s, inY - 0.03, zf),
          V(0.06 * s, inY - 0.01, zr + 0.01),
          V(0.02 * s, ENG.deck - 0.03, zr - 0.06),
          V(0, ENG.deck + 0.02, zr - 0.06),
          V(0.03 * s, passY, zr),
          V(0.03 * s, passY, zf - 0.05),
          V(THERMO.x, passY + 0.01, THERMO.z),
          V(THERMO.x, ENG.headTop + 0.035, THERMO.z),
        ])
      }),
    [],
  )
  const corePaths = useMemo(
    () =>
      TUBE_X.filter((_, i) => i % 2 === 1).map((x) =>
        path([V(0, (RAD.y1 + RAD.topY1) / 2, RAD.tankZ0 + 0.01), V(x * 0.7, RAD.y1 + 0.03, 0.3), V(x, RAD.y1 + 0.005, 0.3), V(x, (RAD.y0 + RAD.y1) / 2, 0.3), V(x, RAD.y0 - 0.006, 0.3), V(x * 0.6 + 0.06, (RAD.botY0 + RAD.y0) / 2, 0.29), V(0.15, (RAD.botY0 + RAD.y0) / 2, RAD.tankZ0 + 0.01)]),
      ),
    [],
  )
  const airPaths = useMemo(() => {
    const out: THREE.CatmullRomCurve3[] = []
    for (const x of [-0.15, -0.05, 0.05, 0.15])
      for (const y of [0.14, 0.34]) out.push(path([V(x, y, 0.55), V(x, y, RAD.z1 + 0.02), V(x * 0.9, y, FAN.z), V(x * 1.3, y + (y > 0.24 ? 0.03 : -0.03), 0.02), V(x * 1.5, y, -0.3)]))
    return out
  }, [])
  const steam = useMemo(() => path([V(CAP.x + 0.05, CAP.y - 0.09, CAP.z), V(CAP.x + 0.05, CAP.y - 0.14, CAP.z), V(CAP.x + 0.06, CAP.y - 0.2, CAP.z + 0.03)]), [])

  useSimFrame((dt) => {
    const st = useCool.getState()
    const ts = useSim.getState().timeScale
    advance(st, ts > 0 ? (dt / ts) * st.thermalSpeed : 0)
    const f = live.flows
    const Te = live.state.Te
    const w = (st.rpm * 2 * PI) / 60
    theta.current += w * dt
    fanG.current?.rotateZ((f.beltRpm * 2 * PI * dt) / 60)
    flyFan.current?.rotateX(w * dt)

    const lift = live.state.th * 0.008
    valve.current?.position.set(0, 0.0135 + lift, 0)
    if (spring.current) {
      spring.current.position.y = 0.0165 + lift
      spring.current.scale.y = 0.049 - (0.0165 + lift)
    }
    const capLift = st.mode !== 'air' && f.boiling ? 0.004 : 0
    capValve.current?.position.set(0, 0.01 + capLift, 0)
    if (capSpring.current) {
      capSpring.current.position.y = 0.013 + capLift
      capSpring.current.scale.y = 0.03 - (0.013 + capLift)
    }

    const inter = useView.getState().cut.intersection
    const paint = (m: typeof hot, T: number) => {
      coolantColor(T, rgb)
      m.material.color.setRGB(rgb.r, rgb.g, rgb.b)
      m.capColor.setRGB(rgb.r, rgb.g, rgb.b)
      m.material.clipIntersection = inter
    }
    paint(hot, Te)
    paint(mid, (Te + f.Tbottom) / 2)
    paint(cold, f.Tbottom)
    finColor(Te, rgb)
    fin.material.color.setRGB(rgb.r, rgb.g, rgb.b)
    fin.capColor.setRGB(rgb.r * 1.1, rgb.g * 1.1, rgb.b * 1.1)
    fin.material.clipIntersection = inter
  })

  const ratedFlow = SPEC.pumpPerRpm * SPEC.ratedRpm
  const k = {
    jacket: () => Math.min(1, (live.flows.radFlow + live.flows.bypassFlow) / ratedFlow + 0.05),
    rad: () => Math.min(1, live.flows.radFlow / ratedFlow + (live.flows.radFlow > 0.01 ? 0.08 : 0)),
    bypass: () => Math.min(1, live.flows.bypassFlow / ratedFlow),
    air: () => {
      const s = useCool.getState()
      return s.fan ? Math.min(1, live.flows.beltRpm / SPEC.ratedRpm) : 0.15
    },
    steam: () => (useCool.getState().mode !== 'air' && live.flows.boiling ? 1 : 0),
    flyAir: () => Math.min(1, useCool.getState().rpm / SPEC.ratedRpm),
  }
  const thermo = mode === 'forced'
  const pumped = mode === 'forced'

  if (air) {
    return (
      <group>
        <Part id="air-engine" name="Air-cooled engine" material="aluminium" role="housing" info={INFO.airEngine} cites={C.air}>
          <Part id="air-crankcase" name="Crankcase" material="aluminium" role="housing">
            <PartMesh geometry={g.airCrankcase} />
          </Part>
          <Part id="fins" name="Finned cylinder & head" role="housing" info={INFO.fins} cites={C.air}>
            <PartMesh geometry={g.airBarrel} customMaterial={fin.material} />
            <PartMesh geometry={g.airHead} customMaterial={fin.material} />
          </Part>
          <Part id="cowl" name="Cowling" material="paintGreen" role="housing" info={INFO.cowl} cites={C.air} explode={[0, 0.15, 0]}>
            <PartMesh geometry={g.airCowl} />
            <PartMesh geometry={g.airScroll} position={[AIRC.fanX - 0.012, 0, 0]} />
          </Part>
          <Part id="flywheel-fan" name="Flywheel fan" material="castIron" role="moving" info={INFO.flyFan} cites={C.air} explode={[-0.12, 0, 0]}>
            <group ref={flyFan} position={[AIRC.fanX, 0, 0]}>
              <PartMesh geometry={g.airFan} />
            </group>
          </Part>
          {flows ? AIR_PATHS.map((c, i) => <Flow key={i} curve={c} count={26} radius={0.004} color="#cfe6f5" speed={0.7} spread={0.02} intensity={k.flyAir} />) : null}
        </Part>
        <PartLabel partId="fins" at={[0.12, 0.24, 0.1]} />
        <PartLabel partId="cowl" at={[0.1, AIRC.headY1 + 0.06, 0.1]} />
        <PartLabel partId="flywheel-fan" at={[AIRC.fanX - 0.03, AIRC.fanR + 0.05, 0.05]} />
        <PartLabel partId="air-crankcase" at={[0.1, -0.02, 0.1]} />
      </group>
    )
  }

  return (
    <group>
      <Part id="engine" name="Tractor diesel" material="castIron" role="housing" info={INFO.engine} cites={C.engine}>
        <Engine
          firing={FIRING}
          position={[0, CRANK_Y, ENGINE_Z]}
          crankAngle={() => theta.current}
          k={ek}
          parts={PARTS}
          gas={false}
          coolantMaterial={hot.material}
        />
      </Part>

      {(
        <Part id="thermostat" name="Thermostat & housing" material="aluminium" role="housing" info={INFO.thermostat} cites={C.forced} explode={[0, 0.12, 0]}>
          <group position={[THERMO.x, THERMO.y, THERMO.z]} rotation={[0, THERMO_TURN, 0]}>
            <PartMesh geometry={g.thermostatHousing} />
            <Part id="thermostat-valve" name="Thermostat valve & wax element" material="brass" role="moving" cut={false} info={INFO.thermostat} cites={C.forced}>
              <PartMesh geometry={g.thSeat} position={[0, 0.012, 0]} />
              <group ref={valve}>
                <PartMesh geometry={g.thValve} />
                <PartMesh geometry={g.thPellet} material="copper" />
              </group>
              <PartMesh ref={spring} geometry={g.thSpring} material="steelDark" />
              <PartMesh geometry={g.thBridge} position={[0, 0.05, 0]} material="steel" />
            </Part>
          </group>
        </Part>
      )}

      <Part id="water-pump" name={pumped ? 'Water pump' : 'Water inlet (no pump)'} material="castIron" role="housing" info={INFO.pump} cites={C.forced} explode={[0, 0, 0.06]}>
        <PartMesh geometry={g.pumpVolute} position={[0, PUMP.y, PUMP.z - 0.0225]} />
      </Part>
      <Part id="fan-drive" name="Fan, pulley & pump impeller" material="paintBlack" role="moving" info={INFO.fan} cites={C.forced} explode={[0, 0, 0.12]}>
        <group ref={fanG} position={[0, PUMP.y, 0]}>
          <PartMesh geometry={g.pumpShaft} material="steel" position={[0, 0, PUMP.z]} />
          {pumped ? <PartMesh geometry={g.impeller} material="bronze" position={[0, 0, PUMP.z]} /> : null}
          <PartMesh geometry={g.fanPulley} material="castIron" position={[0, 0, PULLEY_Z]} />
          <PartMesh geometry={g.fan} position={[0, 0, FAN.z]} />
        </group>
      </Part>
      <Part id="fan-belt" name="Fan belt" material="rubber" role="static" cut={false} info={INFO.belt} cites={[SRC.tb509('Ch 7 faults: loose fan belt')]}>
        <PartMesh geometry={g.belt} />
      </Part>

      <Part id="radiator" name="Radiator" material="brass" role="housing" info={INFO.radiator} cites={C.radiator} explode={[0, 0, 0.2]}>
        <Part id="top-tank" name="Header (top) tank" material="brass" role="housing" info={INFO.radiator} cites={C.radiator}>
          <PartMesh geometry={g.topTank} />
          <PartMesh geometry={g.topWater} customMaterial={hot.material} castShadow={false} />
        </Part>
        <Part id="core" name="Radiator core (tubes & fins)" material="brass" role="housing" info={INFO.core} cites={C.radiator}>
          <PartMesh geometry={g.coreTubes} />
          <PartMesh geometry={g.coreFins} material="copper" />
          <PartMesh geometry={g.coreWater} customMaterial={mid.material} castShadow={false} />
        </Part>
        <Part id="bottom-tank" name="Bottom tank" material="brass" role="housing" info={INFO.radiator} cites={C.radiator}>
          <PartMesh geometry={g.bottomTank} />
          <PartMesh geometry={g.bottomWater} customMaterial={cold.material} castShadow={false} />
        </Part>
        <PartMesh geometry={g.radFrame} material="paintBlack" />
        <Part id="pressure-cap" name="Pressure cap" material="steel" role="static" cut={false} info={INFO.cap} cites={C.radiator}>
          <group position={[CAP.x, CAP.y, CAP.z]}>
            <PartMesh geometry={g.capNeck} material="brass" position={[0, 0.015, 0]} />
            <PartMesh geometry={g.cap} />
            <group ref={capValve}>
              <PartMesh geometry={g.capValve} material="rubber" />
            </group>
            <PartMesh ref={capSpring} geometry={g.capSpring} material="steelDark" />
            <PartMesh geometry={g.overflow} material="rubber" />
          </group>
        </Part>
      </Part>

      <Part id="hoses" name="Radiator hoses" material="rubber" role="static" info={INFO.hoses} cites={C.forced}>
        <PartMesh geometry={g.topHose} />
        <PartMesh geometry={g.bottomHose} />
        <Part id="hose-coolant" name="Coolant in the hoses" role="fluid">
          <PartMesh geometry={g.topHoseWater} customMaterial={hot.material} castShadow={false} />
          <PartMesh geometry={g.bottomHoseWater} customMaterial={cold.material} castShadow={false} />
        </Part>
      </Part>
      {thermo ? (
        <Part id="bypass" name="Bypass hose" material="rubber" role="static" info={INFO.bypass} cites={C.forced}>
          <PartMesh geometry={g.bypassHose} />
          <PartMesh geometry={g.bypassWater} customMaterial={hot.material} castShadow={false} />
        </Part>
      ) : null}

      {flows ? (
        <>
          {jacketPaths.map((c, i) => (
            <Flow key={`j${i}`} curve={c} count={40} radius={0.004} color="#7fd0f0" speed={0.25} spread={0.012} intensity={k.jacket} />
          ))}
          <Flow curve={HOSES.top} count={24} radius={0.0045} color="#ffb070" speed={0.5} spread={0.006} intensity={k.rad} />
          {corePaths.map((c, i) => (
            <Flow key={`c${i}`} curve={c} count={22} radius={0.0022} color="#ffd0a0" speed={0.22} spread={0.002} intensity={k.rad} />
          ))}
          <Flow curve={HOSES.bottom} count={24} radius={0.0045} color="#7fd0f0" speed={0.5} spread={0.006} intensity={k.rad} />
          {thermo ? <Flow curve={HOSES.bypass} count={18} radius={0.003} color="#ffb070" speed={0.6} spread={0.003} intensity={k.bypass} /> : null}
          {airPaths.map((c, i) => (
            <Flow key={`a${i}`} curve={c} count={18} radius={0.005} color="#dfeef8" speed={0.6} spread={0.05} intensity={k.air} emissive={0.2} />
          ))}
          <Flow curve={steam} count={20} radius={0.008} color="#f2f2f2" speed={0.8} spread={0.02} intensity={k.steam} emissive={0.3} />
        </>
      ) : null}

      <PartLabel partId="radiator" at={[RAD.x + 0.06, RAD.y1, 0.3]} />
      <PartLabel partId="thermostat" at={[THERMO.x + 0.03, ENG.headTop + 0.09, THERMO.z]} />
      <PartLabel partId="pressure-cap" at={[CAP.x + 0.02, CAP.y + 0.08, CAP.z]} />
      <PartLabel partId="water-pump" at={[-0.1, PUMP.y - 0.06, PUMP.z + 0.02]} />
      <PartLabel partId="fan-drive" at={[-0.15, PUMP.y + 0.16, FAN.z]} text="Fan" />
      <PartLabel partId="fan-belt" at={[0.08, 0.12, PULLEY_Z]} />
      <PartLabel partId="coolant" at={[0.12, 0.22, ENG.cylZ[1]]} />
      <PartLabel partId="hoses" at={[0.06, ENG.headTop + 0.07, 0.15]} text="Top hose" />
      <PartLabel partId="block" at={[0.14, 0.08, ENG.cylZ[2]]} />
      <PartLabel partId="core" at={[-RAD.x - 0.05, 0.25, 0.32]} />
      {thermo ? <PartLabel partId="bypass" at={[-0.12, ENG.headTop - 0.02, 0.1]} /> : null}
    </group>
  )
}
