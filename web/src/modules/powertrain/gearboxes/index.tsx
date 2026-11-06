import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { BEVEL } from './dims'
import { prepareGearboxGeometry } from './geometry'
import { DEFAULTS, resetShift, useGearbox, type GearboxParams } from './model'
import { GearboxPanel } from './Panel'
import { GearboxScene3D } from './Scene3D'

type V3 = [number, number, number]
// seen from the −X side: the cut removes that half, keeping the idler's side wall and the casing top the levers stand on
const home = { position: [-1.5, 0.64, 1.42] as V3, target: [0, 0.05, 0.42] as V3 }
const near = (z: number) => ({ position: [-0.5, 0.18, z + 0.32] as V3, target: [0, -0.06, z] as V3 })

const scene: SceneDef = {
  id: 'gearboxes',
  title: 'Sliding, constant-mesh & synchromesh gearboxes',
  summary:
    'A two-lever tractor gearbox — three gears and reverse doubled by a high/low range into 6F/2R — built three ways: spur gears slid into mesh by selector forks, helical gears in constant mesh locked by dog collars, and synchromesh with cone synchronisers that match speeds before the dogs engage. The gear lever drives the shafts and the power path live.',
  Viewport: GearboxScene3D,
  Panel: GearboxPanel,
  camera: home,
  extent: 1.1,
  floorY: -0.26,
  hatchScale: 0.005,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'side', label: 'Through the shafts', planes: [{ normal: [-1, 0, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [-1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: 0.02 }], intersection: true },
    { id: 'plan', label: 'Plan section', planes: [{ normal: [0, 1, 0], pos: 0.02 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [-1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'side',
  cites: [SRC.tts510('p4–7, Figs 32–33'), SRC.pt510('p3 — sliding gear, collar shift, synchromesh'), SRC.top510('p3–4')],
  reset: () => {
    useGearbox.getState().reset()
    resetShift()
  },
  prepare: prepareGearboxGeometry,
  applyParams: (p) => useGearbox.getState().set(p as Partial<GearboxParams>),
  tour: [
    {
      title: 'What a gearbox does',
      body:
        'The gearbox provides a range of forward and reverse speeds and a neutral. A simple tractor box has **six or eight forward and two reverse** speeds, chosen with two levers — one for the gear, one for the speed **range**. Here: 1st, 2nd, 3rd and reverse × high/low = 6F/2R.',
      camera: home,
      cut: 'side',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, variant: 'sliding', gear: '2', range: 'H' },
      cites: [SRC.tts510('p4')],
    },
    {
      title: 'Sliding mesh',
      body:
        'Straight-toothed **spur gears** on the splined top shaft are slid along by **selector forks** until they mesh with gears on the bottom shaft. Pick 1st: the tractor is stopped first, because sliding spinning teeth together makes them clash. Spur gears are rather noisy.',
      camera: near(0.11),
      select: 'sliding-gears',
      params: { variant: 'sliding', gear: '1' },
      cites: [SRC.tts510('p6 Fig 33, p7')],
      check: {
        question: 'Why must the tractor be stopped before a gear is selected in the sliding-mesh box?',
        options: ['The selector forks jam while the shafts turn', 'The gears turn at different speeds and would clash', 'Oil pressure is needed to slide the gears'],
        answer: 1,
        explain: 'Sliding mesh has nothing to **match the speeds** of the two gears, so teeth running at different speeds would clash. Synchromesh solves this with friction cones.',
      },
    },
    {
      title: 'Reverse through an idler',
      body:
        'For reverse the sliding gear meshes with an **idler**: power passes top → idler → bottom, two meshes instead of one, so the output turns the other way.',
      camera: { position: [-0.55, 0.15, 0.62], target: [0.04, -0.05, 0.32] },
      select: 'idler',
      params: { variant: 'sliding', gear: 'R', range: 'L' },
      cites: [SRC.pt510('p3 — reverse the travel')],
      check: {
        question: 'If a second idler were added in series (three meshes from top to bottom shaft), which way would the output turn?',
        options: ['Backwards, as in reverse', 'Forwards, as in a normal gear', 'It could not turn at all'],
        answer: 1,
        explain: 'Each external mesh **reverses the rotation**. One mesh (a normal gear) and three meshes both give an odd number of reversals, so the output turns forwards; two meshes give reverse.',
      },
    },
    {
      title: 'Constant mesh and dog collars',
      body:
        '**Helical** gears stay in mesh and run free on the top shaft. A sliding **collar** on a splined hub locks the chosen gear to its shaft. Helical teeth are quieter and stronger but dearer.',
      camera: near(0.12),
      select: 'hubs',
      params: { variant: 'constant', gear: '2', range: 'H' },
      cites: [SRC.tts510('p7'), SRC.pt510('p3')],
    },
    {
      title: 'Synchromesh',
      body:
        'Change 2nd → 3rd on the move: the sleeve pushes the **baulk ring** onto the gear’s cone, friction brings the top shaft to the gear’s speed, and only then can the dog teeth slide in — the pair of gears is brought to the same speed before the teeth engage.',
      camera: near(0.18),
      select: 'hubs',
      timeScale: 1 / 40,
      params: { variant: 'synchro', gear: '3', range: 'H' },
      cites: [SRC.tts510('p4–5')],
    },
    {
      title: 'High and low range',
      body:
        'The second lever slides the **range gears** on the output shaft: high (30:30) or low (18:42). That doubles the three gears and reverse. The range is a sliding, non-synchromesh change — stop first.',
      camera: near(0.46),
      select: 'range-gears',
      timeScale: 1 / 20,
      params: { range: 'L' },
      cites: [SRC.tts510('p4')],
      check: {
        question: 'High range is 30 : 30 and low range is 18 : 42. In the same gear, how much slower does the output turn in low than in high?',
        options: ['About 1.4 times', 'About 3.0 times', 'About 2.3 times'],
        answer: 2,
        explain: 'High is 1 : 1, while low reduces by **42 / 18 ≈ 2.33**, so every gear runs about 2.3 times slower, with about 2.3 times the torque, in low range.',
      },
    },
    {
      title: 'Crown wheel and pinion',
      body:
        'The output shaft’s bevel **pinion** drives the **crown wheel** through 90° — a second reduction (47 : 11). The final reduction in the hubs makes the third. The bottom-shaft gears dip into **SAE 40/50 gear oil**, checked weekly.',
      camera: { position: [-0.55, 0.3, BEVEL.apexZ + 0.35], target: [-0.04, -0.05, BEVEL.apexZ - 0.05] },
      select: 'crown',
      cites: [SRC.tts510('p7, p10')],
    },
  ],
}

export default scene
