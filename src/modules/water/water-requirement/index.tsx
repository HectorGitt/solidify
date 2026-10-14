import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, EXAM_EVENT, useReq, type ReqParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [14, 14, 26] as [number, number, number], target: [-3, -0.8, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'water-requirement',
  title: 'Crop water requirement & efficiencies',
  summary:
    'Water from a reservoir travels down a canal to a maize field and into the root zone, with seepage, runoff and deep percolation losses shown as flows. Evapotranspiration rises from the crop and drains a soil-water “bucket” between irrigations. Blaney–Criddle and Jensen–Haise estimate ET; the leaching requirement and the six irrigation efficiencies are worked from the flows.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 40,
  floorY: -2.6,
  hatchScale: 0.25,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'long', label: 'Along the field (head → tail)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0 }], intersection: true },
    { id: 'canal', label: 'Across the canal', planes: [{ normal: [1, 0, 0], pos: -14 }] },
  ],
  defaultPreset: 'long',
  cites: [C.ipp('p1–5, p12 Problem Set'), C.sg('p1–4'), C.s1('Q3c'), C.s2('Q2c')],
  reset: () => useReq.getState().reset(),
  applyParams: (p) => useReq.getState().set(p as Partial<ReqParams>),
  tour: [
    {
      title: 'From source to root zone',
      body: 'Water **W_i** leaves the **reservoir**, loses some to seepage in the **canal**, and **W_d** reaches the field. Conveyance efficiency **E_c = W_d/W_i** — 105/175 = **60 %** in the worked problem.',
      camera: { position: [-8, 8, 14], target: [-14, 0, 0] },
      cut: 'canal',
      select: 'canal',
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.ipp('p3'), C.s1('Q3c')],
    },
    {
      title: 'Stored, runoff and deep percolation',
      body: 'Of the water delivered, some runs off at the **tail drain**, some is **stored** in the root zone (W_s) and any below the root zone is **deep percolation**. **E_a = W_s/W_d**: 2484/3024 = **82.1 %**.',
      camera: { position: [0, 2, 24], target: [0, -1.2, 0] },
      cut: 'long',
      select: 'stored',
      params: { ...EXAM_EVENT },
      cites: [C.ipp('p3–4')],
    },
    {
      title: 'Storage and distribution',
      body: 'The root zone held a deficit **W_n** = 0.20 × 1.8 × 0.6 × 20 000 = 4320 m³, so **E_s = 57.5 %**. Depth falling linearly from 1.8 to 1.2 m gives **E_d = 1 − y/d = 90 %**.',
      camera: { position: [4, 1, 22], target: [0, -1.4, 0] },
      cut: 'long',
      select: 'root-zone',
      cites: [C.ipp('p4'), C.s1('Q3c')],
    },
    {
      title: 'Evapotranspiration',
      body: 'Vapour rising from the crop is the **consumptive use**. Blaney–Criddle: ET = K·K_t·p(0.46T + 8.13) — about **149 mm** for July at Ile-Ife. ET rises with temperature and wind and falls with humidity.',
      camera: { position: [10, 8, 16], target: [0, 1.5, 0] },
      cut: 'none',
      select: 'crop',
      params: { etMethod: 'bc' },
      cites: [C.ipp('p1–2; p12 Problem 1'), C.sg('p4')],
    },
    {
      title: 'When to irrigate',
      body: 'The **bucket** is the root zone: full at field capacity, empty at wilting point. ET drains it; at the trigger depletion (50–60 %) it turns red and irrigation refills it. Extra water for **leaching** (LR = EC_i/EC_d) carries salts below the roots.',
      camera: { position: [20, 5, 4], target: [14, 1, -5] },
      cut: 'none',
      select: 'bucket',
      params: { speed: 4 },
      cites: [C.sg('p4'), C.ipp('p3, p5')],
    },
  ],
}

export default scene
