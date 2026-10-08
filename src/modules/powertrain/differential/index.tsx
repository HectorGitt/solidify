import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { prepareDiffGeometry } from './geometry'
import { DEFAULTS, DIM, useDiff } from './model'
import { DiffPanel } from './Panel'
import { Diff3D } from './Scene3D'

const scene: SceneDef = {
  id: 'differential',
  title: 'Crown wheel, differential & diff lock',
  summary:
    'The rear-axle centre of a tractor: a bevel pinion drives the crown wheel bolted to the differential cage; planet pinions on the cross-pin share the drive between two side gears and half shafts. Run it straight, round a corner, with one wheel held or in mud — then press the diff lock.',
  Viewport: Diff3D,
  Panel: DiffPanel,
  camera: { position: [0.62, 0.5, 1.05], target: [0, 0, 0.02] },
  extent: 1.7,
  floorY: -DIM.tyreR,
  hatchScale: 0.004,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'front', label: 'Front section (pinion side)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plan', label: 'Plan section', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [0, 1, 0], pos: 0 }], intersection: true },
    { id: 'all', label: 'Section the gears too', planes: [{ normal: [0, 1, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'front',
  cites: [SRC.tts510('p7–8, Fig 34'), SRC.pt510('p11–12'), SRC.top510('p2 Fig A2.5a/b; p10 Fig A2.15')],
  reset: () => useDiff.getState().reset(),
  prepare: prepareDiffGeometry,
  applyParams: (p) => useDiff.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'The rear-axle centre',
      body:
        'The wheels turn at right angles to the crankshaft, so the drive must turn through 90°. The **bevel pinion** on the gearbox output shaft drives the large **crown wheel**, which is bolted to the **differential cage**. Click any part to see what it does.',
      camera: { position: [0.62, 0.5, 1.05], target: [0, 0, 0.02] },
      cut: 'front',
      select: null,
      explode: 0,
      playing: true,
      params: { mode: 'straight', locked: false, pinionRpm: 600, spiders: 4 },
      cites: [SRC.tts510('p7')],
    },
    {
      title: 'Crown wheel and pinion: the second reduction',
      body:
        'A small pinion (11 teeth) drives a large crown wheel (47 teeth), so the cage turns **47/11 = 4.27 times slower** than the gearbox shaft — the second of the three speed reductions between engine and wheel. Most tractors use helical (spiral) teeth; straight teeth are drawn here.',
      camera: { position: [0.32, 0.25, 0.52], target: [0.04, 0, 0.06] },
      select: 'crown',
      cut: 'front',
      cites: [SRC.tts510('p7, p10'), SRC.top510('p3 D·N = d·n')],
    },
    {
      title: 'Going straight: one solid unit',
      body:
        'Both wheels meet the same resistance, so the cage, planet pinions and side gears turn **as one**: the planet pinions ride round with the cage but do **not spin** on the cross-pin. Each half shaft turns at cage speed.',
      camera: { position: [0.05, 0.6, 0.35], target: [0, 0, 0] },
      select: 'spiders',
      cut: 'plan',
      params: { mode: 'straight', locked: false },
      cites: [SRC.tts510('p8'), SRC.top510('Fig A2.5a')],
    },
    {
      title: 'Cornering',
      body:
        'Turning left, the inner (left) wheel must travel a shorter path. It slows, and the planet pinions **spin** on the cross-pin, walking round the slower side gear and speeding the other up: **as one wheel turns faster, the other turns slower by the same amount**. The cage speed is always the mean of the two.',
      camera: { position: [0.05, 0.6, 0.35], target: [0, 0, 0] },
      select: 'spiders',
      cut: 'plan',
      params: { mode: 'cornering', turnRadius: 3, locked: false },
      cites: [SRC.pt510('p11'), SRC.top510('Fig A2.5b')],
    },
    {
      title: 'One wheel held: twice cage speed',
      body:
        'Hold the left wheel still. The planet pinions roll round the stationary left side gear like a wheel on a track and drive the right side gear at **twice the cage speed**. Watch the readouts: (0 + 2N)/2 = N.',
      camera: { position: [0.55, 0.45, 0.9], target: [0, -0.02, 0] },
      select: 'side-left',
      cut: 'front',
      params: { mode: 'held', locked: false },
      cites: [SRC.tts510('p8')],
    },
    {
      title: 'One wheel in mud',
      body:
        'The same thing happens on bad ground. The open differential always gives **equal torque** to both sides, so the firm wheel gets only what the mud can take. The tractor stays put and the mud wheel spins at twice cage speed.',
      camera: { position: [-1.0, 0.35, 0.85], target: [-0.35, -0.08, 0] },
      select: 'mud',
      cut: 'front',
      params: { mode: 'mud', locked: false, mudGrip: 250 },
      cites: [SRC.tts510('p8'), SRC.pt510('p12')],
    },
    {
      title: 'The diff lock',
      body:
        'Press the **diff-lock pedal**: the dog collar on the left half shaft slides into the dogs on the cage and locks them together. Now both wheels must turn at cage speed, and the firm wheel can pull. It is released before turning — **the tractor cannot corner** with it in. The MF version uses hydraulic multi-plate clutch plates and a piston instead of dogs.',
      camera: { position: [0.42, 0.22, 0.4], target: [0.12, 0, 0] },
      select: 'diff-lock',
      cut: 'quarter',
      params: { mode: 'mud', locked: true },
      cites: [SRC.tts510('p8'), SRC.pt510('p12'), SRC.top510('p10 Fig A2.15')],
    },
    {
      title: 'Exploded view',
      body: 'Pull the axle apart: carrier, crown wheel, cage, cross-pins, planet pinions, side gears and half shafts. Open the **Controls** tab to switch the running condition (straight, cornering, one wheel held, mud) and see the working.',
      camera: { position: [0.7, 0.6, 1.2], target: [0, 0, 0] },
      select: null,
      explode: 1,
      cut: 'front',
      params: { mode: 'straight', locked: false },
    },
  ],
}

export default scene
