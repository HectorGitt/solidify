/**
 * Engine and PTO dynamometers.
 *
 * Sources: AEE502 "Tractor Tests and Performance" (textbook Ch 15, pp350–362):
 *   eq 3  Power = 2π·l·F·n / 60 000 kW (Prony brake; also the DC dynamometer, eq 5)
 *   eq 4  Power = 2π·n·T / 60 000 kW, T = F·l
 *   hydraulic absorbing capacity ∝ N³D⁵; air (fan) brake ∝ rpm³
 * AEE502 "Tractor Mechanics" Fig 2.2: the "Farmland" tractor engine curve (Leyland 253).
 * AEE510 Lecture 27 (Zoz & Grisso) eq 29: PTO power ≈ 0.85 × flywheel power.
 *
 * Units: N, m, N·m, rpm, kW.
 */

const { PI } = Math

/** eq 3: brake power from arm length l (m), scale force F (N) and speed n (rpm), kW. */
export function armPower(l: number, F: number, n: number) {
  return (2 * PI * l * F * n) / 60000
}

/** eq 4: power from torque T (N·m) and speed n (rpm), kW. */
export function torquePower(T: number, n: number) {
  return (2 * PI * n * T) / 60000
}

/** Scale reading needed to balance a torque on an arm: F = T / l. */
export function scaleForce(T: number, l: number) {
  return T / l
}

/** Hydraulic dynamometer capacity scales as N³D⁵ (TESTS p6). */
export function hydraulicCapacity(P0: number, N0: number, D0: number, N: number, D: number) {
  return P0 * (N / N0) ** 3 * (D / D0) ** 5
}

/* ------------------------------ the test engine ------------------------------ */

/**
 * Full-throttle engine curve of the "Farmland" tractor (Leyland 253; Australian Test Report
 * No 78), as tabulated in Tractor Mechanics Fig 2.2: rpm → N·m.
 * 2390 rpm is high idle; 2390 → 2250 rpm is the governor run-out; below 2250 rpm the
 * engine lugs on the full-load torque curve (maximum 173 N·m at 1300 rpm).
 */
export const FARMLAND_ENGINE: [number, number][] = [
  [1000, 171],
  [1300, 173],
  [1730, 161],
  [2250, 142],
  [2325, 120],
  [2350, 80],
  [2370, 40],
  [2390, 0],
]

export const ENGINE_MIN_RPM = 1000
export const ENGINE_HIGH_IDLE = 2390

/** Engine torque at speed n from the table (linear interpolation). 0 outside the tested range. */
export function engineTorque(n: number, curve = FARMLAND_ENGINE) {
  if (n < curve[0][0] || n > curve[curve.length - 1][0]) return 0
  for (let i = 0; i < curve.length - 1; i++) {
    const [n0, t0] = curve[i]
    const [n1, t1] = curve[i + 1]
    if (n <= n1) return t0 + ((t1 - t0) * (n - n0)) / (n1 - n0)
  }
  return 0
}

/** Maximum power on a piecewise-linear torque curve (checks every segment's interior maximum). */
export function maxEnginePower(curve = FARMLAND_ENGINE) {
  let best = { n: 0, T: 0, P: 0 }
  const test = (n: number) => {
    const T = engineTorque(n, curve)
    const P = torquePower(T, n)
    if (P > best.P) best = { n, T, P }
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const [n0, t0] = curve[i]
    const [n1, t1] = curve[i + 1]
    test(n0)
    const s = (t1 - t0) / (n1 - n0)
    // d(nT)/dn = T0 + s(n − n0) + s·n = 0
    if (s < 0) {
      const nStar = (s * n0 - t0) / (2 * s)
      if (nStar > n0 && nStar < n1) test(nStar)
    }
  }
  return best
}

/* ------------------------------ absorption characteristics ------------------------------ */

export type DynoKind = 'prony' | 'hydraulic' | 'eddy' | 'dc' | 'pto'

export interface DynoSpec {
  kind: DynoKind
  /** torque-arm length, m */
  arm: number
  /** largest absorbing torque at full load setting and the reference speed, N·m (at the dynamometer shaft) */
  Tmax: number
  /** reference speed for the characteristic, rpm (dynamometer shaft) */
  nRef: number
}

/**
 * Absorbed torque at dynamometer-shaft speed n for a load setting s (0…1):
 *  - Prony brake: dry friction, T = s·Tmax, nearly independent of speed;
 *  - hydraulic and the shop-type PTO unit (hydraulic): T ∝ s·n² (power ∝ n³, TESTS p6);
 *  - eddy-current: torque set by field excitation, rising with speed then levelling off;
 *  - DC generator into a resistor bank: T ∝ excitation²·n.
 * The eddy-current and DC shapes are standard behaviour, not given in the notes.
 */
export function dynoTorque(spec: DynoSpec, s: number, n: number) {
  const x = n / spec.nRef
  switch (spec.kind) {
    case 'prony':
      return s * spec.Tmax
    case 'hydraulic':
    case 'pto':
      return s * spec.Tmax * x * x
    case 'eddy':
      return s * s * spec.Tmax * (1 - Math.exp(-3 * x))
    case 'dc':
      return s * s * spec.Tmax * x
  }
}

export interface OperatingPoint {
  /** engine speed, rpm (0 = stalled) */
  n: number
  /** torque at the engine, N·m */
  T: number
  /** kW */
  P: number
  /** d(T_dyno − T_engine)/dn > 0 → a small speed change is corrected */
  stable: boolean
  stalled: boolean
}

/**
 * Steady running point of the engine at full throttle against a load torque T_load(n)
 * (expressed at the engine crankshaft). The engine starts at high idle and slows until the
 * load torque equals the engine torque: the first crossing found scanning down from high idle.
 */
export function operatingPoint(load: (n: number) => number, curve = FARMLAND_ENGINE): OperatingPoint {
  const lo = curve[0][0]
  const hi = curve[curve.length - 1][0]
  const f = (n: number) => engineTorque(n, curve) - load(n)
  const step = 2
  let prev = hi
  let fPrev = f(hi)
  if (fPrev >= 0) return finish(hi)
  for (let n = hi - step; n >= lo; n -= step) {
    const fn = f(n)
    if (fn >= 0 && fPrev < 0) {
      // bisect between n and prev
      let a = n
      let b = prev
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2
        if (f(m) >= 0) a = m
        else b = m
      }
      return finish((a + b) / 2)
    }
    prev = n
    fPrev = fn
  }
  return { n: 0, T: 0, P: 0, stable: false, stalled: true }

  function finish(n: number): OperatingPoint {
    const T = engineTorque(n, curve)
    const h = 5
    const slope = (load(n + h) - engineTorque(n + h, curve) - (load(n - h) - engineTorque(n - h, curve))) / (2 * h)
    return { n, T, P: torquePower(T, n), stable: slope > 1e-6, stalled: false }
  }
}

/** PTO power ≈ 0.85 × flywheel power (Zoz & Grisso eq 29). */
export const PTO_DRIVE_EFFICIENCY = 0.85
