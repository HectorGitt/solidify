import type { ChallengeDef } from '@/challenges/types'
import { fmt } from '@/ui/controls'
import { solve, useLab } from './model'

const now = () => {
  const p = useLab.getState()
  return { p, s: solve(p) }
}

const challenges: ChallengeDef[] = [
  {
    id: 'traction-ballast',
    title: 'Just enough ballast',
    brief: 'Pull 14 kN on tilled soil with no more than 15 % slip — but keep enough weight on the front wheels to steer. Use the least ballast you can.',
    difficulty: 2,
    setup: { soil: 'tilled', pull: 14, gear: '3', ballast: 0, slipMode: 'brixius', ideal: false, tyre: 'bias', view: 'tractor' },
    criteria: [
      {
        label: 'Drawbar pull ≥ 14 kN',
        check: () => {
          const { p } = now()
          return { pass: p.pull >= 14, value: `${fmt(p.pull, 3)} kN` }
        },
      },
      {
        label: 'Tilled soil, slip from the soil model',
        check: () => {
          const { p } = now()
          return { pass: p.soil === 'tilled' && p.slipMode === 'brixius' && !p.ideal, value: p.soil }
        },
      },
      {
        label: 'Wheel slip ≤ 15 %',
        check: () => {
          const { s } = now()
          return { pass: !s.spin && s.i <= 0.15, value: s.spin ? 'spinning' : `${fmt(s.i * 100, 3)} %` }
        },
      },
      {
        label: 'Front axle carries ≥ 13 % of the weight',
        check: () => {
          const { s } = now()
          const f = s.Vf / s.c.W
          return { pass: f >= 0.13, value: `${fmt(f * 100, 3)} %` }
        },
      },
    ],
    hold: 1.5,
    score: { label: 'Ballast used', unit: 'kg', value: () => useLab.getState().ballast, better: 'lower', digits: 4 },
    hint: 'Rear ballast cuts slip but also moves the centre of gravity back, lifting the front. Look for the smallest amount that gets slip under 15 % — and try the other tyre type.',
    explain:
      'The pull itself transfers weight from the front axle to the rear, which helps traction but makes steering light. Ballast lowers slip by adding load to the driving wheels; too much wastes fuel in rolling resistance and compacts the soil, and rear ballast unloads the front even more. Radial tyres grip better at the same load, so they need less ballast.',
  },
]

export default challenges
