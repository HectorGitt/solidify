import { create } from 'zustand'
import { DriveGraph, coupling, gearMesh } from '@/core/drive'
import { frictionPairs, frictionRadiusUniformWear } from '@/physics/clutch'
import { radToRpm, rpmToRad, simulateShift, type ShiftTrace } from '@/physics/gearing'
import { PACK, PISTON_AREA, RATIO, REDUCTION, Z, type Sel } from './dims'

export interface PSParams {
  sel: Sel
  engineRpm: number
  /** engine torque into the unit, N·m */
  torque: number
  /** on-coming fill time, s */
  fill: number
  /** start of the off-going release after the on-coming fill starts, s (negative = released first) */
  overlap: number
  flows: boolean
  powerFlow: boolean
}

export const SURFACES = frictionPairs(PACK.discs, PACK.plates + 1)
export const CAPACITY = (PACK.pressure * PISTON_AREA - PACK.spring) * PACK.mu * frictionRadiusUniformWear(PACK.Ro, PACK.Ri) * SURFACES
export const J_INPUT = 1.2
/** off-going release time (simulateShift default: fill/4) */
export const releaseTime = (fill: number) => fill / 4
/**
 * Release delay at which the off-going clutch has just finished letting go when the on-coming
 * one can carry the full engine torque (linear ramps): t = t_fill·T_e/T_max − t_release.
 * Later → tie-up (both locked, fighting); earlier → torque hole and engine flare.
 */
export const idealOverlap = (fill: number, Te: number) => (fill * Te) / CAPACITY - releaseTime(fill)

export const DEFAULTS: PSParams = { sel: 'H', engineRpm: 2000, torque: 300, fill: 0.25, overlap: idealOverlap(0.25, 300), flows: true, powerFlow: true }

interface Store extends PSParams {
  set: (p: Partial<PSParams>) => void
  reset: () => void
}

export const usePS = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => {
    set(DEFAULTS)
    resetShift()
  },
}))

/* ------------------------------ Shift state ------------------------------ */

export type Phase = 'drive' | 'shift' | 'stop' | 'fill' | 'neutral'

export const ps = {
  phase: 'drive' as Phase,
  /** clutch that is applied (or being applied) */
  sel: DEFAULTS.sel as Sel,
  from: DEFAULTS.sel as Sel,
  t: 0,
  trace: null as ShiftTrace | null,
  /** engagement 0…1 of each clutch (piston pressure fraction) */
  e: { H: 1, L: 0, R: 0 } as Record<'H' | 'L' | 'R', number>,
  wIn: 0,
  wOut: 0,
}

export function resetShift() {
  ps.phase = 'drive'
  ps.sel = DEFAULTS.sel
  ps.from = DEFAULTS.sel
  ps.t = 0
  ps.trace = null
  ps.e = { H: 1, L: 0, R: 0 }
}

/** Run the overlapping-clutch model for a shift between H and L at the present speeds. */
export function planShift(from: 'H' | 'L', to: 'H' | 'L', wOut: number, p: Pick<PSParams, 'torque' | 'fill' | 'overlap'>) {
  return simulateShift({ Te: p.torque, J: J_INPUT, wOut, iOff: REDUCTION[from], iOn: REDUCTION[to], Cmax: CAPACITY, fill: p.fill, overlap: p.overlap, duration: 1.2, dt: 0.002 })
}

export function makeGraph() {
  const g = new DriveGraph()
  for (const id of ['input', 'counter', 'idler', 'low', 'rev', 'output']) g.body(id, 0.5)
  g.get('output').drag = 0.1
  g.add(gearMesh('a-b', 'input', Z.a, 'counter', Z.b))
  g.add(gearMesh('c-d', 'counter', Z.c, 'low', Z.d))
  g.add(gearMesh('e-idler', 'counter', Z.e, 'idler', Z.idler))
  g.add(gearMesh('idler-f', 'idler', Z.idler, 'rev', Z.f))
  const locked = (k: 'H' | 'L' | 'R') => ps.phase === 'drive' && ps.sel === k
  g.add(coupling('C_H', 'input', 'output', () => locked('H')))
  g.add(coupling('C_L', 'low', 'output', () => locked('L')))
  g.add(coupling('C_R', 'rev', 'output', () => locked('R')))
  return g
}

const sampleAt = (tr: ShiftTrace, arr: number[], t: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(t / (tr.t[1] - tr.t[0]))))]

export function stepPS(g: DriveGraph, dt: number) {
  const s = usePS.getState()
  const wGov = rpmToRad(s.engineRpm)
  ps.t += dt
  g.drivers.clear()
  const approach = (cur: number, tgt: number, tau: number) => tgt + (cur - tgt) * Math.exp(-dt / tau)
  if (ps.phase === 'drive' && s.sel !== ps.sel) {
    ps.from = ps.sel
    ps.t = 0
    ps.wOut = g.get('output').omega
    ps.wIn = g.get('input').omega
    if ((ps.sel === 'H' || ps.sel === 'L') && (s.sel === 'H' || s.sel === 'L')) {
      ps.trace = planShift(ps.sel, s.sel, ps.wOut, s)
      ps.phase = 'shift'
    } else if (s.sel === 'N') ps.phase = 'neutral'
    else if (ps.sel !== 'N' && Math.sign(RATIO[s.sel]) !== Math.sign(RATIO[ps.sel])) ps.phase = 'stop'
    else ps.phase = 'fill'
    ps.sel = s.sel
  }
  switch (ps.phase) {
    case 'drive': {
      // governor brings the engine back to its set speed; the vehicle follows through the locked clutch
      ps.wIn = approach(g.get('input').omega, wGov, 0.4)
      g.drive('input', ps.wIn)
      for (const k of ['H', 'L', 'R'] as const) ps.e[k] = approach(ps.e[k], ps.sel === k ? 1 : 0, 0.03)
      break
    }
    case 'shift': {
      const tr = ps.trace!
      const t = Math.min(ps.t, tr.t[tr.t.length - 1])
      ps.wIn = sampleAt(tr, tr.wIn, t)
      g.drive('input', ps.wIn)
      g.drive('output', ps.wOut)
      ps.e[ps.sel as 'H'] = sampleAt(tr, tr.Con, t) / CAPACITY
      ps.e[ps.from as 'H'] = sampleAt(tr, tr.Coff, t) / CAPACITY
      if (ps.t >= tr.t[tr.t.length - 1]) ps.phase = 'drive'
      break
    }
    case 'neutral':
    case 'stop': {
      // release everything; for a change of direction the tractor is brought to rest first
      for (const k of ['H', 'L', 'R'] as const) ps.e[k] = approach(ps.e[k], 0, 0.05)
      g.drive('input', approach(g.get('input').omega, wGov, 0.4))
      if (ps.phase === 'stop') {
        ps.wOut *= Math.exp(-dt * 6)
        g.drive('output', ps.wOut)
        if (Math.abs(ps.wOut) < 0.05) {
          ps.wOut = 0
          ps.phase = 'fill'
          ps.t = 0
        }
      } else if (s.sel !== 'N') {
        ps.from = 'N'
        ps.sel = s.sel
        ps.phase = 'fill'
        ps.t = 0
        ps.wOut = g.get('output').omega
      }
      break
    }
    case 'fill': {
      // on-coming clutch fills and slips the output up to speed
      const k = ps.sel as 'H' | 'L' | 'R'
      const f = Math.min(1, ps.t / Math.max(0.05, s.fill * 2))
      ps.e[k] = f
      for (const o of ['H', 'L', 'R'] as const) if (o !== k) ps.e[o] = approach(ps.e[o], 0, 0.05)
      g.drive('input', approach(g.get('input').omega, wGov, 0.4))
      ps.wOut = ps.wOut + (g.get('input').omega * RATIO[k] - ps.wOut) * f * Math.min(1, dt * 8)
      g.drive('output', ps.wOut)
      if (f >= 1 && Math.abs(ps.wOut - g.get('input').omega * RATIO[k]) < 0.5) ps.phase = 'drive'
      break
    }
  }
  g.step(dt)
  live.input = radToRpm(g.get('input').omega)
  live.counter = radToRpm(g.get('counter').omega)
  live.output = radToRpm(g.get('output').omega)
  live.phase = ps.phase
  live.e = { ...ps.e }
  live.shiftT = ps.phase === 'shift' ? ps.t : -1
  live.sel = ps.sel
}

export const live = {
  input: 0,
  counter: 0,
  output: 0,
  phase: 'drive' as Phase,
  e: { H: 1, L: 0, R: 0 } as Record<'H' | 'L' | 'R', number>,
  /** time into the current H↔L shift, s (−1 = not shifting) */
  shiftT: -1,
  sel: 'H' as Sel,
}
