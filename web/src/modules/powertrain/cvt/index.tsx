import type { SceneDef } from '@/modules/types'
import { DEFAULTS, live, useCvt, type CvtParams } from './model'
import { prepareCvtGeometry } from './geometry'
import { CvtPanel } from './Panel'
import { Cvt3D } from './Scene3D'

const home = { position: [-1.85, 0.9, 1.3] as [number, number, number], target: [0, 0, 0.17] as [number, number, number] }
const side = { position: [-2.1, 0.15, 0.17] as [number, number, number], target: [0, 0, 0.17] as [number, number, number] }

const scene: SceneDef = {
  id: 'cvt',
  title: 'Power-split CVT',
  summary:
    'A hydro-mechanical continuously variable transmission. The engine drives a planetary carrier; the sun takes power straight to the output through gears, the ring drives a variable pump whose oil drives a variable motor on the same output shaft. Swing the two swashplates and the speed changes steplessly from active standstill, through reverse, to pure gear drive.',
  Viewport: Cvt3D,
  Panel: CvtPanel,
  camera: home,
  extent: 1.4,
  floorY: -0.4,
  hatchScale: 0.008,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'side', label: 'Side section (through every shaft)', planes: [{ normal: [-1, 0, 0], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [-1, 0, 0], pos: 0 }], sectionMoving: true },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [-1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: 0 }], intersection: true },
    { id: 'gears', label: 'Through the planetary set', planes: [{ normal: [0, 0, -1], pos: 0.004 }], sectionMoving: true },
  ],
  defaultPreset: 'side',
  reset: () => {
    useCvt.getState().reset()
    live.L = DEFAULTS.lever
  },
  prepare: prepareCvtGeometry,
  applyParams: (p) => useCvt.setState({ ...DEFAULTS, ...(p as Partial<CvtParams>) }),
  tour: [
    {
      title: 'Why a CVT',
      body: 'A gearbox gives a handful of fixed ratios; a hydrostatic drive gives any ratio but wastes power as heat. The **power-split CVT** gets both: stepless speed, with most of the power still going through gears. Engine (left) in, output (right) out.',
      camera: home,
      cut: 'side',
      select: null,
      explode: 0,
      playing: true,
      params: { target: 12, pull: 20 },
    },
    {
      title: 'The power splits in a planetary set',
      body: 'The engine turns the **planet carrier**. Its torque divides in a fixed proportion between the **sun**, fixed to the output shaft (the gear branch), and the **ring**, which drives the pump (the hydraulic branch). How fast the ring is allowed to turn decides the ratio.',
      camera: { position: [0.75, 0.35, -0.45], target: [0, 0, 0] },
      cut: 'gears',
      select: 'carrier',
      params: { target: 12, pull: 20 },
    },
    {
      title: 'Active standstill',
      body: 'Pump swashplate upright: the pump moves no oil, so the motor — and the output — cannot turn. The ring just spins free. The tractor stands still, engine running, **no clutch**, and the motor holds it on a slope.',
      camera: home,
      cut: 'side',
      select: 'pump-swash',
      params: { target: 0, pull: 15 },
    },
    {
      title: 'Phase 1: the pump swings out',
      body: 'Tilting the pump swashplate sends oil to the motor, which drives the output shaft through the **summing gears**. As the output speeds up, the ring slows. Red line = high pressure. Low down most of the power goes through the oil.',
      camera: { position: [-1.5, 0.15, 0.55], target: [0, -0.05, 0.3] },
      cut: 'side',
      select: 'motor',
      params: { target: 8, pull: 40 },
    },
    {
      title: 'Phase 2: the motor swings back',
      body: 'With the pump fully out, the **motor** swashplate now swings back. Less motor displacement means the ring and pump must slow down further — until, at the top, the motor plate is flat, the ring stops and **all power goes through gears**.',
      camera: side,
      cut: 'side',
      select: 'motor-swash',
      params: { target: 30, pull: 10, rpm: 2100 },
    },
    {
      title: 'Reverse without a reverse gear',
      body: 'Swing the pump past zero and the output turns backwards. Power now circulates: the gear branch runs backwards and more power flows through the oil than reaches the wheels, so reverse is less efficient — fine for short shuttle moves.',
      camera: home,
      cut: 'side',
      select: 'ring',
      params: { target: -8, pull: 5 },
    },
    {
      title: 'Speed is set by the lever, not the engine',
      body: 'Because the ratio is stepless, the controller can hold the travel speed while the engine runs where it uses least fuel — 50 km/h on the road at low revs. Ask for more than the engine can give and it **lowers the ratio instead of stalling**.',
      camera: home,
      cut: 'side',
      select: 'output',
      params: { range: 'road', target: 40, pull: 0, rpm: 1500 },
    },
  ],
}

export default scene
