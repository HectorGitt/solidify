import type { SceneDef } from '@/modules/types'
import { A503 } from '../_shared/cites'
import { DEFAULTS, useCB } from './model'
import { ClutchBrakePanel, MODE_CAMERA, PRESETS } from './Panel'
import { ClutchBrake3D, FLOOR } from './Scene3D'

const scene: SceneDef = {
  id: 'clutch-brake',
  title: 'Clutch & brake design',
  summary:
    'A multiple-disc clutch squeezing its steel and bronze plates together, a cone clutch, a single-shoe brake with its self-locking condition, and a 280° band brake — each with worked examples.',
  Viewport: ClutchBrake3D,
  Panel: ClutchBrakePanel,
  camera: MODE_CAMERA.disc,
  extent: 1.2,
  floorY: FLOOR,
  hatchScale: 0.002,
  timeScale: 1 / 10,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
    { id: 'top', label: 'Plan section', planes: [{ normal: [0, 1, 0], pos: -0.37 }], sectionMoving: true },
  ],
  defaultPreset: 'all',
  cites: [A503.m(8, 'Clutches'), A503.m(9, 'Brake design'), A503.mg15('Q5'), A503.mg16('Q5'), A503.mg19('Q6')],
  reset: () => useCB.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useCB.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'A multiple-disc clutch',
      body:
        'A **clutch** connects and disconnects two shafts. Steel plates **A** slide on the splines of shaft **C**; bronze plates **B** slide in the splines of member **D**. Squeezed together by the axial force F, every pair of touching faces transmits torque: with 5 steel and 4 bronze plates there are **n = 5 + 4 − 1 = 8** pairs.',
      camera: MODE_CAMERA.disc,
      cut: 'all',
      select: null,
      explode: 0,
      playing: true,
      params: { preset: 'mg16' },
      cites: [A503.m(8, 'Fig 14-1, slides 2–4'), A503.mg16('Q5b')],
    },
    {
      title: 'Engage and release',
      body: 'With the force released, gaps open in the pack and **D coasts down**. Engaged, the plates lock and D turns with C. The torque capacity is **T = F f R_f n**: 16 N·m here.',
      camera: { position: [0.06, -0.33, 0.14], target: [0.012, -0.37, 0] },
      params: { engage: 0.2 },
      select: 'bronze-plates',
      cites: [A503.m(8, 'slide 4'), A503.mg16('Q5d')],
    },
    {
      title: 'The cone clutch',
      body: 'A cone clutch works by the **wedging** of the cone in the cup: the axial force F gives a normal force F/sin α on the face, so **T = F f R_f / sin α**. A small cone angle gives a big torque — but too small and the cone sticks.',
      camera: MODE_CAMERA.cone,
      params: { preset: 'cone', engage: 1 },
      select: 'lining',
      cites: [A503.m(8, 'slides 6–9')],
    },
    {
      title: 'Single shoe brake',
      body:
        'A **brake** connects a moving part to the frame. The 360 mm drum sustains 225 N·m: **N = T/fR = 2083 N**. Taking moments about the pivot, the lever force is **805 N** clockwise, where the friction helps, and **861 N** counter-clockwise.',
      camera: MODE_CAMERA.shoe,
      cut: false,
      params: { preset: 'shoe' },
      select: 'lever',
      cites: [A503.m(9, 'Example 1'), A503.mg15('Q5c')],
    },
    {
      title: 'Self-locking and heat',
      body: 'Move the pivot further below the friction line: when **c ≥ a/f = 1.2 m** the lever force falls to zero and the brake applies itself. The energy absorbed becomes heat: **H_g = fNV = 11.8 kW** at 500 rpm.',
      camera: { position: [0.1, 0.45, 0.9], target: [-0.1, 0.3, 0] },
      select: 'pivot',
      params: { c: 1.0 },
      cites: [A503.m(9, 'Example 1d–e')],
    },
    {
      title: 'The band brake',
      body: 'A band wrapped 280° round a Ø450 drum. Like a belt that cannot move, **F₁/F₂ = e^(fα) = 2.66**; with T = (F₁ − F₂)r = 170 N·m, **F₁ = 1210 N** on the fixed pivot and **F₂ = 455 N** on the lever.',
      camera: MODE_CAMERA.band,
      params: { preset: 'band' },
      select: 'band',
      cites: [A503.m(9, 'Example 2')],
    },
  ],
}

export default scene
