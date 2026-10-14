import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim, useSimFrame } from '@/core/sim'
import { CVT, TRACTOR, operate, planetOmega, powerFlow, speeds } from '@/physics/cvt'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial, type MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { POWER, approach } from '../common/anim'
import { meshPhase } from '@/parts/lib/shapes'
import { hydroGeometry } from '../hydrostatic/geometry'
import { DIM, UNIT, pistonBallZ } from '../hydrostatic/model'
import { DAMPER_Z, G, MOTOR_Z0, N_PLANETS, OUTPUT_Z, PUMP_Z0, RC, RR, UNIT_SCALE, live, rpmToRad, useCvt } from './model'
import { getCvtGeometry, pipeCurves } from './geometry'

const { PI } = Math
const HP = new THREE.Color('#d8432c')
const LP = new THREE.Color('#3f7fd0')

/** Angles integrated by the physics step (rad). */
const ang = { engine: 0, out: 0, ring: 0, planet: 0, pumpLocal: 0, motorLocal: 0 }

const planetAngle = (i: number) => (2 * PI * i) / N_PLANETS
const planetPhase = (i: number) => {
  const g = planetAngle(i)
  return g + PI + PI / CVT.zp + g * (CVT.zs / CVT.zp)
}
const RING_PHASE = CVT.zp % 2 === 0 ? PI / CVT.zr : 0

/** Output torque at the summing shaft for the current settings (N·m). */
function outputTorque() {
  const s = useCvt.getState()
  const i = s.range === 'field' ? TRACTOR.iField : TRACTOR.iRoad
  const resist = s.pull * 1e3 + TRACTOR.rr * TRACTOR.mass * 9.81
  const sign = (s.manual ? live.L : s.target) < 0 ? -1 : 1
  return (sign * resist * TRACTOR.r) / (i * TRACTOR.etaFinal)
}

const INFO = {
  cvt: {
    summary: 'Hydro-mechanical power-split continuously variable transmission (CVT).',
    role: 'Gives any ground speed from standstill to top speed, forward or reverse, with no steps and no clutch. The engine power is split in a planetary set: part goes straight through gears, part through a hydrostatic pump and motor that set the ratio. The two meet again on the output shaft.',
    details: 'Input-coupled layout, as used in the Fendt Vario family. Sizes are typical, not a specific model.',
  },
  damper: { summary: 'Torsional damper on the engine flywheel.', role: 'Springs between flywheel and input shaft smooth the diesel’s firing pulses before they reach the gears.' },
  input: { summary: 'Input shaft, from the engine.', role: 'Drives the planet carrier: the engine always turns the carrier, at engine speed.' },
  carrier: { summary: 'Planet carrier (input member).', role: 'Driven by the engine. Its torque splits between the sun (gear branch) and the ring (hydraulic branch) in the fixed ratio z_s : z_r.' },
  planets: { summary: 'Planet pinions (four).', role: 'Mesh with sun and ring at once and divide the carrier’s torque between them.' },
  sun: { summary: 'Sun gear — the mechanical branch.', role: 'Fixed to the output (summing) shaft. It carries the gear-driven share of the power straight to the output, at gear efficiency.' },
  ring: { summary: 'Ring gear with drum and hollow hub — the hydraulic branch.', role: 'Drives the pump through the take-off gear. Its speed is what the pump controls: hold the ring still and the set becomes a fixed overdrive; let it run free and the output stops.' },
  takeoff: { summary: 'Ring take-off gear (72 teeth) and pump gear (48 teeth).', role: 'Drive the hydrostatic pump from the ring, 1.5 times ring speed.' },
  sum: { summary: 'Summing gears (60 : 60).', role: 'The motor adds its torque to the output shaft here — where the hydraulic branch rejoins the mechanical one.' },
  pump: { summary: 'Variable axial-piston pump.', role: 'Its swashplate angle α sets how much oil it moves per turn. At zero angle it pumps nothing, so the ring spins free and the tractor stands still with the engine running (active standstill). Tilted backwards: reverse.' },
  motor: { summary: 'Variable axial-piston motor.', role: 'Turns the oil back into torque on the output shaft. In the upper half of the range its swashplate swings back (β → 0): the ring and pump slow to a stop and all the power goes through the gears — the most efficient point.' },
  block: { summary: 'Rotating cylinder block with nine pistons.', role: 'The pistons stroke against the swashplate once per turn: stroke = 2R·tan(angle).' },
  swash: { summary: 'Swashplate.', role: 'Tilting it changes the piston stroke and so the displacement. The transmission controller swings both plates to give the ratio asked for.' },
  lines: { summary: 'High-pressure loop between pump and motor.', role: 'Red = high pressure, blue = low pressure. Loop pressure rises with the pull and reaches its peak at standstill, where the motor alone holds the load.' },
  output: { summary: 'Output (summing) shaft.', role: 'Carries sun torque plus motor torque on to the range gears, the bevel drive and the wheels.' },
  housing: { summary: 'Transmission housing (sectioned).', role: 'Carries the bearings and takes the reaction torques.' },
}

function PistonUnit({ kind, z0, y, swashAngle, blockAngle, colour }: { kind: 'pump' | 'motor'; z0: number; y: number; swashAngle: () => number; blockAngle: () => number; colour: MaterialKey }) {
  const g = hydroGeometry()
  const pump = kind === 'pump'
  const id = (s: string) => `${kind}-${s}`
  const block = useRef<THREE.Group>(null)
  const swash = useRef<THREE.Group>(null)
  const pistons = useRef<(THREE.Group | null)[]>([])
  const slippers = useRef<(THREE.Group | null)[]>([])
  const q = useMemo(() => ({ plate: new THREE.Quaternion(), inv: new THREE.Quaternion(), e: new THREE.Euler() }), [])
  const n = UNIT.pistons
  const R = UNIT.pitchR

  useSimFrame(() => {
    const th = blockAngle()
    const beta = swashAngle()
    block.current?.rotation.set(0, 0, th)
    swash.current?.rotation.set(beta, 0, 0)
    q.plate.setFromEuler(q.e.set(beta, 0, 0))
    q.inv.setFromEuler(q.e.set(0, 0, -th)).multiply(q.plate)
    for (let i = 0; i < n; i++) {
      const z = pistonBallZ(th + (2 * PI * i) / n, beta)
      pistons.current[i]?.position.setZ(z)
      const s = slippers.current[i]
      if (s) {
        s.position.setZ(z)
        s.quaternion.copy(q.inv)
      }
    }
  })

  return (
    <group position={[0, y, z0]} rotation={[0, PI, 0]} scale={UNIT_SCALE}>
      <Part id={kind} name={pump ? 'Variable pump' : 'Variable motor'} role="housing" material="castIron" info={pump ? INFO.pump : INFO.motor}>
        <Part id={id('housing')} name={pump ? 'Pump casing' : 'Motor casing'} material={colour} info={INFO.housing} explode={[0, pump ? 0.12 : -0.12, 0]}>
          <PartMesh geometry={g.housing} />
          <PartMesh geometry={g.cover} material="aluminium" />
        </Part>
        <Part id={id('valve')} name={pump ? 'Pump valve plate' : 'Motor valve plate'} role="static" material="bronze" info={INFO.block}>
          <PartMesh geometry={g.valvePlate} />
        </Part>
        <Part id={id('swash')} name={pump ? 'Pump swashplate' : 'Motor swashplate'} role="moving" material="steelDark" info={INFO.swash} explode={[0, 0, 0.08]}>
          <group position={[0, 0, DIM.swZ]} ref={swash}>
            <PartMesh geometry={g.swash} />
          </group>
        </Part>
        <group ref={block}>
          <Part id={id('block')} name={pump ? 'Pump cylinder block' : 'Motor cylinder block'} role="moving" material="steel" info={INFO.block}>
            <PartMesh geometry={g.block} />
            <PartMesh geometry={g.shaft} material="forged" />
          </Part>
          <Part id={id('pistons')} name={pump ? 'Pump pistons' : 'Motor pistons'} role="moving" material="chrome" info={INFO.block}>
            {Array.from({ length: n }, (_, i) => {
              const a = (2 * PI * i) / n
              return (
                <group key={i} position={[R * Math.cos(a), R * Math.sin(a), 0]}>
                  <group ref={(el) => void (pistons.current[i] = el)}>
                    <PartMesh geometry={g.piston} />
                  </group>
                  <group ref={(el) => void (slippers.current[i] = el)}>
                    <PartMesh geometry={g.slipper} material="bronze" />
                  </group>
                </group>
              )
            })}
          </Part>
        </group>
      </Part>
    </group>
  )
}

export function Cvt3D() {
  const g = getCvtGeometry()
  const s = useCvt()
  const flows = s.flows
  const mats = useMemo(() => ({ A: createDynamicCutMaterial({ color: '#d8432c', roughness: 0.2 }), B: createDynamicCutMaterial({ color: '#3f7fd0', roughness: 0.2 }) }), [])
  const curves = useMemo(pipeCurves, [])
  const tmp = useMemo(() => new THREE.Color(), [])

  const carrier = useRef<THREE.Group>(null)
  const input = useRef<THREE.Group>(null)
  const sun = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const pumpGear = useRef<THREE.Group>(null)
  const motorGear = useRef<THREE.Group>(null)
  const planets = useRef<(THREE.Group | null)[]>([])

  // power-path colouring follows the settled operating point (not per frame)
  const op = useMemo(() => (s.manual ? null : operate({ rpm: s.rpm, range: s.range, target: s.target, pull: s.pull * 1e3 })), [s.manual, s.rpm, s.range, s.target, s.pull])
  const hydActive = s.manual ? Math.min(s.lever, 2) < 1.98 : (op?.hydShare ?? 0) > 0.02
  const mech: MaterialKey | null = s.powerFlow ? POWER : null
  const hyd: MaterialKey | null = s.powerFlow && hydActive ? 'paintYellow' : null

  useSimFrame((dt) => {
    const st = useCvt.getState()
    const real = dt / Math.max(1e-6, useSim.getState().timeScale)
    const we = rpmToRad(st.rpm)
    let targetL = st.lever
    let limited = false
    if (!st.manual) {
      const o = operate({ rpm: st.rpm, range: st.range, target: st.target, pull: st.pull * 1e3 })
      targetL = o.L
      limited = o.limited
    }
    // the controller swings the swashplates over in under a second
    live.L = approach(live.L, targetL, real, 0.5)
    const sp = speeds(live.L, we)
    const pf = powerFlow(live.L, we, outputTorque())
    ang.engine += sp.engine * dt
    ang.out += sp.out * dt
    ang.ring += sp.ring * dt
    ang.planet += planetOmega(sp.out, sp.engine) * dt
    // the units face −Z, so their local angle runs the other way to the world gear angle
    const pumpWorld = meshPhase(G.zTake, ang.ring, G.zPump, PI / 2)
    const motorWorld = meshPhase(G.zSum, ang.out, G.zMotor, -PI / 2)
    ang.pumpLocal = -pumpWorld
    ang.motorLocal = -motorWorld
    pumpGear.current?.rotation.set(0, 0, pumpWorld)
    motorGear.current?.rotation.set(0, 0, motorWorld)
    input.current?.rotation.set(0, 0, ang.engine)
    carrier.current?.rotation.set(0, 0, ang.engine)
    sun.current?.rotation.set(0, 0, ang.out)
    ring.current?.rotation.set(0, 0, ang.ring + RING_PHASE)
    planets.current.forEach((p, i) => p?.rotation.set(0, 0, ang.planet - ang.engine + planetPhase(i)))

    Object.assign(live, {
      alpha: sp.alpha,
      beta: sp.beta,
      engine: sp.engine,
      out: sp.out,
      ring: sp.ring,
      pump: sp.pump,
      motor: sp.motor,
      speed: (sp.out / (st.range === 'field' ? TRACTOR.iField : TRACTOR.iRoad)) * TRACTOR.r * 3.6,
      dp: pf.dp,
      hydShare: pf.hydShare,
      efficiency: pf.efficiency,
      Pout: pf.Pout,
      Pin: pf.Pin,
      Te: pf.Te,
      limited,
    })

    // line colours: the side the pressure is on is red, scaled by how high it is
    const k = Math.min(1, Math.abs(pf.dp) / 15e6)
    const aHigh = pf.dp >= 0
    for (const [m, isA] of [
      [mats.A, true],
      [mats.B, false],
    ] as const) {
      tmp.copy(LP).lerp(HP, isA === aHigh ? k : 0)
      m.material.color.copy(tmp)
      m.capColor.copy(tmp)
      m.material.clipIntersection = useView.getState().cut.intersection
    }
  }, -1)

  const qMax = CVT.kr * ((CVT.zs + CVT.zr) / CVT.zr)
  const q = () => (live.alpha * live.pump) / Math.max(1e-6, qMax * live.engine)
  const fp = { count: 60, radius: 0.006, speed: 2.5, spread: 0.01 }
  const flowOn = (sgn: 1 | -1) => () => {
    const v = sgn * q()
    return v > 0.002 ? Math.min(1, 0.25 + v) : 0
  }
  const beta = (x: number) => x * UNIT.maxAngle

  return (
    <group>
      <Part id="cvt" name="Power-split CVT" role="moving" material="steel" info={INFO.cvt}>
        <Part id="housing" name="Bell housing" role="housing" material="castIron" info={INFO.housing} explode={[0, 0.3, 0]}>
          <PartMesh geometry={g.housing} />
        </Part>
        <Part id="gear-case" name="Gear case" role="housing" material="castIron" info={INFO.housing} explode={[0.3, 0, 0]}>
          <PartMesh geometry={g.gearCase} />
        </Part>

        <Part id="damper" name="Flywheel & torsional damper" role="moving" material="steelDark" info={INFO.damper} explode={[0, 0, -0.15]}>
          <group ref={input}>
            <PartMesh geometry={g.damper.disc} material={mech ?? 'castIron'} />
            <PartMesh geometry={g.damper.ring} material="steelDark" />
            <PartMesh geometry={g.damper.springs} material="steel" />
            <Part id="input" name="Input shaft" material="forged" info={INFO.input}>
              <PartMesh geometry={g.inputShaft} material={mech ?? 'forged'} />
            </Part>
          </group>
        </Part>

        <Part id="carrier" name="Planet carrier" role="moving" material="forged" info={INFO.carrier} explode={[0, 0, -0.08]}>
          <group ref={carrier}>
            <PartMesh geometry={g.carrier.plates} material={mech ?? 'forged'} />
            <PartMesh geometry={g.carrier.pins} material="steel" />
            <Part id="planets" name="Planet pinions" material="steelDark" info={INFO.planets}>
              {Array.from({ length: N_PLANETS }, (_, i) => (
                <group key={i} position={[RC * Math.cos(planetAngle(i)), RC * Math.sin(planetAngle(i)), 0]}>
                  <group ref={(el) => void (planets.current[i] = el)}>
                    <PartMesh geometry={g.planet} />
                  </group>
                </group>
              ))}
            </Part>
          </group>
        </Part>

        <Part id="sun" name="Sun gear & output shaft" role="moving" material="steel" info={INFO.sun} explode={[0, 0, 0.1]}>
          <group ref={sun}>
            <PartMesh geometry={g.sun} material={mech ?? 'steel'} />
            <Part id="output" name="Output (summing) shaft" material="forged" info={INFO.output}>
              <PartMesh geometry={g.outputShaft} material={mech ?? 'forged'} />
            </Part>
            <Part id="sum-gear" name="Summing gear" material="steel" info={INFO.sum}>
              <PartMesh geometry={g.sumGear} position={[0, 0, G.sumZ]} material={mech ?? 'steel'} />
            </Part>
          </group>
        </Part>

        <Part id="ring" name="Ring gear & hub" role="moving" material="steel" info={INFO.ring} explode={[0, 0, 0.18]}>
          <group ref={ring}>
            <PartMesh geometry={g.ring} material={hyd ?? 'steel'} />
            <PartMesh geometry={g.ringDrum} material={hyd ?? 'forged'} />
            <Part id="takeoff" name="Ring take-off gear" material="steel" info={INFO.takeoff}>
              <PartMesh geometry={g.takeoff} position={[0, 0, G.takeZ]} material={hyd ?? 'steel'} />
            </Part>
          </group>
        </Part>

        <Part id="pump-gear" name="Pump drive gear" role="moving" material="steel" info={INFO.takeoff}>
          <group position={[0, G.pumpY, G.takeZ]}>
            <group ref={pumpGear}>
              <PartMesh geometry={g.pumpGear} material={hyd ?? 'steel'} />
            </group>
          </group>
        </Part>
        <Part id="motor-gear" name="Motor gear" role="moving" material="steel" info={INFO.sum}>
          <group position={[0, G.motorY, G.sumZ]}>
            <group ref={motorGear}>
              <PartMesh geometry={g.motorGear} material={hyd ?? 'steel'} />
            </group>
          </group>
        </Part>

        <PistonUnit kind="pump" z0={PUMP_Z0} y={G.pumpY} colour="paintGreen" swashAngle={() => beta(live.alpha)} blockAngle={() => ang.pumpLocal} />
        <PistonUnit kind="motor" z0={MOTOR_Z0} y={G.motorY} colour="paintGrey" swashAngle={() => beta(live.beta)} blockAngle={() => ang.motorLocal} />

        <Part id="lines" name="High-pressure loop" role="static" material="steel" info={INFO.lines} explode={[0, 0, 0.15]}>
          <PartMesh geometry={g.pipeWall.A} />
          <PartMesh geometry={g.pipeWall.B} />
          <Part id="oil" name="Oil in the loop" role="fluid" material="hydraulicOil" info={INFO.lines}>
            <PartMesh geometry={g.pipeOil.A} customMaterial={mats.A.material} castShadow={false} />
            <PartMesh geometry={g.pipeOil.B} customMaterial={mats.B.material} castShadow={false} />
          </Part>
        </Part>
      </Part>

      {flows ? (
        <>
          <Flow curve={curves.A} color="#ff6a4d" intensity={flowOn(1)} {...fp} />
          <Flow curve={curves.Br} color="#6fa8ff" intensity={flowOn(1)} {...fp} />
          <Flow curve={curves.B} color="#ff6a4d" intensity={flowOn(-1)} {...fp} />
          <Flow curve={curves.Ar} color="#6fa8ff" intensity={flowOn(-1)} {...fp} />
        </>
      ) : null}

      <PartLabel partId="damper" at={[0, 0.25, DAMPER_Z]} />
      <PartLabel partId="carrier" at={[0, -0.12, -0.03]} />
      <PartLabel partId="sun" at={[0, 0.05, 0.02]} />
      <PartLabel partId="ring" at={[0, RR + 0.04, 0.02]} />
      <PartLabel partId="pump" at={[0, G.pumpY + 0.16, PUMP_Z0]} />
      <PartLabel partId="motor" at={[0, G.motorY - 0.16, MOTOR_Z0]} />
      <PartLabel partId="pump-gear" at={[0, G.pumpY + 0.11, G.takeZ]} />
      <PartLabel partId="sum-gear" at={[0, -0.05, G.sumZ]} />
      <PartLabel partId="lines" at={[0, 0.2, 0.62]} />
      <PartLabel partId="output" at={[0, 0.12, OUTPUT_Z]} />
    </group>
  )
}
