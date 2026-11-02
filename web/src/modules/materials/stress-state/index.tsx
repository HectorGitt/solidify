import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Stress3D, StressPanel, useStressState } from './Rig'

const M3 = (where: string) => cite('MSE305', 'Module 3 - Two-Dimensional Stress and Strain.pdf', where)
const M5 = (where: string) => cite('MSE305', 'Module 5 - Strain Gage Measurements and Applications.pdf', where)
const M8 = (where: string) => cite('MSE305', 'Module 8 - Yield Criteria.pdf', where)
const view = { position: [0.3, 0.28, 2.2] as [number, number, number], target: [0, -0.02, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'stress-state',
  title: 'Stress at a point: Mohr’s circle',
  summary: 'Turn a stressed element and watch the stresses on its faces change, with Mohr’s circle alongside. Read a strain-gauge rosette, and test the result against the yield criteria.',
  Viewport: Stress3D,
  Panel: StressPanel,
  camera: view,
  extent: 1.2,
  floorY: FLOOR,
  hatchScale: 0.008,
  timeScale: 1,
  cutPresets: [
    { id: 'oblique', label: 'Oblique plane (45°)', planes: [{ normal: [0.7071, 0.7071, 0], pos: 0 }] },
    { id: 'mid', label: 'Through the element', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  cites: [M3('stress transformation; Mohr’s circle'), M5('rosettes'), M8('Tresca and von Mises')],
  reset: () => useStressState.getState().reset(),
  applyParams: (p) => useStressState.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'One point, many views',
      body: 'This square is one point in a loaded part. **Turn it**, and the stresses on its faces change. The material hasn’t changed: only the planes you’re looking at. Three numbers, **σx, σy and τxy**, describe every view.',
      camera: view,
      cut: false,
      select: 'element',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [M3('transformation equations')],
    },
    {
      title: 'Mohr’s circle',
      body: 'Every face’s stress lies on one **circle**. Turn the element by θ, and the point moves **2θ** around it. Where the circle crosses the axis there is no shear: those are the **principal stresses**, here 85 and −45 MPa.',
      params: { theta: 12 },
      cites: [M3('Mohr’s circle')],
      check: {
        question: 'At a point σ₁ = 100 MPa and σ₂ = 0. What is the largest in-plane shear stress, and where is it?',
        options: ['100 MPa, at 90°', '50 MPa, at 45°', '50 MPa, at 90°'],
        answer: 1,
        explain: 'The largest shear is the circle’s **radius**, half the difference: 50 MPa. A quarter of the way round the circle is 90°, which is **45° on the element**.',
        reveal: { params: { sx: 100, sy: 0, txy: 0, theta: 45 } },
      },
    },
    {
      title: 'Measuring it: rosettes',
      body: 'A gauge reads strain along its own line only. **Three gauges** in different directions fix all three strains. For a 45° rosette, **γxy = 2ε_b − ε_a − ε_c**, and Hooke’s law then gives the stresses.',
      params: { mode: 'rosette', theta: 0 },
      select: 'gauge-45',
      cites: [M5('rectangular and delta rosettes')],
    },
    {
      title: 'Will it yield?',
      body: 'A tensile test gives one number; a part has a whole state of stress. **Tresca** says it yields at a critical shear; **von Mises** at a critical distortion energy. Tresca’s hexagon sits inside von Mises’ ellipse, so it is the safer of the two.',
      params: { mode: 'stress', sx: 180, sy: -60, txy: 40, yieldS: 250 },
      cites: [M8('Tresca; von Mises')],
    },
  ],
}

export default scene
