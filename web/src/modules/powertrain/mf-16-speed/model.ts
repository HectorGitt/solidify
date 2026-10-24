import { create } from 'zustand'
import { DriveGraph, brake, coupling, gearMesh, planetary, planetSpin } from '@/core/drive'
import { groundSpeedKmh, radToRpm, rpmToRad } from '@/physics/gearing'
import { FINAL, FIXED, ROLLING_R, SS, Z, boxRatio, reverseAllowed, type GearNo, type RangeSel, type Shuttle, type SpeedShift } from './dims'

export interface MFParams {
  speedShift: SpeedShift
  shuttle: Shuttle
  gear: GearNo
  range: RangeSel
  fourWD: boolean
  pto: boolean
  parkingBrake: boolean
  engineRpm: number
  powerFlow: boolean
}

export const DEFAULTS: MFParams = { speedShift: 'H', shuttle: 'F', gear: 2, range: 'L', fourWD: false, pto: true, parkingBrake: false, engineRpm: 2000, powerFlow: true }

interface Store extends MFParams {
  /** last refused request (e.g. reverse in speeds 13–16) */
  warning: string | null
  set: (p: Partial<MFParams>) => void
  reset: () => void
}

export const useMF = create<Store>((set, get) => ({
  ...DEFAULTS,
  warning: null,
  set: (p) => {
    const n = { ...get(), ...p }
    if (n.shuttle === 'R' && !reverseAllowed(n.speedShift, n.gear, n.range)) {
      set({ warning: 'Reverse is available only in speeds 1–12 (shuttle reverse in 12 speeds). Choose a lower gear or range first.' })
      return
    }
    set({ ...p, warning: null })
  },
  reset: () => {
    set({ ...DEFAULTS, warning: null })
    resetSeq()
  },
}))

/* ------------------------------ Sequencer ------------------------------ */

export type Phase = 'drive' | 'declutch' | 'shift' | 'stop' | 'reclutch'

export const PHASE_LABEL: Record<Phase, string> = {
  drive: 'Driving',
  declutch: 'Clutch down',
  shift: 'Moving the selectors',
  stop: 'Stopping for the range change',
  reclutch: 'Clutch up',
}

/** Selector positions −1 … +1: gears 1/2 (sleeve 12: 1 = +1 towards gear 1), 3/4, shuttle (F +1, R −1), range (H −1, L +1). */
export function targets(p: Pick<MFParams, 'shuttle' | 'gear' | 'range'>) {
  return {
    s12: p.gear === 1 ? 1 : p.gear === 2 ? -1 : 0,
    s34: p.gear === 3 ? 1 : p.gear === 4 ? -1 : 0,
    sh: p.shuttle === 'F' ? 1 : p.shuttle === 'R' ? -1 : 0,
    r: p.range === 'H' ? -1 : p.range === 'L' ? 1 : 0,
  }
}

export const seq = {
  phase: 'drive' as Phase,
  t: 0,
  pos: targets(DEFAULTS),
  /** engaged selections */
  shuttle: DEFAULTS.shuttle as Shuttle,
  gear: DEFAULTS.gear as GearNo,
  range: DEFAULTS.range as RangeSel,
  clutch: true,
  wOut: 0,
}

export function resetSeq() {
  seq.phase = 'drive'
  seq.t = 0
  seq.pos = targets(DEFAULTS)
  seq.shuttle = DEFAULTS.shuttle
  seq.gear = DEFAULTS.gear
  seq.range = DEFAULTS.range
  seq.clutch = true
}

const engaged = (v: number, sign: number) => v * sign > 0.97

export function makeGraph() {
  const g = new DriveGraph()
  for (const id of ['engine', 'pto', 'input', 'carrier', 'ring', 'fwd', 'rev', 'idler', 'main', 'm1', 'm2', 'm3', 'm4', 'lay', 'output', 'transfer', 'front', 'crown']) g.body(id, 0.6)
  g.get('pto').drag = 1.5
  const st = () => useMF.getState()
  g.add(coupling('clutch', 'engine', 'input', () => seq.clutch && !st().parkingBrake))
  g.add(coupling('pto-clutch', 'engine', 'pto', () => st().pto))
  // speed-shift epicyclic: ring held → low; sun locked to carrier → high (on the move)
  g.add(planetary('speed-shift', 'input', SS.zs, 'ring', SS.zr, 'carrier'))
  g.add(brake('low-brake', 'ring', () => st().speedShift === 'L'))
  g.add(coupling('high-clutch', 'input', 'carrier', () => st().speedShift === 'H'))
  // shuttle: forward gear meshes the constant-mesh gear; reverse through the idler
  g.add(gearMesh('fwd-cm', 'fwd', Z.fwd, 'main', Z.cm))
  g.add(gearMesh('rev-idler', 'rev', Z.rev, 'idler', Z.idler))
  g.add(gearMesh('idler-cm', 'idler', Z.idler, 'main', Z.cm))
  g.add(coupling('coupler-F', 'carrier', 'fwd', () => engaged(seq.pos.sh, 1)))
  g.add(coupling('coupler-R', 'carrier', 'rev', () => engaged(seq.pos.sh, -1)))
  // four synchromesh gears: free on the mainshaft, fixed on the layshaft
  for (let k = 1; k <= 4; k++) g.add(gearMesh(`g${k}`, `m${k}`, Z.m[k - 1], 'lay', Z.l[k - 1]))
  g.add(coupling('sync1', 'main', 'm1', () => engaged(seq.pos.s12, 1)))
  g.add(coupling('sync2', 'main', 'm2', () => engaged(seq.pos.s12, -1)))
  g.add(coupling('sync3', 'main', 'm3', () => engaged(seq.pos.s34, 1)))
  g.add(coupling('sync4', 'main', 'm4', () => engaged(seq.pos.s34, -1)))
  // sliding (non-synchro) range gear on the output shaft
  g.add(gearMesh('range-H', 'lay', Z.lh, 'output', Z.oh, { active: () => engaged(seq.pos.r, -1) }))
  g.add(gearMesh('range-L', 'lay', Z.ll, 'output', Z.ol, { active: () => engaged(seq.pos.r, 1) }))
  g.add(gearMesh('transfer', 'output', Z.t1, 'transfer', Z.t2))
  g.add(coupling('4wd', 'transfer', 'front', () => st().fourWD))
  g.add(gearMesh('bevel', 'output', Z.pinion, 'crown', Z.crown))
  g.add(brake('parking', 'output', () => st().parkingBrake))
  return g
}

const T = { declutch: 0.06, move: 0.1, reclutch: 0.2 }

export function stepMF(g: DriveGraph, dt: number) {
  const s = useMF.getState()
  const wE = rpmToRad(s.engineRpm)
  const tgt = targets(s)
  seq.t += dt
  g.drivers.clear()
  g.drive('engine', wE)
  const toward = (c: number, t: number) => {
    const k = (2 * dt) / T.move
    return Math.abs(t - c) <= k ? t : c + Math.sign(t - c) * k
  }
  const want = s.shuttle !== seq.shuttle || s.gear !== seq.gear || s.range !== seq.range
  switch (seq.phase) {
    case 'drive':
      seq.clutch = true
      if (want) {
        seq.phase = 'declutch'
        seq.t = 0
        seq.clutch = false
        seq.wOut = g.get('output').omega
      }
      break
    case 'declutch':
      if (seq.t > T.declutch) {
        seq.phase = s.range !== seq.range && Math.abs(seq.wOut) > 0.05 ? 'stop' : 'shift'
        seq.t = 0
      }
      break
    case 'stop':
      seq.wOut *= Math.exp(-dt * 12)
      if (Math.abs(seq.wOut) < 0.05) {
        seq.wOut = 0
        seq.phase = 'shift'
        seq.t = 0
      }
      break
    case 'shift': {
      // each selector goes through neutral to its new position
      const step = (cur: number, t: number) => (Math.sign(cur) !== Math.sign(t) && cur !== 0 ? toward(cur, 0) : toward(cur, t))
      seq.pos.s12 = step(seq.pos.s12, tgt.s12)
      seq.pos.s34 = step(seq.pos.s34, tgt.s34)
      seq.pos.sh = step(seq.pos.sh, tgt.sh)
      seq.pos.r = step(seq.pos.r, tgt.r)
      if (seq.pos.s12 === tgt.s12 && seq.pos.s34 === tgt.s34 && seq.pos.sh === tgt.sh && seq.pos.r === tgt.r) {
        seq.shuttle = s.shuttle
        seq.gear = s.gear
        seq.range = s.range
        seq.phase = 'reclutch'
        seq.t = 0
      }
      break
    }
    case 'reclutch': {
      const k = Math.min(1, seq.t / T.reclutch)
      const r = boxRatio(s.speedShift, seq.shuttle, seq.gear, seq.range)
      if (Number.isFinite(r) && !s.parkingBrake) {
        const wNow = seq.wOut / r
        g.drive('input', wNow + (wE - wNow) * k)
      }
      if (k >= 1) {
        seq.clutch = true
        seq.phase = 'drive'
      }
      break
    }
  }
  if (!seq.clutch && seq.phase !== 'reclutch' && !s.parkingBrake) {
    if (seq.phase !== 'stop') seq.wOut *= Math.exp(-dt * 0.15)
    g.drive('output', seq.wOut)
  }
  g.step(dt)
  if (seq.phase === 'reclutch' || seq.clutch) seq.wOut = g.get('output').omega

  const w = (id: string) => radToRpm(g.get(id).omega)
  live.engine = s.engineRpm
  live.input = w('input')
  live.carrier = w('carrier')
  live.main = w('main')
  live.lay = w('lay')
  live.output = w('output')
  live.front = w('front')
  live.pto = w('pto')
  live.wheel = w('crown') / FINAL
  live.kmh = groundSpeedKmh(Math.abs(live.wheel), 1, ROLLING_R)
  live.ratio = boxRatio(s.speedShift, seq.shuttle, seq.gear, seq.range)
  live.planet = radToRpm(planetSpin(g.get('input').omega, g.get('carrier').omega, SS.zs, SS.zp) - g.get('carrier').omega)
  live.phase = seq.phase
  live.engaged = `${seq.range}${seq.gear || 'N'}${s.speedShift}${seq.shuttle}`
  live.clutch = seq.clutch
}

export const live = {
  engine: 0,
  input: 0,
  carrier: 0,
  main: 0,
  lay: 0,
  output: 0,
  front: 0,
  pto: 0,
  wheel: 0,
  kmh: 0,
  ratio: NaN,
  /** planet spin on its pin, rpm */
  planet: 0,
  phase: 'drive' as Phase,
  engaged: '',
  clutch: true,
}

export { FIXED }
