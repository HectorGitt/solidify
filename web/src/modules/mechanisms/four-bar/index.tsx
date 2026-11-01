import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { useFourBar, type FourBarParams } from './model'
import { FourBarPanel } from './Panel'
import { FLOOR, FourBar3D } from './Scene3D'

const LAB = (where: string) => cite('MEE395', 'MEE395 LAB1-Mechanics of Machines.pdf', where)
const INV = (where: string) => cite('MEE305', 'Inversion of Mechanisms.pdf', where)
const front = { position: [0.4, 0.24, 1.04] as [number, number, number], target: [0, -0.015, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'four-bar',
  title: 'Four-bar linkage rig',
  summary:
    'The four-bar chain on the bench: change any link, fix a different one, and see Grashof’s law decide what it can do. Live transmission angle, mechanical advantage and coupler curve.',
  Viewport: FourBar3D,
  Panel: FourBarPanel,
  camera: front,
  extent: 0.7,
  floorY: FLOOR,
  hatchScale: 0.005,
  timeScale: 1,
  cutPresets: [{ id: 'through', label: 'Through the links', planes: [{ normal: [0, 0, 1], pos: 0.02 }], sectionMoving: true }],
  cites: [LAB('Labs 1–2'), INV('four-bar chain, Grashof')],
  reset: () => useFourBar.getState().reset(),
  applyParams: (p) => useFourBar.getState().set(p as Partial<FourBarParams>),
  tour: [
    {
      title: 'Four links, four pins',
      body: 'The **frame** is fixed. The **crank** drives, the **coupler** carries the force across, and the **output lever** is driven. Four turning pairs leave one degree of freedom: set the crank angle and everything else follows.',
      camera: front,
      cut: false,
      select: null,
      explode: 0,
      playing: true,
      params: { frame: 8, crank: 4, coupler: 12, rocker: 10, branch: 1 },
      cites: [LAB('Lab 1 theory')],
    },
    {
      title: 'Grashof’s law',
      body: 'Take the shortest link **S**, the longest **L** and the other two **P** and **Q**. If **S + L ≤ P + Q**, at least one link can turn fully relative to the rest. Here 4 + 12 < 8 + 10, so it can. With the shortest as the crank, you get a **crank-rocker**.',
      select: 'crank',
      cites: [INV('Grashof’s law, eq 29')],
      check: {
        question: 'Links of 4, 6, 9 and 12 cm. Can any link turn right round?',
        options: ['Yes, the 4 cm link', 'No, none of them can', 'Yes, but only if it is fixed'],
        answer: 1,
        explain: 'S + L = 16 is more than P + Q = 15, so **Grashof’s condition fails**. Whichever link is fixed, every moving link can only swing.',
        reveal: { params: { frame: 6, crank: 4, coupler: 12, rocker: 9 } },
      },
    },
    {
      title: 'Same bars, different mechanism',
      body: 'Fixing a different link of the same chain is an **inversion**. Fix the shortest link and both its neighbours turn fully: a **double crank**. Fix the link opposite the shortest and neither neighbour can: a **double rocker**. The bars have not changed, only what is held still.',
      select: 'frame',
      params: { frame: 4, crank: 8, coupler: 12, rocker: 10 },
      cites: [LAB('Lab 1 steps i–iii'), INV('Inversions of the four-bar chain')],
    },
    {
      title: 'The transmission angle',
      body: 'The angle **γ** between the coupler and the output lever says how well force gets through. At 90° all the coupler’s pull turns the lever; near 0° it mostly pulls along it. γ is at its extremes with the **crank in line with the frame**, which gives two triangles for the cosine rule.',
      select: 'coupler',
      params: { frame: 8, crank: 4, coupler: 12, rocker: 10 },
      cites: [LAB('Lab 1 Q4, Lab 2')],
      check: {
        question: 'Which crank position gives the smallest transmission angle on this rig?',
        options: ['Crank at right angles to the frame', 'Crank in line with the frame', 'Crank at right angles to the coupler'],
        answer: 1,
        explain: 'γ depends only on the diagonal BD. BD is shortest with the crank folded back along the frame, d − r = 4 cm here, which gives **γ = 18.2°**.',
      },
    },
    {
      title: 'Crank radius and output swing',
      body: 'Move the crank pin out through its holes and the output lever swings further, but γ ranges wider too, from 35.7°–47.2° at 1 cm to 18.2°–65.4° at 4 cm. More swing costs force transmission. **A windscreen wiper that sweeps too wide needs a shorter crank.**',
      select: 'rocker',
      params: { crank: 2 },
      cites: [LAB('Lab 2')],
    },
    {
      title: 'Toggle',
      body: 'When crank and coupler fall **in line**, β is 0° or 180° and the output lever is momentarily still. The mechanical advantage **MA = e sin γ / (r sin β)** runs away: a small crank torque holds a huge output load. Stone crushers and toggle clamps work on exactly this.',
      select: 'crank',
      params: { crank: 4 },
      cites: [LAB('Lab 1 theory, Q4')],
    },
    {
      title: 'Coupler curves',
      body: 'Every point on the coupler traces its own closed path, the **coupler curve**. Change any link and watch the orange trace reshape: this is how mechanisms are designed to follow a required path.',
      select: null,
      params: { trace: true },
      cites: [INV('four-bar chain')],
    },
  ],
}

export default scene
