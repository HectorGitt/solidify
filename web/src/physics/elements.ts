/**
 * Machine elements — AEE503 Machine Design (Modules 2–11). This is the single entry point for the
 * M9 scenes: belts, chains, gear forces, bearings, brakes, springs and welds live in per-topic
 * files beside it (re-exported here); ropes and clutch design helpers are defined below.
 * Friction-clutch capacity formulas are in ./clutch (shared, read-only) and are re-used, not copied.
 * Pure functions, SI units (m, N, Pa, kg, s, rad, W) unless a name says otherwise.
 */
import { axialForceUniformPressure, clutchTorque, frictionRadius, type ClutchTheory } from './clutch'

export * from './belts'
export * from './chains'
export * from './gearforces'
export * from './bearings'
export * from './brakes'
export * from './springs'

const { PI, exp, sin } = Math

/* ------------------------------ Ropes and hoists (Module 6) ------------------------------ */

/** Capstan (rope on an ungrooved drum): T₁/T₂ = e^(fα) with α = 2π × turns (Q17, E18, E21). */
export function capstanRatio(f: number, turns: number) {
  return exp(f * 2 * PI * turns)
}

/**
 * Rope winch: the operator holds the slack end with `pull` (T₂); the load side carries
 * T₁ = T₂·e^(fα). Power P = (T₁ − T₂)v; drum speed N = 60v/(πD).
 */
export function ropeWinch(pull: number, f: number, turns: number, drumD: number, v: number) {
  const k = capstanRatio(f, turns)
  const T1 = pull * k
  return { alpha: 2 * PI * turns, k, T1, T2: pull, P: (T1 - pull) * v, rpm: (60 * v) / (PI * drumD), torque: ((T1 - pull) * drumD) / 2 }
}

/** Fibre-rope pulley diameter rule (M6): about 40d and not less than 36d. */
export function ropePulleyDiameter(ropeD: number) {
  return { recommended: 40 * ropeD, minimum: 36 * ropeD }
}

/* ------------------------------ Clutch design (Module 8, using ./clutch) ------------------------------ */

/**
 * Multiple-disc clutch sized for a torque at an average pressure p (M8; MG16 example):
 * T = F·f·R_f·n with F = pπ(R_o² − R_i²). Solves for R_o by bisection.
 */
export function discOuterRadius(T: number, p: number, Ri: number, f: number, n: number, theory: ClutchTheory) {
  const torque = (Ro: number) => clutchTorque(axialForceUniformPressure(p, Ro, Ri), f, frictionRadius(Ro, Ri, theory), n)
  let lo = Ri * 1.0001
  let hi = Ri * 2
  while (torque(hi) < T && hi < Ri * 1e3) hi *= 2
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (torque(mid) < T) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Axial force for a required torque once the radii are fixed: F = T/(f·R_f·n). */
export function clutchForceForTorque(T: number, f: number, Ro: number, Ri: number, n: number, theory: ClutchTheory) {
  return T / (f * frictionRadius(Ro, Ri, theory) * n)
}

/** Cone clutch: the axial force F gives a normal force F_n = F / sin α on the cone face (M8 slide 8). */
export function coneNormalForce(F: number, alpha: number) {
  return F / sin(alpha)
}

/** Cone clutch face width along the cone, b = (R_o − R_i)/sin α. */
export function coneFaceWidth(Ro: number, Ri: number, alpha: number) {
  return (Ro - Ri) / sin(alpha)
}

/** Mean radius of the cone face, R_m = ½(R_o + R_i) (uniform wear: T = F·f·R_m/sin α). */
export function coneMeanRadius(Ro: number, Ri: number) {
  // errata 'cone-clutch': the slide prints ½(R_o − R_i)
  return (Ro + Ri) / 2
}
