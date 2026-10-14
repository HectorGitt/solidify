import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import type * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { epicyclicFinalDrive, epicyclicRatio, type EpicyclicSpec } from '@/parts/lib/finalDrive'
import type { PartInfo } from '@/parts/registry'
import { FINAL_DRIVE } from '@/physics/drives'
import { Part, PartMesh } from '@/render/Part'
import type { DriveAngles } from './DrivelineInternals'
import { AXLE_Y, REAR_Z } from './geometry'

/**
 * Both final drives of the rear axle, in place: half shafts from the differential, wet disc
 * brakes, inboard epicyclic reductions (sun on the half shaft, annulus held, carrier driving the
 * axle) and the axles out to the wheel hubs. The final-drive scene's MF-type set, scaled to this
 * tractor's track. Frame as the tractor: +X forward, Y up, +Z right.
 */

const EPI: EpicyclicSpec = { ...FINAL_DRIVE.epicyclic, module: 0.005, width: 0.04, planets: 3 }
/** the set is drawn at the final-drive scene's size and scaled so its hub lands on this tractor's wheel */
const S = REAR_Z / 0.9
/** final reduction: the half shafts turn this much faster than the wheels */
export const FINAL_RATIO = epicyclicRatio(EPI)
const SIDES = [1, -1] as const

const INFO: Record<string, PartInfo> = {
  shafts: { summary: 'Half shafts with the sun gears.', role: 'Carry the drive from the differential side gears out to the final reductions; each ends in the sun gear of its epicyclic.' },
  planets: { summary: 'Final-drive planet gears.', role: 'Roll between the sun and the fixed annulus, carrying the planet carrier round at 1/4.8 of the half-shaft speed — the last and largest speed reduction before the wheels.' },
  rings: { summary: 'Annulus (ring) gears, held in the axle housing.', role: 'Fixed, so the planets must roll round inside them; holding the annulus is what makes the set a reduction gear.' },
  carriers: { summary: 'Planet carriers and axle shafts.', role: 'The output of the final drive: the carrier is splined to the axle shaft that turns the wheel hub, at high torque and low speed.' },
  brakes: { summary: 'Oil-immersed (wet) disc brakes.', role: 'A disc on each half shaft is clamped between friction faces by an annular piston; running in oil they stay cool and need little adjustment. Braking the fast half shaft needs 4.8 times less torque than braking the wheel.' },
  lock: { summary: 'Differential-lock plate pack.', role: 'Clamping these plates locks the half shaft to the differential cage, so both wheels turn together to get out of soft or slippery ground.' },
}

export function FinalDrives({ a, k }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const g = useMemo(() => epicyclicFinalDrive(EPI, { shaftFrom: 0.11 / S, brake: 0.175, reduction: 0.26, hub: 0.9 }, { lockPack: true }), [])
  /** per side (0 = right, 1 = left): groups turning with the half shaft, and with the carrier */
  const shaft = useRef<(THREE.Group | null)[]>([])
  const carrier = useRef<(THREE.Group | null)[]>([])
  const planets = useRef<(THREE.Group | null)[]>([])

  useSimFrame(() => {
    const { crown, diff } = a.current
    SIDES.forEach((s, i) => {
      // side-gear angle about this side's outward axis (the left set is turned 180° about Y)
      const phi = s > 0 ? -crown + diff : crown + diff
      const out = phi / FINAL_RATIO
      shaft.current[i]?.rotation.set(0, 0, phi)
      shaft.current[i + 2]?.rotation.set(0, 0, phi)
      carrier.current[i]?.rotation.set(0, 0, out)
      carrier.current[i + 2]?.rotation.set(0, 0, out)
      for (let p = 0; p < EPI.planets; p++) planets.current[i * EPI.planets + p]?.rotation.set(0, 0, (-(phi - out) * EPI.sun) / EPI.planet)
    })
  })

  /** one copy per side, in that side's outward frame */
  const each = (render: (i: number) => ReactNode, only?: 1 | -1) =>
    SIDES.map((sd, i) =>
      only && sd !== only ? null : (
        <group key={sd} position={[0, AXLE_Y, 0]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]} scale={S}>
          {render(i)}
        </group>
      ),
    )
  const set = (arr: MutableRefObject<(THREE.Group | null)[]>, i: number) => (el: THREE.Group | null) => void (arr.current[i] = el)

  return (
    <>
      <Part id={k('half-shafts')} name="Half shafts & sun gears" role="moving" material="forged" info={INFO.shafts}>
        {each((i) => (
          <group ref={set(shaft, i)}>
            <PartMesh geometry={g.sun} />
          </group>
        ))}
      </Part>
      <Part id={k('wet-brakes')} name="Wet disc brakes" role="moving" material="steel" info={INFO.brakes} explode={[0, 0.25, 0]}>
        {each((i) => (
          <>
            <group ref={set(shaft, i + 2)}>
              <PartMesh geometry={g.disc} />
              <PartMesh geometry={g.lining} material="friction" />
            </group>
            <PartMesh geometry={g.brakePiston} material="aluminium" />
          </>
        ))}
      </Part>
      <Part id={k('final-rings')} name="Final-drive annulus gears" role="static" material="steelDark" info={INFO.rings}>
        {each(() => (
          <PartMesh geometry={g.ring} />
        ))}
      </Part>
      <Part id={k('final-planets')} name="Final-drive planet gears" role="moving" material="steel" info={INFO.planets} explode={[0, 0.2, 0]}>
        {each((i) => (
          <group ref={set(carrier, i + 2)}>
            {g.planetAngles.map((ang, p) => (
              <group key={p} position={[g.rc * Math.cos(ang), g.rc * Math.sin(ang), 0.26]} ref={set(planets, i * EPI.planets + p)}>
                <PartMesh geometry={g.planet} />
              </group>
            ))}
          </group>
        ))}
      </Part>
      <Part id={k('final-carriers')} name="Planet carriers & axles" role="moving" material="forged" info={INFO.carriers} explode={[0, -0.2, 0]}>
        {each((i) => (
          <group ref={set(carrier, i)}>
            <PartMesh geometry={g.carrier} />
            <PartMesh geometry={g.hub} material="steelDark" />
          </group>
        ))}
      </Part>
      {g.lock ? (
        <Part id={k('diff-lock')} name="Differential-lock pack" role="static" material="friction" info={INFO.lock}>
          {each(
            () => (
              <>
                <PartMesh geometry={g.lock!.plates} />
                <PartMesh geometry={g.lock!.piston} material="steel" />
              </>
            ),
            -1,
          )}
        </Part>
      ) : null}
    </>
  )
}
