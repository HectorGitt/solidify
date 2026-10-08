import type { SceneDef } from '@/modules/types'
import { Ballast3D } from './Ballast3D'
import { BAL, DEFAULTS, L27, TT, TTS, resetTest, useBallast } from './model'
import { BallastPanel } from './Panel'

type V = [number, number, number]
const view = { position: [1.9, 1.35, 2.9] as V, target: [0.25, 0.55, 0] as V }

const scene: SceneDef = {
  id: 'ballast',
  title: 'Inflation & ballast',
  summary:
    'A rear drive tyre cut open to show liquid ballast (water + calcium chloride at 75 % fill) with its air cushion, cast-iron wheel weights and front weights. It drives over soil leaving tread prints and runs the chalk-mark slip test, so you can judge the ballast from the slip and the marks; inflation pressure, the weight guides and the liquid-ballast chart are in Controls.',
  Viewport: Ballast3D,
  Panel: BallastPanel,
  camera: view,
  extent: 3,
  floorY: -0.2,
  hatchScale: 0.02,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'half', label: 'Half section (wheel plane)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [-1, 0, 0], pos: 0 }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [TT('p7–13, Figs 9–21'), TTS('p14–15'), BAL('p1–5'), L27('p18, p39–44')],
  reset: () => {
    useBallast.getState().reset()
    resetTest()
  },
  applyParams: (p) => {
    useBallast.getState().set(p as Partial<typeof DEFAULTS>)
    resetTest()
  },
  tour: [
    {
      title: 'Why ballast?',
      body:
        'A tyre develops pull in proportion to the weight on it, so adding weight increases traction — but weight also compacts the soil and raises rolling resistance. The aim is the **right** weight: **10–15 % wheel slip**, where drawbar power is greatest.',
      camera: view,
      cut: 'half',
      select: 'wheel',
      playing: true,
      params: { ...DEFAULTS },
      cites: [TT('p7–8, Fig 14')],
    },
    {
      title: 'Liquid ballast',
      body:
        'Water with **calcium chloride** (3½ lb per gallon, slush-free to −12 °F) is pumped in through the valve. Fill to **75 %** — water up to the valve with the valve at the top. The liquid stays at the bottom as the wheel turns.',
      camera: { position: [0.9, 0.9, 1.9], target: [0, 0.5, 0] },
      select: 'liquid',
      cut: 'half',
      cites: [TT('p12–13, Fig 20'), TTS('p15')],
    },
    {
      title: 'Keep an air cushion',
      body:
        'Air compresses; water does not. A tyre filled to 100 % cannot absorb shocks and has little bruise resistance, so the **air cushion** above the liquid matters. Here the fill is set to 100 % to show it disappear.',
      select: 'air',
      params: { fill: 1 },
      cites: [TT('p12, Fig 20')],
    },
    {
      title: 'Cast-iron wheel weights',
      body:
        'Removable cast-iron discs (about 40 kg each, usually 2–3 per wheel) bolt to the wheel centre: quick to add or take off. On two-wheel-drive tractors **front** weights are for stability, not traction — ½ the rear weight for integral implements, ⅓ for towed.',
      camera: { position: [1.6, 1.1, 2.2], target: [0.6, 0.5, 0] },
      select: 'weights',
      cut: false,
      params: { fill: 0.75, weights: 3 },
      cites: [TTS('p15'), TT('p10–12, Figs 19, 21')],
    },
    {
      title: 'The chalk-mark slip test',
      body:
        'Mark the tyre and the ground, drive **10 revolutions** under load and mark again; then back over the same distance without load and count. **9 to 8½** no-load revolutions (10–15 % slip) means proper ballast; fewer — add weight; more — remove it. The yellow marks fall short of the grey no-slip ticks by the slip.',
      camera: { position: [-0.6, 1.3, 2.6], target: [-0.9, 0.2, 0] },
      select: 'chalk',
      params: { pull: 30 },
      cites: [TT('p9–10')],
    },
    {
      title: 'Reading the tread marks',
      body:
        '**Too heavy**: sharp, distinct marks with no sign of slip. **Too light**: marks wiped out. **Correct**: the soil between the cleats is shifted, but the pattern is still visible.',
      camera: { position: [-1.0, 1.6, 1.6], target: [-1.3, 0, 0] },
      select: 'prints',
      params: { pull: 12 },
      cites: [TT('p7–8, Fig 11'), BAL('p3')],
    },
    {
      title: 'Inflation and the weight guides',
      body:
        'Open **Controls**: set the cold pressure (under-inflation wears the sides and heats the tyre; over-inflation wears the centre), compare your rear weight with the lb-per-PTO-hp guide, and check the liquid-ballast chart.',
      camera: view,
      cut: 'half',
      select: null,
      params: { ...DEFAULTS },
      cites: [TT('p6–7, Fig 9; p10–11, Figs 16–18')],
    },
  ],
}

export default scene
