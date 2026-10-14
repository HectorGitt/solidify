import { mat4, xform } from '@/geometry'
import { gearPump, gearPumpCovers, portPipe, vanePump, type GearPumpSpec } from '@/parts/lib/hydraulics'
import { GEAR, VANE } from './model'

/**
 * Pumps scene geometry, from the shared parts library (src/parts/lib/hydraulics.ts).
 * Gear pump: axis Z, gear centres at y = ±r (the library builds them at x = ±r; turned 90° here),
 * open body closed by front and rear covers. Vane pump: axis Z, rotor at the origin.
 */

const GEAR_SPEC: GearPumpSpec = {
  module: GEAR.module,
  teeth: GEAR.teeth,
  width: GEAR.width,
  block: [0.105, 0.095, GEAR.width],
  clearance: 0.0004,
  cavityDepth: 0.05,
  portR: 0.0095,
  portOffset: 0.035,
  gearWidth: GEAR.width,
  bore: 0.0062,
  flankPoints: 8,
}
/** library frame (gears along X) → scene frame (gears along Y, drive gear on top) */
const TURN = mat4.rz(Math.PI / 2)

export function buildStatic() {
  const gp = gearPump(GEAR_SPEC)
  const gc = gearPumpCovers(GEAR_SPEC)
  const vp = vanePump(VANE)
  return {
    gearBody: xform(gp.body, TURN),
    gearFront: xform(gc.front, TURN),
    gearRear: xform(gc.rear, TURN),
    gear: gp.gear,
    gearDrive: gc.drive,
    gearIdler: gc.idler,
    gearInPipe: portPipe(-0.1, -0.0465),
    gearOutPipe: portPipe(0.0465, 0.1),
    ring: vp.ring,
    rotor: vp.rotor,
    vane: vp.vane,
    vaneShaft: vp.shaft,
    vaneBody: vp.body,
    vaneRear: vp.rear,
    vaneFront: vp.front,
    vaneInPipe: portPipe(-0.12, -0.065, 0, -VANE.width / 2 - 0.006),
    vaneOutPipe: portPipe(0.065, 0.12, 0, -VANE.width / 2 - 0.006),
  }
}

export type PumpGeometry = ReturnType<typeof buildStatic>

let ready: PumpGeometry | null = null

export async function preparePumpGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('hydraulics/pumps', buildStatic)
  return ready
}

export function buildPumpGeometry(): PumpGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
