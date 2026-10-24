import type { ChallengeDef } from '@/challenges/types'
import { fmt } from '@/ui/controls'
import { test, useConfig, verdicts } from './model'

const now = () => {
  const p = useConfig.getState()
  const r = test(p)
  return { p, r, v: verdicts(p, r) }
}

const check = (i: number) => () => {
  const { v } = now()
  return { pass: v[i].pass, value: v[i].value }
}

const challenges: ChallengeDef[] = [
  {
    id: 'config-soft-field',
    title: 'Built for the wet',
    brief: 'Plough a soft field — 18 kN at 7 km/h — with every check green: speed, slip, steering and soil. Then cut the fuel.',
    difficulty: 2,
    setup: { engine: 'medium', trans: 'gear8', drive: '2wd', tyre: 'bias', width: 'standard', front: 0, rear: 0, pull: 18, target: 7, soil: 'soft' },
    criteria: [
      {
        label: 'Job: 18 kN, 7 km/h, soft soil',
        check: () => {
          const { p } = now()
          return { pass: p.pull >= 18 && p.target >= 7 && p.soil === 'soft', value: `${fmt(p.pull, 3)} kN, ${fmt(p.target, 2)} km/h` }
        },
      },
      { label: 'Reaches the speed', check: check(1) },
      { label: 'Slip 6–15 %', check: check(2) },
      { label: 'Front axle ≥ 20 % of weight', check: check(3) },
      { label: 'Ground pressure ≤ 110 kPa', check: check(4) },
    ],
    hold: 1,
    score: { label: 'Fuel', unit: 'L/h', value: () => now().r.fuel, better: 'lower', digits: 3 },
    hint: 'Soft soil needs grip without weight: drive more wheels and spread the load (radial or wide tyres). A little front ballast keeps the steering honest. A bigger engine wastes fuel at part load.',
    explain:
      'On soft ground the answer is rarely more weight — that deepens the ruts and compacts the soil. Front-wheel assist uses the weight already on the front axle for traction, and radial or wider tyres lower the ground pressure and let the tread grip. A tractor sized to the job runs nearer full load, where a diesel uses the least fuel per kWh.',
  },
]

export default challenges
