import { create } from 'zustand'
import { DriveGraph, coupling, gearMesh } from '@/core/drive'
import { gearTable, groundSpeedKmh, radToRpm, rpmToRad, synchroRemaining } from '@/physics/gearing'
import { CROWN, FINAL, GEAR_RATIO, M, RANGE_RATIO, ROLLING_R, Z, type Gear, type Range, type Variant } from './dims'

export interface GearboxParams {
  variant: Variant
  /** lever positions the driver has chosen */
  gear: Gear
  range: Range
  engineRpm: number
  /** synchroniser cone torque, N·m, and the inertia it has to match (input shaft + clutch plate), kg·m² */
  syncTorque: number
  syncJ: number
  powerFlow: boolean
}

export const DEFAULTS: GearboxParams = { variant: 'synchro', gear: '2', range: 'H', engineRpm: 1800, syncTorque: 25, syncJ: 0.05, powerFlow: true }

interface Store extends GearboxParams {
  set: (p: Partial<GearboxParams>) => void
  reset: () => void
}

export const useGearbox = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => {
    set(DEFAULTS)
    resetShift()
  },
}))

/** ω_out/ω_in of the gearbox (NaN in neutral). */
export function boxRatio(gear: Gear, range: Range) {
  if (gear === 'N' || range === 'N') return NaN
  return GEAR_RATIO[gear] * RANGE_RATIO[range]
}

export function kmh(engineRpm: number, gear: Gear, range: Range) {
  const r = boxRatio(gear, range)
  return Number.isFinite(r) ? groundSpeedKmh(engineRpm, Math.abs(r) / (CROWN * FINAL), ROLLING_R) * Math.sign(r) : 0
}

/** All six forward and two reverse speeds, slowest first. */
export function speedTable(engineRpm: number) {
  return gearTable(
    engineRpm,
    [
      (['1', '2', '3', 'R'] as const).map((g) => ({ label: g, ratio: GEAR_RATIO[g] })),
      (['L', 'H'] as const).map((r) => ({ label: r, ratio: RANGE_RATIO[r] })),
    ],
    CROWN * FINAL,
    ROLLING_R,
  )
}

/* ------------------------------ Shift sequencer ------------------------------ */

export type Phase = 'drive' | 'declutch' | 'out' | 'stop' | 'sync' | 'in' | 'reclutch'

export const PHASE_LABEL: Record<Phase, string> = {
  drive: 'Driving',
  declutch: 'Clutch down',
  out: 'Into neutral',
  stop: 'Stopping the tractor',
  sync: 'Synchronising (baulk ring blocks the sleeve)',
  in: 'Engaging',
  reclutch: 'Clutch up',
}

/** Slider / collar positions: −1 … +1 (cluster A: 1st = −1, 2nd = +1; B: 3rd −1, R +1; range: H −1, L +1). */
export function targetPos(gear: Gear, range: Range) {
  return {
    a: gear === '1' ? -1 : gear === '2' ? 1 : 0,
    b: gear === '3' ? -1 : gear === 'R' ? 1 : 0,
    r: range === 'H' ? -1 : range === 'L' ? 1 : 0,
  }
}

export const shift = {
  phase: 'drive' as Phase,
  t: 0,
  /** what is engaged now */
  gear: DEFAULTS.gear as Gear,
  range: DEFAULTS.range as Range,
  pos: targetPos(DEFAULTS.gear, DEFAULTS.range),
  clutch: true,
  /** vehicle-held output speed while declutched, rad/s */
  wOut: 0,
  /** synchroniser: starting speed difference and elapsed time */
  dw0: 0,
  tSync: 0,
  /** pitch-line speed mismatch when the teeth/dogs met, m/s */
  clash: 0,
}

export function resetShift() {
  shift.phase = 'drive'
  shift.t = 0
  shift.gear = DEFAULTS.gear
  shift.range = DEFAULTS.range
  shift.pos = targetPos(DEFAULTS.gear, DEFAULTS.range)
  shift.clutch = true
  shift.clash = 0
}

/** Pitch radius of the top gear and the speed ratio top/bottom for a gear (to compute the speed the top must have). */
function gearPair(g: Exclude<Gear, 'N'>) {
  const top = { '1': Z.t1, '2': Z.t2, '3': Z.t3, R: Z.tr }[g]
  return { r: (M * top) / 2, ratio: GEAR_RATIO[g] }
}

/* ------------------------------ Drive graph ------------------------------ */

export function makeGraph() {
  const g = new DriveGraph()
  for (const id of ['engine', 'top', 'bottom', 'output', 'crown', 't1', 't2', 't3', 'tr', 'idler']) g.body(id, 0.6)
  g.get('output').drag = 0.15
  const st = () => useGearbox.getState()
  const sliding = () => st().variant === 'sliding'
  const engaged = (k: Gear) => shift.gear === k && (k === '1' || k === '2' ? Math.abs(shift.pos.a) > 0.97 : Math.abs(shift.pos.b) > 0.97)
  g.add(coupling('clutch', 'engine', 'top', () => shift.clutch))
  // sliding mesh: the top-shaft clusters are splined to the top shaft and mesh only when slid in
  g.add(gearMesh('s1', 'top', Z.t1, 'bottom', Z.b1, { active: () => sliding() && engaged('1') }))
  g.add(gearMesh('s2', 'top', Z.t2, 'bottom', Z.b2, { active: () => sliding() && engaged('2') }))
  g.add(gearMesh('s3', 'top', Z.t3, 'bottom', Z.b3, { active: () => sliding() && engaged('3') }))
  g.add(gearMesh('sr', 'top', Z.tr, 'idler', Z.idler, { active: () => sliding() && engaged('R') }))
  // constant mesh / synchromesh: free gears always in mesh, locked to the top shaft by the collar
  g.add(gearMesh('c1', 't1', Z.t1, 'bottom', Z.b1))
  g.add(gearMesh('c2', 't2', Z.t2, 'bottom', Z.b2))
  g.add(gearMesh('c3', 't3', Z.t3, 'bottom', Z.b3))
  g.add(gearMesh('cr', 'tr', Z.tr, 'idler', Z.idler))
  g.add(gearMesh('ib', 'idler', Z.idler, 'bottom', Z.br))
  for (const k of ['1', '2', '3', 'R'] as const) g.add(coupling(`dog${k}`, 'top', k === 'R' ? 'tr' : `t${k}`, () => !sliding() && engaged(k)))
  // range (sliding, non-synchro) and the bevel pinion
  const rangeIn = (r: Range) => shift.range === r && Math.abs(shift.pos.r) > 0.97
  g.add(gearMesh('rh', 'bottom', Z.rhb, 'output', Z.rho, { active: () => rangeIn('H') }))
  g.add(gearMesh('rl', 'bottom', Z.rlb, 'output', Z.rlo, { active: () => rangeIn('L') }))
  g.add(gearMesh('bevel', 'output', Z.pinion, 'crown', Z.crown))
  return g
}

/** Time for each phase (sim seconds). */
const T = { declutch: 0.1, slide: 0.15, reclutch: 0.35 }

/**
 * Advance the shift sequencer and the drive graph by dt. Sliding-mesh and constant-mesh boxes
 * are changed with the tractor stopped (the teeth or dogs would clash); a synchromesh box
 * matches the speeds with the cone first and changes on the move (TTS p4–5). Range and
 * forward/reverse changes always need a stop.
 */
export function stepGearbox(g: DriveGraph, dt: number) {
  const s = useGearbox.getState()
  const wE = rpmToRad(s.engineRpm)
  const want = { gear: s.gear, range: s.range }
  const target = targetPos(want.gear, want.range)
  const needStop = s.variant !== 'synchro' || want.range !== shift.range || (want.gear === 'R') !== (shift.gear === 'R')
  shift.t += dt
  const toward = (cur: number, tgt: number) => {
    const step = (2 * dt) / T.slide
    return Math.abs(tgt - cur) <= step ? tgt : cur + Math.sign(tgt - cur) * step
  }
  g.drivers.clear()
  g.drive('engine', wE)
  g.get('top').drag = 0.6
  switch (shift.phase) {
    case 'drive':
      shift.clutch = true
      if (want.gear !== shift.gear || want.range !== shift.range) {
        shift.phase = 'declutch'
        shift.t = 0
        shift.clutch = false
        shift.wOut = g.get('output').omega
      }
      break
    case 'declutch':
      shift.clutch = false
      if (shift.t > T.declutch) next('out')
      break
    case 'out': {
      // leave the engaged position for neutral (only the members that must move)
      const sameA = (target.a !== 0 && shift.pos.a === target.a) || (target.a === 0 && shift.pos.a === 0)
      const sameB = (target.b !== 0 && shift.pos.b === target.b) || (target.b === 0 && shift.pos.b === 0)
      if (!sameA) shift.pos.a = toward(shift.pos.a, 0)
      if (!sameB) shift.pos.b = toward(shift.pos.b, 0)
      if (want.range !== shift.range) shift.pos.r = toward(shift.pos.r, 0)
      const done = (sameA || shift.pos.a === 0) && (sameB || shift.pos.b === 0) && (want.range === shift.range || shift.pos.r === 0)
      if (done) {
        if (!sameA || !sameB) shift.gear = 'N'
        if (want.range !== shift.range) shift.range = 'N'
        const nextPhase: Phase = needStop ? 'stop' : want.gear !== 'N' && s.variant === 'synchro' ? 'sync' : 'in'
        next(nextPhase)
        if (nextPhase === 'sync') startSync(g, want.gear)
      }
      break
    }
    case 'stop':
      shift.wOut *= Math.exp(-dt * 12)
      g.get('top').drag = 10
      if (Math.abs(shift.wOut) < 0.05 && Math.abs(g.get('top').omega) < 1) {
        shift.wOut = 0
        next('in')
      }
      break
    case 'sync': {
      shift.tSync += dt
      const left = synchroRemaining(shift.dw0, s.syncJ, s.syncTorque, shift.tSync)
      const need = topSpeedFor(g, want.gear)
      g.drive('top', need - left)
      if (left === 0) next('in')
      break
    }
    case 'in': {
      if (want.gear !== 'N' && shift.gear !== want.gear && shift.t < dt * 1.5) shift.clash = mismatch(g, want.gear)
      if (s.variant === 'synchro' && want.gear !== 'N' && shift.gear !== want.gear) g.drive('top', topSpeedFor(g, want.gear))
      shift.pos.a = toward(shift.pos.a, target.a)
      shift.pos.b = toward(shift.pos.b, target.b)
      shift.pos.r = toward(shift.pos.r, target.r)
      if (shift.pos.a === target.a && shift.pos.b === target.b && shift.pos.r === target.r) {
        shift.gear = want.gear
        shift.range = want.range
        next('reclutch')
      }
      break
    }
    case 'reclutch': {
      // clutch slips in: the top shaft is brought up to engine speed
      const k = Math.min(1, shift.t / T.reclutch)
      const ratio = boxRatio(shift.gear, shift.range)
      if (Number.isFinite(ratio)) {
        const wTopNow = shift.wOut / ratio
        g.drive('top', wTopNow + (wE - wTopNow) * k)
      }
      if (k >= 1) {
        shift.clutch = true
        next('drive')
      }
      break
    }
  }
  if (!shift.clutch && shift.phase !== 'reclutch') {
    if (shift.phase !== 'stop') shift.wOut *= Math.exp(-dt * 0.15)
    g.drive('output', shift.wOut)
  }
  g.step(dt)
  if (!shift.clutch && shift.phase === 'reclutch') shift.wOut = g.get('output').omega
  if (shift.clutch) shift.wOut = g.get('output').omega

  live.engine = s.engineRpm
  live.top = radToRpm(g.get('top').omega)
  live.bottom = radToRpm(g.get('bottom').omega)
  live.output = radToRpm(g.get('output').omega)
  live.wheel = live.output / (CROWN * FINAL)
  live.kmh = groundSpeedKmh(Math.abs(live.wheel), 1, ROLLING_R) * Math.sign(live.wheel)
  live.phase = shift.phase
  live.gear = shift.gear
  live.range = shift.range
  live.clutch = shift.clutch
  live.dw = shift.phase === 'sync' ? radToRpm(synchroRemaining(shift.dw0, s.syncJ, s.syncTorque, shift.tSync)) : 0
  live.clash = shift.clash
}

function next(p: Phase) {
  shift.phase = p
  shift.t = 0
}

/** Speed the top shaft must have for the free gear of `gear` (driven from the bottom shaft) to match it. */
function topSpeedFor(g: DriveGraph, gear: Gear) {
  if (gear === 'N') return g.get('top').omega
  return g.get('bottom').omega / gearPair(gear).ratio
}

function startSync(g: DriveGraph, gear: Gear) {
  shift.tSync = 0
  shift.dw0 = topSpeedFor(g, gear) - g.get('top').omega
}

/** Pitch-line sliding speed between the gears (or dogs) about to engage, m/s. */
function mismatch(g: DriveGraph, gear: Gear) {
  if (gear === 'N') return 0
  const dw = topSpeedFor(g, gear) - g.get('top').omega
  return Math.abs(dw) * gearPair(gear).r
}

/* ------------------------------ Live values ------------------------------ */

export const live = {
  engine: 0,
  top: 0,
  bottom: 0,
  output: 0,
  wheel: 0,
  kmh: 0,
  phase: 'drive' as Phase,
  gear: 'N' as Gear,
  range: 'N' as Range,
  clutch: true,
  /** synchroniser speed difference left, rpm */
  dw: 0,
  /** pitch-line mismatch at the last engagement, m/s */
  clash: 0,
}
