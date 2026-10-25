import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DRIVE_Y } from '@/tractor/geometry'
import { DEFAULTS, useDrive } from './model'
import { DrivePanel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [3.3, 2.3, 4.3] as [number, number, number], target: [0.55, 0.75, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'line-of-drive',
  title: 'Line of drive (1/2/4WD)',
  summary:
    'The whole power train of the Farmland tractor, from flywheel to tyre: clutch, gearbox, crown wheel and pinion, differential, final drives and PTO, with live power flow and the three speed reductions that take a 2000 rpm engine down to about 20 rpm at the wheels.',
  Viewport: Scene3D,
  Panel: DrivePanel,
  camera: overview,
  extent: 4.6,
  floorY: -0.022,
  hatchScale: 0.03,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'side', label: 'Side section (centre line)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plan', label: 'Plan section', planes: [{ normal: [0, 1, 0], pos: DRIVE_Y }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [0, 1, 0], pos: DRIVE_Y }], intersection: true },
  ],
  defaultPreset: 'side',
  cites: [SRC.tts510('p1–2, Fig 30'), SRC.pt510('p1, p3'), SRC.mech502('Ch 2, eqs 2.1–2.15, Fig 2.2'), SRC.mac502('App. II Farmland tractor')],
  reset: () => useDrive.getState().reset(),
  applyParams: (p) => useDrive.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'From flywheel to tyre',
      body:
        'The power train takes the engine’s torque at more than 2000 rpm and delivers it to the rear wheels at about **20 rpm** in bottom gear. The housings are sectioned so you can see the drive inside; the **orange particles** show the power flowing.',
      camera: overview,
      cut: 'side',
      select: null,
      explode: 0,
      xray: false,
      playing: true,
      params: { drive: '2wd', gear: '3', pull: 12, flow: true },
      cites: [SRC.tts510('p1')],
    },
    {
      title: 'Engine and clutch',
      body:
        'The **clutch** on the flywheel connects or disconnects the engine and the gearbox. The engine is treated here simply as a torque source on its test-report curve (peak 173 N·m at 1300 rpm, governed at 2390 rpm).',
      camera: { position: [1.6, 1.6, 2.1], target: [0.9, 0.7, 0] },
      select: 'tractor-clutch-housing',
      cites: [SRC.mech502('p4 Fig 2.2'), SRC.tts510('p2–3')],
    },
    {
      title: '1 · The gearbox',
      body:
        'The **gearbox** gives the first speed reduction and lets the driver choose the ratio: high pull at low speed, or low pull at high speed. It also reverses the travel and drives the **PTO** (blue particles) and hydraulic pump.',
      camera: { position: [0.9, 1.4, 1.7], target: [0.35, 0.6, 0] },
      select: 'tractor-gearbox',
      cites: [SRC.pt510('p3 jobs of the transmission'), SRC.tts510('p2, p4')],
      check: {
        question: 'The engine turns at 2000 rpm and the wheels at about 20 rpm. Ignoring losses, how does the wheel torque compare with the engine torque?',
        options: ['About the same', 'About 100 times smaller', 'About 100 times larger'],
        answer: 2,
        explain: 'Power is torque × speed, and the power train cannot create power. Cutting the speed 100 times **multiplies the torque about 100 times**, less the small gear losses.',
      },
    },
    {
      title: '2 · Crown wheel, pinion and differential',
      body:
        'The bevel pinion turns the drive through 90° into the **crown wheel** — the second reduction (37 : 9 here). The crown wheel carries the **differential**, which lets the rear wheels turn at different speeds on a corner.',
      camera: { position: [0.6, 1.3, 1.5], target: [0, 0.65, 0] },
      select: 'tractor-crown-wheel',
      cut: 'plan',
      cites: [SRC.tts510('p7–8')],
      check: {
        question: 'The 9-tooth pinion drives the 37-tooth crown wheel. If the pinion turns at 400 rpm, how fast does the crown wheel turn?',
        options: ['About 97 rpm', 'About 400 rpm', 'About 1640 rpm'],
        answer: 0,
        explain: 'The speed falls by the tooth ratio **37 / 9 ≈ 4.1**: 400 / 4.1 ≈ 97 rpm. The torque rises by the same factor.',
      },
    },
    {
      title: '3 · Final reduction and wheels',
      body:
        'The **final drives** in the axle housings give the third reduction (an epicyclic 4.8 : 1 here) and carry the tractor’s weight. Torque rises at all three stages; the table in Controls shows the speed and torque after each.',
      camera: { position: [0.9, 1.5, 2.6], target: [0, 0.6, 0.6] },
      select: 'tractor-trumpets',
      cut: 'plan',
      cites: [SRC.tts510('p8–10'), SRC.pt510('p12')],
    },
    {
      title: 'Four-wheel drive',
      body:
        'With **front-wheel assist** a transfer drive under the gearbox sends part of the power forward through a propeller shaft to a front differential, so all four wheels pull. Compare the 1-, 2- and 4-wheel-drive diagrams in Controls.',
      camera: { position: [2.4, 1.2, 2.8], target: [1.0, 0.4, 0] },
      select: 'front-drive',
      cut: 'side',
      xray: true,
      params: { drive: '4wd' },
      cites: [SRC.l27('Fig 47, 2WD vs MFWD vs 4WD')],
    },
    {
      title: 'Pull, speed and slip',
      body:
        'The arrows show the drawbar pull **P**, the rolling resistance **R** and the gross traction **H = P + R** at the tyre. The tread marks on the ground move at the true speed **V**, slower than the tyre surface **V₀**: the difference is the wheelslip.',
      camera: { position: [-1.6, 1.2, 3.2], target: [-0.2, 0.4, 0.4] },
      select: 'ground',
      xray: false,
      params: { drive: '2wd', pull: 20 },
      cites: [SRC.mech502('Fig 2.3, eqs 2.5–2.8')],
      check: {
        question: 'The tyre surface moves at V₀ = 5.0 km/h but the tractor travels at V = 4.4 km/h. What is the wheelslip?',
        options: ['About 14 %', '12 %', '0.6 %'],
        answer: 1,
        explain: 'Wheelslip is measured against the tyre speed: **s = (V₀ − V) / V₀** = (5.0 − 4.4) / 5.0 = 0.12, or 12 %.',
      },
    },
    {
      title: 'Try the gears',
      body: 'Open **Controls**: pick a gear, change the pull and watch the engine speed, the travel speed and the three reductions. Load it past the torque peak and the engine stalls.',
      camera: overview,
      select: null,
      params: { pull: 12 },
    },
  ],
}

export default scene
