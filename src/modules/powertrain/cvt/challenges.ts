import type { ChallengeDef } from '@/challenges/types'
import { operate } from '@/physics/cvt'
import { fmt } from '@/ui/controls'
import { useCvt } from './model'

const now = () => {
  const s = useCvt.getState()
  return { s, o: operate({ rpm: s.rpm, range: s.range, target: s.target, pull: s.pull * 1e3 }) }
}

const challenges: ChallengeDef[] = [
  {
    id: 'cvt-efficient-plough',
    title: 'Gear up, throttle back',
    brief: 'Plough at 12 km/h with a 45 kN pull, with the transmission at least 89.8 % efficient. Engine speed and range are yours to choose.',
    difficulty: 3,
    setup: { target: 12, pull: 45, range: 'road', rpm: 2100, manual: false },
    criteria: [
      {
        label: 'Pull ≥ 45 kN, asking for ≥ 12 km/h',
        check: () => {
          const { s } = now()
          return { pass: s.pull >= 45 && s.target >= 12 && !s.manual, value: `${fmt(s.pull, 3)} kN, ${fmt(s.target, 3)} km/h` }
        },
      },
      {
        label: 'Actually doing ≥ 11.9 km/h',
        check: () => {
          const { o } = now()
          return { pass: o.speed >= 11.9 && !o.limited, value: o.limited ? `${fmt(o.speed, 3)} (engine-limited)` : `${fmt(o.speed, 3)} km/h` }
        },
      },
      {
        label: 'Transmission efficiency ≥ 89.8 %',
        check: () => {
          const { o } = now()
          return { pass: o.efficiency >= 0.898, value: `${fmt(o.efficiency * 100, 3)} %` }
        },
      },
    ],
    hold: 2,
    score: { label: 'Engine power used', unit: 'kW', value: () => now().o.Pin / 1e3, better: 'lower', digits: 4 },
    hint: 'The less power goes through the oil, the more efficient the drive — and that happens when the output turns fast relative to the engine. Pick the range and lower the revs, but not so far that the engine runs out of power.',
    explain:
      'A CVT can hold the travel speed at any engine speed, so the controller (or the driver) can run the engine slower and push the transmission towards its pure-gear point. That is “gear up, throttle back”: the same work for less fuel. Too low, though, and the engine cannot give the power and the tractor slows.',
  },
]

export default challenges
