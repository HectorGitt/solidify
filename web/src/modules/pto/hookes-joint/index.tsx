import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { HJ2 } from '../shared/cites'
import { DEFAULTS, RIG, useHooke } from './model'
import { HookePanel } from './Panel'
import { HookeScene3D } from './Scene3D'

const scene: SceneDef = {
  id: 'hookes-joint',
  title: "Hooke's joint",
  summary:
    "A single Hooke's (cardan) joint on a test rig: forged yokes, a cross on needle-roller cups, and a driven shaft that speeds up and slows down twice per revolution. Change the shaft angle and watch ω₂/ω₁, the acceleration and the angular lag live.",
  Viewport: HookeScene3D,
  Panel: HookePanel,
  camera: { position: [0.32, 0.5, 0.95], target: [-0.06, -0.03, 0] },
  extent: 1.25,
  floorY: -RIG.drop,
  hatchScale: 0.004,
  timeScale: 1 / 40,
  cutPresets: [
    { id: 'plan', label: 'Bearings, plan section', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'joint-plan', label: 'Joint, plan section', planes: [{ normal: [0, 1, 0], pos: 0 }], sectionMoving: true },
    { id: 'joint-front', label: 'Joint, front section', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 1, 0], pos: 0 }, { normal: [0, 0, 1], pos: 0 }], intersection: true, sectionMoving: true },
  ],
  defaultPreset: 'plan',
  cites: [SRC.hj502('slides 1–5'), HJ2('§26.2.1–26.2.2, Example 26.3'), SRC.uj502('p1–3'), SRC.top510('p4–5'), cite2017()],
  reset: () => useHooke.getState().reset(),
  applyParams: (p) => useHooke.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: "Hooke's joint",
      body:
        "A **Hooke's joint** (universal joint, cardan, Hardy Spicer) connects two shafts whose axes **intersect at an angle**. It carries the drive from a tractor PTO to an implement, and from a gearbox to an axle.\n\nHere a constant-speed motor turns the driving shaft at **1000 rpm** and the joint works at **δ = 20°**.",
      camera: { position: [0.32, 0.5, 0.95], target: [-0.06, -0.03, 0] },
      cut: 'plan',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 40,
      params: { delta: 20, rpm: 1000 },
      cites: [SRC.hj502('definition, uses'), SRC.uj502('p1')],
    },
    {
      title: 'Two yokes and a cross',
      body:
        'Each shaft ends in a U-shaped **yoke** (fork). A **cross** (spider) with four arms at right angles joins them: one pair of arms pivots in the driving yoke, the other pair in the driven yoke. Torque passes through the cross.',
      camera: { position: [0.2, 0.22, 0.32], target: [0, 0, 0] },
      select: 'spider',
      explode: 0.6,
      cites: [SRC.hj502('components'), SRC.uj502('Fig 2')],
    },
    {
      title: 'Needle-roller cups',
      body:
        'Each trunnion runs in a hardened **cup** of **needle rollers**, pressed into the yoke ear and held by a circlip. The section shows the rollers between trunnion and cup. They only rock to and fro, so they must be greased: a dry joint indents and starts to **clonk**.',
      camera: { position: [0.1, 0.24, 0.2], target: [0, 0, 0] },
      select: 'needles',
      cut: 'joint-plan',
      explode: 0,
      playing: false,
      cites: [HJ2('§26.2.1')],
    },
    {
      title: 'Fast, slow, fast, slow',
      body:
        'With the driver at constant speed the driven shaft does **not** turn uniformly:\n\nω_B/ω_A = cos δ / (1 − sin²δ cos²θ)\n\nIt is fastest (ω_A/cos δ) when the driving yoke lies in the plane of the shafts, and slowest (ω_A cos δ) a quarter turn later — twice each per revolution. Watch the red marks drift apart and back.',
      camera: { position: [0.55, 0.62, 0.95], target: [0, -0.03, 0] },
      select: 'output',
      cut: 'plan',
      playing: true,
      timeScale: 1 / 60,
      cites: [SRC.uj502('p2–3'), HJ2('§26.2.2')],
    },
    {
      title: 'Bigger angle, bigger fluctuation',
      body:
        'At **40°** the speed swings from 0.77 to 1.31 times the input and the driven shaft runs up to **7.6° ahead and behind** — a total swing of about 15°. Below about 5–10° the effect is small.',
      camera: { position: [0.45, 0.8, 0.75], target: [0, -0.05, 0] },
      params: { delta: 40 },
      select: 'gauge',
      cites: [SRC.top510('p4–5'), HJ2('Fig 26.9')],
    },
    {
      title: 'Inertia torque',
      body:
        'Speeding up and slowing down a heavy driven part needs torque: T = I·α_B. For example, a 147 N mass with k = 0.25 m at 20° and 1000 rpm needs about **1.27 kN·m** at θ = 45° — which is why a single joint is unsuitable at high speed.',
      camera: { position: [0.65, 0.35, 0.7], target: [0.25, -0.02, -0.05] },
      params: { delta: 20, rpm: 1000, weight: 147, k: 0.25, thetaProbe: 45 },
      select: 'mass',
      cites: [HJ2('Example 26.3'), SRC.hj502('disadvantages')],
    },
    {
      title: 'Speed table and charts',
      body:
        'Open **Controls**. The **speed table** lists the driven speed for θ = 10°…90°. The charts show the velocity ratio, the acceleration and the position error with a live marker.\n\nTo cancel the fluctuation, use **two joints** — see the next scene.',
      camera: { position: [0.32, 0.5, 0.95], target: [-0.06, -0.03, 0] },
      select: null,
      params: { delta: 20, rpm: 1000 },
      cites: [cite2017()],
    },
  ],
}

function cite2017() {
  return { course: 'AEE502' as const, file: 'AEE 502 -2017-2018-marking scheme.docx', where: 'Q4(d)' }
}

export default scene
