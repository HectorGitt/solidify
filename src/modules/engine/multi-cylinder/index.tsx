import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { prepareMultiGeometry } from './geometry'
import { DEFAULTS, cylZ, useMulti } from './model'
import { MultiPanel } from './Panel'
import { Multi3D } from './Scene3D'

const z1 = (n: number) => cylZ(1, n)

const scene: SceneDef = {
  id: 'multi-cylinder',
  title: 'Crankshafts & firing order',
  summary:
    'An inline tractor diesel with 2, 3, 4, 6 or 8 cylinders. Pick a firing order and the crankshaft is rebuilt to suit; the firing chart and the combined crank torque follow the engine live.',
  Viewport: Multi3D,
  Panel: MultiPanel,
  camera: { position: [1.05, 0.55, 0.95], target: [0, 0.08, 0] },
  extent: 1.0,
  floorY: -0.182,
  hatchScale: 0.0065,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'long', label: 'Longitudinal (through every bore)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'quarter', label: 'Longitudinal + above crank', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: 0.0 }], intersection: true },
    { id: 'cyl1', label: 'Transverse (cylinder 1 of a four)', planes: [{ normal: [0, 0, 1], pos: 0.15 }] },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'long',
  cites: [SRC.tb509('§2.6.4, Fig 2.5, Table 2.3'), SRC.l4_509('firing order, firing interval, firing chart'), SRC.exam509('2021/22 Q3b, 2017/18, 2022/23 Q2')],
  reset: () => useMulti.getState().reset(),
  prepare: prepareMultiGeometry,
  applyParams: (p) => useMulti.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'One crankshaft, many cylinders',
      body:
        'Every cylinder runs the same four strokes, but they must be **synchronised**. That is done by the shape of the **crankshaft**, which fixes where each piston is at every moment. The block is cut lengthwise so you can see every bore.',
      camera: { position: [1.05, 0.55, 0.95], target: [0, 0.08, 0] },
      cut: 'long',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 20,
      params: { n: 4, layout: '1-3-4-2', gas: true },
      cites: [SRC.tb509('§2.6.4')],
    },
    {
      title: 'The four-cylinder crank',
      body:
        'Throws 1 & 4 point the same way and so do 2 & 3: **pistons 1 and 4 travel together, and so do 2 and 3**. While 1 is on power, 4 is on intake — they are a full revolution apart in the cycle.',
      camera: { position: [0.7, 0.05, 0.75], target: [0, 0.0, 0] },
      select: 'crankshaft',
      cites: [SRC.tb509('p10–11, Fig 2.5')],
    },
    {
      title: 'Firing order 1-3-4-2',
      body:
        'Watch the numbered tags: each glows as its cylinder fires — **1, 3, 4, 2**, one every **720°/4 = 180°**. The firing chart in Controls shows every cylinder’s stroke; the highlighted row follows the crank.',
      camera: { position: [0.95, 0.6, 0.6], target: [0, 0.2, 0] },
      select: 'gas',
      timeScale: 1 / 50,
      cites: [SRC.tb509('Table 2.3, Q12'), SRC.l4_509('firing order 1-2-4-3 or 1-3-4-2')],
    },
    {
      title: 'Six cylinders: power every 120°',
      body:
        'A six fires every **720°/6 = 120°**, so a new power stroke starts before the last one has finished — power strokes **overlap**. The usual orders are 1-5-3-6-2-4 or 1-4-2-6-3-5; throws 1 & 6, 2 & 5, 3 & 4 are paired.',
      camera: { position: [1.2, 0.6, 1.0], target: [0, 0.08, 0] },
      params: { n: 6, layout: '1-5-3-6-2-4' },
      select: 'crankshaft',
      cites: [SRC.tb509('p11')],
    },
    {
      title: 'Another six-cylinder order: 1-6-3-5-2-4',
      body:
        'The order **1-6-3-5-2-4** still fires every 120°, but its crank pairs 1 & 5, 2 & 4, 3 & 6 — not mirror-symmetric, so the “Throws & balance” card shows a rocking couple. Compare it with 1-5-3-6-2-4.',
      camera: { position: [1.2, 0.6, 1.0], target: [0, 0.08, 0] },
      params: { n: 6, layout: '1-6-3-5-2-4' },
      select: null,
      cites: [SRC.exam509('2021/22 Q3b')],
    },
    {
      title: 'Eight cylinders: a genset engine',
      body:
        'A typical 100 kVA genset engine is an 8-cylinder with firing order **1-7-5-3-8-6-2-4**: an impulse every **90°**, with two cylinders always on power — a very even torque, which is why the flywheel can be small.',
      camera: { position: [1.5, 0.75, 1.3], target: [0, 0.08, 0] },
      params: { n: 8, layout: '1-7-5-3-8-6-2-4' },
      select: 'flywheel',
      cites: [SRC.exam509('2022/23 Q2'), SRC.tb509('p11 flywheel')],
    },
    {
      title: 'Across one cylinder',
      body:
        'A transverse section through cylinder 1 shows the piston, connecting rod and crank throw in the wet liner, with coolant round it and the bulkhead main bearings behind.',
      camera: { position: [0.25, 0.35, 1.1], target: [0, 0.08, z1(4)] },
      params: { n: 4, layout: '1-3-4-2' },
      cut: 'cyl1',
      select: 'conrods',
    },
    {
      title: 'Exploded',
      body: 'Pull the engine apart to see the crankshaft, rods, pistons and castings. Try every cylinder count and firing order from the Controls tab.',
      camera: { position: [1.2, 0.7, 1.1], target: [0, 0.08, 0] },
      cut: 'long',
      explode: 1,
      select: null,
    },
  ],
}

export default scene
