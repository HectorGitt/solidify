import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Fracture3D, FracturePanel, useFracture } from './Rig'

const M10 = (where: string) => cite('MSE305', 'Module 10 - Fracture Mechanics.pdf', where)
const view = { position: [1.2, 0.45, 3.7] as [number, number, number], target: [0, -0.04, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'fracture',
  title: 'Fracture mechanics rig',
  summary: 'A plate with a crack: grow the crack or raise the stress until K reaches the material’s toughness, and find the crack size each material can tolerate.',
  Viewport: Fracture3D,
  Panel: FracturePanel,
  camera: view,
  extent: 2,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the crack', planes: [{ normal: [0, 1, 0], pos: 0 }] }],
  cites: [M10('stress intensity factor; toughness; Griffith')],
  reset: () => useFracture.getState().reset(),
  applyParams: (p) => useFracture.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Cracks change everything',
      body: 'Handbook strength assumes a perfect part. A real one has flaws, and a sharp crack **concentrates stress at its tip**. A part can break well below its yield stress, suddenly and with little warning.',
      camera: view,
      cut: false,
      select: 'plate',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [M10('introduction')],
    },
    {
      title: 'The stress intensity factor',
      body: '**K = Yσ√(πa)** rolls stress and crack size into one number. Y is 1 for a through crack in a wide plate, and 1.12 at an edge. The plate breaks when K reaches the material’s **fracture toughness, K_Ic**.',
      params: { a: 16 },
      cites: [M10('Eqns 1–3')],
      check: {
        question: 'A crack’s length is doubled. By how much does the stress the plate can carry fall?',
        options: ['2 times', 'About 1.4 times', '4 times'],
        answer: 1,
        explain: 'σc = K_Ic / (Y√(πa)), so it goes with **1/√a**. Double the crack and the strength falls by √2.',
      },
    },
    {
      title: 'Yield or fracture?',
      body: 'Small cracks don’t matter: the plate yields first. Above the crossing on the chart the crack takes over, and failure is brittle. Compare tough steel with glass, where a surface scratch is enough.',
      params: { sigma: 30, KIc: 0.8, a: 0.2, Y: 3000 },
      cites: [M10('Griffith; material selection')],
    },
  ],
}

export default scene
