import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { L, prepareLiftGeometry } from './geometry'
import { C, DEFAULTS, MG1617, useLift } from './model'
import { LiftPanel } from './Panel'
import { Lift3D } from './Scene3D'

const home = { position: [0.9, 1.5, 2.9] as [number, number, number], target: [-0.1, 0.72, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'lift-circuit',
  title: 'Hydraulic lift circuit',
  summary:
    'A simple tractor hydraulic lift: reservoir, gear pump, filter, control valve, relief valve and single-acting ram turning the rockshaft to raise the three-point linkage. Lift, hold and lower with live oil flow; overload it and the relief valve blows.',
  Viewport: Lift3D,
  Panel: LiftPanel,
  camera: home,
  extent: 2.4,
  floorY: 0,
  hatchScale: 0.012,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'half', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'valve', label: 'Through the valve spool', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [-1, 0, 0], pos: 0.36 }], intersection: true },
    { id: 'plan', label: 'Plan section (ram height)', planes: [{ normal: [0, 1, 0], pos: 0.9 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.hy510('p1–3, Fig 40'), MG1617('Q(a) tractor hydraulic system'), SRC.top510('p11 relief 275 bar')],
  reset: () => useLift.getState().reset(),
  prepare: prepareLiftGeometry,
  applyParams: (p) => useLift.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'The tractor hydraulic lift',
      body:
        'The basic circuit: oil from the **reservoir** (the transmission housing) is pumped through the **control valve** to the **ram cylinder**. The ram piston turns the **ram cross shaft**, whose **lift arms** pull up the **lift rods** and so the **lower links** carrying the implement.',
      camera: home,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      params: { valve: 'lift', load: 6, Q: 27 },
      cites: [SRC.hy510('p1–2, Fig 40')],
    },
    {
      title: 'Pump and filter',
      body:
        'A **gear pump** — the most common type — draws oil from the housing and delivers about **27 L/min** on a 45 kW tractor. It is driven from the gearbox/PTO line or from the engine. The **filter** keeps wear particles out of the valve.',
      camera: { position: [1.35, 1.0, 1.0], target: [L.pump.x, 0.65, 0] },
      select: 'pump',
      cites: [SRC.hy510('p2–3'), SRC.tts510('p2')],
    },
    {
      title: 'LIFT: oil to the ram',
      body:
        'With the lever at **lift**, the spool connects the pump to the ram. Oil pushes the piston, the crank turns the rockshaft and the implement rises.',
      camera: { position: [0.45, 1.35, 1.2], target: [0.0, 0.95, 0] },
      select: 'control-valve',
      params: { valve: 'lift' },
      cites: [MG1617('Q(a)')],
    },
    {
      title: 'HOLD',
      body: 'At **hold** the ram line is blocked so the oil trapped in the ram carries the load (red). The pump flow goes straight back to the reservoir through the valve.',
      camera: { position: [0.45, 1.35, 1.2], target: [0.0, 0.95, 0] },
      select: 'ram-oil',
      params: { valve: 'hold' },
    },
    {
      title: 'LOWER',
      body:
        'At **lower** the ram is opened to the tank: the implement **drops under its own weight** and pushes the oil back. A flow-control valve sets how fast it drops. This simple system needs a depth wheel to set working depth.',
      camera: { position: [-0.2, 1.1, 2.3], target: [-0.6, 0.6, 0] },
      select: 'implement',
      params: { valve: 'lower' },
      cites: [SRC.hy510('p2, p5')],
    },
    {
      title: 'Overload: the relief valve',
      body:
        'Load the hitch beyond the lift capacity and the pressure climbs to the **relief setting (150 kg/cm²)**. The poppet lifts off its seat and the pump flow returns to the tank — you hear a knocking sound. The same happens if the lever is left at lift once the arms are fully up.',
      camera: { position: [1.4, 1.25, 0.8], target: [L.relief.x, 0.9, 0] },
      select: 'relief',
      params: { valve: 'lift', load: 25 },
      cites: [SRC.hy510('p3')],
    },
    {
      title: 'Rockshaft and linkage',
      body: 'The **crank** on the rockshaft turns the short ram stroke into a big swing of the lift arms. The linkage multiplies motion, so the ram needs about five times the implement weight in force.',
      camera: { position: [-0.2, 1.6, 1.6], target: [C.x - 0.2, 0.9, 0.2] },
      select: 'rockshaft',
      params: { valve: 'lift', load: 6 },
      cites: [SRC.hy510('p6–7, Fig 42')],
    },
    {
      title: 'Try it',
      body: 'Open **Controls**: change the load, pump flow and relief setting, and follow the step-by-step working.',
      camera: home,
      select: null,
      explode: 0.6,
    },
  ],
}

export default scene
