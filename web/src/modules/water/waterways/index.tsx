import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useWaterway, type WaterwayParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [22, 12, 20] as [number, number, number], target: [0, 0, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'waterways',
  title: 'Grassed waterways',
  summary:
    'A grass-lined waterway carrying runoff down a 40 m slope. Choose a parabolic, trapezoidal or triangular section; the channel is sized with Manning’s equation so the velocity stays below the permissible value for the grass, and freeboard is added. Grass bends as the flow deepens and particles show faster flow at the centre than at the grassy boundary.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 40,
  floorY: -0.8,
  hatchScale: 0.2,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'cross', label: 'Cross-section (mid-length)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'long', label: 'Along the centre line', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: 'cross',
  cites: [C.vw('book pp. 134–149, Fig. 7.1, Tables 7.2–7.4, Ex. 7.1–7.2'), C.s1('Q2b, Q2c'), C.s2('Q3d, Q5d')],
  reset: () => useWaterway.getState().reset(),
  applyParams: (p) => useWaterway.getState().set(p as Partial<WaterwayParams>),
  tour: [
    {
      title: 'What a grassed waterway does',
      body: 'It carries runoff from terraces, contour furrows, diversions and pond spillways down the slope **without channel or gully erosion**. Vegetation is the lining; it is not for continuous flows, which kill the grass.',
      camera: overview,
      cut: 'none',
      select: 'ground',
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.vw('book p134')],
    },
    {
      title: 'Cross-section shapes',
      body: '**Parabolic** is natural-like; **trapezoidal** is blade-built with sides 4:1 or flatter for mowing and crossing; **triangular** is V-bottomed. With flow and deposition, trapezoids and triangles become parabolic.',
      camera: { position: [16, 3, 0], target: [0, 0.3, 0] },
      cut: 'cross',
      select: 'flow',
      params: { shape: 'parabolic' },
      cites: [C.vw('Fig. 7.1')],
    },
    {
      title: 'Manning velocity and capacity',
      body: 'v = **R^(2/3) s^(1/2) / n** with R = a/p, and q = a·v. Particles are faster at the centre and near the surface, slower in the grass at the boundary.',
      camera: { position: [10, 4, 8], target: [0, 0.3, 0] },
      cut: 'cross',
      select: 'grass',
      params: { shape: 'trapezoidal' },
      cites: [C.vw('Eq. 7.1–7.2, Fig. 7.2')],
      check: {
        question: 'The same channel, with the same depth and grass, is laid on a 6 % slope instead of 3 %. What happens to the velocity?',
        options: ['It doubles', 'It rises about 41 %', 'It stays the same'],
        answer: 1,
        explain: 'In **Manning’s equation** v grows with **s^(1/2)**: doubling the slope multiplies v by √2 ≈ 1.41.',
      },
    },
    {
      title: 'Design: 5.67 m³/s on 3 %',
      body: 'a = Q/v = 3.24 m², R = (vn/√s)^1.5 = 0.414 m, p = a/R = 7.82 m. Solving the quadratic gives **d = 0.63 m, b = 2.64 m**; with 0.1 m freeboard **D = 0.73 m, T = 8.47 m**.',
      camera: { position: [14, 4, 6], target: [0, 0.3, 0] },
      cut: 'cross',
      select: 'freeboard',
      params: { ...DEFAULTS },
      cites: [C.s1('Q2b')],
      check: {
        question: 'The grass can only stand a lower velocity than 1.75 m/s. For the same 5.67 m³/s, how must the waterway change?',
        options: ['Wider, to give more flow area', 'Narrower, to speed the flow up', 'The same, since Q is unchanged'],
        answer: 0,
        explain: 'The flow area is **a = Q/v**, so a lower permissible velocity needs a bigger section, which in a shallow grassed channel means a wider bottom.',
      },
    },
    {
      title: 'Grass retardance',
      body: 'At low flow the grass stands up and n is high; as the flow deepens the blades bend over and n falls towards 0.03–0.04. Lower the flow to see the blades stand.',
      camera: { position: [6, 2, 6], target: [0, 0.2, 0] },
      cut: 'cross',
      select: 'grass',
      params: { flowFrac: 0.15 },
      cites: [C.vw('Fig. 7.3, Table 7.3')],
      check: {
        question: 'As the flow deepens, the grass lies flat and Manning’s n falls. At the same hydraulic radius and slope, what happens to the velocity?',
        options: ['It falls', 'It stays the same', 'It rises'],
        answer: 2,
        explain: 'Velocity varies as **1/n**: flattened grass is a smoother lining, so the water runs faster — which is why the design must check the velocity at the low-retardance condition.',
      },
    },
  ],
}

export default scene
