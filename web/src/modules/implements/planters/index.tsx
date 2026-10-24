import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, usePlant, type PlantParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const field = { position: [-1, 4, 6] as [number, number, number], target: [-1.5, 0, -0.3] as [number, number, number] }

const scene: SceneDef = {
  id: 'planters',
  title: 'Seed drill & planter',
  summary:
    'A mounted 5 × 150 mm seed drill (box, agitator, fluted-roller metering, seed tubes, openers, coverers, ground-wheel chain drive) drops seed into slots; switch to a seed-cum-fertilizer drill, a row-crop planter with rotating cell plates, or a jab planter. Calibration N = L/(πD), L = 10000·A/W.',
  Viewport: Scene3D,
  Panel,
  camera: field,
  follow: 'tractor',
  extent: 14,
  floorY: -0.4,
  hatchScale: 0.04,
  timeScale: 0.5,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'rows', label: 'Along a seed row (z = 0)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: 'none',
  cites: [C.am('§13 planting'), C.guide('2018-2019', 'drill vs planter'), C.bush('p4–7 no-till planting')],
  reset: () => usePlant.getState().reset(),
  applyParams: (p) => usePlant.getState().set(p as Partial<PlantParams>),
  tour: [
    { title: 'Drilling', body: 'A mounted **seed drill** opens five slots 150 mm apart, drops seed into them and covers it. The ground wheel drives the metering, so the rate per hectare does not change with speed.', camera: field, cut: 'none', select: null, playing: true, params: { ...DEFAULTS }, cites: [C.am('§13')] },
    { title: 'Metering', body: 'Under the **seed box** the **fluted rollers** carry seed out in their flutes; an **agitator** keeps it flowing. Sliding the rollers to expose more flute (rate chart on the shaft) changes the rate.', camera: field, select: 'metering', xray: true, cites: [C.am('§13 fluted roller, agitator')] },
    { title: 'Openers, tubes and coverers', body: 'Seed falls down the **seed tubes** to the boots behind the **furrow openers**; the **coverers** close the slot. Cut along a row to see seeds in the slot.', camera: field, select: 'openers', xray: false, cut: 'rows', cites: [C.am('§13 parts')] },
    { title: 'Calibration', body: 'For 0.1 ha a 5 × 150 mm drill (W = 0.75 m) covers **L = 10000·A/W = 1333 m**, i.e. **N = L/(πD) = 425** turns of a 1 m wheel. At 80 kg/ha collect 8 kg — **1.6 kg per tube**.', camera: field, cut: 'none', select: 'ground-wheel', params: { kind: 'drill', rows: 5, spacing: 0.15, rate: 80, D: 1, area: 0.1 }, cites: [C.am('§13 calibration example')] },
    { title: 'Row-crop planter', body: 'A **planter** places single seeds: the **cell plate** turning in each hopper drops one seed per cell down the tube; the **press wheel** firms the soil. Spacing = πD/(ratio × cells).', camera: field, select: 'plate-0', xray: true, params: { kind: 'planter' }, cites: [C.am('§13 planter, Fig 13.8')] },
    { title: 'Jab planter', body: 'The **jab planter** is pushed into the ground by hand: ground pressure opens the jaws and the seed drops.', camera: { position: [0.8, 0.6, 0.9], target: [0, 0.1, 0] }, select: 'jaws', xray: false, params: { kind: 'jab' }, cites: [C.am('§13 jab planter')] },
  ],
}

export default scene
