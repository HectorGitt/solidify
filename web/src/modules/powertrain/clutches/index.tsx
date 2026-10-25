import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { prepareClutchGeometry } from './geometry'
import { DEFAULTS, useClutch, type ClutchParams } from './model'
import { ClutchPanel } from './Panel'
import { ClutchScene3D } from './Scene3D'

type V3 = [number, number, number]
const home = { position: [0.78, 0.3, 0.5] as V3, target: [0, -0.05, 0.08] as V3 }
const close = { position: [0.5, 0.12, 0.2] as V3, target: [0, 0.02, 0.04] as V3 }

const scene: SceneDef = {
  id: 'clutches',
  title: 'Clutches',
  summary:
    'Tractor clutches cut open: the single dry plate clutch with its pedal free play, the two-stage dual clutch that gives a live PTO, and the wet multi-plate hydraulic IPTO clutch. Press the pedal and watch the clamp load, slip and the gearbox shaft coasting to rest; switch between mechanical, hydraulic and electrical actuation; check torque capacity with the standard friction-clutch formulas.',
  Viewport: ClutchScene3D,
  Panel: ClutchPanel,
  camera: home,
  extent: 0.9,
  floorY: -0.38,
  hatchScale: 0.004,
  timeScale: 1 / 40,
  cutPresets: [
    { id: 'half-all', label: 'Half section', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
    { id: 'quarter-all', label: 'Quarter cut', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: 0 }], intersection: true, sectionMoving: true },
    { id: 'housing', label: 'Housing only (parts whole)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  ],
  defaultPreset: 'quarter-all',
  cites: [SRC.tts510('p2–4, Fig 31'), SRC.top510('p5–8, Figs A2.8–A2.10'), SRC.pt510('p2 — clutch types and actuation'), SRC.m503(8, 'clutch capacity')],
  reset: () => useClutch.getState().reset(),
  prepare: prepareClutchGeometry,
  applyParams: (p) => useClutch.getState().set(p as Partial<ClutchParams>),
  tour: [
    {
      title: 'The single plate clutch',
      body:
        'The clutch connects and disconnects the engine and the gearbox. Here the **clutch plate** (friction lining on both faces) is clamped between the **flywheel** and the **pressure plate** by nine coil springs, so everything turns together and drive passes "to gearbox".',
      camera: home,
      cut: 'quarter-all',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, kind: 'single', pedal: 0 },
      cites: [SRC.tts510('p2–3, Fig 31'), SRC.top510('p5 — clutch definition')],
    },
    {
      title: 'Clamped by springs',
      body:
        'The springs push the pressure plate towards the flywheel with about **7.2 kN**. With two friction faces, f = 0.3 and a friction radius of 120 mm the clutch can carry **T = n f F R_f ≈ 518 N·m** — twice the engine torque, so it does not slip.',
      camera: close,
      cut: 'half-all',
      select: 'springs',
      cites: [SRC.m503(8, 'T = n f F R_f')],
      check: {
        question: 'If the springs weaken so the clamp load falls from 7.2 kN to 3.6 kN, what is the clutch\'s torque capacity?',
        options: ['About 1036 N·m', 'About 259 N·m', 'Still about 518 N·m'],
        answer: 1,
        explain: 'T = n f F R_f is **proportional to the clamp load**: 2 × 0.3 × 3.6 kN × 0.12 m ≈ 259 N·m. That leaves no margin over the engine torque, so the clutch would start to slip.',
      },
    },
    {
      title: 'Pedal free play — 18 mm',
      body:
        'The first **18 mm** of pedal travel does nothing: the thrust bearing just closes the gap to the levers. Too little free play wears the thrust bearing and lets the clutch **slip**; too much and the drive is never fully broken, so gears are hard to engage.',
      camera: { position: [0.55, 0.08, 0.45], target: [0, -0.02, 0.1] },
      select: 'release-bearing',
      params: { pedal: 15 },
      cites: [SRC.tts510('p3–4')],
      check: {
        question: 'As the friction lining wears thinner over the months, what happens to the pedal free play?',
        options: ['It grows larger', 'It stays the same', 'It shrinks, and can vanish'],
        answer: 2,
        explain: 'As the lining thins, the pressure plate moves closer to the flywheel and the inner ends of the release levers move back towards the thrust bearing, so **free play shrinks**. With none left the bearing holds the levers and the clutch slips.',
      },
    },
    {
      title: 'Releasing the clutch',
      body:
        'Push further: the bearing pushes the inner ends of the **release levers** towards the flywheel, the outer ends pull the pressure plate back against the springs and the plate is freed. Cover, springs and pressure plate keep turning with the engine — the **clutch plate and gearbox shaft coast to rest**.',
      camera: close,
      select: 'levers',
      params: { pedal: 140, load: 0 },
      cites: [SRC.tts510('p2')],
    },
    {
      title: 'Three ways to work it',
      body:
        '**Mechanical** — linkages and springs (standard or over-centre). **Hydraulic** — master cylinder to slave (ram) cylinder; the most common. **Electrical** — direct or indirect.',
      camera: { position: [0.9, -0.05, 0.6], target: [0.2, -0.18, 0.2] },
      select: 'actuation',
      params: { actuation: 'hydraulic', pedal: 0 },
      cites: [SRC.pt510('p2'), SRC.tts510('p4')],
    },
    {
      title: 'Dual clutch for a live PTO',
      body:
        'Two plates, two pressure plates, two sets of springs. Press the pedal **half way** and the transmission plate is freed — the wheels stop but the **hollow PTO shaft** keeps turning. Press it **fully** and the PTO set screws pick up the second plate and the PTO stops too.',
      camera: home,
      cut: 'half-all',
      select: 'pto-shaft',
      params: { kind: 'dual', pedal: 75, actuation: 'mechanical' },
      cites: [SRC.top510('p6, Fig A2.9'), SRC.tts510('p3')],
    },
    {
      title: 'Wet multi-plate IPTO clutch',
      body:
        'An independent PTO has its own clutch in the transmission housing. A **spool valve** sends oil to the **piston**, which forces the friction plates and inter-plates together. In neutral the oil is released, the **Belleville spring** pushes the piston back and the shaft is **braked**.',
      camera: { position: [0.42, 0.25, 0.42], target: [0, 0.04, 0.02] },
      cut: 'half-all',
      select: 'piston',
      params: { kind: 'ipto', spool: true },
      cites: [SRC.top510('p7, Fig A2.10')],
    },
    {
      title: '10 + 9 plates = 18 surfaces',
      body:
        'Multi-plate clutches run in oil: ten driving plates and nine driven ones give eighteen friction surfaces. Open the **Controls** tab: the torque calculator uses n = n₁ + n₂ − 1 and the standard friction radii, with worked-example presets.',
      camera: { position: [0.3, 0.12, 0.3], target: [0, 0.03, 0.03] },
      select: 'friction-plates',
      params: { kind: 'ipto', spool: false },
      cites: [SRC.top510('p7'), SRC.m503(8, 'MG16')],
      check: {
        question: 'If the pack had ten driving plates and ten driven plates, how many friction surfaces would it have?',
        options: ['19', '20', '21'],
        answer: 0,
        explain: 'Each pair of neighbouring plates makes one contact, so a stack of n₁ + n₂ plates has **n = n₁ + n₂ − 1** surfaces: 10 + 10 − 1 = 19.',
      },
    },
  ],
}

export default scene
