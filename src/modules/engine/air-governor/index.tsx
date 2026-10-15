import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { AirGov3D } from './AirGov3D'
import { prepareAirGovGeometry } from './geometry'
import { DEFAULTS, FULL_LOAD, GY, OB, RIG_X, resetGovernor, useAirGov } from './model'
import { AirGovPanel } from './Panel'

const overview = { position: [0.25, 1.25, 3.3] as [number, number, number], target: [0.25, 0.3, 0] as [number, number, number] }
const govCam = { position: [RIG_X + 0.42, 0.42, 0.62] as [number, number, number], target: [RIG_X + 0.24, 0.16, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'air-governor',
  title: 'Air cleaner & governor',
  summary:
    'Oil-bath and dry air cleaners with live airflow and measured dust-vs-height data, and a centrifugal flyweight governor on a loaded tractor diesel: throw load on and off, watch the speed droop and the rack move, check the 6.45 % regulation example — and make it hunt.',
  Viewport: AirGov3D,
  Panel: AirGovPanel,
  camera: overview,
  extent: 1.9,
  floorY: -0.155,
  hatchScale: 0.003,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'governor-only', label: 'Section the governor only', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [-1, 0, 0], pos: -RIG_X }], intersection: true },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.tb509('§4.3, §4.6, Figs 4.3, 4.4, 4.10'), SRC.supp509('governor regulation and hunting')],
  reset: () => useAirGov.getState().reset(),
  prepare: () => Promise.all([prepareAirGovGeometry(), import('@/machines/engine.geometry').then((m) => m.prepareEngine())]),
  applyParams: (p) => useAirGov.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Clean air and steady speed',
      body:
        'Two engine systems on one bench. **Left:** air cleaners — an engine breathes thousands of litres of dusty air a minute, and dust is the fastest way to wear out its bores and rings. **Right:** a **centrifugal governor**, which holds the engine speed as the load changes.',
      camera: overview,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 20,
      params: { ...DEFAULTS },
      cites: [SRC.tb509('§4.3, §4.6')],
    },
    {
      title: 'Oil-bath air cleaner',
      body:
        'The **pre-cleaner** stops chaff and leaves. Air rushes down the centre tube and turns sharply over the **oil**: the heavy dust cannot make the turn and is thrown into the bath. The air then rises through the **oil-wetted wire mesh**, which catches the fine dust.',
      camera: { position: [OB.x + 0.35, 0.3, 0.55], target: [OB.x, 0.16, 0] },
      select: 'oil-bath',
      cites: [SRC.tb509('Fig 4.4')],
    },
    {
      title: 'Take air from high up',
      body: 'Dust is thickest near the ground: **0.565 g/m³** at the dashboard, **0.283** at 45 cm above it and **0.141** at 74 cm. Each step up halves the dust — which is why tractors have tall intake stacks. Try the height slider.',
      camera: { position: [OB.x + 0.5, 0.75, 1.0], target: [OB.x, 0.6, 0] },
      select: 'intake-stack',
      params: { height: 0.74 },
      cites: [SRC.tb509('§4.3 dust survey')],
    },
    {
      title: 'Dry element cleaner',
      body: 'Air enters **tangentially** and swirls round the **baffle**, so heavy dust is flung out and drops into the **dust cup**. The air then passes inwards through the **pleated paper element**.',
      camera: { position: [-0.0, 0.3, 0.5], target: [-0.15, 0.14, 0] },
      select: 'dry-cleaner',
      params: { cleaner: 'dry', height: 0.45 },
      cites: [SRC.tb509('Fig 4.3')],
    },
    {
      title: 'The flyweight governor',
      body:
        'The spindle is gear-driven at half engine speed. As speed rises the **flyweights** swing out and their toes push the **thrust sleeve** against the **governor spring**. The **fork lever** turns sleeve movement into rack movement: faster → less fuel, slower → more fuel.',
      camera: govCam,
      select: 'flyweights',
      cut: 'half',
      params: { cleaner: 'oil-bath', load: 0, damping: 200, setRpm: 1600 },
      cites: [SRC.tb509('Fig 4.10')],
    },
    {
      title: 'Throw on the load',
      body:
        'Full load slows the engine; the flyweights fall in, the rack moves to more fuel and the speed recovers to a little below the no-load speed. **1600 rpm with no load, 1500 rpm at full load** gives the regulation R = 100/1550 = **6.45 %**.',
      camera: govCam,
      select: 'rack',
      params: { load: FULL_LOAD },
      cites: [SRC.supp509('regulation example 6.45 %')],
    },
    {
      title: 'Hunting',
      body: 'With too little damping on the sleeve the governor over-corrects: too much fuel, then too little — the speed swings **fast–slow–fast**. This is **hunting**. Watch the speed chart in the Controls panel, then raise the damping.',
      camera: { position: [RIG_X + 0.38, GY + 0.2, 0.42], target: [RIG_X + 0.24, GY, 0] },
      select: 'sleeve',
      params: { load: 0, damping: 15 },
      cites: [SRC.supp509('hunting'), SRC.ln518('Routh–Hurwitz')],
    },
    {
      title: 'The speed-control lever',
      body: 'The hand lever squeezes the governor spring: more preload means the flyweights need more speed to balance it, so the governor holds a higher speed. The governor then keeps that speed (within its regulation) whatever the load.',
      camera: govCam,
      select: 'speed-lever',
      params: { damping: 200, setRpm: 1200, load: 110 },
      cites: [SRC.tb509('Fig 4.10 manual speed control')],
    },
  ],
}

resetGovernor()

export default scene
