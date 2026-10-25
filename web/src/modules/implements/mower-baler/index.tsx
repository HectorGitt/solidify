import type { CameraPose, SceneDef } from '@/modules/types'
import { C, DEFAULTS, resetLive, useHay, type HayParams } from './model'
import { MowerBalerPanel } from './Panel'
import { MowerBaler3D, resetScene } from './Scene3D'

const MOWER_VIEW: CameraPose = { position: [0.6, 2.6, -4.6], target: [-1.2, 0.2, -1.4] }
const BALER_VIEW: CameraPose = { position: [-1.0, 3.4, -5.6], target: [-3.6, 0.8, -0.4] }

const scene: SceneDef = {
  id: 'mower-baler',
  title: 'Mower & baler',
  summary:
    'A rear-mounted cutter-bar mower — PTO, gears, crank and pitman driving a reciprocating knife over the guards and ledger plates, set with a 6 mm/m lead — and a trailed pick-up baler: tines, cross auger, packer arms, ram with knife and the knotter tying 35 × 45 × 90 cm bales.',
  Viewport: MowerBaler3D,
  Panel: MowerBalerPanel,
  camera: MOWER_VIEW,
  follow: 'tractor',
  extent: 8,
  floorY: -0.45,
  hatchScale: 0.04,
  timeScale: 1 / 8,
  cutPresets: [
    { id: 'knife', label: 'Section through the knife line', planes: [{ normal: [0, 1, 0], pos: 0.07 }] },
    { id: 'chamber', label: 'Baler chamber, side section', planes: [{ normal: [0, 0, -1], pos: 0.15 }] },
    { id: 'plan', label: 'Plan through the chamber', planes: [{ normal: [0, 1, 0], pos: 1.05 }] },
  ],
  defaultPreset: 'knife',
  cites: [C.am('§16.2.1 cutter-bar mower'), C.am('§16.2.2 registration and alignment'), C.am('§16.2.3 baler'), C.pto('540 rpm baler')],
  reset: () => {
    useHay.getState().reset()
    resetLive()
    resetScene()
  },
  applyParams: (p) => useHay.getState().set(p as Partial<HayParams>),
  tour: [
    {
      title: 'The cutter-bar mower',
      body: 'The PTO drives the mower **through gears to a crank**; the **pitman** turns the crank’s rotation into the to-and-fro motion of the **knife**. The knife sections shear the grass against **ledger plates** riveted on the guards, like many pairs of scissors.',
      camera: MOWER_VIEW,
      cut: false,
      select: 'mower',
      playing: true,
      timeScale: 1 / 8,
      params: { ...DEFAULTS },
      cites: [C.am('§16.2.1')],
    },
    {
      title: 'Crank and pitman',
      body: 'Watch the **pitman wheel** turn at about 918 rpm and the pitman push and pull the knife head. The knife stops at each end of its **76 mm stroke** and is fastest in the middle — see the chart in **Controls**.',
      camera: { position: [-0.35, 0.9, -0.2], target: [-1.15, 0.12, -0.6] },
      select: 'pitman',
      timeScale: 1 / 30,
      cites: [C.am('§16.2.1')],
      check: {
        question: 'You drive faster but keep the PTO at 540 rpm. What happens at the knife?',
        options: ['Each stroke has more grass to cut', 'The knife speeds up to match', 'The knife stroke gets longer'],
        answer: 0,
        explain: 'The knife is driven from the **PTO**, not the wheels, so its stroke rate is fixed. Driving faster gives each stroke more crop, and too fast leaves a ragged cut.',
        reveal: { params: { speed: 12 } },
      },
    },
    {
      title: 'Registration and lead',
      body: 'Two adjustments. **Registration**: at each end of the stroke every section should be centred on a guard. **Alignment**: the outer end is set ahead by about **6 mm per metre** of bar, because the drag of the crop pulls it back when cutting. The lead is drawn ×20 here.',
      camera: { position: [-0.2, 3.4, -1.8], target: [-1.15, 0, -1.75] },
      select: 'cutter-bar',
      cut: 'knife',
      params: { exaggerate: true, regOffset: 0 },
      cites: [C.am('§16.2.2')],
      check: {
        question: 'At 6 mm per metre, how far ahead should the outer end of a 2 m cutter bar be set?',
        options: ['6 mm', '12 mm', '3 mm'],
        answer: 1,
        explain: 'The **lead** scales with bar length: 6 mm/m × 2 m = **12 mm**, so the crop drag pulls the bar back to square when cutting.',
      },
    },
    {
      title: 'The pick-up baler',
      body: 'The **pick-up tines** lift the windrow; the **cross auger** carries it to the feed opening, where the **packer arms** — moving like connecting rods — sweep each charge into the **bale chamber** while the ram is forward.',
      camera: BALER_VIEW,
      select: 'baler',
      cut: false,
      timeScale: 1 / 4,
      params: { ...DEFAULTS, mode: 'baler' },
      cites: [C.am('§16.2.3')],
    },
    {
      title: 'Ram, knife and knotter',
      body: 'The **ram** reciprocates like a piston, its **knife** shearing the charge off at the opening and pressing it onto the bale. When the bale reaches its length — about **35 × 45 × 90 cm** — the **needles** bring the twine up and the **knotter** ties it.',
      camera: { position: [-2.4, 2.4, -2.6], target: [-3.6, 1.0, 0.1] },
      select: 'ram',
      cut: 'chamber',
      params: { mode: 'baler' },
      cites: [C.am('§16.2.3')],
      check: {
        question: 'A heavier windrow feeds more hay with every ram stroke. What changes?',
        options: ['The ram slows down', 'Each bale comes out longer', 'Bales are finished more often'],
        answer: 2,
        explain: 'The knotter ties at a set **bale length**, so a bigger charge per stroke fills that length in fewer strokes: more bales per minute, each the same size.',
      },
    },
  ],
}

export default scene
