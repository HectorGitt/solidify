import type { CameraPose, SceneDef } from '@/modules/types'
import { DEFAULTS, useAutosteer, type AutosteerParams } from './model'
import { AutosteerPanel } from './Panel'
import { Autosteer3D, resetScene } from './Scene3D'

const CHASE: CameraPose = { position: [-14, 9, 8], target: [0, 0.8, 0] }
const HIGH: CameraPose = { position: [-12, 34, 22], target: [6, 0, 0] }

const scene: SceneDef = {
  id: 'autosteer',
  title: 'GNSS auto-steer',
  summary:
    'A tractor works a field in back-and-forth passes, steered by a GNSS receiver and an electric steering motor. Choose the positioning — driver by eye, uncorrected GNSS, SBAS or RTK — and watch the coverage map: green worked once, red overlapped, bare strips missed.',
  Viewport: Autosteer3D,
  Panel: AutosteerPanel,
  camera: CHASE,
  follow: 'tractor',
  extent: 40,
  floorY: -0.6,
  hatchScale: 0.1,
  timeScale: 1,
  cutPresets: [{ id: 'across', label: 'Section across the tractor', planes: [{ normal: [0, 0, -1], pos: 0 }] }],
  defaultPreset: undefined,
  reset: () => {
    useAutosteer.getState().reset()
    resetScene()
  },
  applyParams: (p) => useAutosteer.setState({ ...DEFAULTS, ...(p as Partial<AutosteerParams>), run: useAutosteer.getState().run + 1 }),
  tour: [
    {
      title: 'Steering by satellite',
      body: 'The **antenna** on the cab roof works out where the tractor is; the **guidance display** compares that with the A-B line; the **steering motor** turns the wheel to close the gap. The driver only handles the headland turns — here the system does those too.',
      camera: CHASE,
      cut: false,
      select: 'antenna',
      playing: true,
      params: { fix: 'rtk' },
    },
    {
      title: 'RTK: edge to edge',
      body: 'A **base station** on a surveyed point measures the satellite errors and radios corrections to the tractor. Passes repeat to about **2 cm**, so the green strips meet with no red and no gaps — every year, on the same lines.',
      camera: HIGH,
      select: 'base',
      params: { fix: 'rtk', ff: 20 },
      check: {
        question: 'How can a base station a few kilometres away correct the tractor’s position?',
        options: ['It sends a stronger signal than the satellites', 'Its errors are nearly the same as the tractor’s', 'It tracks the tractor directly by radar'],
        answer: 1,
        explain: 'Satellite and atmosphere errors are almost the **same** over a short distance. The base knows where it really is, so the error it measures can be subtracted at the tractor.',
      },
    },
    {
      title: 'Uncorrected: a metre of wander',
      body: 'Without corrections the position drifts slowly by a metre or more. Each pass is off by a different amount, leaving **red overlaps and bare misses**. Good for recording where you went, not for steering.',
      camera: HIGH,
      select: 'coverage',
      params: { fix: 'gps', ff: 20 },
    },
    {
      title: 'Driving by eye',
      body: 'A good driver aims off the last pass’s edge, but small wanders add up — and most deliberately overlap 5–10 % to avoid misses. On 200 ha that is 10–20 ha of seed, fertiliser and spray wasted per operation.',
      camera: HIGH,
      select: 'coverage',
      params: { fix: 'manual', ff: 20 },
      check: {
        question: 'On a 200 ha farm the driver overlaps 7.5 % on every pass. How much ground is worked twice per operation?',
        options: ['About 1.5 ha', 'About 30 ha', 'About 15 ha'],
        answer: 2,
        explain: '7.5 % of 200 ha = **15 ha** given seed, fertiliser or spray twice, every operation. Auto-steer pays for itself by removing that **overlap**.',
      },
    },
    {
      title: 'How the controller steers',
      body: '**Pure pursuit**: pick the point on the line one look-ahead distance ahead (yellow ball) and steer onto the arc through it. A short look-ahead holds the line tightly but weaves; a long one is smooth but slow to correct.',
      camera: { position: [-9, 5, -5], target: [3, 0.5, 0] },
      select: 'steer-motor',
      params: { fix: 'rtk', lookahead: 2, lag: 0.5, ff: 1 },
      check: {
        question: 'You cut the look-ahead from 3.5 m to 1 m. How does the tractor track the line?',
        options: ['Smoother, but slower to correct', 'Tighter, but it weaves from side to side', 'No different; RTK sets the accuracy'],
        answer: 1,
        explain: 'A short **look-ahead** aims at a point just in front, so small errors produce sharp steering and the tractor overshoots and weaves. A long one smooths it out.',
        reveal: { params: { fix: 'rtk', lookahead: 1, lag: 0.5, ff: 1 } },
      },
    },
  ],
}

export default scene
