import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, Diagram3D, DiagramPanel, FLOOR, useDiagram } from './Rig'

const V = (where: string) => cite('MEE305', 'Velocity in Mechanisms.pdf', where)
const A = (where: string) => cite('MEE305', 'Acceleration in Mechanisms.pdf', where)
const view = { position: [0.42, 0.26, 2.1] as [number, number, number], target: [0.02, 0.02, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'velocity-diagram',
  title: 'Velocity & acceleration diagrams',
  summary: 'The polygons you would draw by hand, drawn live for a real linkage: move the crank and watch them close, with the instantaneous centre on the rig.',
  Viewport: Diagram3D,
  Panel: DiagramPanel,
  camera: view,
  extent: 1,
  floorY: FLOOR,
  hatchScale: 0.007,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the links', planes: [{ normal: [0, 0, 1], pos: 0.02 }], sectionMoving: true }],
  cites: [V('relative velocity method'), A('acceleration diagrams')],
  reset: () => useDiagram.getState().reset(),
  applyParams: (p) => useDiagram.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Start from what you know',
      body: 'The crank turns at a known speed, so its pin moves at **v = ω × AB**, at right angles to the crank. That single vector is the only thing you know at the start.',
      camera: view,
      cut: false,
      select: 'crank',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [V('velocity of a point on a link')],
    },
    {
      title: 'Crossing two lines',
      body: 'C is on the coupler, so relative to B it moves **at right angles to BC**. C is also on the output lever, so it moves **at right angles to DC**. Draw both lines on the diagram; where they cross fixes C’s velocity.',
      select: 'coupler',
      cites: [V('relative velocity method')],
      check: {
        question: 'Two points on the same rigid link: which way is one’s velocity relative to the other?',
        options: ['Along the line joining them', 'At right angles to the line joining them', 'It depends on the speed'],
        answer: 1,
        explain: 'A rigid link cannot stretch, so there is no relative motion **along** it: all of it is across it, at right angles.',
      },
    },
    {
      title: 'The instantaneous centre',
      body: 'At any instant the coupler is turning about one point, which has no velocity: the **instantaneous centre**, in purple. It is where the crank’s line and the output lever’s line cross. Each point’s speed is ω₃ × its distance from it.',
      select: null,
      params: { run: true },
      cites: [V('instantaneous centre')],
    },
    {
      title: 'Acceleration has two parts',
      body: 'Each point has a **centripetal** part, ω²r towards its centre, already known from the velocity diagram, and a **tangential** part, αr, at right angles to its link. Again two routes reach C, and they close at one point.',
      params: { run: false, angle: 60 },
      select: 'rocker',
      cites: [A('acceleration of a point on a link')],
    },
    {
      title: 'The slider-crank',
      body: 'Here C can only move **along the line of stroke**, so that is the second line on each diagram. The rod’s motion comes out just the same way. The slider’s velocity is zero at the dead centres, and its acceleration there is **ω²r(1 ± 1/n)**.',
      params: { mech: 'slider', crank: 0.05, coupler: 0.2, run: true },
      select: 'slider',
      cites: [V('slider-crank mechanism'), A('slider-crank mechanism')],
    },
  ],
}

export default scene
