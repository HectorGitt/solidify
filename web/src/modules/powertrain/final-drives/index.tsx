import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useFinal } from './model'
import { FinalPanel } from './Panel'
import { Final3D } from './Scene3D'

const home = { position: [0.75, 0.75, 1.15] as [number, number, number], target: [0.42, -0.05, 0] as [number, number, number] }

/** Cuts are in world space: the half shaft runs along +X, the pinion comes from +Z. */
const scene: SceneDef = {
  id: 'final-drives',
  title: 'Final drives & rear axle',
  summary:
    'One half of a tractor rear axle, from bevel pinion to wheel hub, in four arrangements: straight axle, spur reduction, outboard epicyclic and the Massey-Ferguson axle with its wet brake, hydraulic diff lock and inboard epicyclic. Follow the three speed reductions from engine to wheel.',
  Viewport: Final3D,
  Panel: FinalPanel,
  camera: home,
  extent: 1.3,
  floorY: -0.48,
  hatchScale: 0.006,
  timeScale: 1 / 6,
  cutPresets: [
    { id: 'front', label: 'Section on the axle', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plan', label: 'Plan section', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'all', label: 'Section the gears too', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'front',
  cites: [SRC.pt510('p12'), SRC.tts510('p8–11, Figs 35a/b/c'), SRC.top510('p9–10, Fig A2.15')],
  reset: () => useFinal.getState().reset(),
  applyParams: (p) => useFinal.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'From pinion to wheel',
      body:
        'This is the left half of a rear axle. The **bevel pinion** from the gearbox drives the **crown wheel** and differential; the **half shaft** carries the drive outward to the **final reduction** and the wheel hub. The orange particles trace the power.',
      camera: home,
      cut: 'front',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [SRC.tts510('p1, p8')],
    },
    {
      title: 'Three speed reductions',
      body:
        'The engine runs at more than **2000 rpm** but the wheels turn at only about **20 rpm** in bottom gear. The speed is reduced — and the torque multiplied — at three places: the **gearbox**, the **crown wheel & pinion**, and the **final reduction**. Together ≈ 100 : 1.',
      camera: { position: [0.3, 0.55, 0.9], target: [0.2, 0, 0] },
      select: 'crown',
      cites: [SRC.tts510('p1, p10')],
      check: {
        question: 'The overall ratio is about 100 : 1, the crown wheel gives about 4.3 : 1 and the final reduction 4.8 : 1. What must bottom gear in the gearbox give?',
        options: ['About 90 : 1', 'About 5 : 1', 'About 10 : 1'],
        answer: 1,
        explain: 'Reductions in series **multiply**: 100 / (4.3 × 4.8) ≈ 5. Each stage also multiplies the torque by its ratio.',
      },
    },
    {
      title: 'Spur reduction',
      body:
        'A small spur pinion on the differential shaft drives a large gear on the wheel axle (62 : 13 here). The **brake** is on the outer end of the fast differential shaft.',
      camera: { position: [0.95, 0.35, 0.95], target: [0.58, -0.18, 0] },
      select: 'spur-pinion',
      params: { layout: 'spur' },
      cites: [SRC.tts510('Fig 35a')],
    },
    {
      title: 'Epicyclic reduction',
      body:
        'Here the reduction is an **epicyclic unit** at the outer end of the axle housing: sun on the half shaft, ring fixed in the housing, carrier to the wheel — 1 + 57/15 = 4.8 : 1. The brake sits inboard, beside the differential.',
      camera: { position: [0.9, 0.4, 0.6], target: [0.6, 0, 0] },
      select: 'planets',
      params: { layout: 'epicyclic' },
      cites: [SRC.tts510('Fig 35b'), SRC.pt510('p6')],
      check: {
        question: 'The half shaft drives the 15-tooth sun at 96 rpm, with the 57-tooth ring held. How fast does the wheel turn?',
        options: ['About 25 rpm', 'About 96 rpm', 'About 20 rpm'],
        answer: 2,
        explain: 'With the ring held and the carrier as output the ratio is **1 + z_ring / z_sun** = 1 + 57/15 = 4.8, so the wheel turns at 96 / 4.8 = 20 rpm.',
      },
    },
    {
      title: 'The MF 2000 rear axle',
      body:
        'Everything is packed into the inboard end of the trumpet: the **hydraulic diff lock** (multi-plate clutch and piston), **one large oil-immersed brake disc** with its piston, and the **epicyclic reduction**. A long axle shaft runs out to the hub.',
      camera: { position: [0.55, 0.45, 0.55], target: [0.2, 0, 0] },
      select: 'mf-actuators',
      params: { layout: 'mf2000' },
      cites: [SRC.top510('p10 Fig A2.15')],
    },
    {
      title: 'Why the brake is on the fast shaft',
      body:
        'For the same stopping torque at the wheel, a brake on the half shaft needs only **1/i** of the torque, because that shaft turns i times faster. Apply the brakes in Controls and compare the clamping forces in the working.',
      camera: { position: [0.45, 0.35, 0.5], target: [0.17, 0, 0] },
      select: 'brake-disc',
      params: { braking: true },
      cites: [SRC.tts510('p11')],
      check: {
        question: 'To hold 4800 N·m at the wheel through a 4.8 : 1 final reduction, how much torque must the half-shaft brake hold?',
        options: ['About 1000 N·m', 'About 4800 N·m', 'About 23 000 N·m'],
        answer: 0,
        explain: 'The half shaft turns 4.8 times faster than the wheel, so the brake there needs only **1/i of the wheel torque**: 4800 / 4.8 = 1000 N·m.',
      },
    },
  ],
}

export default scene
