import type { SceneDef } from '@/modules/types'
import { A503 } from '../_shared/cites'
import { DEFAULTS, useSW } from './model'
import { PRESETS, SpringsWeldsPanel } from './Panel'
import { FLOOR, SpringsWelds3D } from './Scene3D'

const scene: SceneDef = {
  id: 'springs-welds',
  title: 'Springs & welded joints',
  summary:
    'A helical compression spring under live load (Wahl factor, stress, deflection, stiffness), a laminated leaf spring with graduated and pre-stressed full-length leaves, fillet-weld throats and the two weld design examples — plus the rope-winch capstan.',
  Viewport: SpringsWelds3D,
  Panel: SpringsWeldsPanel,
  camera: { position: [0.13, 0.02, 0.26], target: [0, -0.09, 0] },
  extent: 1.2,
  floorY: FLOOR,
  hatchScale: 0.0025,
  timeScale: 1,
  cutPresets: [
    { id: 'half', label: 'Half section (cut the wire, leaves and welds)', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
    { id: 'housing', label: 'Half section, springs whole', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'side', label: 'Side section', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'housing',
  cites: [A503.m(10, 'springs'), A503.m(11, 'welding'), A503.m(6, 'ropes and hoists'), A503.mg21('Q4d'), A503.mg17('Q4c, Q5')],
  reset: () => useSW.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useSW.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'A helical compression spring',
      body:
        'A spring is an elastic body that distorts under load and recovers when the load is removed. This close-coiled helical spring (helix angle under 10°) carries **500 N** and deflects **25 mm**: stiffness k = F/y = **20 N/mm**.\n\nDrag the load on the Controls tab and watch it compress — and close solid if you overdo it.',
      camera: { position: [0.13, 0.02, 0.26], target: [0, -0.09, 0] },
      cut: false,
      select: 'spring',
      explode: 0,
      params: { preset: 'mg21-wahl' },
      cites: [A503.m(10, 'slides 2–3, 13'), A503.mg21('Q4d')],
    },
    {
      title: 'Stress in the wire: the Wahl factor',
      body:
        'Cut through, each turn of wire is a bar in **torsion** with some direct shear; the coil’s curvature raises the stress on the inside. s = K·8FD/(πd³) with the **Wahl factor** K = (4C − 1)/(4C − 4) + 0.615/C = **1.184** for C = 8.\n\nThe simpler shear factor K_s = 1 + 0.5/C = 1.0625 still lands on a 6 mm wire.',
      camera: { position: [0.06, -0.05, 0.14], target: [0, -0.09, 0] },
      cut: 'half',
      select: 'spring',
      params: { preset: 'mg21' },
      cites: [A503.m(10, 'slide 12'), A503.mg21('Q4d')],
    },
    {
      title: 'The leaf spring',
      body:
        'Leaves of decreasing length are clamped together: **graduated** leaves plus **extra full-length** leaves on top. Unstressed, the full leaves work hardest: s_e = 18FL/[bt²(3n_e + 2n_g)] = **277 MN/m²**, while the graduated leaves carry ⅔ of that.',
      camera: { position: [0.1, 0.35, 1.25], target: [0, 0.05, 0] },
      cut: false,
      select: 'leaf-spring',
      params: { preset: 'mg17-leaf' },
      cites: [A503.m(10, 'slides 5–9'), A503.mg17('Q4c')],
    },
    {
      title: 'Pre-stressing with a nip',
      body:
        'Bend the full leaves more than the rest before assembly, leaving a **nip** gap h = 2FL³/(nbt³E). Bolted up and fully loaded, every leaf then carries the same stress, 6FL/(nbt²) = **195 MN/m²** — 30 % less than 277.',
      camera: { position: [0.55, 0.3, 0.6], target: [0.35, 0.1, 0] },
      select: 'full-leaves',
      params: { preset: 'mg17-leaf-pre', lF: 600 },
      cites: [A503.m(10, 'slides 10–11')],
    },
    {
      title: 'Fillet welds and their throat',
      body:
        'A fillet weld has a roughly triangular section with leg w. Loaded **parallel** to its length it fails across the 45° throat, 0.707w (F = 0.707swL); loaded **transversely** it fails at 67½°, throat 0.765w (F = 0.828swL). The AWS allowable stress is 94 MN/m².\n\nSection the bar weld to see the triangle.',
      camera: { position: [-0.02, 0.06, 0.12], target: [-0.09, 0.025, 0] },
      cut: 'half',
      select: 'weld',
      params: { preset: 'bar' },
      cites: [A503.m(11, 'slides 14–21')],
    },
    {
      title: 'A bar welded to a plate',
      body:
        'A Ø50 mm bar carries 10 kN at 200 mm. Treat the weld as a **line**: Z_w = πd²/4, bending f_b = M/Z_w = 1.02 MN/m, shear 63.7 kN/m, resultant 1.022 MN/m → w = f/(0.707 × 94) = **15.4 mm**.',
      camera: { position: [0.25, 0.12, 0.35], target: [0, 0, 0] },
      cut: false,
      select: 'bar',
      params: { preset: 'bar' },
      cites: [A503.mg15('Q6c'), A503.mg21('Q5c')],
    },
    {
      title: 'The eccentric bracket',
      body:
        'Three fillet welds (120/240/120 mm) hold a bracket loaded 570 mm from their c.g. Move the 35 kN to the c.g. and add the couple T = 19.95 kN·m. At the flange tip the twist adds 0.45 MN/m across and 0.337 MN/m down to the direct 72.9 kN/m: f = 0.609 MN/m → **w = 9.2, say 10 mm**.',
      camera: { position: [0.3, 0.1, 0.9], target: [0.25, 0, 0] },
      select: 'welds',
      params: { preset: 'bracket' },
      cites: [A503.m(11, 'Example 1')],
    },
  ],
}

export default scene
