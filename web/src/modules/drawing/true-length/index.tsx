import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Line3D, LinePanel, useLine } from './Rig'

const NOTE = (where: string) => cite('Textbook', 'True Lengths and Auxiliary views.pdf', where)
const view = { position: [2.4, 1.8, 5.6] as [number, number, number], target: [0, -0.1, -0.2] as [number, number, number] }

const scene: SceneDef = {
  id: 'true-length',
  title: 'True length & auxiliary views',
  summary: 'A line across a block is shorter in every principal view. Swing a viewing plane round until it lies parallel to the line, and read its true length.',
  Viewport: Line3D,
  Panel: LinePanel,
  camera: view,
  extent: 3,
  floorY: FLOOR,
  timeScale: 1,
  cutPresets: [{ id: 'diag', label: 'Plane through the line', planes: [{ normal: [-0.6, 0, 0.8], pos: 0 }] }],
  cites: [NOTE('true length of a line; first auxiliary views')],
  reset: () => useLine.getState().reset(),
  applyParams: (p) => useLine.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Every view lies a little',
      body: 'This line runs corner to corner across a block. The elevation, the plan and the end view each show only a face diagonal, and the line itself is longer than all of them.',
      camera: view,
      select: 'block',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [NOTE('Figs 1–2')],
    },
    {
      title: 'Turn the plane to suit the line',
      body: 'A line shows its true length on a plane **parallel to it**. So take a plane parallel to the plan view of the line, and project onto that: this is the first auxiliary elevation.',
      select: 'sheet',
      cites: [NOTE('first auxiliary elevation')],
      check: {
        question: 'An auxiliary elevation is projected from which view?',
        options: ['The plan', 'The front elevation', 'The end elevation'],
        answer: 0,
        explain: 'A plan is projected from an elevation, and an elevation from a plan.',
      },
    },
  ],
}

export default scene
