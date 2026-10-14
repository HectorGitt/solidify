import { useMemo, useRef, type MutableRefObject } from 'react'
import type * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { mat4, xform } from '@/geometry'
import { dogRing, shaftZ, spur } from '@/parts/lib/shapes'
import type { PartInfo } from '@/parts/registry'
import { Part, PartMesh } from '@/render/Part'
import type { DriveAngles } from './DrivelineInternals'
import { PTO_STUB_X, PTO_Y } from './geometry'

/**
 * The PTO drive, in place: a transmission PTO taken off the rear of the layshaft (it turns whenever
 * the clutch is engaged, whatever gear is selected, and stops when the pedal is down), stepped
 * down to 540 rpm by two spur pairs through a countershaft that runs beside the differential,
 * low enough to clear the crown wheel and the wet brakes, and back on to the stub's axis.
 * Frame as the tractor: +X forward, Y up, +Z right. Shafts run along X; gears turn by rotation.x.
 */

/** teeth of the two reduction pairs (each pair on the same 110 mm centres) */
export const PTO_PAIRS = [
  [20, 28],
  [20, 28],
] as const
const OFFSET = 0.11
const M = (2 * OFFSET) / (PTO_PAIRS[0][0] + PTO_PAIRS[0][1])
const W = 0.025
/** stub turns this many times slower than the layshaft (layshaft = engine ÷ 2) */
export const PTO_FROM_LAY = (PTO_PAIRS[0][1] / PTO_PAIRS[0][0]) * (PTO_PAIRS[1][1] / PTO_PAIRS[1][0])
const X_FRONT = 0.16
const X_REAR = -0.17

const INFO: Record<string, PartInfo> = {
  drive: { summary: 'PTO drive shaft and engagement collar.', role: 'Taken off the rear of the gearbox layshaft. Sliding the collar with the PTO lever engages the drive; because the layshaft only turns while the clutch is engaged, this is a transmission PTO.' },
  counter: { summary: 'PTO countershaft.', role: 'Carries the drive past the differential, below the crown wheel and beside the brakes; its two gears make the two steps of the reduction to 540 rpm.' },
  output: { summary: 'PTO output shaft.', role: 'Brings the drive back on to the stub’s axis: 540 rpm at about 2120 engine rpm, the standard speed for a 6-spline 35 mm stub.' },
}

export function PtoDrive({ a, k }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const g = useMemo(() => {
    const gx = (z: number, bore: number) => spur(z, M, W, bore).rotateY(Math.PI / 2)
    const shaft = (x0: number, x1: number, r: number) => xform(shaftZ(r, x0, x1, 20), mat4.ry(Math.PI / 2))
    return {
      driveShaft: shaft(X_FRONT - 0.03, 0.235, 0.014),
      a1: gx(PTO_PAIRS[0][0], 0.014),
      collar: dogRing(12, 0.022, 0.03, 0.014, 0.02).rotateY(Math.PI / 2),
      counter: shaft(X_REAR - 0.03, X_FRONT + 0.03, 0.015),
      b1: gx(PTO_PAIRS[0][1], 0.015),
      b2: gx(PTO_PAIRS[1][0], 0.015),
      output: shaft(PTO_STUB_X, X_REAR + 0.03, 0.016),
      c1: gx(PTO_PAIRS[1][1], 0.016),
    }
  }, [])
  const drive = useRef<THREE.Group>(null)
  const counter = useRef<THREE.Group>(null)
  const output = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const lay = a.current.lay
    const b = (-lay * PTO_PAIRS[0][0]) / PTO_PAIRS[0][1]
    drive.current?.rotation.set(lay, 0, 0)
    counter.current?.rotation.set(b, 0, 0)
    output.current?.rotation.set((-b * PTO_PAIRS[1][0]) / PTO_PAIRS[1][1], 0, 0)
  })
  return (
    <>
      <Part id={k('pto-drive')} name="PTO drive shaft & collar" role="moving" material="forged" info={INFO.drive}>
        <group ref={drive} position={[0, PTO_Y, 0]}>
          <PartMesh geometry={g.driveShaft} />
          <PartMesh geometry={g.a1} material="steel" position={[X_FRONT, 0, 0]} />
          <PartMesh geometry={g.collar} material="steelDark" position={[0.2, 0, 0]} />
        </group>
      </Part>
      <Part id={k('pto-countershaft')} name="PTO countershaft" role="moving" material="forged" info={INFO.counter} explode={[0, -0.15, -0.15]}>
        <group ref={counter} position={[0, PTO_Y, -OFFSET]}>
          <PartMesh geometry={g.counter} />
          <PartMesh geometry={g.b1} material="steel" position={[X_FRONT, 0, 0]} />
          <PartMesh geometry={g.b2} material="steel" position={[X_REAR, 0, 0]} />
        </group>
      </Part>
      <Part id={k('pto-output')} name="PTO output shaft" role="moving" material="forged" info={INFO.output} explode={[-0.15, 0, 0]}>
        <group ref={output} position={[0, PTO_Y, 0]}>
          <PartMesh geometry={g.output} />
          <PartMesh geometry={g.c1} material="steel" position={[X_REAR, 0, 0]} />
        </group>
      </Part>
    </>
  )
}
