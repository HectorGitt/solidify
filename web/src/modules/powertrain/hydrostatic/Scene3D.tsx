import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { DriveGraph } from '@/core/drive'
import { useSim, useSimFrame } from '@/core/sim'
import { comboAngles, unitDisplacement } from '@/physics/drives'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { approach } from '../common/anim'
import { flowPath, hydroGeometry } from './geometry'
import { DIM, UNIT, live, pistonBallZ, radToRpm, rpmToRad, useHydro } from './model'

const { PI } = Math
const HP = new THREE.Color('#d8432c')
const LP = new THREE.Color('#3f7fd0')
const DMAX = unitDisplacement(UNIT, UNIT.maxAngle)

/** Mutable state shared by the unit components (written by the physics step at priority −1). */
const state = { pumpTheta: 0, motorTheta: 0, dpSign: 1 }

const C = {
  hydro: [SRC.pt510('p8–9 hydrostatic drive'), SRC.tts510('p5')],
  unit: [SRC.pt510('p8: piston groups on swashplates'), SRC.beyond('axial-piston unit construction')],
}

const INFO = {
  pump: {
    summary: 'Variable-displacement axial-piston pump, driven by the engine.',
    role: 'Turns engine power into a flow of oil. Tilting its swashplate changes the piston stroke, so the flow (and the travel speed) — and, past zero, the flow direction (and the travel direction).',
    details: '9 pistons, Ø18 mm on a 72 mm pitch circle, ±18° → up to 53.6 cm³/rev (typical size).',
  },
  motor: {
    summary: 'Axial-piston motor driving the wheels.',
    role: 'Oil at high pressure pushes its pistons out against the inclined swashplate; the sideways reaction turns the cylinder block and the output shaft. Fixed swashplate = fixed displacement (FDM); a tilting one = variable (VDM).',
  },
  housing: { summary: 'Pump/motor casing.', role: 'Holds the swashplate trunnions and shaft bearings; sectioned here to show the rotating group.' },
  cover: { summary: 'End cover with the two main ports.', role: 'The high- and low-pressure lines are connected here.' },
  valve: {
    summary: 'Valve plate (port plate) with two kidney-shaped ports.',
    role: 'Stationary. Each cylinder bore passes over one kidney while its piston is moving out (filling) and over the other while it moves in (delivering) — so it acts as the inlet and outlet valve.',
  },
  block: { summary: 'Rotating cylinder block (barrel).', role: 'Splined to the shaft; carries the nine pistons round. Its back face slides on the valve plate.' },
  pistons: { summary: 'Pistons with ball ends and slippers.', role: 'Each slipper slides round on the swashplate face, so a tilted plate makes every piston stroke once per revolution: stroke = 2R·tan β.' },
  swashPump: {
    summary: 'Tilting swashplate (pump).',
    role: 'The control lever tilts it. At 0° the pistons do not stroke and there is no flow — neutral, with the wheels held. Tilted one way: forward; the other way: reverse.',
  },
  swashMotor: { summary: 'Motor swashplate.', role: 'Fixed at full angle for a fixed-displacement motor. In a variable motor, a smaller angle gives higher speed and lower torque.' },
  lever: { summary: 'Speed and direction control lever.', role: 'One lever controls speed and direction — easy one-lever control. On the tractor it works in a quadrant, with a range lever for high/low/reverse.' },
  lineA: { summary: 'Main line A.', role: 'High-pressure line when the pump swashplate is tilted forward; the return (low-pressure) line in reverse. Red = high pressure, blue = low pressure.' },
  lineB: { summary: 'Main line B.', role: 'The other side of the closed loop: return line going forward, pressure line in reverse.' },
  oil: { summary: 'Hydraulic oil.', role: 'Incompressible, it takes the shape of its container — the two principles the drive relies on. Flow rate gives speed, flow direction gives travel direction, pressure gives power.' },
  shaft: { summary: 'Drive shaft.', role: 'Pump: from the engine. Motor: out to the final drive and wheel.' },
  wheel: { summary: 'Driven wheel (stand-in for the final drive and wheel).', role: 'No clutch and no drive line: the oil lines can run anywhere — flexible location, no drive lines.' },
}

function Unit({ kind, matA, matB }: { kind: 'pump' | 'motor'; matA: THREE.Material; matB: THREE.Material }) {
  const g = hydroGeometry()
  const pump = kind === 'pump'
  const cx = pump ? -DIM.unitX : DIM.unitX
  const id = (s: string) => `${kind}-${s}`
  const block = useRef<THREE.Group>(null)
  const swash = useRef<THREE.Group>(null)
  const lever = useRef<THREE.Group>(null)
  const pistons = useRef<(THREE.Group | null)[]>([])
  const slippers = useRef<(THREE.Group | null)[]>([])
  const columns = useRef<(THREE.Mesh | null)[]>([])
  const q = useMemo(() => ({ plate: new THREE.Quaternion(), inv: new THREE.Quaternion(), e: new THREE.Euler() }), [])
  const n = UNIT.pistons

  useSimFrame(() => {
    const th = pump ? state.pumpTheta : state.motorTheta
    const beta = pump ? live.pumpAngle : live.motorAngle
    block.current?.rotation.set(0, 0, th)
    swash.current?.rotation.set(beta, 0, 0)
    lever.current?.rotation.set(beta, 0, 0)
    q.plate.setFromEuler(q.e.set(beta, 0, 0))
    q.inv.setFromEuler(q.e.set(0, 0, -th)).multiply(q.plate)
    for (let i = 0; i < n; i++) {
      const phi = th + (2 * PI * i) / n
      const z = pistonBallZ(phi, beta)
      pistons.current[i]?.position.setZ(z)
      const s = slippers.current[i]
      if (s) {
        s.position.setZ(z)
        s.quaternion.copy(q.inv)
      }
      const c = columns.current[i]
      if (c) {
        c.position.z = DIM.blockZ0
        c.scale.z = Math.max(1e-4, z - DIM.pistonL - DIM.blockZ0)
        // bore over the x<0 kidney: pump → line A, motor → line B
        const neg = Math.cos(phi) < 0
        c.material = pump === neg ? matA : matB
      }
    }
  })

  const R = UNIT.pitchR
  const at = (i: number): [number, number] => [R * Math.cos((2 * PI * i) / n), R * Math.sin((2 * PI * i) / n)]
  const posMat = pump ? matB : matA
  const negMat = pump ? matA : matB
  const variable = useHydro((s) => (pump ? s.combo === 'VDP-FDM' || s.combo === 'VDP-VDM' : s.combo === 'FDP-VDM' || s.combo === 'VDP-VDM'))

  return (
    <group position={[cx, 0, 0]}>
      <Part id={kind} name={pump ? 'Hydraulic pump' : 'Hydraulic motor'} role="housing" material="castIron" info={pump ? INFO.pump : INFO.motor} cites={C.hydro}>
        <Part id={id('housing')} name={pump ? 'Pump casing' : 'Motor casing'} material={pump ? 'paintGreen' : 'paintGrey'} info={INFO.housing} explode={[0, 0.16, 0.06]}>
          <PartMesh geometry={g.housing} />
        </Part>
        <Part id={id('cover')} name={pump ? 'Pump end cover' : 'Motor end cover'} material="aluminium" info={INFO.cover} explode={[0, 0, -0.1]}>
          <PartMesh geometry={g.cover} />
          <Part id={id('port-oil')} name="Oil in the ports" role="fluid" material="hydraulicOil" info={INFO.oil} cites={C.hydro}>
            <PartMesh geometry={g.portOil.pos} customMaterial={posMat} castShadow={false} />
            <PartMesh geometry={g.portOil.neg} customMaterial={negMat} castShadow={false} />
          </Part>
        </Part>
        <Part id={id('valve')} name={pump ? 'Pump valve plate' : 'Motor valve plate'} role="static" material="bronze" info={INFO.valve} cites={C.unit} beyondNotes explode={[0, 0, -0.06]}>
          <PartMesh geometry={g.valvePlate} />
          <Part id={id('kidney-oil')} name="Oil in the kidney ports" role="fluid" material="hydraulicOil" info={INFO.oil}>
            <PartMesh geometry={g.kidneyOil.pos} customMaterial={posMat} castShadow={false} />
            <PartMesh geometry={g.kidneyOil.neg} customMaterial={negMat} castShadow={false} />
          </Part>
        </Part>
        <Part id={id('swash')} name={pump ? 'Pump swashplate' : 'Motor swashplate'} role="moving" material="steelDark" info={pump ? INFO.swashPump : INFO.swashMotor} cites={C.hydro} explode={[0, 0, 0.12]}>
          <group position={[0, 0, DIM.swZ]} ref={swash}>
            <PartMesh geometry={g.swash} />
          </group>
        </Part>
        {variable ? (
          <Part id={id('lever')} name={pump ? 'Control lever (pump)' : 'Control lever (motor)'} role="moving" material="paintRed" info={INFO.lever} cites={[SRC.pt510('p9'), SRC.tts510('p5')]} cut={false} explode={[pump ? -0.08 : 0.08, 0, 0.12]}>
            <group position={[pump ? -DIM.housingR - 0.022 : DIM.housingR + 0.022, 0, DIM.swZ + DIM.swT / 2]} ref={lever}>
              <PartMesh geometry={g.lever} />
            </group>
          </Part>
        ) : null}
        <group ref={block}>
          <Part id={id('block')} name={pump ? 'Pump cylinder block' : 'Motor cylinder block'} role="moving" material="steel" info={INFO.block} cites={C.unit} beyondNotes explode={[0, -0.12, 0]}>
            <PartMesh geometry={g.block} />
          </Part>
          <Part id={id('pistons')} name={pump ? 'Pump pistons' : 'Motor pistons'} role="moving" material="chrome" info={INFO.pistons} cites={C.unit} beyondNotes explode={[0, -0.12, 0.1]}>
            {Array.from({ length: n }, (_, i) => (
              <group key={i} position={[...at(i), 0]}>
                <group ref={(el) => void (pistons.current[i] = el)}>
                  <PartMesh geometry={g.piston} />
                </group>
                <group ref={(el) => void (slippers.current[i] = el)}>
                  <PartMesh geometry={g.slipper} material="bronze" />
                </group>
              </group>
            ))}
          </Part>
          <Part id={id('bore-oil')} name="Oil in the cylinder bores" role="fluid" material="hydraulicOil" info={INFO.oil}>
            {Array.from({ length: n }, (_, i) => (
              <PartMesh key={i} ref={(el: THREE.Mesh | null) => void (columns.current[i] = el)} geometry={g.column} customMaterial={matB} position={[...at(i), DIM.blockZ0]} castShadow={false} />
            ))}
          </Part>
          <Part id={id('shaft')} name={pump ? 'Pump input shaft' : 'Motor output shaft'} role="moving" material="forged" info={INFO.shaft} explode={[0, 0, 0.16]}>
            <PartMesh geometry={pump ? g.shaft : g.motorShaft} />
            {!pump ? (
              <Part id="output" name="Driven wheel" material="rubber" info={INFO.wheel} cites={[SRC.pt510('p9 advantages')]} cut={false}>
                <PartMesh geometry={g.wheel} position={[0, 0, DIM.wheelZ]} />
                <PartMesh geometry={g.wheelRim} material="paintRed" position={[0, 0, DIM.wheelZ]} />
              </Part>
            ) : null}
          </Part>
        </group>
      </Part>
    </group>
  )
}

export function Hydro3D() {
  const g = hydroGeometry()
  const flows = useHydro((s) => s.flows)
  const mats = useMemo(() => ({ A: createDynamicCutMaterial({ color: '#d8432c', roughness: 0.2 }), B: createDynamicCutMaterial({ color: '#3f7fd0', roughness: 0.2 }) }), [])
  const curves = useMemo(() => ({ A: flowPath('A', false), Ar: flowPath('A', true), B: flowPath('B', false), Br: flowPath('B', true) }), [])
  const graph = useMemo(() => {
    const d = new DriveGraph()
    d.body('pump')
    d.body('motor', 3)
    // closed loop: D_m·ω_m = η_v²·D_p·ω_p (pump leakage, then motor leakage)
    d.add({
      id: 'loop',
      rows: () => {
        const st = useHydro.getState()
        return [{ c: { motor: unitDisplacement(UNIT, live.motorAngle), pump: -st.etaV * st.etaV * unitDisplacement(UNIT, live.pumpAngle) }, rhs: 0 }]
      },
    })
    return d
  }, [])
  const tmp = useMemo(() => new THREE.Color(), [])

  useSimFrame((dt) => {
    const st = useHydro.getState()
    const a = comboAngles(st.combo, { pumpLever: st.pumpLever, motorLever: st.motorLever }, UNIT, UNIT)
    // the swashplates follow their levers in about a quarter of a (real) second
    const real = dt / Math.max(1e-6, useSim.getState().timeScale)
    live.pumpAngle = approach(live.pumpAngle, a.pumpAngle, real, 0.25)
    live.motorAngle = approach(live.motorAngle, a.motorAngle, real, 0.25)
    graph.drive('pump', rpmToRad(st.rpm))
    graph.step(dt)
    state.pumpTheta = graph.get('pump').theta
    state.motorTheta = graph.get('motor').theta
    live.pumpRpm = radToRpm(graph.get('pump').omega)
    live.motorRpm = radToRpm(graph.get('motor').omega)
    // line colours: the delivering line is high pressure; with no flow both sit at charge pressure
    const k = Math.min(1, Math.abs(live.pumpAngle) / (0.05 * UNIT.maxAngle))
    const fwd = live.pumpAngle >= 0
    for (const [m, isA] of [
      [mats.A, true],
      [mats.B, false],
    ] as const) {
      const high = isA === fwd
      tmp.copy(LP).lerp(HP, high ? k : 0)
      m.material.color.copy(tmp)
      m.capColor.copy(tmp)
      m.material.clipIntersection = useView.getState().cut.intersection
    }
  }, -1)

  const q = () => unitDisplacement(UNIT, live.pumpAngle) / DMAX
  const flowProps = { count: 50, radius: 0.0045, speed: 3, spread: 0.008 }
  return (
    <group>
      <Unit kind="pump" matA={mats.A.material} matB={mats.B.material} />
      <Unit kind="motor" matA={mats.A.material} matB={mats.B.material} />
      <Part id="lines" name="Closed loop (main lines)" role="static" material="steel" info={INFO.oil} cites={C.hydro}>
        <Part id="line-a" name="Main line A" info={INFO.lineA} cites={C.hydro}>
          <PartMesh geometry={g.pipeWall.A} />
          <Part id="line-a-oil" name="Oil in line A" role="fluid" material="hydraulicOil" info={INFO.oil}>
            <PartMesh geometry={g.pipeOil.A} customMaterial={mats.A.material} castShadow={false} />
          </Part>
        </Part>
        <Part id="line-b" name="Main line B" info={INFO.lineB} cites={C.hydro}>
          <PartMesh geometry={g.pipeWall.B} />
          <Part id="line-b-oil" name="Oil in line B" role="fluid" material="hydraulicOil" info={INFO.oil}>
            <PartMesh geometry={g.pipeOil.B} customMaterial={mats.B.material} castShadow={false} />
          </Part>
        </Part>
      </Part>
      <Part id="base" name="Mounting feet" role="static" material="paintBlack" cut={false}>
        <PartMesh geometry={g.base} />
      </Part>
      {flows ? (
        <>
          <Flow curve={curves.A} color="#ff6a4d" intensity={() => Math.max(0, q())} {...flowProps} />
          <Flow curve={curves.Br} color="#6fa8ff" intensity={() => Math.max(0, q())} {...flowProps} />
          <Flow curve={curves.B} color="#ff6a4d" intensity={() => Math.max(0, -q())} {...flowProps} />
          <Flow curve={curves.Ar} color="#6fa8ff" intensity={() => Math.max(0, -q())} {...flowProps} />
        </>
      ) : null}
      <PartLabel partId="pump" at={[-DIM.unitX, DIM.housingR + 0.03, 0.02]} />
      <PartLabel partId="motor" at={[DIM.unitX, DIM.housingR + 0.03, 0.02]} />
      <PartLabel partId="pump-swash" at={[-DIM.unitX - 0.02, 0.05, DIM.swZ + 0.02]} />
      <PartLabel partId="pump-block" at={[-DIM.unitX + 0.03, -0.04, 0]} />
      <PartLabel partId="pump-pistons" at={[-DIM.unitX + 0.01, 0.04, 0.03]} />
      <PartLabel partId="pump-valve" at={[-DIM.unitX + 0.05, 0.05, DIM.valveZ0]} />
      <PartLabel partId="line-a" at={[0, 0.02, DIM.outerZ]} />
      <PartLabel partId="line-b" at={[0, 0.02, DIM.innerZ]} />
      <PartLabel partId="pump-lever" at={[-DIM.unitX - 0.11, 0.12, DIM.swZ]} />
      <PartLabel partId="output" at={[DIM.unitX, DIM.wheelR + 0.02, DIM.wheelZ]} />
    </group>
  )
}
