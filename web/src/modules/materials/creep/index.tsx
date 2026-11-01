import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Creep3D, CreepPanel, DEFAULTS, FLOOR, useCreep } from './Rig'

const M9 = (where: string) => cite('MSE305', 'Module 9 - Creep.pdf', where)
const view = { position: [1.25, 0.5, 3.1] as [number, number, number], target: [0, -0.04, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'creep',
  title: 'Creep testing rig',
  summary: 'A dead load on a hot specimen: watch it slowly stretch through primary, secondary and tertiary creep to rupture, and see how much life a little heat costs.',
  Viewport: Creep3D,
  Panel: CreepPanel,
  camera: view,
  extent: 1.8,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the furnace', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  defaultPreset: 'mid',
  cites: [M9('creep curve; Norton; Larson–Miller')],
  reset: () => useCreep.getState().reset(),
  applyParams: (p) => useCreep.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Metal that flows',
      body: 'This steel is loaded **well below its yield stress**, yet at this temperature it keeps slowly stretching. That is **creep**: permanent strain that grows with time at constant stress.',
      camera: view,
      cut: 'mid',
      select: 'specimen',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [M9('introduction')],
    },
    {
      title: 'Three stages',
      body: '**Primary**: the rate falls as the metal work-hardens. **Secondary**: a long steady rate, where hardening and softening balance, used for design. **Tertiary**: the rate climbs as voids form and the specimen necks, ending in rupture.',
      select: 'weights',
      cites: [M9('creep curve')],
      check: {
        question: 'Which stage of the creep curve is usually used in design, and why?',
        options: ['Primary, as it is quickest', 'Secondary, as it takes most of the life', 'Tertiary, as it is the most severe'],
        answer: 1,
        explain: 'The **secondary** stage takes up most of a part’s life, at a steady rate, so it is the natural basis for sizing it.',
      },
    },
    {
      title: 'Trading heat for time',
      body: 'Nobody can test for 20 years. **Larson–Miller**, P = T(C + log t), says that a short hot test stands in for a long cooler one. It also shows how quickly life falls: 50 °C hotter costs many times over.',
      params: { T: 600 },
      select: 'furnace',
      cites: [M9('Larson–Miller')],
    },
  ],
}

export default scene
