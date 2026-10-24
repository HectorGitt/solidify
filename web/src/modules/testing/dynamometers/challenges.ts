import type { ChallengeDef } from '@/challenges/types'
import { fmt } from '@/ui/controls'
import { solve, useDyno, type DynoParams } from './model'

/** Highest brake power the engine can give on this dynamometer (scanned once per kind). */
const peakCache = new Map<string, number>()
function peak(kind: DynoParams['kind']) {
  let p = peakCache.get(kind)
  if (p === undefined) {
    p = 0
    const st = useDyno.getState()
    for (let l = 0; l <= 1.0001; l += 0.0025) p = Math.max(p, solve({ kind, load: l, arm: st.arm }).P)
    peakCache.set(kind, p)
  }
  return p
}

const current = () => solve(useDyno.getState())

const challenges: ChallengeDef[] = [
  {
    id: 'dyno-peak-power',
    title: 'Find the peak',
    brief: 'Load the engine on the hydraulic dynamometer until it gives its maximum power, and hold it there.',
    difficulty: 1,
    setup: { kind: 'hydraulic', load: 0.85 },
    criteria: [
      {
        label: 'Hydraulic dynamometer',
        check: () => ({ pass: useDyno.getState().kind === 'hydraulic', value: useDyno.getState().kind }),
      },
      {
        label: 'Brake power within 1 % of the maximum',
        check: () => {
          const r = current()
          const pk = peak('hydraulic')
          return { pass: r.P >= 0.99 * pk, value: `${fmt(r.P, 3)} / ${fmt(pk, 3)} kW` }
        },
      },
    ],
    hold: 2,
    hint: 'Too much water and the engine is dragged down its torque curve; too little and the governor cuts the fuel. Peak power sits just below the speed where the governor starts to act.',
    explain:
      'Maximum power is not at maximum torque: power = 2πNT, so it peaks near rated speed, just before the governor run-out. Testing stations load the engine step by step to map the whole curve; the rated point is the one quoted on the spec sheet.',
  },
  {
    id: 'dyno-pto-540',
    title: 'Standard PTO speed',
    brief: 'On the PTO dynamometer, set the load so the PTO shaft turns at its standard 540 rpm (±5) — the speed implements are designed for.',
    difficulty: 2,
    setup: { kind: 'pto', load: 0.2 },
    criteria: [
      {
        label: 'PTO dynamometer',
        check: () => ({ pass: useDyno.getState().kind === 'pto', value: useDyno.getState().kind }),
      },
      {
        label: 'PTO speed 540 ± 5 rpm',
        check: () => {
          const r = current()
          return { pass: Math.abs(r.nDyno - 540) <= 5, value: `${fmt(r.nDyno, 4)} rpm` }
        },
      },
    ],
    hold: 2,
    hint: 'The PTO turns at engine speed ÷ the PTO ratio. Light load lets the governor hold the engine near high idle — too fast. Add load until the engine is pulled down to the right speed.',
    explain:
      'Implements are built for 540 (or 1000) rpm at the PTO. The tractor reaches it at a set engine speed, marked on the rev counter. Running slower loses capacity; faster over-speeds the machine. The PTO test measures power at exactly this speed.',
  },
]

export default challenges
