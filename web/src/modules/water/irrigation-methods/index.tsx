import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useIrr, type IrrParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [24, 16, 26] as [number, number, number], target: [0, -0.6, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'irrigation-methods',
  title: 'Irrigation methods',
  summary:
    'One field irrigated six ways: basins, borders and furrows (surface methods, with the wetting front advancing from the head), a solid-set sprinkler system with rotating heads and overlapping circles, drip emitters wetting onion-shaped bulbs, and sub-irrigation by water-table control. Cut the soil to compare wetting depth with the root zone.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 36,
  floorY: -2.6,
  hatchScale: 0.24,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'quarter', label: 'Quarter cut (head–tail and across)', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0 }], intersection: true },
    { id: 'long', label: 'Along the run (head → tail)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'across', label: 'Across the furrows / laterals', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  ],
  defaultPreset: 'quarter',
  cites: [C.ipp('p5–11 surface, drip, sprinkler and sub-irrigation; selection'), C.sg('p4–9'), C.s1('Q5b'), C.s2('Q4b')],
  reset: () => useIrr.getState().reset(),
  applyParams: (p) => useIrr.getState().set(p as Partial<IrrParams>),
  tour: [
    {
      title: 'Surface irrigation: furrows',
      body: 'Water is turned on at the **head ditch** and flows downslope in each furrow, diminishing as it infiltrates. It seeps through the furrow bottom and sides, so only **½ to ⅕** of the surface is wetted — less evaporation.',
      camera: overview,
      cut: 'quarter',
      select: 'surface-water',
      playing: true,
      params: { ...DEFAULTS, method: 'furrow' },
      cites: [C.ipp('p5–6 furrows')],
    },
    {
      title: 'Head-to-tail gradient',
      body: 'The head is wet for longer than the tail, so the wetting depth falls from head to tail (here **1.8 → 1.2 m**). Water below the **root zone** at the head is **deep percolation**; the tail may be under-irrigated.',
      camera: { position: [4, 2, 26], target: [0, -1.2, 0] },
      cut: 'long',
      select: 'deep-percolation',
      params: { method: 'border', dHead: 1.8, dTail: 1.2, root: 1.6 },
      cites: [C.ipp('p5–6'), C.s1('Q3c')],
    },
    {
      title: 'Basins',
      body: 'Controlled flooding: level plots surrounded by **levees** are filled to the desired depth, then the water infiltrates. The depth is uniform because the plots are level.',
      camera: { position: [20, 12, 20], target: [0, 0, 0] },
      cut: 'quarter',
      select: 'surface-water',
      params: { method: 'basin', root: 1.8 },
      cites: [C.ipp('p5 checks/basins')],
    },
    {
      title: 'Sprinklers',
      body: 'A **pump**, **mainline**, **laterals** and **risers** with rotating heads spray water like rain. Circles overlap so the field is wetted evenly. No land grading is needed, but the pumping power and the cost are high, and wind spoils the pattern.',
      camera: { position: [16, 9, 16], target: [0, 0.5, -2] },
      cut: 'none',
      select: 'heads',
      params: { method: 'sprinkler', root: 0.9 },
      cites: [C.ipp('p7–9, Fig. 2')],
    },
    {
      title: 'Drip and sub-irrigation',
      body: 'Drip: the **control head** filters and doses the water; emitters on plastic laterals give 1–8 L/h, each wetting an onion-shaped **bulb**. Sub-irrigation raises a **water table** from tile drains and lets capillarity feed the roots, leaving the surface dry.',
      camera: { position: [-6, 4, 12], target: [-6, -0.4, 0] },
      cut: 'across',
      select: 'wetted-zone',
      params: { method: 'drip', root: 0.9 },
      cites: [C.ipp('p6–7, Fig. 1; p9–10')],
    },
  ],
}

export default scene
