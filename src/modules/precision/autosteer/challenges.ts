import type { ChallengeDef } from '@/challenges/types'
import { fmt } from '@/ui/controls'
import { live, useAutosteer } from './model'

const has = () => live.lastPassNo > 0 && Number.isFinite(live.lastRms)
const cm = (m: number) => (Number.isFinite(m) ? `${fmt(m * 100, 2)} cm` : '—')

const challenges: ChallengeDef[] = [
  {
    id: 'autosteer-fast-tight',
    title: 'Fast and tight',
    brief: 'At 18 km/h the factory tune weaves all over the field. Tune the look-ahead and steering response so a whole pass stays within 2 cm RMS on RTK.',
    difficulty: 3,
    setup: { fix: 'rtk', speed: 18, lookahead: 2, lag: 0.6, ff: 5 },
    criteria: [
      {
        label: 'RTK positioning',
        check: () => ({ pass: useAutosteer.getState().fix === 'rtk', value: useAutosteer.getState().fix.toUpperCase() }),
      },
      {
        label: 'Last pass driven at ≥ 16 km/h',
        check: () => ({ pass: has() && live.lastMinSpeed >= 16, value: has() ? `${fmt(live.lastMinSpeed, 3)} km/h` : 'finish a pass' }),
      },
      {
        label: 'Last pass RMS error ≤ 2 cm',
        check: () => ({ pass: has() && live.lastRms <= 0.02, value: has() ? cm(live.lastRms) : '—' }),
      },
      {
        label: 'Last pass worst error ≤ 8 cm',
        check: () => ({ pass: has() && live.lastPeak <= 0.08, value: has() ? cm(live.lastPeak) : '—' }),
      },
    ],
    hold: 0,
    score: { label: 'Pass RMS error', unit: 'cm', value: () => live.lastRms * 100, better: 'lower', digits: 2 },
    hint: 'A very short look-ahead over-corrects and a slow steering motor makes it worse — the tractor weaves. A long one is smooth but drifts. Look for the middle, and speed the motor up. Fast-forward helps you see whole passes quickly.',
    explain:
      'Pure pursuit steers for a point a set distance ahead. Too close and every small error causes a big steering correction; with a lagging actuator those corrections arrive late and the tractor oscillates. Too far and errors are corrected slowly. The right look-ahead grows with speed, which is why real systems tune it automatically.',
  },
]

export default challenges
