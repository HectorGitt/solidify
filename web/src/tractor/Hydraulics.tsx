import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, mat4, pipe, xform, merge } from '@/geometry'
import type { PartInfo } from '@/parts/registry'
import { Part, PartMesh } from '@/render/Part'
import type { DriveAngles } from './DrivelineInternals'
import { PTO_PAIRS } from './PtoDrive'
import { C, CRANK, RAM_PIVOT, ROD_LEN, ramLength } from './liftRam'
import { phiForHitchHeight } from './linkage'
import { FILTER_SPEC, RELIEF_SPEC, VALVE_SPEC, prepareSystems, systemsReady, type SystemsGeometry } from './systems.geometry'

/**
 * The hydraulic lift system, in place: gear pump driven off the PTO countershaft (it runs whenever
 * the clutch is engaged), full-flow filter, relief valve, spool control valve in the lift cover,
 * single-acting ram working the rockshaft crank, and the transmission oil it all draws from.
 * The lift-circuit scene's parts, from the shared library, in this tractor's frame
 * (+X forward, Y up, +Z right).
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
/** placements, tractor frame */
/** pump low in the centre housing under the PTO shaft (Ferguson-style); full-flow filter outside the gearbox side */
const PUMP = V(0.08, 0.415, 0)
const FILTER = V(0.36, 0.33, 0.27)
/** relief valve in the lift cover beside the control valve */
const RELIEF = V(0.22, 0.81, 0.12)
const VALVE = V(-0.05, 0.985, 0.12)
const VALVE_X0 = VALVE.x - VALVE_SPEC.length / 2
const PORT = { P: V(VALVE_X0 + 0.1, VALVE.y + 0.04, VALVE.z), A: V(VALVE_X0 + 0.17, VALVE.y - 0.04, VALVE.z), T: V(VALVE_X0 + 0.06, VALVE.y - 0.04, VALVE.z) }

const INFO: Record<string, PartInfo> = {
  pump: { summary: 'Gear pump.', role: 'Two meshing gears carry oil round the outside of the casing from suction to delivery. Driven off the PTO countershaft, it delivers whenever the clutch is engaged.' },
  filter: { summary: 'Full-flow oil filter.', role: 'Every drop the pump delivers passes through the element before it reaches the valves, keeping dirt out of the close-fitting spool and ram.' },
  relief: { summary: 'Relief valve.', role: 'Sets the maximum pressure: when the ram is at the end of its stroke or the load is too heavy, the poppet lifts off its seat against the spring and the pump’s oil returns to the tank.' },
  valve: { summary: 'Spool control valve, in the lift cover.', role: 'The spool slides with the lift lever: raise sends pump oil to the ram, hold traps the oil in it, lower lets it out to the tank.' },
  ram: { summary: 'Single-acting lift ram.', role: 'Oil pressure on the piston pushes the rod against the rockshaft crank, turning the lift arms that raise the lower links. The implement’s weight lowers it.' },
  crank: { summary: 'Ram crank arm on the rockshaft.', role: 'Fixed to the rockshaft with the lift arms; the ram pushes it round to lift.' },
  pipes: { summary: 'Hydraulic pipes.', role: 'Suction from the oil, delivery through the filter to the valve and the relief valve, the ram line, and the returns to tank.' },
  oil: { summary: 'Transmission oil.', role: 'The gearbox and centre housing are the hydraulic reservoir: the same oil lubricates the gears and works the lift.' },
}

export function Hydraulics({ a, k }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const [g, setG] = useState<SystemsGeometry | null>(systemsReady)
  useEffect(() => {
    if (!g) void prepareSystems().then(setG)
  }, [g])
  if (!g) return null
  return <HydraulicSystem g={g} a={a} k={k} />
}

function HydraulicSystem({ g, a, k }: { g: SystemsGeometry; a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const h = g.hydraulics
  const pipes = useMemo(() => {
    const line = (...pts: THREE.Vector3[]) => pipe(new THREE.CatmullRomCurve3(pts), 0.008, 0.0055, 48, 12)
    const reliefIn = V(RELIEF.x + RELIEF_SPEC.r, RELIEF.y + RELIEF_SPEC.seat - 0.025, RELIEF.z)
    const reliefOut = V(RELIEF.x - RELIEF_SPEC.r, RELIEF.y + RELIEF_SPEC.seat + 0.09, RELIEF.z)
    const filterTop = V(FILTER.x, FILTER.y + FILTER_SPEC.height, FILTER.z)
    return [
      // suction from the oil under the pump; delivery out through the housing side to the filter
      line(V(PUMP.x, PUMP.y, PUMP.z - 0.055), V(PUMP.x, 0.37, -0.1), V(PUMP.x, 0.355, -0.15)),
      line(V(PUMP.x, PUMP.y, PUMP.z + 0.055), V(0.12, 0.4, 0.2), V(0.3, 0.4, 0.3), V(FILTER.x, FILTER.y, FILTER.z)),
      // filter up the gearbox side into the lift cover, to the valve P port, with the tee to the relief valve
      line(filterTop, V(FILTER.x, 0.7, FILTER.z), V(0.3, 0.95, 0.2), V(PORT.P.x, 1.0, PORT.P.z), PORT.P),
      line(filterTop.clone().add(V(0, 0.01, 0)), V(0.3, 0.8, 0.2), reliefIn),
      // relief and valve returns down to the oil, ram line
      line(reliefOut, V(0.18, 0.75, 0.1), V(0.15, 0.5, 0.1)),
      line(PORT.T, V(PORT.T.x - 0.02, 0.9, 0.18), V(-0.165, 0.7, 0.21), V(-0.165, 0.45, 0.21)),
      line(PORT.A, V(0.1, 0.92, 0.1), V(0.22, 0.94, 0.04), V(RAM_PIVOT.x - 0.02, RAM_PIVOT.y + 0.06, 0)),
    ]
  }, [])
  // the transmission oil, in the centre housing and the gearbox (the wall between has its own drillings)
  const oil = useMemo(() => merge(xform(box(0.34, 0.2, 0.5), mat4.t(0, 0.45, 0)), xform(box(0.27, 0.19, 0.41), mat4.t(0.36, 0.455, 0))), [])
  const crankArm = useMemo(() => xform(box(0.03, CRANK + 0.03, 0.04), mat4.t(0, -CRANK / 2, 0)), [])

  const drive = useRef<THREE.Group>(null)
  const driven = useRef<THREE.Group>(null)
  const spool = useRef<THREE.Group>(null)
  const poppet = useRef<THREE.Group>(null)
  const ramG = useRef<THREE.Group>(null)
  const piston = useRef<THREE.Group>(null)
  const ramOil = useRef<THREE.Mesh>(null)
  const crank = useRef<THREE.Group>(null)
  const spoolX = useRef(0)

  useSimFrame(() => {
    const s = a.current
    // pump: drive gear on the countershaft axis, the other turning the opposite way
    const b = (-s.lay * PTO_PAIRS[0][0]) / PTO_PAIRS[0][1]
    drive.current?.rotation.set(0, 0, b)
    driven.current?.rotation.set(0, 0, -b + Math.PI / 10)
    // spool follows the lift lever: + raise, − lower
    const target = Math.max(-1, Math.min(1, s.hitchRate / 0.03)) * 0.03
    spoolX.current += (target - spoolX.current) * 0.15
    spool.current?.position.set(spoolX.current, 0, 0)
    // relief cracks open when the ram is held at full lift
    poppet.current?.position.set(0, RELIEF_SPEC.seat + (s.hitchRate > 0.005 && s.hitch > 0.62 ? 0.004 : 0), 0)
    // ram and crank from the linkage
    const r = ramLength(phiForHitchHeight(s.hitch))
    const dx = r.K.x - RAM_PIVOT.x
    const dy = r.K.y - RAM_PIVOT.y
    ramG.current?.rotation.set(0, 0, Math.atan2(dy, dx))
    const stroke = r.L - ROD_LEN
    piston.current?.position.set(stroke, 0, 0)
    if (ramOil.current) ramOil.current.scale.set(Math.max(1e-4, stroke), 1, 1)
    crank.current?.rotation.set(0, 0, -r.pose.beta)
  })

  return (
    <>
      <Part id={k('hyd-pump')} name="Hydraulic pump" role="static" material="castIron" info={INFO.pump} explode={[0, -0.25, -0.2]}>
        <group position={PUMP} rotation={[Math.PI / 2, 0, 0]}>
          <group rotation={[0, Math.PI / 2, 0]}>
            <PartMesh geometry={h.pump.body} />
            <Part id={k('hyd-pump-gears')} name="Pump gears" role="moving" material="steel" info={INFO.pump}>
              <group position={[h.pump.centres / 2, 0, 0]} ref={drive}>
                <PartMesh geometry={h.pump.gear} />
              </group>
              <group position={[-h.pump.centres / 2, 0, 0]} ref={driven}>
                <PartMesh geometry={h.pump.gear} />
              </group>
            </Part>
          </group>
        </group>
      </Part>
      <Part id={k('hyd-filter')} name="Hydraulic filter" role="static" material="paintBlue" info={INFO.filter}>
        <group position={FILTER}>
          <PartMesh geometry={h.filter.can} />
          <PartMesh geometry={h.filter.element} material="paintYellow" />
        </group>
      </Part>
      <Part id={k('hyd-relief')} name="Relief valve" role="static" material="steel" info={INFO.relief}>
        <group position={RELIEF} rotation={[0, Math.PI, 0]}>
          <PartMesh geometry={h.relief.body} />
          <group ref={poppet}>
            <PartMesh geometry={h.relief.poppet} material="chrome" />
          </group>
          <PartMesh geometry={h.relief.spring} material="steelDark" position={[0, RELIEF_SPEC.seat + 0.014, 0]} scale={[1, RELIEF_SPEC.height - RELIEF_SPEC.seat - 0.03, 1]} />
        </group>
      </Part>
      <Part id={k('hyd-valve')} name="Control valve" role="static" material="castIron" info={INFO.valve} explode={[0, 0.25, 0.15]}>
        <group position={VALVE}>
          <PartMesh geometry={h.valve.body} />
          <Part id={k('hyd-spool')} name="Valve spool" role="moving" material="chrome" info={INFO.valve}>
            <group ref={spool}>
              <PartMesh geometry={h.valve.spool} />
            </group>
          </Part>
        </group>
      </Part>
      <Part id={k('hyd-ram')} name="Lift ram" role="static" material="castIron" info={INFO.ram} explode={[0, 0.3, 0]}>
        <group position={[RAM_PIVOT.x, RAM_PIVOT.y, 0]} ref={ramG}>
          <PartMesh geometry={h.ram.barrel} />
          <Part id={k('hyd-ram-piston')} name="Ram piston & rod" role="moving" material="chrome" info={INFO.ram}>
            <group ref={piston}>
              <PartMesh geometry={h.ram.piston} material="steel" />
              <PartMesh geometry={h.ram.seal} material="rubber" />
              <PartMesh geometry={h.ram.rod} />
            </group>
          </Part>
          <Part id={k('hyd-ram-oil')} name="Oil in the ram" role="fluid" material="hydraulicOil" info={INFO.oil}>
            <PartMesh ref={ramOil} geometry={h.ram.oil} />
          </Part>
        </group>
      </Part>
      <Part id={k('hyd-crank')} name="Ram crank arm" role="moving" material="forged" info={INFO.crank}>
        <group position={[C.x, C.y, 0]} ref={crank}>
          <PartMesh geometry={crankArm} />
        </group>
      </Part>
      <Part id={k('hyd-pipes')} name="Hydraulic pipes" role="static" material="steel" info={INFO.pipes}>
        {pipes.map((p, i) => (
          <PartMesh key={i} geometry={p} />
        ))}
      </Part>
      <Part id={k('hyd-oil')} name="Transmission oil" role="fluid" material="hydraulicOil" xray info={INFO.oil}>
        <PartMesh geometry={oil} />
      </Part>
    </>
  )
}
