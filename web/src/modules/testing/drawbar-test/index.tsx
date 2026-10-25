import { SRC } from '@/content/citations'
import type { CameraPose, SceneDef } from '@/modules/types'
import { C, DEFAULTS, live, startRun, stopRun, useDrawbar, type DrawbarParams } from './model'
import { DrawbarPanel } from './Panel'
import { Scene3D } from './Scene3D'

const CAR_VIEW: CameraPose = { position: [-0.6, 3.4, 8.6], target: [-2.0, 0.9, 0] }
const DYNO_VIEW: CameraPose = { position: [4.6, 2.6, 4.2], target: [0.2, -0.6, -1.9] }

const scene: SceneDef = {
  id: 'drawbar-test',
  title: 'Drawbar & chassis testing',
  summary:
    'The Nebraska tractor test car loads the Farmland tractor through a hydraulic drawbar cylinder, pressure transducer and throttling valve; swap in a strain-gauge link or a Dillon spring dial. Measure pull, speed, slip and drawbar power, run a pull-vs-speed test, then put the tractor on the Uppsala chassis dynamometer.',
  Viewport: Scene3D,
  Panel: DrawbarPanel,
  camera: CAR_VIEW,
  extent: 9,
  floorY: -0.2,
  hatchScale: 0.05,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'hitch', label: 'Hitch line & cylinder (half section)', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [-1, 0, 0], pos: 0.9 }], intersection: true },
    { id: 'plan', label: 'Plan at drawbar height (behind the tractor)', planes: [{ normal: [0, 1, 0], pos: 0.45 }, { normal: [-1, 0, 0], pos: 0.9 }], intersection: true },
    { id: 'train', label: 'Dynamometer train section', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 0, -1], pos: 1.2 }], intersection: true },
    { id: 'pit', label: 'Pit section through the drums', planes: [{ normal: [0, 0, 1], pos: 0.71 }, { normal: [0, -1, 0], pos: 0.05 }], intersection: true },
  ],
  defaultPreset: 'hitch',
  cites: [C.car, C.spring, C.gauge, C.chassis, C.criteria, SRC.mech502('eqs 2.1–2.15, Fig 2.2'), SRC.l27('eqs 3–16')],
  reset: () => {
    useDrawbar.getState().reset()
    live.dist = 0
    live.Pread = 0
  },
  applyParams: (p) => {
    const { run, ...rest } = p as Partial<DrawbarParams> & { run?: boolean }
    useDrawbar.getState().set(rest)
    if (run === true) startRun()
    else if (run === false) stopRun()
  },
  tour: [
    {
      title: 'Measuring drawbar performance',
      body:
        'Maximum drawbar power is the most useful single test of a tractor. Here the **Nebraska test car** is hitched behind the Farmland tractor on a concrete track. The car loads the drawbar and measures the pull, while the tractor drives it along.\n\nThe track moves under the stationary tractor; watch the rear wheels turn a little faster than the ground goes by — that is **wheel slip**.',
      camera: CAR_VIEW,
      cut: 'hitch',
      select: 'test-car',
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.criteria, C.car],
    },
    {
      title: 'The hydraulic drawbar cylinder',
      body:
        'The pull reaches the car through a **hydraulic cylinder**. The oil pressure, p = P/A, is read by a **pressure transducer** whose signal goes to a recorder and a computer.\n\nA **throttling valve** in the line damps the fluctuations — the cylinder’s advantage over a spring dynamometer.',
      camera: { position: [-1.0, 1.4, 2.6], target: [-1.7, 0.6, 0] },
      select: 'drawbar-cylinder',
      cut: 'hitch',
      params: { meter: 'cylinder', damping: 0.85, pull: 14 },
      cites: [C.car],
      check: {
        question: 'If you close the throttling valve further, what happens to the pull reading?',
        options: ['It fluctuates more', 'It settles nearer the mean pull', 'It reads a higher mean pull'],
        answer: 1,
        explain: 'The **throttling valve** restricts the oil passage to the transducer, so quick pressure spikes are smoothed out and the reading settles near the mean pull. The mean itself does not change.',
        reveal: { params: { meter: 'cylinder', damping: 0.95 } },
      },
    },
    {
      title: 'Dillon spring dial',
      body:
        'The simplest drawbar dynamometer is a **spring** that stretches under tension. It suits rough measurements only: implement loads vary so quickly that the needle never settles, and the load at any instant can only be approximated.',
      camera: { position: [-0.3, 1.2, 1.7], target: [-0.8, 0.5, 0] },
      select: 'dillon',
      cut: false,
      params: { meter: 'dillon' },
      cites: [C.spring],
    },
    {
      title: 'Strain-gauge link',
      body: 'A link with **electrical resistance strain gauges** senses its own tiny stretch under the pull; a digital readout box shows the force.',
      camera: { position: [-0.2, 1.4, 1.9], target: [-0.9, 0.6, 0] },
      select: 'link',
      params: { meter: 'link' },
      cites: [C.gauge],
    },
    {
      title: 'Speed, slip, rpm and fuel',
      body:
        'The car also measures tractor **velocity**, **wheel slip**, **engine rpm**, **fuel consumption**, the **sound level** and the temperatures of intake air, hydraulic fluid, coolant and fuel. Slip compares the wheel’s turns with the distance actually travelled: i = (V0 − V)/V0.',
      camera: { position: [-2.6, 3.0, 5.4], target: [-2.4, 1.2, 0] },
      select: 'recorder',
      cut: 'hitch',
      params: { meter: 'cylinder', damping: 0.5 },
      cites: [C.car, SRC.mech502('p7, eq 2.5')],
    },
    {
      title: 'The test run: pull against speed',
      body:
        'At open throttle in one gear the car raises its load step by step. Speed falls slowly while the governor holds the engine up, then fast once the engine lugs down its torque curve, and slip climbs. Open **Controls** to watch the table and the curves build up.',
      camera: CAR_VIEW,
      select: null,
      params: { gear: 5, surface: 'concrete', run: true },
      cites: [C.criteria, SRC.mech502('Fig 2.2')],
      check: {
        question: 'Past the point of maximum drawbar power, the car keeps raising the load. Why does the power fall although the pull is higher?',
        options: ['Speed falls faster than the pull rises', 'The car’s brake absorbs less power', 'The engine burns less fuel at high pull'],
        answer: 0,
        explain: 'Drawbar power is **pull × speed**. Once the engine lugs down its torque curve and slip climbs, the speed drops faster than the pull grows.',
      },
    },
    {
      title: 'The chassis dynamometer',
      body:
        'Outdoor testing depends on the weather. At **Uppsala** the drive wheels turn **concrete-covered drums** in a pit. The drums drive a **1 : 18** gearbox, a **1 : 1–7.7** range box and a **hydraulic dynamometer**; a variable-speed transmission and an electric motor complete the line.',
      camera: DYNO_VIEW,
      select: 'drums',
      cut: 'train',
      params: { mode: 'dyno', run: false, k: 4, s: 0.7 },
      cites: [C.chassis],
    },
    {
      title: 'Pendulum frame and scale',
      body:
        'The gearboxes and absorber sit on a **pendulum frame** that can swing about the drum axis, so the whole reaction torque bears on the **scale**: T = F·l and power = 2πlFn/60 000 kW.',
      camera: { position: [3.4, 1.4, -0.4], target: [0.6, -0.5, -2.8] },
      select: 'pendulum-frame',
      cut: 'train',
      cites: [C.chassis, SRC.tests502('p5, eq 3')],
    },
    {
      title: 'Pros and cons',
      body:
        'The drums stay unaffected by the weather, so testing goes on all year. But the tractor is **restrained**, so the front wheels do not roll and their rolling resistance is missing from the result — an obvious disadvantage.',
      camera: { position: [-3.6, 2.2, 3.4], target: [-0.8, 0.3, 0] },
      select: 'restraint',
      cut: false,
      cites: [C.chassis],
      check: {
        question: 'On the drums the front wheels do not roll. Compared with drawbar power from a track test, the result reads…',
        options: ['A little low, as the drums slip on the tyres', 'The same, as the engine power is unchanged', 'A little high, as front rolling resistance is missing'],
        answer: 2,
        explain: 'On the track part of the drive-wheel effort goes into rolling the **front wheels**. Restrained on the drums they do not roll, so that loss is left out and the result reads a little high.',
      },
    },
  ],
}

export default scene
