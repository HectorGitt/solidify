import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, ISU_DISK, ISU_TRACTOR, useCosts, type CostParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [18, 46, 58] as [number, number, number], target: [0, 0, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'costs',
  title: 'Field capacity & machinery costs',
  summary:
    'A tractor and trailed tandem disk work a plot in lands. Headland turns, overlap and stops eat into the time, giving the field efficiency and the effective capacity C = W·S·FE/10. A machinery-cost worksheet then turns ownership and operating costs into a cost per hour, per hectare and per acre.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  follow: 'tractor',
  extent: 90,
  floorY: 0,
  hatchScale: 0.6,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'tractor', label: 'Section the tractor (y = 1 m)', planes: [{ normal: [0, 1, 0], pos: 1.0 }] },
  ],
  defaultPreset: 'none',
  cites: [C.mgmt('p1–8, Tables 1–3, worked examples'), C.exam1920('capacity and cost questions'), C.exam2324('capacity and cost questions')],
  reset: () => useCosts.getState().reset(),
  applyParams: (p) => useCosts.getState().set(p as Partial<CostParams>),
  tour: [
    {
      title: 'Working a field in lands',
      body:
        'The tractor pulls a **tandem disk** up and down a plot. Each pass leaves a worked strip; at each end it lifts the disk and turns on the **headland**. Passes are gathered outward from the centre line, so the turns get wider as the land grows.',
      camera: overview,
      cut: 'none',
      select: null,
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.mgmt('p7–8')],
    },
    {
      title: 'Theoretical capacity',
      body: 'If the full width W were used at speed S all the time, the machine would cover **C_t = W·S/10 ha/h** (W in m, S in km/h). Nothing real does that.',
      camera: { position: [-8, 14, 26], target: [-6, 0, 2] },
      select: 'worked-strips',
      cites: [C.mgmt('p8 field capacity')],
    },
    {
      title: 'Overlap',
      body: 'Each pass overlaps the last a little (orange) so no strip is missed. That width is worked twice, so the effective width is only **W(1 − overlap)**.',
      camera: { position: [6, 10, 14], target: [6, 0, 0] },
      select: 'overlap',
      params: { overlap: 0.15 },
      cites: [C.mgmt('p7 overlapping')],
    },
    {
      title: 'Turning time',
      body: 'At each **headland** the disk is lifted, the tractor slows and turns, and the disk is lowered again — time with no work done. Longer passes mean fewer turns per hectare.',
      camera: { position: [52, 18, 22], target: [32, 0, 0] },
      select: 'headlands',
      params: { overlap: DEFAULTS.overlap },
      cites: [C.mgmt('p7 turning at the ends')],
    },
    {
      title: 'Field efficiency and effective capacity',
      body: 'Field efficiency **FE = theoretical time ÷ actual time**. The effective capacity is **C = W·S·FE/10 ha/h**, or **W(ft)·S(mph)·FE/8.25 ac/h** in US units. See “Where the time goes” in the Controls tab.',
      camera: overview,
      select: null,
      cites: [C.mgmt('p8')],
    },
    {
      title: 'Ownership costs',
      body: 'Ownership costs come whether the machine works or not: **capital recovery** (depreciation plus interest, using the capital recovery factor and the remaining salvage value) and **taxes, insurance and housing** (1 % of the price). Spread over more hours, they cost less per hectare.',
      camera: overview,
      params: { ...ISU_TRACTOR, ...ISU_DISK },
      cites: [C.mgmt('p1–4')],
    },
    {
      title: 'Operating costs and cost per acre',
      body: 'Repairs (from the accumulated repair-cost curves), fuel (0.044 gal/h per PTO hp), lubrication (15 % of fuel) and labour (wage × 1.1) make the operating cost. For the worked example the tractor costs **$46.56/h**, the used disk **$19.59/h**: $66.15/h ÷ 16 ac/h = **$4.13/acre**.',
      camera: overview,
      params: { W: 28 * 0.3048, S: 6 * 1.609344, feModel: false, FE: 0.79, units: 'imperial', passes: 6, L: 120 },
      cites: [C.mgmt('p4–8 worked examples')],
    },
  ],
}

export default scene
