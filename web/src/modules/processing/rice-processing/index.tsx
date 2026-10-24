import type { SceneDef } from '@/modules/types'
import { RICE_CITES as R } from './cites'
import { DEFAULTS, useRice } from './model'
import { EXAM, PRESETS, RicePanel } from './Panel'
import { Scene3D } from './Scene3D'

type V3 = [number, number, number]
const overview = { position: [0.4, 3.6, 6.8] as V3, target: [0.1, 0.6, 0] as V3 }

const scene: SceneDef = {
  id: 'rice-processing',
  title: 'Rice processing line',
  summary:
    'A rice mill from paddy to graded rice: pre-cleaner, parboiling soak tanks and steam autoclave, dryer, a cut-open rubber-roll huller, husk aspirator, paddy separator, abrasive whitener and indented-cylinder grader, with live milling and head-rice yields.',
  Viewport: Scene3D,
  Panel: RicePanel,
  camera: overview,
  extent: 8,
  floorY: 0,
  hatchScale: 0.04,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'half', label: 'Half section (whole line)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'huller', label: 'Huller and aspirator cut open', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: -1.1 }, { normal: [-1, 0, 0], pos: -0.9 }], intersection: true },
    { id: 'polisher', label: 'Whitener and grader cut open', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 1.6 }], intersection: true },
    { id: 'plan', label: 'Plan section at 0.6 m', planes: [{ normal: [0, 1, 0], pos: 0.6 }] },
  ],
  defaultPreset: 'huller',
  cites: [R.flow(), R.parboil(), R.types(), R.anatomy(), R.pqParboil()],
  reset: () => useRice.getState().reset(),
  applyParams: (p) => {
    const id = p.preset as string | undefined
    const pr = id ? [...PRESETS, ...EXAM].find((x) => x.id === id) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useRice.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'Paddy to white rice',
      body:
        'Rough rice (paddy), dried to about **12 % moisture**, is **cleaned**, **shelled** to brown rice (hulls off), **milled** to white rice (bran off) and **graded** into head rice, second heads, screenings and brewers.',
      camera: overview,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      params: { preset: 'raw-long' },
      cites: [R.flow()],
    },
    {
      title: 'Parboiling',
      body:
        'The parboiled branch soaks clean paddy in **warm water**, **steams** it under pressure and dries it before shelling. The starch **gelatinises**, giving firmer, separate, more stable grains that break far less in the mill.',
      camera: { position: [-1.8, 2.2, 3], target: [-1.8, 0.6, -0.3] },
      cut: 'half',
      select: 'parboiler',
      params: { preset: 'parboiled' },
      cites: [R.parboil()],
    },
    {
      title: 'Rubber-roll huller',
      body:
        'Two rubber rolls turn towards each other at **different speeds**. Grains pass the nip and the speed difference shears the husk off without crushing the kernel. The **aspirator** then lifts the light husk on an air stream set between the terminal velocities of husk and grain.',
      camera: { position: [-0.1, 1.6, 2.2], target: [-0.2, 0.6, 0] },
      cut: 'huller',
      select: 'huller',
      params: { focusedStage: 'hulling' },
      cites: [R.flow('p9, shelling'), R.sepAero()],
    },
    {
      title: 'Whitening',
      body:
        'An abrasive stone rotor turns inside a perforated screen and rubs the **bran** off the brown rice. More milling makes whiter rice but loses mass and breaks more kernels.',
      camera: { position: [2.4, 1.8, 2.4], target: [2.15, 0.6, 0] },
      cut: 'polisher',
      select: 'polisher',
      params: { focusedStage: 'polishing' },
      cites: [R.flow('p9, milling → bran'), R.anatomy()],
    },
    {
      title: 'Grading by length',
      body:
        'An indented cylinder sorts kernels by length: **head rice** is at least ¾ of a whole kernel, **second heads** ½–¾, then screenings and **brewers** (about ¼). Head-rice yield sets the value of the milling.',
      camera: { position: [3.6, 1.8, 2.6], target: [3.35, 0.5, 0] },
      cut: 'polisher',
      select: 'grader',
      params: { focusedStage: 'grading' },
      cites: [R.types()],
    },
  ],
}

export default scene
