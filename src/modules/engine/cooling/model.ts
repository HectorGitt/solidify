import { create } from 'zustand'
import { BLOCK_INLET, FIRING_ORDERS, HEAD_OUTLET, HEAD_Y, engineLayout, firingFromOrder } from '@/machines/layout'
import { DIM as ENGINE } from '../four-stroke/model'
import { TYPICAL_COOLING, coolingFlows, coolingStep, type CoolMode, type CoolingFlowsResult, type CoolingInputs, type CoolingState, type ThermostatFault } from '@/physics/engineSystems'

/**
 * Cooling-system scene. Liquid-cooled layout (forced circulation / thermosiphon): the shared engine
 * (src/machines/Engine) as a three-cylinder tractor diesel, crank axis along Z at y = CRANK_Y, cylinder 1
 * at the front (+Z) and the radiator ahead of it. The engine sits in its own frame shifted by
 * (0, CRANK_Y, ENGINE_Z). Air-cooled layout: a single finned cylinder with a flywheel fan (TB Fig 7.1),
 * crank axis along X. Metres, Y up.
 */
export const SPEC = TYPICAL_COOLING

/** the engine: three cylinders firing 1-2-3 */
export const FIRING = firingFromOrder(FIRING_ORDERS[3])
const E = engineLayout(FIRING)
export const CRANK_Y = -0.04
/** cylinder 1 sits at z = 0.048, so the crank pulley and the pump pulley line up ahead of the block */
export const ENGINE_Z = 0.048 - E.front

export const ENG = {
  /** half-width of the crankcase */
  x: 0.132,
  /** rear and front faces of the block */
  z0: ENGINE_Z - E.ll / 2,
  z1: ENGINE_Z + E.lu / 2,
  deck: CRANK_Y + HEAD_Y,
  headTop: CRANK_Y + HEAD_OUTLET.topY,
  cylZ: E.cylZ.map((z) => z + ENGINE_Z),
  bore: ENGINE.bore,
}
/** thermostat housing on the head's coolant outlet */
export const THERMO = { x: HEAD_OUTLET.x, y: CRANK_Y + HEAD_OUTLET.topY, z: ENGINE_Z + E.front + HEAD_OUTLET.dz }
/** water-pump volute mid-plane: bolted to the block front (its back face just into the block's inlet boss), its outlet 40 mm below the spindle on the block inlet */
export const PUMP = { y: CRANK_Y + BLOCK_INLET.y + 0.04, z: ENG.z1 - 0.002 + 0.0225 }
export const FAN = { z: 0.21, r: 0.17 }
/** the fan belt's plane: the crank pulley's groove */
export const PULLEY_Z = ENGINE_Z + E.pulleyZ + 0.012
export const RAD = { x: 0.2, y0: 0.06, y1: 0.44, z0: 0.27, z1: 0.33, tankZ0: 0.255, tankZ1: 0.345, topY1: 0.52, botY0: -0.02 }
export const CAP = { x: 0.12, y: 0.52, z: 0.3 }
/** air-cooled engine */
export const AIRC = { barrelY0: 0.1, barrelY1: 0.28, headY1: 0.36, core: 0.06, fin: 0.11, fanX: -0.2, fanR: 0.14 }

/* ------------------------------ parameters ------------------------------ */

export interface CoolParams {
  mode: CoolMode
  /** fraction of rated load */
  load: number
  rpm: number
  ambientC: number
  capKPa: number
  thermostat: ThermostatFault
  beltSlip: number
  scale: number
  fan: boolean
  /** thermal time runs this many times faster than real time */
  thermalSpeed: number
  flows: boolean
}

export const DEFAULTS: CoolParams = {
  mode: 'forced',
  load: 0.8,
  rpm: 2000,
  ambientC: 30,
  capKPa: 90,
  thermostat: 'none',
  beltSlip: 0,
  scale: 0,
  fan: true,
  thermalSpeed: 20,
  flows: true,
}

interface Store extends CoolParams {
  /** bumps when the engine is restarted from cold */
  restart: number
  set: (p: Partial<CoolParams>) => void
  coldStart: () => void
  reset: () => void
}

export const useCool = create<Store>((set) => ({
  ...DEFAULTS,
  restart: 0,
  set: (p) => set(p),
  coldStart: () => set((s) => ({ restart: s.restart + 1 })),
  reset: () => set((s) => ({ ...DEFAULTS, restart: s.restart + 1 })),
}))

export function inputs(p: CoolParams): CoolingInputs {
  return { mode: p.mode, load: p.load, rpm: p.rpm, ambientC: p.ambientC, capKPa: p.capKPa, thermostat: p.thermostat, beltSlip: p.beltSlip, scale: p.scale, fan: p.fan }
}

/* ------------------------------ live thermal state ------------------------------ */

const HISTORY = 400

export interface LiveCool {
  state: CoolingState
  flows: CoolingFlowsResult
  /** simulated thermal time since the (cold) start, s */
  t: number
  hist: { t: number[]; Te: number[]; Tb: number[] }
  lastSample: number
}

function cold(p: CoolParams): LiveCool {
  const state = { Te: p.ambientC, th: 0 }
  return { state, flows: coolingFlows(SPEC, inputs(p), state), t: 0, hist: { t: [0], Te: [p.ambientC], Tb: [p.ambientC] }, lastSample: 0 }
}

export const live: LiveCool = cold(DEFAULTS)

export function restartLive(p: CoolParams) {
  Object.assign(live, cold(p))
}

/** Advance the thermal model by `dt` simulated seconds and record history. */
export function advance(p: CoolParams, dt: number) {
  if (dt <= 0) return
  const inp = inputs(p)
  live.state = coolingStep(SPEC, inp, live.state, dt)
  live.flows = coolingFlows(SPEC, inp, live.state)
  live.t += dt
  if (live.t - live.lastSample >= 2) {
    live.lastSample = live.t
    const h = live.hist
    h.t.push(live.t)
    h.Te.push(live.state.Te)
    h.Tb.push(p.mode === 'air' ? p.ambientC : live.flows.Tbottom)
    if (h.t.length > HISTORY) {
      h.t.shift()
      h.Te.shift()
      h.Tb.shift()
    }
  }
}

export type CoolStatus = 'warming' | 'regulating' | 'hot' | 'boiling' | 'cool'

export function status(p: CoolParams, l: LiveCool): CoolStatus {
  const Te = l.state.Te
  if (p.mode !== 'air' && l.flows.boiling) return 'boiling'
  if (p.mode === 'air') return Te > 150 ? 'hot' : Te < 60 ? 'warming' : 'regulating'
  if (Te > 100) return 'hot'
  if (Te < 60) return 'warming'
  if (Te <= 93) return 'regulating'
  return 'hot'
}

/** Coolant colour for a temperature: cold blue → warm teal → hot orange → boiling red. */
export function coolantColor(T: number, out: { r: number; g: number; b: number }) {
  const stops: [number, number, number, number][] = [
    [20, 0.17, 0.42, 0.78],
    [60, 0.16, 0.6, 0.72],
    [90, 0.85, 0.6, 0.2],
    [120, 0.85, 0.2, 0.12],
  ]
  if (T <= stops[0][0]) return Object.assign(out, { r: stops[0][1], g: stops[0][2], b: stops[0][3] })
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (T <= b[0]) {
      const u = (T - a[0]) / (b[0] - a[0])
      out.r = a[1] + (b[1] - a[1]) * u
      out.g = a[2] + (b[2] - a[2]) * u
      out.b = a[3] + (b[3] - a[3]) * u
      return out
    }
  }
  const l = stops[stops.length - 1]
  return Object.assign(out, { r: l[1], g: l[2], b: l[3] })
}

/** Fin colour for an air-cooled cylinder: bare aluminium grey → heat-tinted red above ≈ 200 °C. */
export function finColor(T: number, out: { r: number; g: number; b: number }) {
  const u = Math.max(0, Math.min(1, (T - 60) / 200))
  out.r = 0.72 + 0.2 * u
  out.g = 0.74 - 0.38 * u
  out.b = 0.77 - 0.5 * u
  return out
}
