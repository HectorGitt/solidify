import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Fatigue3D, FatiguePanel, useFatigue } from './Rig'

const M11 = (where: string) => cite('MSE305', 'Module 11 - Fatigue.pdf', where)
const view = { position: [0.9, 0.5, 2.75] as [number, number, number], target: [-0.08, -0.12, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'fatigue',
  title: 'Rotating-bending fatigue machine',
  summary: 'A steady load on a spinning bar swings every surface point between tension and compression. Read the life from an S–N curve, and allow for mean stress.',
  Viewport: Fatigue3D,
  Panel: FatiguePanel,
  camera: view,
  extent: 1.7,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Along the specimen', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true }],
  cites: [M11('stress cycles; S–N; Goodman and Gerber; Miner')],
  reset: () => useFatigue.getState().reset(),
  applyParams: (p) => useFatigue.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A steady load, a changing stress',
      body: 'The weight bends the bar the same way all the time, but the bar is spinning. Each point on its surface is stretched at the bottom and squeezed at the top: **fully reversed stress, once a turn**.',
      camera: view,
      cut: false,
      select: 'specimen',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [M11('stress cycles')],
    },
    {
      title: 'The S–N curve',
      body: 'Test many bars at different stresses and count the turns to failure. Lower stress means a longer life, until, for steels, the curve flattens at the **endurance limit**. Below it the bar never fails.',
      params: { amp: 200 },
      cites: [M11('S–N curve')],
      check: {
        question: 'A stress cycles from +100 to −100 MPa. What is its stress ratio R?',
        options: ['0', '−1', '1'],
        answer: 1,
        explain: 'R = σmin / σmax = −100 / 100 = **−1**: fully reversed, with no mean stress.',
      },
    },
    {
      title: 'Mean stress',
      body: 'A steady tension on top of the swing does more harm, so less swing is allowed. **Goodman** draws a straight line from the endurance limit to the ultimate strength. **Gerber** is more generous and **Soderberg** more cautious.',
      params: { mean: 200, amp: 200 },
      cites: [M11('Goodman, Gerber, Soderberg')],
    },
  ],
}

export default scene
