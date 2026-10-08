import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useMb, type MbParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const field = { position: [-1, 4.5, 6.5] as [number, number, number], target: [-1.5, 0, -0.3] as [number, number, number] }
const close = { position: [0.9, 0.7, 1.6] as [number, number, number], target: [-0.4, 0, -0.2] as [number, number, number] }

const scene: SceneDef = {
  id: 'mouldboard',
  title: 'Mouldboard plough',
  summary:
    'A mounted three-bottom mouldboard plough cuts, lifts and inverts the furrow slice behind the shared tractor. Share, mouldboard, landside, frog, coulter and jointer are shown on one bottom close up; draft = unit draft × furrow area and power = draft × speed, with the centre of draft, centre of power and ploughing patterns.',
  Viewport: Scene3D,
  Panel,
  camera: field,
  follow: 'tractor',
  extent: 14,
  floorY: -0.5,
  hatchScale: 0.05,
  timeScale: 0.5,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'across', label: 'Across the furrows (x = −0.5 m)', planes: [{ normal: [1, 0, 0], pos: -0.5 }] },
    { id: 'land', label: 'Along the landside (z = 0)', planes: [{ normal: [0, 0, 1], pos: 0.0 }] },
  ],
  defaultPreset: 'none',
  cites: [C.am('§12 primary tillage: mouldboard plough'), C.guide1819('plough sketch and draft numerical'), C.bush('p4–7 tillage types')],
  reset: () => useMb.getState().reset(),
  applyParams: (p) => useMb.getState().set(p as Partial<MbParams>),
  tour: [
    {
      title: 'Ploughing',
      body: 'The tractor lowers a three-bottom **mouldboard plough** into work. Each bottom cuts a furrow slice and turns it over to the right; the rear bottom leaves an **open furrow** that the right rear tyre runs in on the next pass.',
      camera: field,
      cut: 'none',
      select: null,
      playing: true,
      params: { ...DEFAULTS, mode: 'field' },
      cites: [C.am('§12')],
    },
    {
      title: 'One bottom',
      body: 'The **share** cuts the slice horizontally, the **disc coulter** cuts the furrow wall, and the **mouldboard** lifts, turns and inverts the slice. The **landside** presses on the furrow wall against the side thrust; all three bolt to the **frog**, carried on the **standard**.',
      camera: close,
      select: 'board',
      params: { mode: 'bottom' },
      cites: [C.am('§12 parts'), C.guide1819('labelled bottom')],
    },
    {
      title: 'Suction',
      body: 'The share point is bent **down** (vertical suction) and **towards the land** (horizontal suction) by 0.48–1.25 cm, so the bottom is drawn into the ground and held to its width. Here the gaps are drawn 6× larger.',
      camera: { position: [0.5, 0.15, 0.9], target: [0, -0.15, 0] },
      select: 'share',
      params: { mode: 'bottom', exaggerate: true },
      cites: [C.am('§12 suction 0.48–1.25 cm')],
    },
    {
      title: 'The furrow slice',
      body: 'Seen in section, the w × d slice rides up the board, rolls over its furrow-side edge and comes to rest leaning on the last slice. The **jointer** skims the top corner so trash ends up at the bottom.',
      camera: { position: [-2.2, 0.5, -0.1], target: [-0.6, 0, -0.3] },
      select: 'slice',
      cut: 'across',
      params: { mode: 'bottom' },
      cites: [C.am('§12 furrow slice')],
    },
    {
      title: 'Draft and power',
      body: 'Draft = unit draft × furrow area (sand ≈ 1, clay ≈ 2 N/cm²); power = draft × speed. A 150 × 60 mm furrow in clay at 1 m/s gives 180 N and **180 W ≈ 0.245 hp**.',
      camera: field,
      cut: 'none',
      select: null,
      params: { mode: 'field', bottoms: 1, width: 0.15, depth: 0.06, unitDraft: 2, speed: 3.6 },
      cites: [C.am('§12 draft example')],
    },
    {
      title: 'Centre of draft and line of draft',
      body: 'The centre of draft sits about 5 cm in from the landside at the top of the share; the centre of power is mid-drawbar. The **line of draft** joining them should be straight and parallel to travel — any offset pulls the tractor sideways.',
      camera: { position: [-2, 6, 0.5], target: [-1.5, 0, 0] },
      params: { ...DEFAULTS, mode: 'field', showDraft: true },
      cites: [C.am('§12 hitching the plough')],
    },
  ],
}

export default scene
