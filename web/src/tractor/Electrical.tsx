import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { mat4, pipe, xform } from '@/geometry'
import { beltBand, loopPath } from '@/geometry/parts'
import { vPulley } from '@/parts/lib/cooling'
import type { PartInfo } from '@/parts/registry'
import { Part, PartMesh } from '@/render/Part'
import type { DriveAngles } from './DrivelineInternals'
import { CYL_Z, ENGINE_X } from './engine'
import { DRIVE_Y } from './geometry'
import { ALT_PULLEY_R, STARTER, prepareSystems, systemsReady, type SystemsGeometry } from './systems.geometry'

/**
 * The electrical system, in place: starter motor on the flywheel housing with its pinion against
 * the ring gear, alternator belt-driven from a second crankshaft pulley, battery under the bonnet,
 * and the heavy cables between them. The ignition scene's machines, from the shared library.
 * Frame as the tractor: +X forward, Y up, +Z right.
 */

const { PI } = Math
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
/** flywheel ring gear plane and radius (108 teeth, m = 2.9 mm) */
const RING_X = ENGINE_X + CYL_Z[3] - 0.115
const RING_R = (108 * STARTER.module) / 2
const PINION_R = (STARTER.pinionTeeth * STARTER.module) / 2
/** starter pinion centre: on the right, 10° below the crank centre line */
const START_ANG = (-10 * PI) / 180
const PINION = V(RING_X, DRIVE_Y + (RING_R + PINION_R) * Math.sin(START_ANG), (RING_R + PINION_R) * Math.cos(START_ANG))
/** second crankshaft pulley for the alternator belt, just ahead of the fan-belt pulley */
const ALT_BELT_X = ENGINE_X + CYL_Z[0] + 0.142
const CRANK2_R = 0.058
const ALT = V(ALT_BELT_X + 0.045, 0.86, -0.2)
const BATTERY = V(0.97, 1.115, 0.2)
export const ALT_RATIO = CRANK2_R / ALT_PULLEY_R

const INFO: Record<string, PartInfo> = {
  starter: { summary: 'Starter motor with pre-engaged solenoid.', role: 'When the key is turned the solenoid throws the pinion into mesh with the flywheel ring gear and closes the heavy contacts, so the motor turns the engine over (about 15 : 1 through the pinion and ring).' },
  alternator: { summary: 'Alternator.', role: 'Belt-driven from the crankshaft at about 2.3 times engine speed; its claw-pole rotor induces alternating current in the stator, rectified by the diodes to charge the battery.' },
  battery: { summary: '12 V lead-acid battery.', role: 'Six cells of lead plates in sulphuric acid. Supplies the large current for starting, and is recharged by the alternator once the engine runs.' },
  cables: { summary: 'Battery cables and charging lead.', role: 'Heavy cables carry the starting current from the battery to the starter and back through the engine frame (earth); a lighter lead brings the charging current from the alternator.' },
  belt: { summary: 'Alternator belt and crankshaft pulley.', role: 'A second V-belt from the crankshaft drives the alternator.' },
}

export function Electrical({ a, k }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const [g, setG] = useState<SystemsGeometry | null>(systemsReady)
  useEffect(() => {
    if (!g) void prepareSystems().then(setG)
  }, [g])
  if (!g) return null
  return <ElectricalSystem g={g} a={a} k={k} />
}

function ElectricalSystem({ g, a, k }: { g: SystemsGeometry; a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const e = g.electrical
  const local = useMemo(() => {
    const cable = (r: number, ...pts: THREE.Vector3[]) => pipe(new THREE.CatmullRomCurve3(pts), r, r * 0.6, 64, 12)
    // starter local frame: pinion at the origin, motor along −Z; turned so the motor runs forward (+X)
    const toWorld = (x: number, y: number, z: number) => V(-z, y, x).add(PINION)
    const solenoid = toWorld(0.009, e.starter.SY + 0.012, -0.132)
    const posPost = V(BATTERY.x - 0.09, BATTERY.y + 0.12, BATTERY.z - 0.045)
    const negPost = V(BATTERY.x + 0.09, BATTERY.y + 0.12, BATTERY.z - 0.045)
    const lp = loopPath(new THREE.Vector2(0, DRIVE_Y), CRANK2_R - 0.006, new THREE.Vector2(ALT.z, ALT.y), ALT_PULLEY_R - 0.004)
    return {
      positive: cable(0.008, posPost, V(posPost.x, posPost.y + 0.04, posPost.z), V(0.95, 1.0, 0.26), V(0.93, 0.78, 0.22), solenoid),
      earth: cable(0.008, negPost, V(negPost.x, negPost.y + 0.04, negPost.z), V(1.15, 1.05, 0.14), V(1.2, 0.92, 0.112)),
      charge: cable(0.004, V(ALT.x + 0.06, ALT.y, ALT.z), V(ALT.x + 0.08, 0.98, -0.18), V(1.42, 1.26, 0.0), V(1.0, 1.27, 0.12), posPost.clone().add(V(0, 0.03, 0))),
      // the band is built in XY with x = tractor z; turn it into the YZ plane at the belt line
      belt: xform(beltBand(lp.path, 0.01, 0.007), mat4.c(mat4.t(ALT_BELT_X, 0, 0), mat4.ry(-PI / 2))),
      crankPulley: vPulley(CRANK2_R),
    }
  }, [e])
  const crankPulley = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)
  useSimFrame(() => {
    crankPulley.current?.rotation.set(0, 0, a.current.crank)
    rotor.current?.rotation.set(0, 0, a.current.crank * ALT_RATIO)
  })
  const s = e.starter
  const al = e.alternator
  const b = e.battery

  return (
    <>
      <Part id={k('starter')} name="Starter motor" role="static" material="paintBlack" info={INFO.starter} explode={[0, -0.12, 0.25]}>
        <group position={PINION} rotation={[0, -PI / 2, 0]}>
          <PartMesh geometry={s.yoke} />
          <PartMesh geometry={s.ceFrame} material="castIron" />
          <PartMesh geometry={s.deFrame} material="aluminium" />
          <PartMesh geometry={s.poles} material="steelDark" />
          <PartMesh geometry={s.fields} material="copper" />
          <PartMesh geometry={s.solBody} />
          <PartMesh geometry={s.solCoil} material="copper" />
          <PartMesh geometry={s.solTerms} material="brass" />
          <PartMesh geometry={s.lever} material="steel" />
          <Part id={k('starter-armature')} name="Starter armature & pinion" role="moving" material="steel" info={INFO.starter}>
            <PartMesh geometry={s.pinion} />
            <PartMesh geometry={s.collar} />
            <PartMesh geometry={s.shaft} />
            <PartMesh geometry={s.armature} material="steelDark" />
            <PartMesh geometry={s.endTurns} material="copper" />
            <PartMesh geometry={s.commutator} material="copper" />
            <PartMesh geometry={s.brushes} material="steelDark" />
          </Part>
        </group>
      </Part>
      <Part id={k('alternator')} name="Alternator" role="static" material="aluminium" info={INFO.alternator} explode={[0.15, 0.1, -0.2]}>
        <group position={ALT} rotation={[0, PI / 2, 0]}>
          <PartMesh geometry={al.housings} />
          <PartMesh geometry={al.stator} material="steelDark" />
          <PartMesh geometry={al.statorWind} material="copper" />
          <PartMesh geometry={al.diodes} material="steel" />
          <Part id={k('alternator-rotor')} name="Alternator rotor & pulley" role="moving" material="steelDark" info={INFO.alternator}>
            <group ref={rotor}>
              <PartMesh geometry={al.claws} />
              <PartMesh geometry={al.rotorCore} />
              <PartMesh geometry={al.rotorWind} material="copper" />
              <PartMesh geometry={al.shaft} material="steel" />
              <PartMesh geometry={al.fan} material="steel" />
              <PartMesh geometry={al.pulley} material="castIron" />
            </group>
          </Part>
        </group>
      </Part>
      <Part id={k('alt-belt')} name="Alternator belt & pulley" role="moving" material="rubber" info={INFO.belt}>
        <PartMesh geometry={local.belt} />
        <group position={[ALT_BELT_X, DRIVE_Y, 0]} rotation={[0, PI / 2, 0]}>
          <group ref={crankPulley}>
            <PartMesh geometry={local.crankPulley} material="castIron" />
          </group>
        </group>
      </Part>
      <Part id={k('battery')} name="Battery" role="housing" material="plastic" info={INFO.battery} explode={[0, 0.3, 0.25]}>
        <group position={BATTERY}>
          <PartMesh geometry={b.case} />
          <PartMesh geometry={b.lid} />
          <PartMesh geometry={b.caps} material="paintGrey" />
          <PartMesh geometry={b.posPost} material="bronze" />
          <PartMesh geometry={b.negPost} material="steelDark" />
          <Part id={k('battery-cells')} name="Battery cells" role="static" material="steelDark" info={INFO.battery}>
            <PartMesh geometry={b.partitions} material="plastic" />
            <PartMesh geometry={b.pos} material="copper" />
            <PartMesh geometry={b.neg} />
            <PartMesh geometry={b.sep} material="paintGrey" />
            <PartMesh geometry={b.straps} material="steelDark" />
            <PartMesh geometry={b.electrolyte} material="water" />
          </Part>
        </group>
      </Part>
      <Part id={k('cables')} name="Battery cables" role="static" material="rubber" info={INFO.cables}>
        <PartMesh geometry={local.positive} material="paintRed" />
        <PartMesh geometry={local.earth} material="paintBlack" />
        <PartMesh geometry={local.charge} material="paintRed" />
      </Part>
    </>
  )
}
