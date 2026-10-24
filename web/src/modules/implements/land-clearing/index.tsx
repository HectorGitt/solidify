import type { CameraPose, SceneDef } from '@/modules/types'
import { C, DEFAULTS, useClearing, type ClearingParams } from './model'
import { LandClearingPanel, setAndEnter } from './Panel'
import { LandClearing3D, enterStage } from './Scene3D'

const OVERVIEW: CameraPose = { position: [-48, 30, 42], target: [0, 0, 0] }

const scene: SceneDef = {
  id: 'land-clearing',
  title: 'Land clearing',
  summary:
    'A 100 m × 24 m bush plot cleared stage by stage: survey with a 0.1 ha tree-count strip, knock down by anchor chaining between two crawlers, a bulldozer with tree pusher or a shear blade with stinger, windrow with a clearing rake, burn, then root-plough. Choose a method from the site factors and work out the clearing cost.',
  Viewport: LandClearing3D,
  Panel: LandClearingPanel,
  camera: OVERVIEW,
  extent: 100,
  floorY: -0.5,
  hatchScale: 0.5,
  timeScale: 1,
  cutPresets: [
    { id: 'lane', label: 'Section along a working lane', planes: [{ normal: [0, 0, 1], pos: -9 }] },
    { id: 'centre', label: 'Section on the centre line', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: undefined,
  cites: [C.bush('p1–4 land clearing'), C.am('§11 land clearing and forming'), C.guide1819('Q2c costing')],
  reset: () => {
    useClearing.getState().reset()
    enterStage()
  },
  applyParams: (p) => {
    const q = p as Partial<ClearingParams>
    if (q.stage !== undefined || q.method !== undefined || q.veg !== undefined) setAndEnter(q)
    else useClearing.getState().set(q)
  },
  tour: [
    {
      title: 'Clearing land for farming',
      body: 'Agricultural land clearing is the systematic removal of vegetation, trees and debris — by hand, chemicals, explosives or machines — working to about **30 cm** while **preserving the topsoil**. The mechanical procedure is **survey → knock down → windrow → burn → till**.',
      camera: OVERVIEW,
      cut: false,
      select: null,
      playing: true,
      params: { ...DEFAULTS, stage: 'survey', auto: false },
      cites: [C.bush('p1–2')],
    },
    {
      title: 'Survey: the tree count',
      body: 'Walk a **100 m line** and count every stem within **5 m each side**: 0.1 ha, so stems per hectare = 10 × the count. Area, vegetation type and density, and topography decide the method and the cost.',
      camera: { position: [-30, 14, 22], target: [-10, 0, 0] },
      select: 'count-strip',
      params: { stage: 'survey', auto: false },
      cites: [C.am('§11.2.2'), C.bush('p2 survey, p3 factors')],
    },
    {
      title: 'Knock down: anchor chaining',
      body: 'A heavy **chain** between two crawlers — one along the edge, one through the bush — drags the trees down as its bight passes. It works for trees up to **45 cm** at up to **2500 stems/ha**; thicker trees stand up to it.',
      camera: { position: [-62, 16, 26], target: [-40, 0, 0] },
      select: 'anchor-chain',
      params: { stage: 'knockdown', method: 'chain', veg: 'regrowth', auto: false },
      cites: [C.am('§11.3.5'), C.bush('p2')],
    },
    {
      title: 'Tree pusher and shear blade',
      body: 'A **tree pusher** meets the trunk high up for leverage and the toothed blade lifts the roots. A **shear blade** cuts at ground level, its **stinger** splitting big trees first, and leaves the stumps. A straight dozer blade pushes trees too — but takes the topsoil with it.',
      camera: { position: [-58, 9, -18], target: [-46, 1, -9] },
      select: 'crawler-blade',
      params: { stage: 'knockdown', method: 'dozer', veg: 'savanna', auto: false },
      cites: [C.bush('p3–4, Figs 1–2'), C.am('§11')],
    },
    {
      title: 'Windrow, burn and root-plough',
      body: 'The **clearing rake** gathers the debris into windrows while the soil falls through its slats. The windrows are burnt, then a **root plough** undercuts the remaining roots at **20–50 cm** before ploughing and harrowing.',
      camera: { position: [-55, 20, 30], target: [-25, 0, 0] },
      select: 'crawler-blade',
      params: { stage: 'windrow', method: 'dozer', auto: true },
      cites: [C.bush('p2'), C.am('§11 rake, root plough')],
    },
  ],
}

export default scene
