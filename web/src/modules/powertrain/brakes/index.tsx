import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useBrakes } from './model'
import { BrakesPanel } from './Panel'
import { Brakes3D } from './Scene3D'

const home = { position: [0.55, 0.42, 0.75] as [number, number, number], target: [0.2, 0.06, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'brakes',
  title: 'Tractor brakes',
  summary:
    'The internal expanding shoe brake, the dry disc brake with its self-energising ball-ramp expander, and the wet multi-plate brake — worked by two independent pedals with a latch, master cylinders and a balancing valve. Shows why the brake sits on the fast, low-torque shaft.',
  Viewport: Brakes3D,
  Panel: BrakesPanel,
  camera: home,
  extent: 0.9,
  floorY: -0.2,
  hatchScale: 0.0035,
  timeScale: 1 / 6,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0.0 }] },
    { id: 'side', label: 'Side section (on the axis)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'side',
  cites: [SRC.tts510('p11–13, Figs 36–37'), SRC.top510('p9, Fig A2.14'), SRC.m503(9, 'brake design')],
  reset: () => useBrakes.getState().reset(),
  applyParams: (p) => useBrakes.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Expanding shoe brake',
      body:
        'Two lined **shoes** pivot on anchor pins on the stationary **back plate**. The pedal turns the **cam**, which spreads the shoe tips so the linings grip the rotating **drum**; **return springs** pull them back. An **adjuster** takes up lining wear.',
      camera: { position: [0.05, 0.12, 0.5], target: [0, 0, 0] },
      cut: false,
      select: 'shoes',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, type: 'shoe', left: 0 },
      cites: [SRC.tts510('Fig 36')],
    },
    {
      title: 'Apply it',
      body:
        'Press the pedal: the cam turns and the shoes swing out. The **leading shoe** is self-energising — drum friction helps press it on — so it gives more torque than the trailing shoe. The working uses the standard leading/trailing shoe formulas.',
      camera: { position: [0.05, 0.12, 0.45], target: [0, 0.02, 0] },
      select: 'cam',
      params: { type: 'shoe', left: 0.8 },
      cites: [SRC.m503(9)],
      check: {
        question: 'If the drum turns the other way (the tractor rolling backwards), what happens to the two shoes?',
        options: ['They swap roles: the old trailing shoe now leads', 'Nothing changes: the same shoe still leads', 'Both shoes become self-energising'],
        answer: 0,
        explain: 'Which shoe leads depends on the drum\'s direction: drum friction drags the **leading shoe** into the drum. Reverse the drum and the other shoe becomes the self-energising one.',
      },
    },
    {
      title: 'Dry disc brake',
      body:
        'Two lined **discs** splined to the half shaft turn between the housing and the cover. Between them is the **expander**: two actuating discs with **steel balls** in tapered grooves, held together by springs.',
      camera: home,
      cut: 'side',
      select: 'expander',
      params: { type: 'disc', left: 0 },
      cites: [SRC.tts510('Fig 37'), SRC.top510('Fig A2.14')],
    },
    {
      title: 'Ball ramps: self-energising',
      body:
        'The pedal link turns the actuating discs in opposite directions; the balls ride up their ramps and force the discs apart, clamping the rotating discs against the housing and cover. Once they grip, friction drags the expander further round: the brake is **self-energising**, more so with higher friction or a flatter ball seat.',
      camera: { position: [0.25, 0.2, 0.32], target: [0, 0.04, 0] },
      select: 'balls',
      params: { type: 'disc', left: 0.7 },
      cites: [SRC.top510('p9')],
    },
    {
      title: 'Wet multi-plate brake',
      body:
        'Sintered friction **discs** on the half shaft run between steel **plates** in oil inside the axle housing. Brake-line pressure pushes the **piston** to clamp the pack. Sealed from dirt and cooled by oil, wet brakes are very reliable and absorb large amounts of energy.',
      camera: home,
      select: 'wet-discs',
      params: { type: 'wet', left: 0.5 },
      cites: [SRC.top510('p9')],
    },
    {
      title: 'Two pedals',
      body:
        'Each rear brake has its own pedal and **master cylinder**. Unlatched, one pedal brakes one wheel — the differential then drives the other wheel at twice speed and the tractor turns tightly. For the road the pedals are **latched**, and the **balancing valve** equalises the two brake pressures.',
      camera: { position: [0.85, 0.45, 0.55], target: [0.5, 0.2, 0] },
      select: 'balancing-valve',
      params: { latched: false, left: 0.8, right: 0 },
      cites: [SRC.tts510('p13'), SRC.tts510('p8')],
      check: {
        question: 'Unlatched, you press only the left pedal until the left wheel stops. How fast does the right wheel turn?',
        options: ['At cage speed, as before', 'At twice cage speed', 'It stops as well'],
        answer: 1,
        explain: 'The differential keeps the cage speed at the **mean** of the two wheel speeds: (0 + 2N)/2 = N. With the left wheel held, the right wheel runs at twice cage speed and the tractor pivots round the braked wheel.',
      },
    },
    {
      title: 'Brakes on the fast shaft',
      body:
        'A brake is more effective on a **fast-moving, low-torque** shaft. Placed on the half shaft before a 4.8 : 1 final reduction it needs only 1/4.8 of the wheel torque. Compare the numbers in the working.',
      camera: home,
      select: null,
      params: { latched: true, left: 0.6, type: 'wet' },
      cites: [SRC.tts510('p11')],
      check: {
        question: 'A brake is moved from the wheel hub onto the half shaft, before the 4.8 : 1 final reduction. How much torque must it now hold?',
        options: ['4.8 times as much', 'The same as at the hub', 'About 1/4.8 as much'],
        answer: 2,
        explain: 'The half shaft turns 4.8 times faster than the wheel, so for the same stopping power it carries **1/4.8 of the torque**. A smaller, lighter brake does the job.',
      },
    },
  ],
}

export default scene
