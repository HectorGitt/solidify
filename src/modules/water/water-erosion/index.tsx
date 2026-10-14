import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useErosion, type ErosionParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [22, 14, 22] as [number, number, number], target: [0, -0.5, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'water-erosion',
  title: 'Water erosion & terraces',
  summary:
    'Rain falls on a sloping field: drops splash soil downhill, sheet flow strips a thin layer, concentrated flow cuts rills and a gully eats back up the slope. The Universal Soil Loss Equation A = R·K·L·S·C·P estimates the annual loss; contouring, strip cropping and diversion terraces with a grassed outlet bring it under tolerance.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 32,
  floorY: -2.2,
  hatchScale: 0.2,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'across', label: 'Across the slope (rills, gully)', planes: [{ normal: [1, 0, 0], pos: 6 }] },
    { id: 'down', label: 'Down the slope (terraces)', planes: [{ normal: [0, 0, 1], pos: -3 }] },
  ],
  defaultPreset: 'none',
  cites: [C.csb('p1–10, Tutorial Problem Set 2'), C.ce('Fig. 1.1'), C.s1('Q1b, Q1c'), C.s2('Q1b, Q1c, Q3b')],
  reset: () => useErosion.getState().reset(),
  applyParams: (p) => useErosion.getState().set(p as Partial<ErosionParams>),
  tour: [
    {
      title: 'Raindrop splash',
      body: 'Erosion is **detachment plus transport**. Raindrops detach soil; on a slope more of the splash lands **downhill**. Cover and mulch absorb the impact.',
      camera: { position: [6, 3, 6], target: [0, 0, 0] },
      cut: 'none',
      select: 'splash',
      playing: true,
      params: { ...DEFAULTS, stage: 'splash', practice: 'none' },
      cites: [C.csb('p2 Fig. 2.1')],
    },
    {
      title: 'Sheet and rill erosion',
      body: 'Runoff first moves as a **sheet**, removing a thin layer; where it concentrates it cuts **rills**, which deepen downslope as the flow gathers.',
      camera: { position: [18, 8, 10], target: [2, 0, 0] },
      cut: 'across',
      select: 'runoff',
      params: { stage: 'rill', practice: 'none' },
      cites: [C.csb('p1–3')],
    },
    {
      title: 'Gully',
      body: 'A rill too large to be removed by tillage is a **gully** — the advanced stage, cutting back up the slope from its head.',
      camera: { position: [20, 6, -2], target: [8, -0.5, -1.5] },
      cut: 'across',
      select: 'soil-block',
      params: { stage: 'gully', practice: 'none' },
      cites: [C.csb('p3 gully')],
    },
    {
      title: 'The USLE',
      body: '**A = R·K·L·S·C·P**. With R = 135, K = 0.47, l = 45.66 m on 6 % (LS = 0.93), C = 0.5 and contouring (P = 0.5), A = **14.7 Mg/ha/yr** — above the 6.72 tolerance. Strip cropping gives 7.4, still too high.',
      camera: overview,
      cut: 'none',
      select: null,
      params: { ...DEFAULTS, practice: 'contour', stage: 'rill' },
      cites: [C.s1('Q1b')],
    },
    {
      title: 'Diversion terraces',
      body: 'Terraces intercept the runoff in broad channels and carry it to a **grassed outlet**, shortening the slope length. With P = 0.10, A = **2.9 Mg/ha/yr**. The channel is sized like a waterway: 0.85 m³/s at 0.9 m/s needs d = 0.27 m on a 1.44 % grade.',
      camera: { position: [4, 6, 18], target: [0, -0.3, 0] },
      cut: 'down',
      select: 'terraces',
      params: { practice: 'terraceUnderground', stage: 'sheet' },
      cites: [C.csb('p6–7'), C.s1('Q1c')],
    },
  ],
}

export default scene
