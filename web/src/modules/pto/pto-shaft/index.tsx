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
    },
  ],
}

export default scene
