import type { SceneDef } from '@/modules/types'
import { A503 } from '../_shared/cites'
import { DEFAULTS, useGears } from './model'
import { GearsPanel, MODE_CAMERA, PRESETS } from './Panel'
import { FLOOR, Gears3D } from './Scene3D'

const scene: SceneDef = {
  id: 'gears',
  title: 'Gears & gear forces',
  summary:
    'A spur pair with every nomenclature circle drawn on it, a helical pair and a straight bevel pair with their tangential, radial and axial force arrows, and the A–B–C idler train — each with its forces worked out.',
  Viewport: Gears3D,
  Panel: GearsPanel,
  camera: MODE_CAMERA.spur,
  extent: 0.9,
  floorY: FLOOR,
  hatchScale: 0.003,
  timeScale: 1,
  cutPresets: [
    { id: 'mid-face', label: 'Across the teeth (mid-face)', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
    { id: 'axes', label: 'Through the shaft axes', planes: [{ normal: [0, -1, 0], pos: 0 }], sectionMoving: true },
    { id: 'housing', label: 'Housing only', planes: [{ normal: [0, 0, 1], pos: -0.045 }] },
  ],
  defaultPreset: 'housing',
  cites: [A503.m(5, 'Gear forces'), A503.mg15('Q3'), A503.mg16('Q3'), A503.mg17('Q2–3'), A503.mg19('Q3'), A503.mg21('Q2–3')],
  reset: () => useGears.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useGears.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'A spur gear pair',
      body:
        'Spur gears have teeth cut **parallel to the shaft axis**. They suit high ratios over the shortest distances and transmit motion exactly, but they cost more, need lubrication and are hard to install.\n\nThe Ø100 pinion (20 teeth, module 5) drives the Ø250 gear (50 teeth).',
      camera: MODE_CAMERA.spur,
      cut: false,
      select: null,
      explode: 0,
      playing: true,
      params: { preset: 'spur' },
      cites: [A503.m(1, 'merits of gears'), A503.mg15('Q1a')],
    },
    {
      title: 'Nomenclature',
      body:
        'Switch **labels** on. The **pitch circles** (gold) roll on each other at the **pitch point**. The **addendum circle** bounds the tooth tips, the **dedendum circle** the bottom land. **Module** m = D/N = 5 mm and **circular pitch** P_c = πD/N, so P_c/m = π. The **line of action** is the common normal to the touching teeth; its angle to the common tangent is the **pressure angle** φ = 20°.',
      camera: { position: [-0.04, 0.05, 0.3], target: [-0.06, 0.01, 0] },
      select: 'pinion',
      cites: [A503.m(5, 'slides 2–6'), A503.mg15('Q3a'), A503.mg21('Q3a')],
    },
    {
      title: 'Spur gear forces',
      body:
        'With 200 N·m on the Ø100 pinion, **Fₜ = Mₜ/r = 4000 N** acts along the common tangent and the **separating force Fᵣ = Fₜ tan φ = 1456 N** pushes the gears apart, always toward the gear centre.',
      camera: { position: [0.05, 0.08, 0.45], target: [-0.02, 0, 0] },
      select: null,
      cut: 'mid-face',
      cites: [A503.m(5, 'Example 1'), A503.mg19('Q3b')],
    },
    {
      title: 'Helical gears push endwise',
      body:
        'Helical teeth are inclined at the **helix angle** α to the axis: they engage gradually and run quietly, but the tooth force now has an **axial thrust Fₐ = Fₜ tan α**. With 200 N·m on the Ø250 gear, φ = 27° and α = 30°: Fₜ = 1600 N, Fᵣ = 815 N, Fₐ = 924 N.',
      camera: MODE_CAMERA.helical,
      cut: false,
      params: { preset: 'helical' },
      cites: [A503.m(5, 'slides 9–12'), A503.mg16('Q3b'), A503.mg19('Q3c')],
    },
    {
      title: 'Straight bevel gears',
      body:
        'Bevel gears join **intersecting shafts**. Their pitch cones share an apex; for a 4 : 3 pair the pinion cone angle has sin β = 0.6. The tangential force acts at the **mean radius** r_m = 60 mm, and the separating force splits into the **pinion thrust Fₚ = Fₜ tan φ sin β** and **gear thrust F_g = Fₜ tan φ cos β**.',
      camera: MODE_CAMERA.bevel,
      params: { preset: 'bevel' },
      select: 'pinion',
      cites: [A503.m(5, 'slides 13–15'), A503.mg15('Q3c')],
    },
    {
      title: 'An idler train',
      body:
        'Gear B is an **idler**: it reverses the direction but carries no torque, so C turns at N_A·z_A/z_C = 466.7 rpm whatever B’s size. Its shaft, however, carries both tooth loads: their vector sum depends on the angle ABC.',
      camera: MODE_CAMERA.idler,
      params: { preset: 'idler' },
      select: 'gear-b',
      cites: [A503.mg17('Q2c'), A503.mg21('Q2c')],
    },
  ],
}

export default scene
