import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, equilibriumHeight, surfaceHeight, useThreePoint, type ThreePointParams } from './model'
import { ThreePointPanel } from './Panel'
import { ThreePoint3D, ZO } from './Scene3D'

const home = { position: [0.2, 1.7, 6.0] as [number, number, number], target: [0.0, 0.45, 0] as [number, number, number] }
const base = { top: 0.55, theta: 10, k: 50, cat: 'II' as const }
const H_SURF = surfaceHeight(base) - 0.004
const H_EQ = equilibriumHeight(base) ?? 0.35

const scene: SceneDef = {
  id: 'three-point',
  title: 'Three-point linkage & virtual hitch',
  summary:
    'The shared tractor’s three-point linkage as a live four-bar chain carrying a mounted plough. Raise the lift arms, wind the top-link turnbuckle and watch the virtual hitch point V — where the lower-link and top-link lines meet — move. Step through the three working stages: penetration, free-link equilibrium and restrained working.',
  Viewport: ThreePoint3D,
  Panel: ThreePointPanel,
  camera: home,
  extent: 6,
  floorY: 0,
  hatchScale: 0.03,
  timeScale: 1,
  cutPresets: [
    { id: 'body', label: 'Section through the front plough body', planes: [{ normal: [0, 0, 1], pos: 0.08 }] },
    { id: 'centre', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'all', label: 'Section everything (centre line)', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'body',
  cites: [...C.fig65, ...C.fig64, ...C.linkage, ...C.coupler],
  reset: () => useThreePoint.getState().reset(),
  applyParams: (p) => useThreePoint.getState().set({ ...(p as Partial<ThreePointParams>), jump: Date.now() }),
  tour: [
    {
      title: 'A four-bar chain',
      body:
        'The fully mounted hitch is a **four-bar chain**: the tractor (between the lower-link and top-link pivots), the **lower links**, the implement **mast** and the **top link**. The **lift arms** on the rockshaft raise the lower links through the **lift rods**.\n\nThe plough is carried wholly on the linkage.',
      camera: { position: [-1.4, 1.5, 3.2], target: [-0.9, 0.6, 0] },
      cut: false,
      select: 'linkage',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, mode: 'hold', h: 0.55 },
      cites: [...C.fig64, ...C.linkage],
    },
    {
      title: 'The virtual hitch point V',
      body:
        'Extend the **lower-link line** (blue) and the **top-link line** (yellow): they meet at the **virtual hitch point V**. V is the **instantaneous centre** about which the implement moves relative to the tractor — as if it were hitched at one point there.',
      camera: { position: [0.6, 1.2, 6.2], target: [0.4, 0.4, ZO] },
      select: 'v-point',
      params: { mode: 'hold', h: 0.4 },
      cites: C.fig65,
    },
    {
      title: 'The top link moves V',
      body:
        'Winding the **turnbuckle** changes the top-link length. A longer top link tips the mast back and drops V; a shorter one raises V and brings it forward. Try the slider, and see the chart **V vs top-link length**.',
      camera: { position: [-0.8, 1.5, 2.6], target: [-0.7, 0.9, 0] },
      select: 'top-link',
      params: { top: 0.7, mode: 'hold', h: 0.4 },
      cites: [...C.fig65, ...C.linkage],
      check: {
        question: 'You shorten the top link with the turnbuckle. Where does the virtual hitch point V move?',
        options: ['Lower and further back', 'Higher and further forward', 'Nowhere; only the mast tilts'],
        answer: 1,
        explain: 'A shorter **top link** changes the slope of the top-link line, so it meets the lower-link line higher and further forward: V rises and moves forward.',
        reveal: { params: { top: 0.5, mode: 'hold', h: 0.4 } },
      },
    },
    {
      title: 'Stage 1 · Penetration',
      body:
        'Lever in **float**: the plough rests on the soil. V is low and the line of the soil force **S** (orange) passes **above V**, so S turns the plough about V into the ground — it **pulls itself in**. As it sinks the links swing and V rises.',
      camera: { position: [-0.2, 1.3, 5.4], target: [0.0, 0.3, 0] },
      cut: 'body',
      select: 'bodies',
      params: { ...base, mode: 'float', h: H_SURF },
      cites: C.fig65,
    },
    {
      title: 'Stage 2 · Free-link equilibrium',
      body:
        'The plough stops going deeper when the soil-force line passes **through V**: S has no moment about V. This is the depth a free-floating mounted implement finds for itself.',
      camera: { position: [0.2, 1.2, 5.6], target: [0.2, 0.3, 0] },
      select: 'v-point',
      params: { ...base, mode: 'float', h: H_EQ },
      cites: C.fig65,
      check: {
        question: 'Suppose the floating plough went deeper than this, so the soil-force line passed below V. What would it do?',
        options: ['Keep sinking until something stops it', 'Stay at that depth, since it floats', 'Rise back towards this depth'],
        answer: 2,
        explain: 'With S passing **below V** its moment about V turns the plough out of the ground, so it rises until the line passes through V again. The free-link depth is a stable equilibrium.',
      },
    },
    {
      title: 'Stage 3 · Restrained working',
      body:
        'With the arms **held** shallower than the free depth, the line again passes **above V** — the plough still wants to go in — and the **lift rods** carry the restraint. Draft control works in this condition.',
      camera: { position: [-1.2, 1.4, 3.0], target: [-0.6, 0.6, 0] },
      select: 'lift-rods',
      params: { ...base, mode: 'hold', h: H_EQ + 0.05 },
      cites: [...C.fig65, SRC.hy510('p3–4 draft control')],
      check: {
        question: 'Held shallower than its free depth, the plough still tries to go deeper. What stops it?',
        options: ['The lift rods, held up by the ram oil', 'The top link, held by the turnbuckle', 'The hitch balls on the lower links'],
        answer: 0,
        explain: 'The soil-force line passes above V, so the plough tries to rotate into the ground. The **lift rods** carry that restraint, held up by the oil trapped in the lift ram.',
      },
    },
    {
      title: 'Categories, coupler and care',
      body:
        'Pins and balls come in **Categories I, II and III**; a Cat I/II dual linkage swaps the hitch balls. The **automatic coupler** (an inverted-V frame with a release lever) picks the implement up without leaving the seat.\n\nGrease the linkage weekly, don’t oil the lower-arm balls, and **never tow from the top-link point**.',
      camera: { position: [-2.0, 1.3, 2.2], target: [-1.1, 0.5, 0] },
      cut: false,
      select: 'hitch-pins',
      params: { mode: 'hold', h: 0.55, coupler: true },
      cites: [...C.linkage, ...C.coupler, ...C.care],
    },
  ],
}

export default scene
