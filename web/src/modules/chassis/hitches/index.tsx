import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useHitch } from './model'
import { HitchPanel } from './Panel'
import { Scene3D } from './Scene3D'

const view = { position: [-1.2, 1.6, 6.2] as [number, number, number], target: [-0.6, 0.45, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'hitches',
  title: 'Trailed vs semi-mounted vs mounted',
  summary:
    'The same cultivator soil force S at angle θ, carried by a trailed, a semi-mounted and a fully mounted hitch, and by a weight-transfer hitch: which axle gains or loses weight, and the tan θ conditions for when mounting helps, evaluated live.',
  Viewport: Scene3D,
  Panel: HitchPanel,
  camera: view,
  extent: 6.5,
  floorY: -0.5,
  hatchScale: 0.04,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'side', label: 'Side section (shows the tines in the soil)', planes: [{ normal: [0, 0, 1], pos: 0.36 }] },
    { id: 'plan', label: 'Plan at drawbar height', planes: [{ normal: [0, 1, 0], pos: 0.45 }] },
  ],
  cites: [SRC.mac502('Ch 6, Figs 6.1–6.3, 6.10–6.15, eqs 6.11–6.31'), SRC.hitch502('trailed, semi-mounted and mounted hitches'), SRC.am502('attachment modes')],
  reset: () => useHitch.getState().reset(),
  applyParams: (p) => useHitch.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'One soil force, different hitches',
      body:
        'A cultivator’s tines meet a soil force **S** (orange) acting backwards and downwards at angle **θ**, b behind the hitch and z below the surface. How much of it reaches the tractor — and which axle gains weight — depends on how the implement is hitched.',
      camera: view,
      select: 'tines',
      cut: 'side',
      playing: true,
      params: { ...DEFAULTS },
      cites: [SRC.mac502('Fig 6.10')],
    },
    {
      title: 'Trailed',
      body:
        'A trailed implement rides on its own wheels and is hitched at one point, the drawbar pin. Only the horizontal pull **S cos θ** acts on the tractor, at drawbar height y′: Vr = Wr + S cos θ·y′/x.',
      camera: { position: [-2.4, 1.4, 5.2], target: [-1.4, 0.4, 0] },
      select: 'implement',
      cut: false,
      params: { hitch: 'trailed' },
      cites: [SRC.mac502('Fig 6.1, eqs 6.11–6.12')],
      check: {
        question: 'On the trailed hitch, if the drawbar were set higher, the weight transferred to the rear axle would be…',
        options: ['Larger', 'Smaller', 'No different'],
        answer: 0,
        explain: 'The pull S cos θ acts at drawbar height y′, so its moment is S cos θ·y′ and **Vr = Wr + S cos θ·y′/x**: a higher drawbar moves more weight onto the rear (and brings the front closer to lifting).',
      },
    },
    {
      title: 'Semi-mounted',
      body:
        'Pinned to the lower links with a castor wheel at the rear: free to pivot vertically but rigid in plan (ploughs, offset mowers). Part of the vertical soil force now reaches the tractor.',
      params: { hitch: 'semi' },
      cites: [SRC.mac502('Fig 6.2, eq 6.13')],
    },
    {
      title: 'Fully mounted',
      body:
        'Carried rigidly on the three-point linkage, so the whole soil force — vertical part included — acts on the tractor. With θ > 0 it adds the most weight to the rear axle. Watch the rear arrow grow.',
      camera: view,
      params: { hitch: 'mounted', theta: 20 },
      cites: [SRC.mac502('Fig 6.3, eqs 6.15–6.16')],
      check: {
        question: 'With the cultivator fully mounted, you steepen θ from 20° to 35°. What happens to the rear axle load?',
        options: ['It falls', 'It stays the same', 'It rises'],
        answer: 2,
        explain: 'A steeper θ gives a larger downward component **S sin θ** acting on the tractor through the linkage, pressing the rear wheels down: here Vr rises from about 25.9 to 30.5 kN.',
        reveal: { params: { hitch: 'mounted', theta: 35 } },
      },
    },
    {
      title: 'When does mounting help?',
      body:
        'Set θ = 0: the deep, horizontal soil force on a mounted implement now **lifts** weight off the rear. The tan θ conditions in Controls switch from true to false as you move θ — e.g. mounted beats trailed only when tan θ > (z + y′)/(x + x′ + b).',
      params: { hitch: 'mounted', theta: 0 },
      cites: [SRC.mac502('eqs 6.17–6.21, Tables 6.1–6.2, Fig 6.12')],
    },
    {
      title: 'Weight-transfer hitch',
      body:
        'For trailed implements a chain from the raised linkage to the implement tongue holds a constant lift force **F**, set by a hydraulic valve. Part of the implement’s weight moves onto the tractor rear axle.',
      camera: { position: [-2.0, 1.8, 5.0], target: [-1.0, 0.5, 0] },
      select: 'wth-chain',
      params: { hitch: 'wth', theta: 20 },
      cites: [SRC.mac502('Fig 6.15, eqs 6.30–6.31')],
      check: {
        question: 'You raise the lift force F in the chain from 3 kN to 6 kN. What happens to the tractor’s rear axle load?',
        options: ['It rises', 'It falls', 'It is unchanged'],
        answer: 0,
        explain: 'A larger **lift force** carries more of the implement’s weight on the tractor instead of the implement’s own wheels: here Vr rises from about 28.4 to 29.7 kN.',
        reveal: { params: { hitch: 'wth', theta: 20, F: 6 } },
      },
    },
    {
      title: 'Compare them',
      body: 'Open **Controls**: the table and the gain-vs-angle chart compare all four hitches for your soil force; the Working shows the selected hitch’s equations with numbers.',
      camera: view,
      select: null,
      params: { ...DEFAULTS },
    },
  ],
}

export default scene
