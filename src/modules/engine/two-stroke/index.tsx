import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { prepareTwoStrokeGeometry } from './geometry'
import { DEFAULTS, HEAD_Y, useTwoStroke } from './model'
import { TwoStrokePanel } from './Panel'
import { TwoStroke3D } from './Scene3D'

const scene: SceneDef = {
  id: 'two-stroke',
  title: 'Two-stroke petrol engine',
  summary:
    'A piston-ported, crankcase-compression two-stroke with a deflector piston. Watch the charge go inlet → crankcase → transfer → cylinder → exhaust in one revolution, with a port-timing wheel computed from the port heights and petroil mist lubrication.',
  Viewport: TwoStroke3D,
  Panel: TwoStrokePanel,
  camera: { position: [0.34, 0.24, 0.44], target: [0, 0.075, -0.02] },
  extent: 0.4,
  floorY: -0.057,
  hatchScale: 0.0024,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'half', label: 'Through exhaust & transfer ports', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'inlet', label: 'Through inlet port & crankcase', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0 }], intersection: true },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.tb509('§2.6.2, Fig 2.4'), SRC.l3_509('two-stroke engine, comparison table'), SRC.add509('combustion in a two-stroke; petroil lubrication'), SRC.tb509('§6.3.3'), SRC.misc509('p6, Ex 5')],
  reset: () => useTwoStroke.getState().reset(),
  prepare: prepareTwoStrokeGeometry,
  applyParams: (p) => useTwoStroke.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A whole cycle in one revolution',
      body:
        'In a two-stroke the cycle is completed in **one revolution** — two strokes of the piston. There are **no valves**: the piston uncovers **ports** in the cylinder wall. This is a 100 cm³ air-cooled petrol engine, the size used on a lawn mower.',
      camera: { position: [0.34, 0.24, 0.44], target: [0, 0.075, -0.02] },
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 50,
      params: { rpm: 600, flows: true, mist: true },
      cites: [SRC.l3_509('two-stroke engine')],
    },
    {
      title: 'Up-stroke: induction below, compression above',
      body:
        'As the piston rises it covers the transfer and exhaust ports and **compresses the charge above it**. Below, the crankcase volume grows: near TDC the **skirt uncovers the inlet port** and fresh petroil mixture is drawn into the **sealed crankcase** (blue).',
      camera: { position: [0.12, 0.12, 0.36], target: [0, 0.06, -0.03] },
      cut: 'inlet',
      select: 'crankcase',
      cites: [SRC.add509('inlet port opens beneath the piston into the crankcase'), SRC.tb509('Fig 2.4(a) induction and compression')],
    },
    {
      title: 'Spark and power',
      body: 'The plug fires about **25° before TDC**; the burning charge drives the piston down — a power stroke **every revolution**, which is why the flywheel can be comparatively small.',
      camera: { position: [0.18, HEAD_Y + 0.05, 0.22], target: [0, HEAD_Y - 0.01, 0] },
      cut: 'half',
      select: 'plug',
      timeScale: 1 / 100,
      cites: [SRC.tb509('§5.5 ignition timing'), SRC.l3_509('one power stroke per revolution')],
    },
    {
      title: 'Exhaust first, then transfer',
      body:
        'Going down, the crown uncovers the **exhaust port** first, so the pressure blows down; a little later it uncovers the lower **transfer port**. Meanwhile the descending piston has **pre-compressed the charge in the crankcase**, which now rushes up the transfer passage.',
      camera: { position: [0.24, 0.16, 0.3], target: [0, 0.1, 0] },
      select: 'barrel',
      timeScale: 1 / 50,
      cites: [SRC.tb509('Fig 2.4(b) power and exhaust'), SRC.add509('crank scoops the mixture into the transfer port')],
    },
    {
      title: 'The deflector',
      body:
        'The ridge on the piston crown **deflects the fresh charge upwards**, so it sweeps over the head and pushes the burnt gas out of the exhaust port opposite. Because the ports open and close symmetrically about BDC, the exhaust stays open after the transfer closes — some charge is lost, one reason the two-stroke has **partial combustion** and lower efficiency.',
      camera: { position: [0.16, 0.14, 0.2], target: [-0.005, 0.11, 0] },
      select: 'piston',
      cites: [SRC.add509('the deflector deflects the fresh mixture towards the combustion chamber'), SRC.l3_509('partial combustion')],
    },
    {
      title: 'Port timing from port heights',
      body:
        'Open **Controls**: the port-timing wheel is **computed** from the port heights through the slider-crank. Note how the piston works on **both faces**: the crankcase trace swings above and below atmospheric pressure.',
      camera: { position: [0.34, 0.24, 0.44], target: [0, 0.075, -0.02] },
      select: null,
      cites: [SRC.l3_509('both sides of the piston compress the charge')],
    },
    {
      title: 'Petroil (mist) lubrication',
      body:
        'There is no oil sump. Oil is **mixed with the petrol** — 2–3 %, or 16 : 1 / 24 : 1. The petrol vaporises in the carburettor; the heavier oil settles as a **mist** on the crankcase, bearings, con-rod and cylinder walls (gold particles).',
      camera: { position: [0.1, 0.05, 0.3], target: [0, 0.01, 0] },
      cut: 'half',
      select: 'bearings',
      params: { mist: true },
      cites: [SRC.add509('petroil or mist lubrication'), SRC.tb509('§6.3.3')],
    },
    {
      title: 'Exploded',
      body: 'Pull it apart: the split crankcase, full-circle crank, deflector piston with only two rings, and the finned barrel with its three ports.',
      camera: { position: [0.42, 0.3, 0.52], target: [0, 0.07, -0.02] },
      explode: 1,
      select: null,
    },
  ],
}

export default scene
