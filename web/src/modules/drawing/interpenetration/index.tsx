import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Join3D, JoinPanel, useJoin } from './Rig'

const NOTE = (where: string) => cite('Textbook', 'Interpenetration.pdf', where)
const view = { position: [2.4, 1.6, 6.2] as [number, number, number], target: [0.4, -0.05, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'interpenetration',
  title: 'Interpenetration of cylinders',
  summary: 'Step a cutting plane round a branch pipe, plot each point in plan and elevation, and watch the curve and its flat pattern build themselves.',
  Viewport: Join3D,
  Panel: JoinPanel,
  camera: view,
  extent: 3.4,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cites: [NOTE('major procedure; cylinders at right angles and at an angle')],
  reset: () => useJoin.getState().reset(),
  applyParams: (p) => useJoin.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Where two shapes meet',
      body: 'A branch pipe meets its main along a curve in space. To cut the branch to fit, you must draw that curve, and then unroll it into a flat pattern.',
      camera: view,
      select: 'branch',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [NOTE('curve of intersection')],
    },
    {
      title: 'Slice it',
      body: 'A cutting plane parallel to both axes meets each cylinder in **straight lines**. Where those lines cross is one point on the curve. Move the plane, and repeat.',
      select: 'plane',
      cites: [NOTE('procedure, steps 2–3')],
      check: {
        question: 'Equal cylinders meet at right angles. What does the curve look like in the elevation?',
        options: ['An ellipse', 'Two straight lines', 'A circle'],
        answer: 1,
        explain: 'It is a mitre: the curve lies in two planes, seen edge-on in the elevation as straight lines at 45°.',
      },
    },
  ],
}

export default scene
