import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { useOldham, type OldhamParams } from './model'
import { OldhamPanel } from './Panel'
import { FLOOR, Oldham3D } from './Scene3D'

const LAB = (where: string) => cite('MEE395', 'MEE395 LAB1-Mechanics of Machines.pdf', where)
const INV = (where: string) => cite('MEE305', 'Inversion of Mechanisms.pdf', where)
const view = { position: [1.05, 0.46, 0.92] as [number, number, number], target: [0, -0.04, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'oldham',
  title: 'Oldham coupling',
  summary: 'Joining two parallel shafts that are out of line: a central disc slides on two tongues, turning at shaft speed while its centre runs round a small circle.',
  Viewport: Oldham3D,
  Panel: OldhamPanel,
  camera: view,
  extent: 0.9,
  floorY: FLOOR,
  hatchScale: 0.006,
  timeScale: 1,
  cutPresets: [{ id: 'axis', label: 'Through the axes', planes: [{ normal: [0, 1, 0], pos: 0 }], sectionMoving: true }],
  cites: [LAB('Lab 8'), INV('double-slider crank chain')],
  reset: () => useOldham.getState().reset(),
  applyParams: (p) => useOldham.getState().set(p as Partial<OldhamParams>),
  tour: [
    {
      title: 'Parallel, but out of line',
      body: 'These two shafts are parallel but offset. Each ends in a disc with a single **tongue** across its diameter, and a **central disc** between them has a groove on each face, at right angles.',
      camera: view,
      cut: false,
      select: 'disc',
      explode: 0,
      playing: true,
      params: { d: 30, rpm: 20, trace: true },
      cites: [LAB('Lab 8 theory')],
    },
    {
      title: 'Take it apart',
      body: 'Pull the three pieces apart to see the tongues and grooves. Each tongue is a good sliding fit in its groove, so the disc can only slide along one tongue and along the other: **two sliding pairs at right angles**.',
      explode: 1,
      select: 'driven',
      cites: [LAB('Lab 8 theory')],
    },
    {
      title: 'The path of the centre',
      body: 'The disc’s centre lies on both tongues, which are always at right angles. A right angle standing on the fixed line between the shaft axes means the centre runs round a **circle whose diameter is the offset**.',
      explode: 0,
      select: 'disc',
      cites: [LAB('Lab 8 Q1')],
      check: {
        question: 'The shafts turn at 20 rpm. How fast does the disc’s centre go round its circle?',
        options: ['10 rpm', '20 rpm', '40 rpm'],
        answer: 2,
        explain: 'An angle at the circumference is half the angle at the centre, so the centre of the disc goes round at **twice shaft speed**: 40 rpm, though the disc itself turns at only 20 rpm.',
      },
    },
    {
      title: 'What goes wrong',
      body: 'The velocity ratio is exactly 1, but the tongues **slide** on every revolution, up to **v = ω d**. That means friction and wear, then backlash, and the off-centre disc shakes at speed. Lubrication, a light disc and sprung pre-load help; large offsets or high speeds rule it out.',
      select: 'driving',
      params: { d: 50 },
      cites: [LAB('Lab 8 Q2–4')],
    },
  ],
}

export default scene
