import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { HJ2 } from '../shared/cites'
import { DEFAULTS, RIG, useDC } from './model'
import { DoubleCardanPanel } from './Panel'
import { DoubleCardan3D, MS1718 } from './Scene3D'

const home = { position: [0.4, 0.72, 1.3] as [number, number, number], target: [0.1, -0.03, -0.08] as [number, number, number] }

const scene: SceneDef = {
  id: 'double-cardan',
  title: 'Double joints & phasing',
  summary:
    "Two Hooke's joints joined by a telescopic shaft, as on every PTO drive shaft. Change the joint angles, the intermediate yoke phase and the plane of the second joint, or turn the tractor with the hitch midway or off-centre, and watch the second joint cancel — or add to — the first joint's speed fluctuation.",
  Viewport: DoubleCardan3D,
  Panel: DoubleCardanPanel,
  camera: home,
  extent: 1.5,
  floorY: -RIG.drop,
  hatchScale: 0.004,
  timeScale: 1 / 40,
  cutPresets: [
    { id: 'plan', label: 'Bearings, plan section', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'joints', label: 'Joints, plan section', planes: [{ normal: [0, 1, 0], pos: 0 }], sectionMoving: true },
    { id: 'front', label: 'Front section', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'plan',
  cites: [HJ2('§26.2.3, Figs 26.11–26.14'), SRC.top510('p4–5'), SRC.uj502('p2, Fig 3'), SRC.hj502('double Hooke’s joint, joint phasing, cancelling angles'), MS1718('Q4(b), Q4(d)')],
  reset: () => useDC.getState().reset(),
  applyParams: (p) => useDC.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Two joints instead of one',
      body:
        "A single Hooke's joint makes the driven shaft speed up and slow down twice a revolution. A tractor PTO shaft therefore always has **two joints** with a **telescopic** shaft between them. Here both joints work at 20°, and the output flywheel turns exactly with the input — watch the two red marks.",
      camera: home,
      cut: 'plan',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 40,
      params: { mode: 'rig', delta1: 20, delta2: 20, equal: true, phase: 0, twist: 0, arrangement: 'W', rpm: 1000 },
      cites: [SRC.top510('p5'), SRC.uj502('Fig 3')],
    },
    {
      title: 'The intermediate shaft still fluctuates',
      body:
        'The shaft between the joints is the output of joint 1, so it still swings between **939.7 and 1064 rpm**. Joint 2 is driven by this uneven shaft a quarter of a turn out of phase, so it slows the output exactly when the intermediate shaft speeds up. The intermediate shaft should therefore be light.',
      camera: { position: [0.3, 0.42, 0.62], target: [0.22, 0, -0.06] },
      select: 'intermediate',
      cites: [HJ2('§26.2.3, Figs 26.11, 26.13')],
    },
    {
      title: 'Condition 3: yokes in line',
      body:
        'Twist one end of the intermediate shaft 90° and the two joints **add** their fluctuations instead of cancelling: the output now swings between cos²δ and 1/cos²δ. The yokes on the intermediate shaft must be **in line**.',
      camera: { position: [0.62, 0.5, 0.7], target: [0.3, 0, -0.08] },
      select: 'inner',
      params: { phase: 90 },
      cites: [SRC.top510('p5'), SRC.hj502('joint phasing')],
    },
    {
      title: 'Condition 2: equal angles',
      body:
        'With the yokes in line again, make the second angle 15° while the first stays 20°. A smaller second joint only partly cancels the first, so some fluctuation remains.',
      camera: home,
      select: 'cross-2',
      params: { phase: 0, equal: false, delta1: 20, delta2: 15, arrangement: 'Z' },
      cites: [MS1718('Q4(d)')],
    },
    {
      title: 'Condition 1: one plane',
      body:
        "Equal angles and yokes in line are not enough if joint 2 bends in a different plane. Twisting its plane by γ acts exactly like a yoke phase error of γ; at 90° it is as bad as yokes 90° out of line.",
      camera: { position: [0.9, 0.55, 0.9], target: [0.3, -0.03, -0.1] },
      select: 'output',
      params: { equal: true, delta1: 20, delta2: 20, arrangement: 'W', twist: 90 },
      cites: [SRC.top510('p5')],
    },
    {
      title: 'Turning: keep the hitch midway',
      body:
        'On a tractor the joint angles are set by the turn. If the hitch pin is **midway** between the two joints, both angles stay equal (ψ/2) in any turn. If it is not, the angles become unequal and the implement shaft speed fluctuates — the reason for the hitch and PTO dimensions in **BS 1495**.',
      camera: { position: [0.3, 1.2, 0.9], target: [0.2, -0.05, -0.15] },
      select: null,
      params: { mode: 'turn', psi: 40, hitch: 0.25, twist: 0 },
      cites: [SRC.top510('p5 BS 1495 Part 1:1970')],
    },
    {
      title: 'Check the charts and conditions',
      body:
        'Open **Controls**. The charts show the intermediate and output speeds with a live marker, the checklist tests the three conditions, and the **Working** follows both joints through the 20° + 15° pair at θ = 30°.',
      camera: home,
      params: { mode: 'rig', delta1: 20, delta2: 15, equal: false, phase: 0, twist: 0, arrangement: 'Z' },
      explode: 0,
      cites: [MS1718('Q4(d)')],
    },
  ],
}

export default scene
