import { pitchDiameter, type Design, type LinkSpec, type PartSpec } from './spec'

/**
 * Speeds and torques of a design, worked from the motor through every mesh, belt and chain.
 * A gear mesh reverses the direction (ω₂ = −ω₁·z₁/z₂); a belt keeps it (ω₂ = ω₁·D₁/D₂, reversed
 * when crossed); a chain keeps it (ω₂ = ω₁·z₁/z₂). Torque on each shaft is T = P/ω, with a typical
 * efficiency per stage.
 */

export const STAGE_EFFICIENCY = { mesh: 0.98, belt: 0.96, chain: 0.97 } as const

export interface ShaftState {
  /** signed rpm (+ = anticlockwise looking along +Z) */
  rpm: number
  /** power reaching the shaft, kW */
  power: number
  /** torque, N·m */
  torque: number
  /** stages from the motor */
  stages: number
}

export interface Solution {
  shafts: Record<string, ShaftState>
  /** shafts not driven by the motor */
  idle: string[]
  /** overall speed ratio motor ÷ each shaft (absolute) */
  ratio: Record<string, number>
  /** contradictions, e.g. a loop that drives a shaft two different speeds */
  conflicts: string[]
}

function teethOrDia(p: PartSpec, l: LinkSpec): number {
  if (l.kind === 'belt') return pitchDiameter(p) ?? 0
  return p.kind === 'spur' || p.kind === 'helical' || p.kind === 'sprocket' ? p.teeth : 0
}

export function solveDesign(d: Design): Solution {
  const part = new Map(d.parts.map((p) => [p.id, p]))
  const motor = d.parts.find((p) => p.kind === 'motor')
  const shafts: Record<string, ShaftState> = {}
  const conflicts: string[] = []
  if (motor && motor.kind === 'motor') {
    const w0 = (motor.rpm * 2 * Math.PI) / 60
    shafts[motor.shaft] = { rpm: motor.rpm, power: motor.power, torque: (motor.power * 1000) / w0, stages: 0 }
    const queue = [motor.shaft]
    while (queue.length) {
      const sid = queue.shift()!
      const s = shafts[sid]
      for (const l of d.links) {
        for (const [from, to] of [
          [l.a, l.b],
          [l.b, l.a],
        ]) {
          const pf = part.get(from)
          const pt = part.get(to)
          if (!pf || !pt || pf.shaft !== sid || pf.shaft === pt.shaft) continue
          const nf = teethOrDia(pf, l)
          const nt = teethOrDia(pt, l)
          if (!nf || !nt) continue
          const sense = l.kind === 'mesh' ? -1 : l.kind === 'belt' && l.crossed ? -1 : 1
          const rpm = (sense * s.rpm * nf) / nt
          const power = s.power * STAGE_EFFICIENCY[l.kind]
          const prev = shafts[pt.shaft]
          if (prev) {
            if (Math.abs(prev.rpm - rpm) > Math.abs(rpm) * 0.002 + 1e-9) conflicts.push(`Shaft ${pt.shaft} would turn at ${round(prev.rpm)} and ${round(rpm)} rpm at once: the drive is locked.`)
            continue
          }
          const w = (Math.abs(rpm) * 2 * Math.PI) / 60
          shafts[pt.shaft] = { rpm, power, torque: w > 0 ? (power * 1000) / w : 0, stages: s.stages + 1 }
          queue.push(pt.shaft)
        }
      }
    }
  }
  const idle = d.shafts.map((s) => s.id).filter((id) => !shafts[id])
  const m = motor && motor.kind === 'motor' ? motor.rpm : 0
  const ratio = Object.fromEntries(Object.entries(shafts).map(([id, s]) => [id, s.rpm ? Math.abs(m / s.rpm) : Infinity]))
  return { shafts, idle, ratio, conflicts: [...new Set(conflicts)] }
}

const round = (x: number) => Number(x.toPrecision(4))
