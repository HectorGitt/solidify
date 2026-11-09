import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { useSlider, type SliderParams } from './model'
import { SliderPanel } from './Panel'
import { FLOOR, Slider3D } from './Scene3D'

const LAB = (where: string) => cite('MEE395', 'MEE395 LAB1-Mechanics of Machines.pdf', where)
const view = { position: [0.42, 0.26, 2.0] as [number, number, number], target: [0, -0.03, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'slider-crank',
  title: 'Slider-crank & scotch yoke',
  summary:
    'Two ways to turn rotation into a straight line, on the same bench: read the displacement every 15°, compare it with a true sine, and see the effect of rod length and an offset line of stroke.',
  Viewport: Slider3D,
  Panel: SliderPanel,
  camera: view,
  extent: 1.4,
  floorY: FLOOR,
  hatchScale: 0.01,
  timeScale: 1,
  // through the connecting rod (z 0.032 to 0.040), the front link; at 0.02 the rod lay wholly in front and vanished
  cutPresets: [{ id: 'through', label: 'Through the mechanism', planes: [{ normal: [0, 0, 1], pos: 0.036 }], sectionMoving: true }],
  cites: [LAB('Labs 3 and 5')],
  reset: () => useSlider.getState().reset(),
  applyParams: (p) => useSlider.getState().set(p as Partial<SliderParams>),
  tour: [
    {
      title: 'The scotch yoke',
      body: 'A crank-pin slides in a slot in the **yoke**. The slot takes out the pin’s up-and-down motion and leaves only **x = r − r cos θ**: true **simple harmonic motion**. Early steam pumps used it, and it still drives test machines that need a pure sine.',
      camera: view,
      cut: false,
      select: 'crosshead',
      explode: 0,
      playing: true,
      params: { mode: 'yoke', r: 25, e: 0 },
      cites: [LAB('Lab 3 theory')],
      check: {
        question: 'At what crank angle is the yoke moving fastest?',
        options: ['0° and 180°', '90° and 270°', '45° and 225°'],
        answer: 1,
        explain: '**V = rω sin θ** is largest at 90° and 270°, in the middle of the stroke. The acceleration, **rω² cos θ**, is zero there and greatest at the ends.',
      },
    },
    {
      title: 'The slider-crank',
      body: 'Replace the slot with a **connecting rod** and you have an engine’s mechanism. The motion is nearly a sine, but the rod’s swing adds a second harmonic. Compare the blue curve with the pale true sine.',
      select: 'rod',
      params: { mode: 'slider', n: 4, e: 0 },
      cites: [LAB('Lab 5 theory')],
    },
    {
      title: 'A longer rod',
      body: 'Departure from the sine depends on **n = l/r**. Stretch the rod to 8 cranks and the curves almost meet; shorten it to 2 and they part widely.',
      params: { n: 8 },
      cites: [LAB('Lab 5')],
      check: {
        question: 'With rod length 4 × crank, how far has the slider gone at θ = 90°, compared with the crank radius r?',
        options: ['Exactly r', 'Further than r', 'Less than r'],
        answer: 1,
        explain: 'At 90° the rod is still inclined, so it reaches back less than its full length: **x = r(n + 1 − √(n² − 1))**, about 1.13 r here.',
        reveal: { params: { n: 4 } },
      },
    },
    {
      title: 'Offsetting the line of stroke',
      body: 'Move the line of stroke off the crank centre. The stroke grows beyond 2r, and the two dead centres are no longer 180° apart, so **out and back take different times**. Quick-return machines use this on purpose.',
      select: 'guide',
      params: { n: 4, e: 25 },
      cites: [LAB('Lab 5 procedure step 3')],
    },
    {
      title: 'The experiment',
      body: 'Turn the crank in 15° steps and read the scale: the panel’s table gives the same readings. The slope of displacement is velocity, and the slope of velocity is acceleration, which is the **graphical differentiation** the experiment teaches.',
      select: 'crank',
      params: { e: 0 },
      cites: [LAB('Lab 3 procedure')],
    },
  ],
}

export default scene
