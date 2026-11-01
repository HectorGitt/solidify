import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useGov } from './model'
import { GovernorPanel, PRESETS } from './Panel'
import { FLOOR, Governor3D } from './Scene3D'

const NOTE = (where: string) => cite('MEE306', 'Chapter 6 - Governors.pdf', where)
const view = { position: [0.75, 0.3, 2.35] as [number, number, number], target: [0, -0.04, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'governors',
  title: 'Watt, Porter & Hartnell governors',
  summary: 'Spin up three governors and watch the balls climb: read the sleeve lift, the speed range and the controlling force, and see what makes one stable.',
  Viewport: Governor3D,
  Panel: GovernorPanel,
  camera: view,
  extent: 1.2,
  floorY: FLOOR,
  hatchScale: 0.008,
  timeScale: 1 / 20,
  cutPresets: [{ id: 'axis', label: 'Through the spindle', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('6.3–6.7, Solved Examples')],
  reset: () => useGov.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useGov.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'The Watt governor',
      body: 'Speed flings the balls out and gravity pulls them in. They settle at height **h = g/ω²**, whatever the ball’s mass. As the balls rise they lift the **sleeve**, and the sleeve moves the throttle. Speed is slowed to 1/20 here, so you can follow it.',
      camera: view,
      cut: false,
      select: 'ball-r',
      explode: 0,
      playing: true,
      params: { preset: 'watt' },
      cites: [NOTE('6.3–6.4')],
      check: {
        question: 'A Watt governor’s balls are made twice as heavy. What happens to its height at a given speed?',
        options: ['It doubles', 'It halves', 'It stays the same'],
        answer: 2,
        explain: 'Both the outward force and the weight double, so **mass cancels out** of h = g/ω². Speed is the only thing that sets the height.',
      },
    },
    {
      title: 'The Porter governor',
      body: 'A heavy **central load** on the sleeve adds to the downward pull, so the governor runs much faster, and has far more force available to move the throttle. The example runs from **170.6 rpm to 185.5 rpm** over 36 mm of lift.',
      select: 'load',
      params: { preset: 'porter' },
      cites: [NOTE('6.5, Example 1')],
    },
    {
      title: 'The Hartnell governor',
      body: 'A **spring** replaces the load, and **bell cranks** turn the balls’ outward swing into lift. It is compact, can run at high speed, and works in any position. The stiffness sets how much speed it takes to move the sleeve.',
      select: 'spring',
      params: { preset: 'hartnell' },
      cites: [NOTE('6.6, Example 2')],
    },
    {
      title: 'Stability',
      body: 'Plot controlling force against radius. A governor is **stable** if a bigger radius needs a higher speed. If the speed is the same at every radius it is **isochronous**: the sleeve has no definite position, and it dashes from stop to stop. Slightly stable is what you want: it responds without **hunting**.',
      select: 'sleeve',
      cites: [NOTE('6.7')],
      check: {
        question: 'What causes a governor’s sleeve to run to one extreme position?',
        options: ['A small speed change, if it is very nearly isochronous', 'A heavier ball on one side', 'A very stiff spring'],
        answer: 0,
        explain: 'Near-isochronous governors need almost no speed change for a large sleeve movement, so a small disturbance sends the sleeve **to a stop**. The engine then over-corrects, and hunts.',
      },
    },
  ],
}

export default scene
