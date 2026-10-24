import { lathe } from '@/geometry'
import { filterCan, gearPump, ram, reliefValve, spoolValve } from '@/parts/lib/hydraulics'
import { BALL, ballNut, ballRocker, ballScrew, boxHousing, dropArm, sphereProfile, transferTube } from '@/parts/lib/steeringBox'
import { fan, impeller, pumpVolute, radiatorCap, radiatorCore, radiatorFrame, radiatorTank, thermostatHousing, thermostatParts, vPulley, type RadiatorSpec } from '@/parts/lib/cooling'
import { alternator, battery, starterMotor } from '@/parts/lib/electrical'
import { BARREL_LEN, RAM_BORE, ROD_LEN } from './liftRam'

/**
 * Heavy (CSG) geometry for the tractor's systems in the whole-tractor view, built once in the
 * geometry worker from the shared parts library. Each part is in its own local frame; the system
 * components place it on the tractor. Worker-safe: no React, no DOM.
 */

export const PUMP_SPEC = { module: 0.004, teeth: 10, width: 0.04 }
export const VALVE_SPEC = {
  length: 0.24,
  h: 0.08,
  w: 0.08,
  boreR: 0.017,
  ports: [
    { x: 0.1, up: true },
    { x: 0.17, up: false },
    { x: 0.06, up: false },
  ],
}
export const RELIEF_SPEC = { r: 0.026, height: 0.21, seat: 0.07 }
export const FILTER_SPEC = { r: 0.04, height: 0.2 }
/** the tractor's radiator, filling its opening behind the grille (local: width along X, y absolute, air along Z) */
export const RADIATOR: RadiatorSpec = { x: 0.2, y0: 1.02, y1: 1.28, z0: -0.03, z1: 0.03, tankZ0: -0.045, tankZ1: 0.045, botY0: 0.96, topY1: 1.35, tubes: 14, fins: 36 }
export const FAN_R = 0.16
export const FAN_PULLEY_R = 0.05
export const ALT_PULLEY_R = 0.025
/** the starter pinion matches the flywheel ring gear (108 teeth, m = 2.9 mm) */
export const STARTER = { module: 0.0029, pinionTeeth: 9 }

/** steering column length from the box (screw centre) to the wheel */
/** (the box-to-wheel distance is 0.762; the shaft runs on up into the wheel hub) */
export const COLUMN_LEN = 0.78

export function buildStatic() {
  return {
    hydraulics: {
      pump: gearPump(PUMP_SPEC),
      valve: spoolValve(VALVE_SPEC),
      relief: reliefValve(RELIEF_SPEC),
      filter: filterCan(FILTER_SPEC),
      ram: ram({ bore: RAM_BORE, barrelLen: BARREL_LEN, rodLen: ROD_LEN }),
    },
    steering: {
      screw: ballScrew(COLUMN_LEN),
      nut: ballNut(),
      tube: transferTube(),
      rocker: ballRocker(),
      drop: dropArm(),
      ball: lathe(sphereProfile(BALL.ball), 16),
      housing: boxHousing(-0.085, 0.085, BALL.eY - 0.03, 0.055, 0.045, [
        { at: [-0.085, 0, 0], r: 0.012, axis: 'x' },
        { at: [0.085, 0, 0], r: 0.012, axis: 'x' },
        { at: [0, BALL.eY, 0.045], r: 0.0135, axis: 'z' },
      ]),
    },
    cooling: {
      core: radiatorCore(RADIATOR),
      topTank: radiatorTank(RADIATOR, RADIATOR.y1, RADIATOR.topY1),
      bottomTank: radiatorTank(RADIATOR, RADIATOR.botY0, RADIATOR.y0),
      frame: radiatorFrame(RADIATOR),
      cap: radiatorCap(),
      thermostat: thermostatHousing(),
      thermoParts: thermostatParts(),
      volute: pumpVolute(),
      impeller: impeller(),
      fan: fan(FAN_R),
      fanPulley: vPulley(FAN_PULLEY_R),
    },
    electrical: {
      starter: starterMotor(STARTER),
      battery: battery(),
      alternator: alternator({ pulleyR: ALT_PULLEY_R, pulleyZ: -0.045 }),
    },
  }
}

export type SystemsGeometry = ReturnType<typeof buildStatic>

let ready: SystemsGeometry | null = null
let pending: Promise<SystemsGeometry> | null = null

/** Build (in the worker) and cache; safe to call often. 'low' priority is a background pre-build. */
export function prepareSystems(priority: 'normal' | 'low' = 'normal') {
  if (ready) return Promise.resolve(ready)
  // a normal request after a low one promotes the queued build
  if (pending && priority === 'normal') void import('@/geometry/build').then(({ buildGeometry }) => buildGeometry('tractor/systems', buildStatic))
  return (pending ??= import('@/geometry/build')
    .then(({ buildGeometry }) => buildGeometry('tractor/systems', buildStatic, undefined, priority))
    .then((g) => (ready = g)))
}

export const systemsReady = () => ready
