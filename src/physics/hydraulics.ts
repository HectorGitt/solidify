/**
 * Hydraulic pumps, motors and cylinders — AEE502 marking guides (2016/17, 2017/18),
 * AEE510 "Transmission of Power" p11, Tractor Hydraulic System p1–8.
 *
 * Units follow the notes: displacement cm³/rev, flow L/min, pressure MPa, torque N·m, power kW.
 */

/** Theoretical pump delivery Q_T = D·N/1000 (L/min). */
export function theoreticalFlow(Dcm3: number, rpm: number) {
  return (Dcm3 * rpm) / 1000
}

/** Theoretical torque T_T = Δp·D/2π (N·m), Δp in MPa, D in cm³/rev. */
export function theoreticalTorque(dpMPa: number, Dcm3: number) {
  return (dpMPa * Dcm3) / (2 * Math.PI)
}

/** Hydraulic power P_h = Q·Δp/60 (kW), Q in L/min, Δp in MPa. */
export function hydraulicPower(QLmin: number, dpMPa: number) {
  return (QLmin * dpMPa) / 60
}

export interface PumpResult {
  QT: number
  QA: number
  TT: number
  TA: number
  Ph: number
  Ps: number
  etaV: number
  etaT: number
  etaO: number
  heatLoss: number
}

/**
 * Pump: actual delivery is LESS than theoretical (leakage) and actual torque is MORE than
 * theoretical (friction). For a motor the reverse holds.
 */
export function pump(Dcm3: number, rpm: number, dpMPa: number, etaV: number, etaT: number): PumpResult {
  const QT = theoreticalFlow(Dcm3, rpm)
  const QA = QT * etaV
  const TT = theoreticalTorque(dpMPa, Dcm3)
  const TA = TT / etaT
  const Ph = hydraulicPower(QA, dpMPa)
  const etaO = etaV * etaT
  const Ps = Ph / etaO
  return { QT, QA, TT, TA, Ph, Ps, etaV, etaT, etaO, heatLoss: Ps - Ph }
}

export interface MotorResult {
  /** output speed, rpm */
  N: number
  /** output torque, N·m */
  TA: number
  /** output power, kW */
  P: number
}

/** Motor fed with flow Q (L/min) at Δp: N = Q·η_v·1000/D, T = η_T·Δp·D/2π. */
export function motor(Dcm3: number, QLmin: number, dpMPa: number, etaV: number, etaT: number): MotorResult {
  const N = (QLmin * etaV * 1000) / Dcm3
  const TA = theoreticalTorque(dpMPa, Dcm3) * etaT
  return { N, TA, P: (2 * Math.PI * N * TA) / 60 / 1000 }
}

export interface CylinderResult {
  areaCap: number
  areaRod: number
  areaAnnulus: number
  /** N */
  forceExtend: number
  forceRetract: number
  /** m/s */
  speedExtend: number
  speedRetract: number
  /** flow leaving the cap end while retracting (L/min) */
  returnFlowRetract: number
  /** flow leaving the annulus while extending (L/min) */
  returnFlowExtend: number
}

/** Double-acting cylinder: F = p·A, v = Q/A, annulus area A − A_rod on the retract side. */
export function cylinder(boreM: number, rodM: number, pPa: number, QLmin: number): CylinderResult {
  const areaCap = (Math.PI / 4) * boreM ** 2
  const areaRod = (Math.PI / 4) * rodM ** 2
  const areaAnnulus = areaCap - areaRod
  const Q = QLmin / 60000
  const speedExtend = Q / areaCap
  const speedRetract = Q / areaAnnulus
  return {
    areaCap,
    areaRod,
    areaAnnulus,
    forceExtend: pPa * areaCap,
    forceRetract: pPa * areaAnnulus,
    speedExtend,
    speedRetract,
    returnFlowRetract: speedRetract * areaCap * 60000,
    returnFlowExtend: speedExtend * areaAnnulus * 60000,
  }
}

/** Ram sizing (Culpin App 2 p11): swept volume, flow for a stroke time, pressure for a load. */
export function ramSizing(strokeM: number, boreM: number, loadN: number, timeS: number) {
  const area = (Math.PI / 4) * boreM ** 2
  const volumeL = area * strokeM * 1000
  return { volumeL, flowLps: volumeL / timeS, pressureBar: loadN / area / 1e5 }
}

/** Relief valve: pressure is capped at the setting; excess flow returns to the reservoir. */
export function reliefSplit(pumpFlow: number, demandPressure: number, reliefSetting: number) {
  if (demandPressure < reliefSetting) return { pressure: demandPressure, toLoad: pumpFlow, toTank: 0 }
  return { pressure: reliefSetting, toLoad: 0, toTank: pumpFlow }
}

/* ------------------------------------------------------------------------------------------
 * Appended for the M4/M5 scenes (pumps, cylinder, lift circuit, steering). Existing exports
 * above are unchanged.
 * ------------------------------------------------------------------------------------------ */

/** 1 kg/cm² = 0.0980665 MPa (the notes quote the relief valve as 150 kg/cm²). */
export const KGCM2_TO_MPA = 0.0980665
/** 1 bar = 0.1 MPa */
export const BAR_TO_MPA = 0.1

export interface EfficiencyResult {
  /** theoretical flow, L/min */
  QT: number
  /** theoretical torque, N·m */
  TT: number
  etaV: number
  /** mechanical (torque) efficiency */
  etaT: number
  etaO: number
  /** hydraulic power, kW */
  Ph: number
  /** shaft (mechanical) power, kW */
  Ps: number
}

/**
 * Pump efficiencies from test measurements (AEE502 marking guides): ηv = QA/QT,
 * ηT = TT/TA (actual torque is MORE than theoretical), ηo = ηv·ηT = Ph/Ps.
 */
export function pumpEfficiencies(Dcm3: number, rpm: number, QA: number, dpMPa: number, TA: number): EfficiencyResult {
  const QT = theoreticalFlow(Dcm3, rpm)
  const TT = theoreticalTorque(dpMPa, Dcm3)
  const etaV = QA / QT
  const etaT = TT / TA
  const Ph = hydraulicPower(QA, dpMPa)
  const Ps = (2 * Math.PI * rpm * TA) / 60 / 1000
  return { QT, TT, etaV, etaT, etaO: etaV * etaT, Ph, Ps }
}

/**
 * Motor efficiencies from test measurements — the reverse of a pump: the motor needs MORE
 * flow than theoretical (ηv = QT/QA) and gives LESS torque (ηT = TA/TT).
 * Here Ph is the hydraulic power IN and Ps the shaft power OUT.
 */
export function motorEfficiencies(Dcm3: number, rpm: number, QA: number, dpMPa: number, TA: number): EfficiencyResult {
  const QT = theoreticalFlow(Dcm3, rpm)
  const TT = theoreticalTorque(dpMPa, Dcm3)
  const etaV = QT / QA
  const etaT = TA / TT
  const Ph = hydraulicPower(QA, dpMPa)
  const Ps = (2 * Math.PI * rpm * TA) / 60 / 1000
  return { QT, TT, etaV, etaT, etaO: etaV * etaT, Ph, Ps }
}

/**
 * External gear pump displacement (standard text, not in the notes):
 * D = (π/4)(Do² − Di²)·b, Do = tip (outside) diameter, Di = root diameter, b = face width.
 * Metres in, cm³/rev out.
 */
export function gearPumpDisplacement(DoM: number, DiM: number, widthM: number) {
  return (Math.PI / 4) * (DoM ** 2 - DiM ** 2) * widthM * 1e6
}

/**
 * Unbalanced vane pump displacement (standard text, not in the notes): D = 2π·Dc·e·L.
 * Fluid between the vanes turns with the rotor, so the flux through the gap at a point where the
 * ring is ρ from the rotor centre is Lω(ρ² − Rr²)/2; the outlet receives the difference between
 * the widest (ρ = Rc + e) and narrowest (ρ = Rc − e) points: 2LωRc·e → 2π·Dc·e·L per rev.
 * Note: the often-quoted (π/2)(Dc + Dr)·e·L ("crescent area × L", e.g. Esposito) is half this —
 * it counts the fluid present at one instant, not the fluid each chamber discharges per rev.
 * Metres in, cm³/rev out. `DrM` is kept for call compatibility (it does not enter the result).
 */
export function vanePumpDisplacement(DcM: number, DrM: number, eM: number, widthM: number) {
  void DrM
  return 2 * Math.PI * DcM * eM * widthM * 1e6
}

/**
 * Axial-piston (swashplate) pump displacement (standard text, not in the notes):
 * D = Y·A·Dp·tan α — Y pistons of area A on pitch-circle diameter Dp, swashplate angle α.
 * Metres/degrees in, cm³/rev out.
 */
export function axialPistonDisplacement(pistons: number, boreM: number, pitchDiaM: number, swashDeg: number) {
  const A = (Math.PI / 4) * boreM ** 2
  return pistons * A * pitchDiaM * Math.tan((swashDeg * Math.PI) / 180) * 1e6
}

/** Time to stroke a ram of area A (m²) and stroke L (m) with flow Q (L/min): t = A·L/Q (s). */
export function strokeTime(areaM2: number, strokeM: number, QLmin: number) {
  return (areaM2 * strokeM) / (QLmin / 60000)
}

/**
 * Lift ram on a rockshaft (lever rule, not in the notes): the implement load W acts on the lift
 * arm at radius a_load; the ram pushes on its crank arm at radius a_ram. Ram force
 * F = W·a_load/a_ram; required pressure p = F/A.
 */
export function liftRamPressure(loadN: number, loadArmM: number, ramArmM: number, boreM: number) {
  const area = (Math.PI / 4) * boreM ** 2
  const ramForce = (loadN * loadArmM) / ramArmM
  return { area, ramForce, pressurePa: ramForce / area }
}

/** Largest load a ram can lift before the relief valve blows: W = p_relief·A·a_ram/a_load (N). */
export function liftCapacity(reliefPa: number, boreM: number, loadArmM: number, ramArmM: number) {
  return (reliefPa * (Math.PI / 4) * boreM ** 2 * ramArmM) / loadArmM
}
