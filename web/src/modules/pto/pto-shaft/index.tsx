import type { SceneDef } from '@/modules/types'
import { B1, C, DEFAULTS, usePtoShaft } from './model'
import { PtoShaftPanel } from './Panel'
import { PtoShaft3D } from './Scene3D'

const home = { position: [-2.6, 1.5, 2.4] as [number, number, number], target: [-0.9, 0.55, 0] as [number, number, number] }
const close = { position: [-1.3, 0.95, 0.9] as [number, number, number], target: [-0.8, 0.55, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'pto-shaft',
  title: 'Telescopic PTO shaft & guards',
  summary:
    'A telescopic PTO drive shaft between the shared tractor and a PTO-driven implement: PTO yoke, two Hooke’s joints, lemon-profile tubes, guard cones and the implement input. Lift the mounted mower or turn a trailed machine and watch the joint angles, shaft length and output-speed fluctuation change; check the BS 1495 midway-hitch rule.',
  Viewport: PtoShaft3D,
  Panel: PtoShaftPanel,
  camera: home,
  extent: 3.5,
  floorY: 0,
  hatchScale: 0.02,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'centre', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'centre',
  cites: [...C.shaft, ...C.uj, ...C.std, ...C.guard],
  reset: () => usePtoShaft.getState().reset(),
  applyParams: (p) => usePtoShaft.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'From PTO to implement',
      body: 'The **PTO drive shaft** joins the tractor PTO (1) to the implement’s power input connection (2): **PTO yoke** (3), two **Hooke’s joints**, a **telescopic lemon-profile shaft** (5), the **PIC yoke** (4) and **guard cones** (6).',
      camera: home,
      cut: false,
      select: 'pto-driveline',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: C.shaft,
    },
    {
      title: '540 or 1000 rpm',
      body: 'The PTO yoke slides onto the stub: **540 rpm, 6 splines, Ø35 mm** or **1000 rpm, 21 splines, Ø44 mm**. The stub turns clockwise viewed from the rear.',
      camera: close,
      select: 'pto-yoke',
      params: { std: '540' },
      cites: C.std,
      check: {
        question: 'For the same power, how does the torque on a 1000 rpm shaft compare with a 540 rpm shaft?',
        options: ['About 54 % of it', 'About 185 % of it', 'The same torque'],
        answer: 0,
        explain: 'Power = torque × angular speed, so at the same power **torque ∝ 1/N**: 540/1000 = 0.54. Less torque is why larger machines use 1000 rpm.',
        reveal: { params: { std: '1000' } },
      },
    },
    {
      title: 'Lifting changes angles and length',
      body: 'Raise the mower: both joint angles grow and the **telescopic tubes** slide. Keep enough overlap at the longest position and never let the tubes bottom at the shortest.',
      camera: home,
      select: 'inner-tube',
      params: { mode: 'mounted', hitch: 0.85 },
      cites: C.shaft,
    },
    {
      title: 'Two joints cancel',
      body: 'One Hooke’s joint makes the output speed swing twice a revolution. With **equal angles**, all shafts in **one plane** and the **intermediate yokes in line**, the second joint cancels the first.',
      camera: close,
      select: 'crosses',
      params: { mode: 'trailed', gamma: 50, b2: B1, phaseErr: 0 },
      cites: C.uj,
      check: {
        question: 'A yoke on the telescopic shaft is refitted a quarter-turn out of line. What does the implement get?',
        options: ['A steady speed, since the angles are still equal', 'A bigger speed swing than one joint alone', 'A smaller speed swing than one joint alone'],
        answer: 1,
        explain: 'With the intermediate yokes **90° out of line**, the second joint adds its swing to the first instead of cancelling it, even with equal angles.',
        reveal: { params: { phaseErr: 90 } },
      },
    },
    {
      title: 'BS 1495: pin midway',
      body: 'For a trailed machine the drawbar pin should be **midway between the joints**; otherwise the angles become unequal in turns and the implement is driven unevenly. Move b₂ and see the chart.',
      camera: { position: [-0.9, 2.6, 0.6], target: [-0.8, 0.5, 0] },
      select: 'implement',
      params: { mode: 'trailed', gamma: 50, b2: 0.5 },
      cites: C.uj,
    },
    {
      title: 'Guard it',
      body: 'A 540 rpm shaft wraps **7 ft of string in one second**. The tractor master shield must carry **114 kg**, and the shaft is guarded up to the implement’s first bearing by cones and tubes that stay still.',
      camera: home,
      select: 'guards',
      params: { ...DEFAULTS },
      cites: C.guard,
      check: {
        question: 'Why are the guard cones and tubes made to stay still while the shaft turns inside them?',
        options: ['To keep the grease in the joints and the dirt out', 'To cut the air drag on the shaft at 540 rpm', 'So clothing that touches them is not caught and wound in'],
        answer: 2,
        explain: 'A bare 540 rpm shaft wraps **7 ft of string in one second**. A guard that does not turn cannot catch clothing or hair, so brushing against it is harmless.',
      },
    },
  ],
}

export default scene
