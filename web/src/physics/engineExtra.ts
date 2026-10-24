/**
 * Extra engine physics for the two-stroke, multi-cylinder, ignition and performance scenes — AEE509.
 * Builds on ./engine (read-only) and keeps to SI units unless a name says otherwise.
 *
 * Sources:
 *  - 509 Lecture 3 (two-stroke cycle, 2- vs 4-stroke table); 509 Additional notes (petroil 2–3 %,
 *    combustion in a two-stroke); extract fromtextbook(509) §2.6.2, Fig 2.4, §2.6.4, Table 2.3,
 *    §6.3.3 (petroil 16:1 / 24:1), ch.5 (ignition, battery, starter), §3.3 (heat balance);
 *  - 509 Lecture 4 (firing order, coil ignition: 200–300 / ≈21 000 turns, 4-lobe breaker cam);
 *  - AEE 509 Miscellaneous Exercises p2–6 (Examples 1–7: IP, BP, bmep, ηm, ηbth, ηv, sfc);
 *  - AEE_509_exam_past_questions (Mahindra 100 × 124 mm, 6-cyl 100 × 125 mm, 100 kVA genset,
 *    orchard tractor).
 * Anything that the notes only state qualitatively (port-timing angles, crankcase pressures, coil
 * fly-back voltage, impulse-coupling kinematics, battery SG vs charge, crank balance) is standard
 * engineering added so the mechanisms can be animated; the scenes badge it "beyond notes".
 */
import {
  airDensity,
  brakePower,
  crankAngleForTravel,
  cylinderCycleAngle,
  heatBalance,
  meanPistonSpeed,
  strokeAt,
  throwAngle,
  torqueFromPower,
  type FourStroke,
  type HeatShares,
  type SliderCrank,
  type StrokeCycle,
} from './engine'

const DEG = 180 / Math.PI
const nF = (c: StrokeCycle) => (c === 4 ? 2 : 1)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const mod = (a: number, m: number) => ((a % m) + m) % m

/* ======================================================================================
 * Two-stroke: piston-controlled ports (TB Fig 2.4; AddN; L3)
 * ====================================================================================== */

/**
 * Port positions expressed as PISTON TRAVEL FROM TDC (m), which is how a port height maps onto
 * the slider-crank. The crown uncovers the exhaust and transfer ports on the way down; the
 * bottom edge of the skirt uncovers the inlet port (into the crankcase) on the way up.
 */
export interface PortLayout {
  /** travel at which the crown reaches the top edge of the exhaust port */
  exhaustTop: number
  exhaustHeight: number
  /** travel at which the crown reaches the top edge of the transfer port */
  transferTop: number
  transferHeight: number
  /** inlet port is open while the travel is LESS than this (skirt edge above the port's lower edge) */
  inletTravel: number
  inletHeight: number
}

/** Port events, crank degrees after TDC (0…360). */
export interface PortTiming {
  /** exhaust opens / closes */
  eo: number
  ec: number
  /** transfer opens / closes */
  to: number
  tc: number
  /** inlet (crankcase) opens / closes */
  io: number
  ic: number
}

/**
 * Port timing COMPUTED from the port heights through the slider-crank. Piston-controlled ports
 * open and close symmetrically about BDC (exhaust, transfer) or TDC (inlet).
 */
export function portTiming(sc: SliderCrank, p: PortLayout): PortTiming {
  const eo = crankAngleForTravel(sc, p.exhaustTop) * DEG
  const to = crankAngleForTravel(sc, p.transferTop) * DEG
  const ic = crankAngleForTravel(sc, p.inletTravel) * DEG
  return { eo, ec: 360 - eo, to, tc: 360 - to, io: 360 - ic, ic }
}

/** Open periods (deg). `blowdown` = exhaust lead before the transfer opens. */
export function portDurations(t: PortTiming) {
  return {
    exhaust: t.ec - t.eo,
    transfer: t.tc - t.to,
    inlet: 360 - t.io + t.ic,
    blowdown: t.to - t.eo,
    /** exhaust still open after the transfer has closed — fresh charge can escape */
    afterTransfer: t.ec - t.tc,
  }
}

/** Fraction (0…1) of each port uncovered at piston travel x from TDC. */
export function portOpenFractions(x: number, p: PortLayout) {
  return {
    exhaust: clamp01((x - p.exhaustTop) / p.exhaustHeight),
    transfer: clamp01((x - p.transferTop) / p.transferHeight),
    inlet: clamp01((p.inletTravel - x) / p.inletHeight),
  }
}

/**
 * Trapped (effective) compression ratio of a piston-ported engine: compression only starts once
 * the crown has covered the exhaust port, at travel `exhaustTop` from TDC.
 */
export function trappedCompressionRatio(Vs: number, Vc: number, exhaustTop: number, stroke: number) {
  return (Vc + (Vs * exhaustTop) / stroke) / Vc
}

/** Crankcase compression ratio (Vcc,max / Vcc,min) from the crankcase volume at BDC. */
export function crankcaseCompressionRatio(Vs: number, VccMin: number) {
  return (VccMin + Vs) / VccMin
}

export type TwoStrokePhase = 'compression' | 'expansion' | 'blowdown' | 'scavenging'
export type CrankcasePhase = 'induction' | 'pre-compression' | 'transfer' | 'suction'

export interface TwoStrokeGas {
  /** geometric compression ratio (Vs + Vc)/Vc */
  r: number
  /** crankcase compression ratio */
  crankcaseRatio: number
  /** ambient pressure, kPa */
  P0: number
  /** charge temperature when trapped, K */
  T0: number
  /** heat released per kg of trapped charge, kJ/kg */
  q: number
  /** ratio of specific heats */
  k: number
  /** cv, kJ/kg·K */
  cv: number
}

export const TYPICAL_TWO_STROKE_GAS: TwoStrokeGas = { r: 8, crankcaseRatio: 1.4, P0: 100, T0: 330, q: 1250, k: 1.4, cv: 0.718 }

export interface TwoStrokeState {
  /** cylinder pressure above the piston, kPa */
  pCyl: number
  /** crankcase pressure below the piston, kPa */
  pCase: number
  /** cylinder gas temperature, K (for display) */
  T: number
  phase: TwoStrokePhase
  casePhase: CrankcasePhase
  /** cylinder volume / Vs */
  v: number
  /** crankcase volume / Vs */
  vcc: number
}

/**
 * Indicative pressures above and below the piston over one revolution (θ deg after TDC).
 * Above: Otto-type compression from exhaust closing, constant-volume combustion at TDC,
 * expansion to exhaust opening, then blow-down and scavenging near ambient.
 * Below: the sealed crankcase is pre-compressed by the descending piston (inlet closed → transfer
 * opens), empties through the transfer port, then is expanded by the rising piston (suction) until
 * the skirt uncovers the inlet port. Relaxations are simple exponentials in crank angle.
 */
export function twoStrokeState(thetaDeg: number, sc: SliderCrank, ports: PortLayout, g: TwoStrokeGas = TYPICAL_TWO_STROKE_GAS): TwoStrokeState {
  const S = 2 * sc.r
  const th = mod(thetaDeg, 360)
  const t = portTiming(sc, ports)
  const xAt = (deg: number) => {
    const a = (deg * Math.PI) / 180
    const s = Math.sin(a)
    return sc.r * (1 - Math.cos(a)) + sc.l - Math.sqrt(sc.l * sc.l - sc.r * sc.r * s * s)
  }
  const vc = 1 / (g.r - 1)
  const vOf = (deg: number) => vc + xAt(deg) / S
  const vccMin = 1 / (g.crankcaseRatio - 1)
  const vccOf = (deg: number) => vccMin + (1 - xAt(deg) / S)
  const k = g.k

  // cylinder
  const pScav = g.P0 * 1.04
  const vTrap = vOf(t.ec)
  const T2 = g.T0 * Math.pow(vTrap / vc, k - 1)
  const P2 = pScav * Math.pow(vTrap / vc, k)
  const T3 = T2 + g.q / g.cv
  const P3 = (P2 * T3) / T2
  const expansion = (deg: number) => P3 * Math.pow(vc / vOf(deg), k)
  const pEO = expansion(t.eo)
  const blow = (deg: number) => pScav + (pEO - pScav) * Math.exp(-(deg - t.eo) / 7)
  const pTO = blow(t.to)
  const cyl = (deg: number): { p: number; T: number; phase: TwoStrokePhase } => {
    if (deg < t.eo) {
      const p = expansion(deg)
      return { p, T: T3 * Math.pow(vc / vOf(deg), k - 1), phase: 'expansion' }
    }
    if (deg < t.to) {
      const p = blow(deg)
      const TEO = T3 * Math.pow(vc / vOf(t.eo), k - 1)
      return { p, T: g.T0 + (TEO - g.T0) * Math.pow(p / pEO, (k - 1) / k) * 0.9, phase: 'blowdown' }
    }
    if (deg < t.ec) {
      const p = pScav + (pTO - pScav) * Math.exp(-(deg - t.to) / 6)
      const u = clamp01((deg - t.to) / (t.ec - t.to))
      return { p, T: 700 - (700 - g.T0) * u, phase: 'scavenging' }
    }
    const v = vOf(deg)
    return { p: pScav * Math.pow(vTrap / v, k), T: g.T0 * Math.pow(vTrap / v, k - 1), phase: 'compression' }
  }
  const c = cyl(th)

  // crankcase
  const pre = (deg: number) => g.P0 * Math.pow(vccOf(t.ic) / vccOf(deg), k)
  const pCaseTO = pre(t.to)
  const transfer = (deg: number) => {
    const pc = cyl(deg).p
    return pc + (pCaseTO - cyl(t.to).p) * Math.exp(-(deg - t.to) / 14)
  }
  const pCaseTC = transfer(t.tc)
  const suction = (deg: number) => pCaseTC * Math.pow(vccOf(t.tc) / vccOf(deg), k)
  const pCaseIO = suction(t.io)
  let pCase: number
  let casePhase: CrankcasePhase
  if (th >= t.io || th < t.ic) {
    const d = mod(th - t.io, 360)
    pCase = g.P0 + (pCaseIO - g.P0) * Math.exp(-d / 12)
    casePhase = 'induction'
  } else if (th < t.to) {
    pCase = pre(th)
    casePhase = 'pre-compression'
  } else if (th < t.tc) {
    pCase = transfer(th)
    casePhase = 'transfer'
  } else {
    pCase = suction(th)
    casePhase = 'suction'
  }
  return { pCyl: c.p, pCase, T: c.T, phase: c.phase, casePhase, v: vOf(th), vcc: vccOf(th) }
}

/**
 * Volumetric efficiency from the air actually drawn in (Misc Ex 5): volume of air per cycle at
 * ambient density divided by the swept volume. One cycle per revolution for a two-stroke.
 */
export function volumetricEfficiencyFromAir(airKgPerH: number, rhoAir: number, sweptVolume: number, rpm: number, cycle: StrokeCycle) {
  const cyclesPerMin = rpm / nF(cycle)
  const vPerCycle = airKgPerH / 60 / cyclesPerMin / rhoAir
  return vPerCycle / sweptVolume
}

/** Scavenge efficiency (inventory, Misc p4): ma / ((Vd + Vc) · ρa), mass of air per cycle ma. */
export function scavengeEfficiency(airPerCycle: number, Vd: number, Vc: number, rhoAir: number) {
  return airPerCycle / ((Vd + Vc) * rhoAir)
}

/* ------------------------------ Petroil (mist) lubrication ------------------------------ */

/** TB §6.3.3: petrol : oil = 16 : 1 for larger two-strokes, 24 : 1 for smaller; AddN: 2–3 % oil. */
export const PETROIL = { tbLarger: 16, tbSmaller: 24, addNPercent: [2, 3] as const }

/** Oil (L) to add to `petrolL` litres of petrol for a petrol:oil ratio R : 1. */
export function petroilOil(petrolL: number, ratio: number) {
  return petrolL / ratio
}

/** Oil as a percentage of the petrol for a ratio R : 1. */
export function petroilPercent(ratio: number) {
  return 100 / ratio
}

/** Ratio R : 1 for an oil percentage of the petrol. */
export function petroilRatio(percent: number) {
  return 100 / percent
}

/* ======================================================================================
 * Multi-cylinder: firing chart (TB Table 2.3), power overlap, crank balance
 * ====================================================================================== */

export interface ChartSegment {
  stroke: FourStroke
  /** engine crank angle range, deg */
  from: number
  to: number
}

export interface ChartRow {
  from: number
  to: number
  /** per cylinder (index = cylinder − 1): the strokes it passes through in this interval */
  cells: ChartSegment[][]
  /** cylinders (1-based) whose power stroke begins in this interval */
  fires: number[]
}

/**
 * Firing chart like TB Table 2.3: rows are crank-travel intervals of `step` degrees over the
 * 720° cycle, columns are cylinders. `firing[i]` is the crank angle at which cylinder i+1 begins
 * its power stroke (cylinder 1 fires at 0°, so it is on POWER for 0–180°, as in the table).
 */
export function firingChart(firing: number[], step: number): ChartRow[] {
  const rows: ChartRow[] = []
  const n = Math.round(720 / step)
  for (let k = 0; k < n; k++) {
    const from = k * step
    const to = from + step
    const fires: number[] = []
    const cells = firing.map((f, i) => {
      const segs: ChartSegment[] = []
      let psi = cylinderCycleAngle(from, f)
      if ((mod(360 - psi, 720)) < step - 1e-9) fires.push(i + 1)
      let crank = from
      let left = step
      while (left > 1e-9) {
        const s = strokeAt(psi + 1e-9)
        const next = (Math.floor((psi + 1e-9) / 180) + 1) * 180
        const len = Math.min(next - psi, left)
        const last = segs[segs.length - 1]
        if (last && last.stroke === s) last.to = crank + len
        else segs.push({ stroke: s, from: crank, to: crank + len })
        psi = mod(psi + len, 720)
        crank += len
        left -= len
      }
      return segs
    })
    rows.push({ from, to, cells, fires })
  }
  return rows
}

/** The stroke occupying most of a chart cell. */
export function dominantStroke(cell: ChartSegment[]): FourStroke {
  let best = cell[0]
  for (const s of cell) if (s.to - s.from > best.to - best.from) best = s
  return best.stroke
}

/** Cylinders (1-based) on their power stroke at engine crank angle θ. */
export function cylindersOnPower(firing: number[], crankDeg: number) {
  const out: number[] = []
  firing.forEach((f, i) => {
    if (strokeAt(cylinderCycleAngle(crankDeg, f)) === 'power') out.push(i + 1)
  })
  return out
}

/** Fewest and most cylinders on power at any moment of the cycle (sampled off the boundaries). */
export function powerOverlap(firing: number[], samples = 1440) {
  let min = Infinity
  let max = 0
  for (let i = 0; i < samples; i++) {
    const c = cylindersOnPower(firing, ((i + 0.5) * 720) / samples).length
    min = Math.min(min, c)
    max = Math.max(max, c)
  }
  return { min, max }
}

/** The cylinder that most recently began its power stroke, and how many degrees ago. */
export function lastFired(firing: number[], crankDeg: number) {
  let best = 1
  let since = Infinity
  firing.forEach((f, i) => {
    const d = mod(crankDeg - f, 720)
    if (d < since) {
      since = d
      best = i + 1
    }
  })
  return { cylinder: best, since }
}

/** Gaps (deg) between successive firings, in firing sequence. Even firing → all equal 720/n. */
export function firingGaps(firing: number[]) {
  const sorted = [...firing].map((f) => mod(f, 720)).sort((a, b) => a - b)
  return sorted.map((f, i) => (i + 1 < sorted.length ? sorted[i + 1] - f : 720 - f + sorted[0]))
}

/** Firing order (1-based cylinder numbers) from firing angles. */
export function orderFromFiring(firing: number[]) {
  return firing
    .map((f, i) => ({ cyl: i + 1, f: mod(f, 720) }))
    .sort((a, b) => a.f - b.f)
    .map((x) => x.cyl)
}

/** "A-D-C-B-F-E" → [1, 4, 3, 2, 6, 5] (exam papers sometimes letter the cylinders). */
export function lettersToOrder(s: string) {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => (/^\d+$/.test(t) ? parseInt(t, 10) : t.toUpperCase().charCodeAt(0) - 64))
}

/** A firing order is a permutation of 1…n that starts with cylinder 1. */
export function isValidOrder(order: number[]) {
  const n = order.length
  return order[0] === 1 && new Set(order).size === n && order.every((c) => c >= 1 && c <= n)
}

/**
 * Inertia balance of an inline crank (beyond notes). For throw angles θi (deg) at axial positions
 * zi, the resultant primary / secondary forces are |Σ e^{iθ}| and |Σ e^{2iθ}| (per cylinder), and
 * the couples |Σ z e^{iθ}|, |Σ z e^{2iθ}| (per cylinder per pitch). Zero = balanced.
 */
export function crankBalance(throwDeg: number[], z: number[], pitch: number) {
  const n = throwDeg.length
  const sum = (f: (i: number) => [number, number]) => {
    let x = 0
    let y = 0
    for (let i = 0; i < n; i++) {
      const [a, b] = f(i)
      x += a
      y += b
    }
    return Math.hypot(x, y)
  }
  const rad = throwDeg.map((d) => (d * Math.PI) / 180)
  const zc = z.map((v) => v - z.reduce((a, b) => a + b, 0) / n)
  return {
    primaryForce: sum((i) => [Math.cos(rad[i]), Math.sin(rad[i])]) / n,
    secondaryForce: sum((i) => [Math.cos(2 * rad[i]), Math.sin(2 * rad[i])]) / n,
    primaryCouple: sum((i) => [zc[i] * Math.cos(rad[i]), zc[i] * Math.sin(rad[i])]) / (n * pitch),
    secondaryCouple: sum((i) => [zc[i] * Math.cos(2 * rad[i]), zc[i] * Math.sin(2 * rad[i])]) / (n * pitch),
  }
}

/** Throw angles (deg, 0…360) of every cylinder for a set of firing angles. */
export function throwAngles(firing: number[]) {
  return firing.map(throwAngle)
}

/* ======================================================================================
 * Ignition (L4; TB ch.5)
 * ====================================================================================== */

/** Distributor / breaker-cam speed: once per engine cycle (half crank speed on a four-stroke). */
export function distributorRpm(engineRpm: number, cycle: StrokeCycle = 4) {
  return engineRpm / nF(cycle)
}

/** Crank angles (0…720) at which each cylinder's spark occurs, `advance` degrees before its firing TDC. */
export function sparkAngles(firing: number[], advanceDeg: number) {
  return firing.map((f) => mod(f - advanceDeg, 720))
}

/** Cam degrees between successive breaker openings: 360 / lobes (90° on the 4-corner cam, L4). */
export function lobeSpacing(lobes: number) {
  return 360 / lobes
}

/** Dwell angle (cam degrees the points stay closed) for a dwell fraction of each lobe interval. */
export function dwellAngle(lobes: number, fraction: number) {
  return lobeSpacing(lobes) * fraction
}

/**
 * Are the contact-breaker points closed at cam angle φ? They open at `openAt` + j·360/lobes and
 * close again `dwell` cam degrees before the next opening.
 */
export function pointsClosed(camDeg: number, lobes: number, dwellFraction: number, openAt = 0) {
  const sp = lobeSpacing(lobes)
  const toNext = mod(openAt - camDeg, sp)
  return toNext > 1e-9 && toNext < dwellFraction * sp
}

/**
 * Peak primary voltage when the points open (beyond notes): the collapsing primary current rings
 * with the condenser, e = I·√(L/C). The condenser keeps this to a few hundred volts so the points
 * do not arc (TB Table 5.1).
 */
export function primaryFlybackVolts(current: number, inductance: number, capacitance: number) {
  return current * Math.sqrt(inductance / capacitance)
}

/** Secondary voltage available: primary fly-back × turns ratio × coupling efficiency (beyond notes). */
export function secondaryAvailableVolts(current: number, inductance: number, capacitance: number, N1: number, N2: number, coupling = 0.6) {
  return primaryFlybackVolts(current, inductance, capacitance) * (N2 / N1) * coupling
}

/** Spark needs 10–15 kV to jump the gap (TB p27). */
export const SPARK_KV_REQUIRED: [number, number] = [10, 15]

/* ------------------------------ Magneto impulse coupling (TB Fig 5.3) ------------------------------ */

export interface ImpulseSpec {
  /** drive rotation while a pawl holds the magneto rotor against the stop pin (spring winds up) */
  windupDeg: number
  /** drive rotation over which the released spring flings the rotor forward */
  snapDeg: number
  /** one trip per spark: the two-pole field reverses every half revolution (TB p28) → 180° */
  periodDeg: number
  /** above this drive speed the pawls are held clear (centrifugal) and the coupling is solid */
  releaseRpm: number
}

export const TYPICAL_IMPULSE: ImpulseSpec = { windupDeg: 35, snapDeg: 4, periodDeg: 180, releaseRpm: 250 }

export type ImpulsePhase = 'wind-up' | 'snap' | 'follow' | 'solid'

/**
 * Magneto rotor angle for a drive (hub) angle (beyond notes — kinematics of TB Fig 5.3):
 * held → wound spring released → rotor snaps forward at many times drive speed → follows the hub.
 */
export function impulseCoupling(driveDeg: number, driveRpm: number, s: ImpulseSpec = TYPICAL_IMPULSE) {
  if (driveRpm >= s.releaseRpm) return { rotorDeg: driveDeg, phase: 'solid' as ImpulsePhase, springDeg: 0, speedFactor: 1 }
  const phi = mod(driveDeg, s.periodDeg)
  const base = driveDeg - phi
  if (phi < s.windupDeg) return { rotorDeg: base, phase: 'wind-up' as ImpulsePhase, springDeg: phi, speedFactor: 0 }
  if (phi < s.windupDeg + s.snapDeg) {
    const u = (phi - s.windupDeg) / s.snapDeg
    const eased = Math.sin((u * Math.PI) / 2)
    const rotor = base + eased * (s.windupDeg + s.snapDeg)
    return { rotorDeg: rotor, phase: 'snap' as ImpulsePhase, springDeg: driveDeg - rotor, speedFactor: (s.windupDeg + s.snapDeg) / s.snapDeg }
  }
  return { rotorDeg: driveDeg, phase: 'follow' as ImpulsePhase, springDeg: 0, speedFactor: 1 }
}

/**
 * Magneto secondary voltage rises with rotor speed (induced EMF ∝ rate of flux change, TB p27–28).
 * Scaled (beyond notes) so that `refRpm` gives the 10 kV the plug needs.
 */
export function magnetoKV(rotorRpm: number, refRpm = 150) {
  return (SPARK_KV_REQUIRED[0] * rotorRpm) / refRpm
}

/* ------------------------------ Lead-acid battery (TB §5.6.1) ------------------------------ */

/** Electrolyte SG with state of charge (beyond notes: linear, 1.12 flat → 1.27 full, TB p31). */
export function batterySG(stateOfCharge: number) {
  return 1.12 + 0.15 * clamp01(stateOfCharge)
}

/** Open-circuit cell voltage ≈ SG + 0.84 V (rule of thumb, beyond notes). */
export function cellOpenCircuitVolts(sg: number) {
  return sg + 0.84
}

/** Atom counts of a formula with an optional leading coefficient, e.g. "2H2SO4". */
export function atomCount(formula: string): Record<string, number> {
  const m = /^(\d*)(.*)$/.exec(formula.trim())!
  const coeff = m[1] ? parseInt(m[1], 10) : 1
  const out: Record<string, number> = {}
  const re = /([A-Z][a-z]?)(\d*)/g
  let t: RegExpExecArray | null
  while ((t = re.exec(m[2]))) out[t[1]] = (out[t[1]] ?? 0) + coeff * (t[2] ? parseInt(t[2], 10) : 1)
  return out
}

/** Is a reaction balanced? Returns the element counts of each side. */
export function reactionBalance(lhs: string[], rhs: string[]) {
  const total = (side: string[]) => {
    const acc: Record<string, number> = {}
    for (const f of side) for (const [el, c] of Object.entries(atomCount(f))) acc[el] = (acc[el] ?? 0) + c
    return acc
  }
  const L = total(lhs)
  const R = total(rhs)
  const els = new Set([...Object.keys(L), ...Object.keys(R)])
  const balanced = [...els].every((e) => (L[e] ?? 0) === (R[e] ?? 0))
  return { balanced, lhs: L, rhs: R }
}

/** Discharge reaction as printed in TB p31 — and balanced. */
export const LEAD_ACID_AS_PRINTED = { lhs: ['PbO2', 'Pb', '2H2SO4'], rhs: ['2PbSO4', 'H2O'] }
export const LEAD_ACID = { lhs: ['Pb', 'PbO2', '2H2SO4'], rhs: ['2PbSO4', '2H2O'] }

/* ======================================================================================
 * Performance calculator (Misc Exercises p2–6; TB p9; exam papers)
 * ====================================================================================== */

export type ClearanceSpec =
  /** compression ratio given */
  | { kind: 'cr'; value: number }
  /** clearance volume per cylinder, m³ */
  | { kind: 'cv'; value: number }
  /** CV = value × PD (e.g. 1/6 for the Mahindra question) */
  | { kind: 'pdFraction'; value: number }
  /** CV = value × TCV (e.g. TB Q9: one fifth of the total cylinder volume) */
  | { kind: 'tcvFraction'; value: number }
  /** total cylinder volume per cylinder, m³ */
  | { kind: 'tcv'; value: number }

export interface PerformanceInput {
  /** m */
  bore: number
  /** m */
  stroke: number
  /** piston area, m², when a question gives it instead of the bore */
  area?: number
  cylinders: number
  cycle: StrokeCycle
  clearance: ClearanceSpec
  rpm: number
  /** brake output: torque (N·m), brake power (W), bmep (Pa), or fuel energy × ηbth */
  output: { kind: 'torque'; value: number } | { kind: 'bp'; value: number } | { kind: 'bmep'; value: number } | { kind: 'fuel'; etaBth: number }
  /** friction: mechanical efficiency, imep (Pa) or friction power (W) */
  losses?: { kind: 'etaM'; value: number } | { kind: 'imep'; value: number } | { kind: 'fp'; value: number }
  /** fuel: measured rate, from the air flow and A/F, or from BP and ηbth */
  fuel?: { kind: 'rate'; kgPerH: number } | { kind: 'fromAir' } | { kind: 'etaBth'; value: number }
  /** air: volumetric efficiency, measured rate, or from the fuel and A/F */
  air?: { kind: 'etaV'; value: number } | { kind: 'rate'; kgPerH: number } | { kind: 'fromFuel' }
  /** air–fuel ratio by mass (stoichiometric ≈ 15, Misc p4) */
  airFuel?: number
  /** lower heating value, J/kg */
  hv: number
  /** ambient pressure (Pa) and temperature (K) for ρa = p/RT */
  pAmb: number
  TAmb: number
  /** heat-balance split of (fuel energy − IP) between exhaust and cooling */
  shares?: HeatShares
}

export interface PerformanceResult {
  area: number
  /** per cylinder, m³ */
  PD: number
  CV: number
  TCV: number
  CR: number
  /** all cylinders, m³ */
  Vd: number
  meanPistonSpeed: number
  rhoAir: number
  /** swept-volume flow, m³/s */
  sweptRate: number
  bp?: number
  torque?: number
  bmep?: number
  ip?: number
  fp?: number
  etaM?: number
  imep?: number
  /** kg/s */
  fuelRate?: number
  airRate?: number
  etaV?: number
  airFuel?: number
  fuelPower?: number
  etaBth?: number
  etaIth?: number
  /** kg/kWh */
  bsfc?: number
  heat?: ReturnType<typeof heatBalance>
  /** what could not be computed, and why */
  missing: string[]
}

function clearanceFrom(PD: number, c: ClearanceSpec) {
  switch (c.kind) {
    case 'cr':
      return PD / (c.value - 1)
    case 'cv':
      return c.value
    case 'pdFraction':
      return PD * c.value
    case 'tcvFraction':
      // CV = f·(PD + CV) → CV = f·PD/(1 − f)
      return (c.value * PD) / (1 - c.value)
    case 'tcv':
      return c.value - PD
  }
}

/**
 * Full engine-performance calculation in the order a worked answer would go: geometry → air →
 * fuel → brake output → indicated power and friction → efficiencies → heat balance.
 */
export function enginePerformance(i: PerformanceInput): PerformanceResult {
  const missing: string[] = []
  const area = i.area ?? (Math.PI / 4) * i.bore * i.bore
  const PD = area * i.stroke
  const CV = clearanceFrom(PD, i.clearance)
  const TCV = PD + CV
  const CR = TCV / CV
  const Vd = PD * i.cylinders
  const rhoAir = airDensity(i.pAmb, i.TAmb)
  const sweptRate = (Vd * i.rpm) / (60 * nF(i.cycle))
  const r: PerformanceResult = { area, PD, CV, TCV, CR, Vd, meanPistonSpeed: meanPistonSpeed(i.stroke, i.rpm), rhoAir, sweptRate, missing }
  const af = i.airFuel

  // air (first pass)
  if (i.air?.kind === 'etaV') r.airRate = i.air.value * rhoAir * sweptRate
  else if (i.air?.kind === 'rate') r.airRate = i.air.kgPerH / 3600

  // fuel (first pass)
  if (i.fuel?.kind === 'rate') r.fuelRate = i.fuel.kgPerH / 3600
  else if (i.fuel?.kind === 'fromAir') {
    if (r.airRate !== undefined && af) r.fuelRate = r.airRate / af
    else missing.push('Fuel from air needs an air flow (ηv or rate) and an A/F ratio.')
  }

  // brake output
  if (i.output.kind === 'torque') {
    r.torque = i.output.value
    r.bp = brakePower(i.rpm, r.torque)
  } else if (i.output.kind === 'bp') {
    r.bp = i.output.value
    r.torque = torqueFromPower(r.bp, i.rpm)
  } else if (i.output.kind === 'bmep') {
    r.bp = (i.output.value * i.stroke * area * i.rpm * i.cylinders) / (60 * nF(i.cycle))
    r.torque = torqueFromPower(r.bp, i.rpm)
  } else if (r.fuelRate !== undefined) {
    r.bp = i.output.etaBth * r.fuelRate * i.hv
    r.torque = torqueFromPower(r.bp, i.rpm)
  } else missing.push('Brake power from ηbth needs a fuel rate.')

  // fuel (second pass)
  if (i.fuel?.kind === 'etaBth') {
    if (r.bp !== undefined) r.fuelRate = r.bp / (i.fuel.value * i.hv)
    else missing.push('Fuel from ηbth needs the brake power.')
  }
  // air (second pass)
  if (i.air?.kind === 'fromFuel') {
    if (r.fuelRate !== undefined && af) r.airRate = r.fuelRate * af
    else missing.push('Air from fuel needs a fuel rate and an A/F ratio.')
  }

  if (r.bp !== undefined) r.bmep = (r.bp * 60 * nF(i.cycle)) / (i.stroke * area * i.rpm * i.cylinders)

  // indicated power and friction
  if (i.losses && r.bp !== undefined) {
    if (i.losses.kind === 'etaM') r.ip = r.bp / i.losses.value
    else if (i.losses.kind === 'imep') r.ip = (i.losses.value * i.stroke * area * i.rpm * i.cylinders) / (60 * nF(i.cycle))
    else r.ip = r.bp + i.losses.value
    r.fp = r.ip - r.bp
    r.etaM = r.bp / r.ip
    r.imep = (r.ip * 60 * nF(i.cycle)) / (i.stroke * area * i.rpm * i.cylinders)
  }

  // efficiencies
  if (r.airRate !== undefined) r.etaV = r.airRate / (rhoAir * sweptRate)
  if (r.airRate !== undefined && r.fuelRate) r.airFuel = r.airRate / r.fuelRate
  if (r.fuelRate !== undefined) {
    r.fuelPower = r.fuelRate * i.hv
    if (r.bp !== undefined) {
      r.etaBth = r.bp / r.fuelPower
      r.bsfc = (r.fuelRate * 3600) / (r.bp / 1000)
    }
    if (r.ip !== undefined) r.etaIth = r.ip / r.fuelPower
    if (r.bp !== undefined && r.ip !== undefined && i.shares) r.heat = heatBalance(r.fuelPower, r.bp, r.ip, i.shares)
  }
  return r
}

/** Brake thermal efficiency from bsfc (kg/kWh) and HV (J/kg): η = 3600 / (bsfc · HV[MJ/kg]). */
export function etaFromBsfc(bsfc: number, hv: number) {
  return 3.6e6 / (bsfc * hv)
}

/**
 * TB §3.3 power-loss chain (per cent of the fuel energy): exhaust 31, cooling 40, friction 5.5
 * → 23.5 at the PTO; transmission & traction 4.5 more → 19 at the drawbar.
 */
export const TB_POWER_CHAIN = { exhaust: 31, cooling: 40, friction: 5.5, transmission: 4.5 }

export function tbPowerChain() {
  const c = TB_POWER_CHAIN
  const pto = 100 - (c.exhaust + c.cooling + c.friction)
  return { pto, drawbar: pto - c.transmission }
}
