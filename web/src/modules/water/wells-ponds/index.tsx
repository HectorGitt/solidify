import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, POND_S1, useWells, type WellParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [30, 22, 34] as [number, number, number], target: [0, 5, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'wells-ponds',
  title: 'Wells, aquifers & farm ponds',
  summary:
    'A pumped well in an unconfined (gravity) or confined (artesian) aquifer, cut away to show the cone of depression growing to steady state, with observation wells and the Dupuit–Thiem discharge. A farm pond behind an earth embankment shows spillways, drain, sediment pool and the seasonal draw-down of its storage.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 60,
  floorY: -2,
  hatchScale: 0.4,
  timeScale: 1,
  cutPresets: [
    { id: 'half', label: 'Half section through the well', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0 }], intersection: true },
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 80 }] },
  ],
  defaultPreset: 'half',
  cites: [C.wrd('p1–11, Figs. 1–4, Tables 1–3, Problem Set VI'), C.s1('Q2d, Q3d, Q4c–d, Q5c'), C.s2('Q4d, Q5c')],
  reset: () => useWells.getState().reset(),
  applyParams: (p) => useWells.getState().set(p as Partial<WellParams>),
  tour: [
    {
      title: 'Gravity (unconfined) well',
      body: 'The well penetrates the **water table**; the water is not under pressure. Pumping draws the table down into an inverted **cone of depression** whose edge is the radius of influence **R**.',
      camera: { position: [0, 10, 40], target: [0, 6, 0] },
      cut: 'half',
      select: 'aquifer',
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.wrd('p5–6, Fig. 3')],
    },
    {
      title: 'Dupuit–Thiem discharge',
      body: 'Darcy’s law for radial flow, integrated from r_w to R: **Q = πK(H² − h_w²)/ln(R/r_w)**. For K = 1.824 m/day, H = 24.38 m, h_w = 15.24 m and R = 183 m, Q = **324 m³/day**.',
      camera: { position: [6, 8, 22], target: [0, 6, 0] },
      cut: 'half',
      select: 'well',
      cites: [C.s1('Q3d')],
    },
    {
      title: 'Observation wells',
      body: 'Drawdowns in two **observation wells** give the conductivity: K = Q ln(r₂/r₁)/[π(h₂² − h₁²)]. 1440 m³/day with 2.62 m at 14 m and 1.50 m at 40 m gives K = **13.5 m/day**, T = **243 m²/day**.',
      camera: { position: [-10, 10, 24], target: [-6, 6, 0] },
      cut: 'half',
      select: 'obs-wells',
      params: { K: 13.47, H: 18, sw: 8.93, rw: 0.15, R: 300, r1: 14, r2: 40 },
      cites: [C.s1('Q4d')],
    },
    {
      title: 'Artesian (confined) well',
      body: 'A pervious stratum between impervious beds, fed from a recharge area, is under pressure: the water rises above the confining bed. Pumping lowers the **piezometric surface**, not the aquifer: **Q = 2πKd(H − h_w)/ln(R/r_w)**.',
      camera: { position: [0, 12, 40], target: [0, 6, 0] },
      cut: 'half',
      select: 'piezometric',
      params: { mode: 'confined', K: 13.5, H: 20, d: 10, sw: 6, R: 300, rw: 0.15 },
      cites: [C.wrd('p6, Fig. 2, Fig. 4')],
    },
    {
      title: 'Farm pond',
      body: 'An on-stream pond: an **embankment** across a valley with principal and emergency **spillways**, a drain pipe and a sediment pool. Storage = needs ÷ (1 − losses): 11.25 ha-m of needs with 20 % loss → **14.06 ha-m**.',
      camera: { position: [36, 20, 34], target: [-4, 2, 0] },
      cut: 'none',
      select: 'pond-water',
      params: { mode: 'pond', ...POND_S1 },
      cites: [C.wrd('p2–4, Table 1'), C.s1('Q5c')],
    },
  ],
}

export default scene
