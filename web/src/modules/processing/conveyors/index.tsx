import type { SceneDef } from '@/modules/types'
import { P504 } from './cites'
import { DEFAULTS, useConv } from './model'
import { ConveyorsPanel, EXAM, PRESETS } from './Panel'
import { Conveyors3D } from './Scene3D'

const scene: SceneDef = {
  id: 'conveyors',
  title: 'Conveyors & handling',
  summary:
    'Troughed belt, scraper-flight chain, screw (auger), bucket elevator and pneumatic conveyor, each cut away with the material moving, with live capacity and power from the handling equations and a material-based selector.',
  Viewport: Conveyors3D,
  Panel: ConveyorsPanel,
  camera: { position: [2.6, 2.4, 4.2], target: [0, 1.1, 0] },
  extent: 5,
  floorY: 0,
  hatchScale: 0.03,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'half', label: 'Half section (along the conveyor)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'across', label: 'Across the conveyor', planes: [{ normal: [1, 0, 0], pos: 0.2 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [P504.hand('Note 3 Materials handling'), P504.hand('Note 3 comparison table')],
  reset: () => useConv.getState().reset(),
  applyParams: (p) => {
    const id = p.preset as string | undefined
    const pr = id ? [...PRESETS, ...EXAM].find((x) => x.id === id) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useConv.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'Belt conveyor',
      body: 'An endless belt round a **head (drive)** and a **tail** pulley, carried on idlers. The load rides still on the belt — no relative motion, so little damage. High capacity, long distance, low power; elevation is limited.',
      camera: { position: [2.6, 2.4, 4.2], target: [0, 1.0, 0] },
      cut: false,
      select: 'belt-band',
      explode: 0,
      playing: true,
      params: { preset: 'grain-belt' },
      cites: [P504.hand('Note 3, Belt conveyors')],
    },
    {
      title: 'Capacity C = V(A + As)',
      body: 'Three-roll idlers trough the belt. The load area **A** between the rolls plus the **surcharge** As above line AB, times belt speed, gives the capacity. Power = empty-belt friction + load friction + lift.',
      camera: { position: [-2.6, 1.6, 0.4], target: [0, 1.1, 0] },
      cut: 'across',
      select: 'carry-idlers',
      cites: [P504.hand('Note 3, Design (preliminary); Power to drive belt conveyors')],
    },
    {
      title: 'Screw conveyor',
      body: 'A helical flight pushes the material one **pitch** per revolution: V = π(D² − d²)p/4 per rev, but only **30–50 %** of that is achieved. Good for damp, sticky or hot material, up to 20°.',
      camera: { position: [1.6, 1.8, 2.2], target: [0, 0.9, 0] },
      cut: 'half',
      select: 'flight',
      params: { kind: 'screw' },
      cites: [P504.hand('Note 3, Screw or Auger conveyor')],
    },
    {
      title: 'Bucket elevator',
      body: 'Buckets lift material from the **boot** to the **head**. Fast buckets throw it out by centrifugal force (v²/gR > 1); slow buckets of the positive and continuous types let it fall out as they turn over.',
      camera: { position: [3.2, 2.6, 3.4], target: [0, 2.0, 0] },
      cut: 'half',
      select: 'buckets',
      params: { preset: 'palm-elevator' },
      cites: [P504.hand('Note 3, Bucket elevators')],
    },
    {
      title: 'Pneumatic conveyor',
      body: 'A fan blows (or sucks) material through a duct at about **1500 m/min**; a **cyclone** drops it out. Any routing and self-cleaning, but it chokes, uses much power and can damage particles. Fan power P = QH/E.',
      camera: { position: [3.0, 3.0, 4.5], target: [0.3, 1.8, 0] },
      cut: 'half',
      select: 'cyclone',
      params: { kind: 'pneumatic', mode: 'positive' },
      cites: [P504.hand('Note 3, Pneumatic conveyor; Pneumatic Systems Design')],
    },
  ],
}

export default scene
