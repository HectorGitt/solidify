import type { SceneDef } from '@/modules/types'
import { P504 } from './cites'
import { DEFAULTS, usePalmOil } from './model'
import { EXAM, PRESETS, PalmOilPanel } from './Panel'
import { PalmOil3D } from './Scene3D'

type V3 = [number, number, number]
const overview = { position: [0.5, 7, 11.5] as V3, target: [-0.6, 0.9, -0.2] as V3 }

const scene: SceneDef = {
  id: 'palm-oil',
  title: 'Palm oil mill',
  summary:
    'A crude palm oil mill: bunch cages into the steriliser, drum thresher, steam-jacketed digester, a cut-open screw press with its choke cone, clarifier, centrifugal purifier, vacuum dryer and storage tank, with the nut/fibre line feeding the boiler. Live mass balance from 1000 kg of fresh fruit bunches to 225 kg of oil.',
  Viewport: PalmOil3D,
  Panel: PalmOilPanel,
  camera: overview,
  extent: 13,
  floorY: 0,
  hatchScale: 0.07,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'half', label: 'Half section (oil line)', planes: [{ normal: [0, 0, 1], pos: -1.4 }] },
    { id: 'press', label: 'Screw press and digester cut open', planes: [{ normal: [0, 0, 1], pos: 0.8 }, { normal: [1, 0, 0], pos: -2 }, { normal: [-1, 0, 0], pos: -0.4 }], intersection: true },
    { id: 'steriliser', label: 'Steriliser cut open', planes: [{ normal: [0, 0, 1], pos: -0.8 }, { normal: [-1, 0, 0], pos: 3.6 }], intersection: true },
    { id: 'plan', label: 'Plan section at 1 m', planes: [{ normal: [0, 1, 0], pos: 1 }] },
  ],
  defaultPreset: 'press',
  cites: [P504.cpo('pictorial flow'), P504.pomb('mass balance per 1000 kg FFB'), P504.t23('traditional route'), P504.sep('centrifugation eq 18')],
  reset: () => usePalmOil.getState().reset(),
  applyParams: (p) => {
    const id = p.preset as string | undefined
    const pr = id ? [...PRESETS, ...EXAM].find((x) => x.id === id) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) usePalmOil.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'From bunch to crude oil',
      body:
        'Fresh fruit bunches (FFB) arrive in cages. Per **1000 kg FFB** the mill yields about **225 kg crude palm oil** (OER 22.5 %), **67 kg kernels**, and 234 kg empty bunches, 180 kg fibre and 73 kg shell — the fibre and shell fire the boiler that powers the mill.',
      camera: overview,
      cut: false,
      select: null,
      explode: 0,
      playing: true,
      params: { preset: 'pomb' },
      cites: [P504.pomb('per 1000 kg FFB')],
    },
    {
      title: 'Sterilising and threshing',
      body:
        'Cages roll into **horizontal pressure cylinders** where steam stops the enzymes that make free fatty acid and loosens the fruit. A rotary **drum thresher** then knocks the fruit off; the empty bunches go back to the plantation.',
      camera: { position: [-4, 3.2, 4.5], target: [-4, 1, -0.8] },
      cut: 'steriliser',
      select: 'steriliser',
      params: { station: 'steriliser' },
      cites: [P504.cpo('sterilising, threshing')],
    },
    {
      title: 'Digester and screw press',
      body:
        'Beater arms in the steam-heated **digester** mash the fruit and break the oil cells. The **screw press** forces the mash against the **choke cone**: oil and water run out through the perforated barrel, and the press cake (fibre and nuts) leaves at the cone. More back-pressure means less oil lost in the fibre but more broken nuts.',
      camera: { position: [-0.6, 2.4, 4], target: [-0.8, 0.9, 0.8] },
      cut: 'press',
      select: 'press-screw',
      params: { station: 'press' },
      cites: [P504.cpo('digesting, pressing')],
    },
    {
      title: 'Clarification and purifying',
      body:
        'Diluted press liquor settles in the **clarifier**: oil globules rise because oil (900 kg/m³) is lighter than water. A 50 µm globule rises at only **1.36 × 10⁻⁴ m/s**, so a **centrifugal purifier** multiplies g by rω²/g; a **vacuum dryer** then removes the last moisture before storage.',
      camera: { position: [1.6, 3, 2.6], target: [1.2, 0.9, -1.4] },
      cut: 'half',
      select: 'centrifuge',
      params: { preset: 'globule' },
      cites: [P504.sep('eqs 11–12, 18'), P504.pq('p5 Q v')],
    },
    {
      title: 'Nut and fibre separation',
      body:
        'Press cake goes to the **depericarper**: an air column lifts the light fibre to a cyclone while the heavy nuts drop into a polishing drum. Nuts are cracked; shells go to the boiler, kernels are dried and sent to a kernel-crushing plant.',
      camera: { position: [2.8, 3, 4.6], target: [2.2, 0.8, 0.8] },
      cut: false,
      select: 'depericarper',
      params: { station: 'depericarper' },
      cites: [P504.cpo('depericarping, nut cracking'), P504.pomb('nut/fibre separation')],
    },
  ],
}

export default scene
