import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { cylinder, mat4, pipe, xform } from '@/geometry'
import { beltBand, loopPath } from '@/geometry/parts'
import type { PartInfo } from '@/parts/registry'
import { Part, PartMesh } from '@/render/Part'
import type { DriveAngles } from './DrivelineInternals'
import { HEAD_OUTLET } from '@/machines/layout'
import { CYL_Z, ENGINE_X } from './engine'
import { DRIVE_Y } from './geometry'
import { FAN_PULLEY_R, RADIATOR, prepareSystems, systemsReady, type SystemsGeometry } from './systems.geometry'

/**
 * The cooling system, in place: radiator (tube-and-fin core, header tanks, pressure cap) behind the
 * grille, fan and water pump on one spindle belt-driven from the crankshaft pulley, thermostat on
 * the head outlet, and the top and bottom hoses. The cooling scene's parts, from the shared library,
 * sized to this tractor. Frame as the tractor: +X forward, Y up, +Z right.
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const RAD_X = 1.96
/** water-pump / fan spindle height, and where things sit along it */
const SPINDLE_Y = 1.06
const PUMP_X = 1.37
const FAN_X = 1.8
/** the crankshaft pulley's plane (front of the engine) */
const BELT_X = ENGINE_X + CYL_Z[0] + 0.112
const CRANK_PULLEY_R = 0.065
/** thermostat on the head's coolant outlet, at its front end (engine frame (x, z) → tractor (ENGINE_X + z, −x)) */
const THERMO = V(ENGINE_X + CYL_Z[0] + HEAD_OUTLET.dz, DRIVE_Y + HEAD_OUTLET.topY, -HEAD_OUTLET.x)
/** fan speed ÷ crank speed */
export const FAN_RATIO = CRANK_PULLEY_R / FAN_PULLEY_R

const INFO: Record<string, PartInfo> = {
  radiator: { summary: 'Radiator: tube-and-fin core between header tanks.', role: 'Hot coolant from the engine enters the top tank and runs down the tubes; air drawn through the fins carries the heat away, and cooled water leaves the bottom tank for the pump.' },
  cap: { summary: 'Pressure cap.', role: 'Holds the system at a little over atmospheric pressure, raising the boiling point; a vacuum valve lets air back in as it cools.' },
  fan: { summary: 'Fan.', role: 'Draws air through the radiator core even when the tractor is standing still or working slowly in the field.' },
  pump: { summary: 'Centrifugal water pump.', role: 'The impeller flings coolant outwards in its volute, circulating it from the radiator through the block and head.' },
  belt: { summary: 'Fan belt and pulleys.', role: 'A V-belt from the crankshaft pulley drives the fan and water pump about 1.3 times faster than the engine.' },
  thermostat: { summary: 'Thermostat.', role: 'A wax-element valve that stays shut while the engine warms up, keeping coolant in the engine, and opens at about 80 °C to send it to the radiator.' },
  hoses: { summary: 'Top and bottom hoses.', role: 'Flexible connections that carry coolant to and from the radiator and absorb the engine’s movement on its mounts.' },
  coolant: { summary: 'Coolant in the radiator.', role: 'Water with antifreeze and corrosion inhibitor.' },
}

export function Cooling({ a, k }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const [g, setG] = useState<SystemsGeometry | null>(systemsReady)
  useEffect(() => {
    if (!g) void prepareSystems().then(setG)
  }, [g])
  if (!g) return null
  return <CoolingSystem g={g} a={a} k={k} />
}

function CoolingSystem({ g, a, k }: { g: SystemsGeometry; a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const c = g.cooling
  const local = useMemo(() => {
    const hose = (...pts: THREE.Vector3[]) => pipe(new THREE.CatmullRomCurve3(pts), 0.021, 0.016, 48, 16)
    const lp = loopPath(new THREE.Vector2(0, DRIVE_Y), CRANK_PULLEY_R - 0.006, new THREE.Vector2(0, SPINDLE_Y), FAN_PULLEY_R - 0.006)
    // the band is built in XY; turn it into the YZ plane at the pulleys' x
    const belt = xform(beltBand(lp.path, 0.014, 0.009), mat4.c(mat4.t(BELT_X, 0, 0), mat4.ry(-Math.PI / 2)))
    const spindle = xform(cylinder(0.012, FAN_X - PUMP_X, 16), mat4.c(mat4.t((PUMP_X + FAN_X) / 2, 0, 0), mat4.rz(Math.PI / 2)))
    const pumpInlet = V(PUMP_X + 0.0225, SPINDLE_Y, 0.05)
    return {
      belt,
      spindle,
      top: hose(THERMO.clone().add(V(0.04, 0.038, 0)), V(1.55, THERMO.y + 0.07, 0.08), V(RAD_X - 0.12, 1.33, 0.12), V(RAD_X - 0.045, 1.315, 0.12)),
      bottom: hose(V(RAD_X - 0.045, 0.99, -0.12), V(1.85, 0.86, -0.05), V(1.6, 0.86, 0.08), V(1.45, 0.98, 0.08), pumpInlet),
    }
  }, [])
  const rotor = useRef<THREE.Group>(null)
  const impeller = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const ang = a.current.crank * FAN_RATIO
    rotor.current?.rotation.set(ang, 0, 0)
    impeller.current?.rotation.set(0, 0, ang)
  })

  return (
    <>
      <Part id={k('radiator')} name="Radiator" role="static" material="copper" info={INFO.radiator} explode={[0.3, 0, 0]}>
        <group position={[RAD_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <PartMesh geometry={c.core.tubes} material="brass" />
          <PartMesh geometry={c.core.fins} />
          <PartMesh geometry={c.topTank.shell} material="brass" />
          <PartMesh geometry={c.bottomTank.shell} material="brass" />
          <PartMesh geometry={c.frame} material="paintBlack" />
          <Part id={k('radiator-cap')} name="Pressure cap" role="static" material="steel" info={INFO.cap}>
            <group position={[0.1, RADIATOR.topY1, 0]}>
              <PartMesh geometry={c.cap.neck} material="brass" />
              <PartMesh geometry={c.cap.cap} material="paintBlack" />
              <PartMesh geometry={c.cap.overflow} material="rubber" />
            </group>
          </Part>
          <Part id={k('coolant')} name="Coolant" role="fluid" material="coolant" xray info={INFO.coolant}>
            <PartMesh geometry={c.core.water} />
            <PartMesh geometry={c.topTank.water} />
            <PartMesh geometry={c.bottomTank.water} />
          </Part>
        </group>
      </Part>
      <Part id={k('fan')} name="Fan, water pump & spindle" role="moving" material="paintBlack" info={INFO.fan}>
        <group position={[0, SPINDLE_Y, 0]} ref={rotor}>
          <group position={[FAN_X, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <PartMesh geometry={c.fan} />
          </group>
          <PartMesh geometry={local.spindle} material="steel" />
          <group position={[BELT_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <PartMesh geometry={c.fanPulley} material="castIron" />
          </group>
        </group>
      </Part>
      <Part id={k('water-pump')} name="Water pump" role="static" material="castIron" info={INFO.pump}>
        <group position={[PUMP_X, SPINDLE_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <PartMesh geometry={c.volute} />
          <Part id={k('impeller')} name="Pump impeller" role="moving" material="bronze" info={INFO.pump}>
            <group position={[0, 0, 0.0225]} ref={impeller}>
              <PartMesh geometry={c.impeller} />
            </group>
          </Part>
        </group>
      </Part>
      <Part id={k('fan-belt')} name="Fan belt" role="static" material="rubber" info={INFO.belt}>
        <PartMesh geometry={local.belt} />
      </Part>
      <Part id={k('thermostat')} name="Thermostat" role="static" material="aluminium" info={INFO.thermostat}>
        <group position={THERMO} rotation={[0, Math.PI / 2, 0]}>
          <PartMesh geometry={c.thermostat} />
          <group position={[0, 0.03, 0]}>
            <PartMesh geometry={c.thermoParts.seat} material="brass" />
            <PartMesh geometry={c.thermoParts.valve} material="brass" position={[0, 0.006, 0]} />
            <PartMesh geometry={c.thermoParts.pellet} material="copper" />
            <PartMesh geometry={c.thermoParts.bridge} material="steel" />
          </group>
        </group>
      </Part>
      <Part id={k('hoses')} name="Radiator hoses" role="static" material="rubber" info={INFO.hoses}>
        <PartMesh geometry={local.top} />
        <PartMesh geometry={local.bottom} />
      </Part>
    </>
  )
}
