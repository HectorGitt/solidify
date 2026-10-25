import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Engine3D } from './Engine3D'
import { prepareEngineGeometry } from './geometry'
import { clamp, roundTo } from '@/content/context'
import { DIM, DEFAULTS, useEngine } from './model'
import { EnginePanel } from './Panel'

/** approximate head height for camera targets */
const head = (y: number) => y + 0.34

const scene: SceneDef = {
  id: 'four-stroke-diesel',
  title: 'Four-stroke diesel cutaway',
  summary:
    'A single-cylinder, direct-injection tractor diesel cut open. The piston, crank and valve train run through the four strokes in slow motion, linked to live P–V and T–s diagrams for the Otto, Diesel and Dual cycles.',
  Viewport: Engine3D,
  Panel: EnginePanel,
  camera: { position: [0.88, 0.62, 1.36], target: [0, 0.2, 0] },
  extent: 0.8,
  floorY: -0.176,
  hatchScale: 0.0055,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'exhaust-plane', label: 'Through exhaust valve', planes: [{ normal: [0, 0, 1], pos: DIM.exhaustZ }] },
    { id: 'valves', label: 'Through both valves', planes: [{ normal: [1, 0, 0], pos: DIM.valveX }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: DIM.valveX }], intersection: true },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.l3_509('four-stroke cycle, CI vs SI'), SRC.l4_509('parts, valve timing'), SRC.tb509('Ch 2, Figs 2.1–2.3'), SRC.thermo509('air-standard cycles'), SRC.misc509('worked examples 9–17')],
  reset: () => useEngine.getState().reset(),
  prepare: prepareEngineGeometry,
  fromContext: (c) => (c.rpm !== undefined && c.rpm > 0 ? { rpm: roundTo(clamp(c.rpm, 400, 2800), 10) } : null),
  applyParams: (p) => useEngine.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A tractor diesel, cut open',
      body:
        'This is a single-cylinder four-stroke **compression-ignition** engine, 100 mm bore × 124 mm stroke. The castings are sectioned and **hatched by material**, as in an engineering drawing; the moving parts are left whole so you can watch them work.\n\nClick any part to see what it does.',
      camera: { position: [0.88, 0.62, 1.36], target: [0, 0.2, 0] },
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 50,
      params: { cycle: 'diesel', r: 17, q: 1500 },
      cites: [SRC.l3_509('classification of engines')],
    },
    {
      title: '1 · Intake stroke',
      body:
        'The cam opens the **inlet valve** just before TDC and the piston moves down, drawing in **air only** — a diesel never draws in fuel. The valve stays open past BDC so the moving air keeps filling the cylinder.',
      camera: { position: [0.32, 0.55, 0.55], target: [-0.01, 0.36, 0] },
      select: 'inlet-valve',
      cut: 'valves',
      cites: [SRC.l3_509('intake'), SRC.l4_509('valve timing')],
    },
    {
      title: '2 · Compression stroke',
      body:
        'Both valves are shut. The piston compresses the air into the bowl — here **17 : 1**, inside the 14–22 : 1 range for diesels. Compression alone heats the air to around **500 °C**, enough to ignite diesel fuel.',
      camera: { position: [0.42, 0.42, 0.62], target: [0, 0.3, 0] },
      select: 'piston',
      cut: 'half',
      cites: [SRC.l3_509('compression pressure 30–45 kg/cm², ~500 °C')],
      check: {
        question: 'A diesel has no spark plug. What ignites the fuel when it is injected?',
        options: ['A glow plug that stays hot all the time', 'The heat of the air, raised by compressing it', 'Hot exhaust gas left over from the last cycle'],
        answer: 1,
        explain: 'Compressing air to about 1/17 of its volume heats it to around **500 °C**, above the self-ignition temperature of diesel fuel. Glow plugs only help cold starting.',
      },
    },
    {
      title: '3 · Injection and power',
      body:
        'Just before TDC the **injector** sprays fuel at 120–300 kg/cm². It ignites in the hot air and the expanding gas drives the piston down — the only stroke that produces work. In the **Diesel cycle** model this heat is added at constant pressure.',
      camera: { position: [0.24, 0.47, 0.42], target: [0.01, 0.36, 0] },
      select: 'injector',
      timeScale: 1 / 100,
      cites: [SRC.supp509('injector'), SRC.thermo509('p4 Diesel cycle')],
    },
    {
      title: '4 · Exhaust stroke',
      body:
        'The **exhaust valve** opens before BDC so pressure starts to fall (blow-down); the rising piston then pushes the burnt gas out. Near TDC both valves are briefly open — **valve overlap** — which helps sweep out the last exhaust gas.',
      camera: { position: [0.36, 0.5, 0.5], target: [0.02, 0.36, -0.02] },
      select: 'exhaust-valve',
      cut: 'valves',
      timeScale: 1 / 50,
      cites: [SRC.l4_509('actual valve timing, overlap')],
    },
    {
      title: 'The valve train',
      body:
        'The **camshaft** turns at half crankshaft speed, driven 2 : 1 by the timing gears. Each lobe lifts a **tappet**, which pushes a **push rod** up to the **rocker arm**, which pushes the **valve** open against its spring.',
      camera: { position: [-0.5, 0.5, 0.6], target: [-0.06, head(0), 0] },
      select: 'camshaft',
      cut: 'exhaust-plane',
      cites: [SRC.tb509('Fig 2.2'), SRC.man509('timing gears')],
      check: {
        question: 'Each valve opens once per cycle, and a cycle takes two crankshaft turns. How fast does the camshaft turn?',
        options: ['Twice crankshaft speed', 'The same as the crankshaft', 'Half crankshaft speed'],
        answer: 2,
        explain: 'One cam lobe per valve, one opening every two revolutions: the timing gears drive the camshaft at **half** crankshaft speed (2 : 1).',
      },
    },
    {
      title: 'Crank, rod and flywheel',
      body:
        'The **connecting rod** and **crankshaft** form a slider-crank that turns the piston’s straight-line motion into rotation. The heavy **flywheel** stores energy on the power stroke and carries the engine through the other three.',
      camera: { position: [0.45, 0.15, 0.7], target: [0, 0.05, 0] },
      select: 'crank-assembly',
      cut: 'half',
      cites: [SRC.l4_509('crankshaft, flywheel'), SRC.tb509('flywheel')],
    },
    {
      title: 'Exploded view',
      body: 'Pull the parts apart to see how they assemble. Use the **explode** slider in the toolbar at any time, and **Isolate** on a part card to study one part on its own.',
      camera: { position: [0.95, 0.6, 1.25], target: [0, 0.18, 0] },
      select: null,
      explode: 1,
      cut: 'half',
    },
    {
      title: 'The cycle on the P–V diagram',
      body:
        'Open the **Controls** panel. The dot on the P–V and T–s diagrams follows the piston. Switch between Otto, Diesel and Dual, and change the compression ratio: the head gasket gets thinner as the clearance volume shrinks.\n\nNote: for the same r, the Diesel bracket term is **greater than 1**, so η(Diesel) < η(Otto).',
      camera: { position: [0.88, 0.62, 1.36], target: [0, 0.2, 0] },
      explode: 0,
      cites: [SRC.thermo509('p5'), SRC.misc509('p9–12')],
    },
  ],
}

export default scene
