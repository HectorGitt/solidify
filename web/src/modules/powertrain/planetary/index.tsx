import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { preparePlanetaryGeometry } from './geometry'
import { DEFAULTS, usePlanetary, type PlanetaryParams } from './model'
import { PlanetaryPanel } from './Panel'
import { PlanetaryScene3D } from './Scene3D'

const home = { position: [0.46, 0.3, 0.62] as [number, number, number], target: [0, 0, 0.04] as [number, number, number] }
const face = { position: [0.05, 0.08, 0.5] as [number, number, number], target: [0, 0, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'planetary',
  title: 'Planetary gear set',
  summary:
    'A simple planetary set — sun, four planet pinions on a carrier and a ring gear — with an input, output, brake and lock-up clutch for every member. Hold the ring for the low speed, lock any two for direct drive, hold the carrier for reverse, or drive the carrier for an overdrive; chain two sets for a compound train.',
  Viewport: PlanetaryScene3D,
  Panel: PlanetaryPanel,
  camera: home,
  extent: 0.8,
  floorY: -0.17,
  hatchScale: 0.004,
  timeScale: 1 / 10,
  cutPresets: [
    { id: 'side', label: 'Side section', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'face', label: 'Through the gear faces', planes: [{ normal: [0, 0, 1], pos: 0.004 }], sectionMoving: true },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: 0 }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'quarter',
  cites: [SRC.pt510('p4–6 planetary transmission, figure p5'), SRC.top510('p2, Fig A2.4')],
  reset: () => usePlanetary.getState().reset(),
  prepare: preparePlanetaryGeometry,
  applyParams: (p) => usePlanetary.setState({ ...DEFAULTS, lock: [], ...(p as Partial<PlanetaryParams>) }),
  tour: [
    {
      title: 'A planetary set',
      body:
        'The planetary gears work like the solar system: the **planet pinions** each turn on their own axis and at the same time travel round the **sun gear**. Gear ratios change without sliding gears in or out of mesh, so the power flow is hardly interrupted.',
      camera: home,
      cut: 'quarter',
      select: null,
      explode: 0,
      playing: true,
      params: { input: 'sun', output: 'carrier', held: 'ring' },
      cites: [SRC.pt510('p4–5')],
    },
    {
      title: 'The basic parts',
      body:
        '**Sun gear** — the centre of the system. **Planet pinions and carrier** — rotate round the sun. **Ring gear** — surrounds the other parts. Here z_sun = 30, z_planet = 24, z_ring = 78.',
      camera: face,
      cut: 'face',
      select: 'planets',
      cites: [SRC.pt510('p5')],
    },
    {
      title: 'Low speed: ring held',
      body:
        'The underdrive brake holds the **ring** (red). The sun turns the planets against the stationary ring, and they "walk" round it, forcing the **carrier** round **the same way as the sun but slower**: here 30/108 = 0.278 of sun speed.',
      camera: { position: [0.3, 0.42, 0.5], target: [0, 0, 0.02] },
      cut: 'quarter',
      select: 'brake-ring',
      params: { input: 'sun', output: 'carrier', held: 'ring' },
      cites: [SRC.pt510('p6 — low speed')],
    },
    {
      title: 'High speed: lock any two',
      body:
        'Release the brake and engage the **direct-drive clutch**. "When any two parts are locked together, all other parts rotate as a unit" — input and output turn in unison, 1 : 1, and the planets stop spinning on their pins.',
      camera: { position: [0.36, 0.25, 0.7], target: [0, 0, 0.12] },
      select: 'lock-drum',
      cut: 'side',
      params: { input: 'sun', output: 'carrier', held: 'none', lock: ['sun', 'carrier'] },
      cites: [SRC.pt510('p6 — high speed')],
    },
    {
      title: 'Neutral and reverse',
      body:
        'With clutch and brake both released the ring just spins backwards and the output stops (**neutral**). Hold the **carrier** instead and the planets become idlers: the ring turns **backwards**, −z_s/z_r = −0.385 — a reversing gear.',
      camera: face,
      cut: 'face',
      select: 'carrier',
      params: { input: 'sun', output: 'ring', held: 'carrier' },
      cites: [SRC.pt510('p4 — direct coupler, reduction or reversing gear')],
    },
    {
      title: 'Overdrive: driving the carrier',
      body:
        'A two-speed epicyclic can hold the outer casing (ring) with a stop and drive the **carrier**: the follower on the **sun** is **speeded up**, (30 + 78)/30 = 3.6 times. It is the same set as the low-speed drive, driven from the other end.',
      camera: home,
      cut: 'quarter',
      select: 'sun',
      params: { input: 'carrier', output: 'sun', held: 'ring' },
      cites: [SRC.top510('p2, Fig A2.4')],
    },
    {
      title: 'Compound planetary',
      body:
        'Feed the output of one set into the input of a second and the ratios multiply: underdrive × reverse gives −0.107. Compound sets give large reductions, overdrives and several reverses in a compact unit, but they need more power to run because of the hydraulic drive unit.',
      camera: { position: [0.6, 0.35, 0.35], target: [0, 0, -0.12] },
      cut: 'side',
      select: 'set-2',
      params: { compound: true, mode1: 'under', mode2: 'reverse' },
      cites: [SRC.pt510('p6 — compound')],
    },
  ],
}

export default scene
