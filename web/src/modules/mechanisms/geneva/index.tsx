import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { useGeneva, type GenevaParams } from './model'
import { GenevaPanel } from './Panel'
import { FLOOR, Geneva3D } from './Scene3D'

const LAB = (where: string) => cite('MEE395', 'MEE395 LAB1-Mechanics of Machines.pdf', where)
const view = { position: [0.42, 0.3, 2.05] as [number, number, number], target: [0.02, -0.03, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'geneva',
  title: 'Geneva wheel',
  summary: 'Steady rotation in, stop-start motion out: change the number of slots and read the stepping angle, the dwell, and the output speed and acceleration.',
  Viewport: Geneva3D,
  Panel: GenevaPanel,
  camera: view,
  extent: 1,
  floorY: FLOOR,
  hatchScale: 0.007,
  timeScale: 1,
  cutPresets: [{ id: 'through', label: 'Through the wheels', planes: [{ normal: [0, 0, 1], pos: 0.014 }], sectionMoving: true }],
  cites: [LAB('Lab 7')],
  reset: () => useGeneva.getState().reset(),
  applyParams: (p) => useGeneva.getState().set(p as Partial<GenevaParams>),
  tour: [
    {
      title: 'Stop-start from steady rotation',
      body: 'Most machines are driven at steady speed, yet a filling head or a film gate needs a part to **move, stop, then move again**. The Geneva wheel does it: one slot forward for each turn of the driver, and locked solid in between.',
      camera: view,
      cut: false,
      select: 'wheel',
      explode: 0,
      playing: true,
      params: { slots: 6, rpm: 15 },
      cites: [LAB('Lab 7 theory')],
    },
    {
      title: 'The pin enters on the tangent',
      body: 'The pin meets each slot square to the wheel’s radius, so the wheel **starts from rest** with no sudden jump in speed. This is why the mechanism suits intermittent motion: the shock of engagement is small.',
      select: 'pin',
      cites: [LAB('Lab 7 theory')],
      check: {
        question: 'A six-slot wheel: how far does the driver turn while the wheel makes one step?',
        options: ['60°', '120°', '180°'],
        answer: 1,
        explain: 'The wheel steps **60°**, but the driver is engaged for **180° − 60° = 120°**. For the other 240° the wheel stands still.',
      },
    },
    {
      title: 'Locked between steps',
      body: 'The driver’s curved disc rides in the wheel’s concave arc, so the wheel cannot drift while the pin is away. The disc’s **relief** clears the wheel’s tips just as the pin arrives.',
      select: 'driver',
      cites: [LAB('Lab 7 diagram')],
    },
    {
      title: 'Designing for five steps',
      body: 'Each step is **360°/n**, so five steps means **72°**. Choose the pin radius a, then the centre distance is **c = a / sin(π/n)**: the pin has to enter on the tangent. Slide the slot count and watch the shafts’ proportions follow.',
      params: { slots: 5 },
      select: 'wheel',
      cites: [LAB('Lab 7 procedure step 5')],
      check: {
        question: 'As the number of slots rises, what share of the time is the wheel moving?',
        options: ['A larger share', 'A smaller share', 'The same share'],
        answer: 0,
        explain: 'The moving share is **(n − 2)/2n**: 25 % with 4 slots, 33 % with 6 and 37.5 % with 8. It tends towards a half.',
      },
    },
    {
      title: 'The Geneva stop',
      body: 'Leave one slot closed and the pin can only make a limited number of turns before it strikes the closed slot, and all motion ceases. This **Geneva stop** is used in watches and similar devices, to prevent overwinding.',
      params: { slots: 6, stop: true, rpm: 40 },
      select: 'pin',
      cites: [LAB('Lab 7 theory')],
    },
  ],
}

export default scene
