import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useDraft } from './model'
import { DraftPanel } from './Panel'
import { Draft3D } from './Scene3D'

const home = { position: [-3.6, 1.9, 3.4] as [number, number, number], target: [-0.9, 0.5, 0] as [number, number, number] }
const hyd = { position: [-0.9, 1.65, 1.15] as [number, number, number], target: [-0.2, 1.05, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'draft-control',
  title: 'Draft vs position control',
  summary:
    'The shared tractor ploughs across soil whose strength varies. In draft control the top-link compression, felt by a heavy spring, moves the control-valve spool so the ram lifts or lowers the plough to keep the draft constant; in position control the depth stays put and the draft follows the soil. Time traces compare both.',
  Viewport: Draft3D,
  Panel: DraftPanel,
  camera: home,
  extent: 6,
  floorY: 0,
  hatchScale: 0.03,
  timeScale: 1,
  cutPresets: [
    { id: 'centre', label: 'Centre-line section (spring, valve)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'body', label: 'Through the front plough body', planes: [{ normal: [0, 0, 1], pos: 0.08 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'body',
  cites: [...C.draft, ...C.alt, ...C.other],
  reset: () => useDraft.getState().reset(),
  applyParams: (p) => useDraft.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Ploughing without a depth wheel',
      body:
        'A fully mounted plough has no depth wheel: the **hydraulics** set its depth. The soil here changes strength along the field — darker bands are harder — so at a fixed depth the **draft** (orange arrow) would rise and fall.',
      camera: home,
      cut: false,
      select: 'plough',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, mode: 'position' },
      cites: C.other,
    },
    {
      title: 'Position control',
      body:
        'In **position control** the valve compares the lift-arm position with the lever. On level ground the depth stays constant and the draft simply follows the soil — fine for sprayers and other implements that work **above** the ground.',
      camera: { position: [-4.6, 1.2, 2.2], target: [-1.8, 0.1, 0] },
      select: 'soil',
      params: { mode: 'position' },
      cites: C.other,
      check: {
        question: 'In position control the plough reaches a band of harder soil. What happens?',
        options: ['The depth stays the same and the draft rises', 'The plough lifts and the draft stays the same', 'The depth and the draft both fall'],
        answer: 0,
        explain: 'Position control holds the lift arms where the lever puts them, so on level ground the **depth** is fixed and the draft simply follows the soil strength.',
      },
    },
    {
      title: 'Draft control: the top link senses draft',
      body:
        'Draft acts below the hitch, so the implement pushes its mast forward: the **top link** is pushed into **compression** that rises with depth and soil strength. It bears on a **heavy spring** — compressed more, the spring moves the **control valve**.',
      camera: hyd,
      cut: 'centre',
      select: 'sensing-spring',
      params: { mode: 'draft' },
      cites: C.draft,
    },
    {
      title: 'The valve closes the loop',
      body:
        'Too much draft: the spool sends pump oil to the ram (orange) and the plough **lifts** until the draft is back at the setting. Too little: the spring pushes back, the ram oil returns to the tank (blue) and the plough **lowers**. The depth varies; the draft stays nearly constant.',
      camera: hyd,
      select: 'control-valve',
      cites: [...C.draft, ...C.circuit],
      check: {
        question: 'In draft control the plough runs into a compacted strip. What does the hitch do?',
        options: ['Lowers the plough to hold the depth', 'Waits for the operator to move the lever', 'Lifts the plough a little to hold the draft'],
        answer: 2,
        explain: 'The higher draft compresses the top link and **sensing spring** further, the valve sends oil to the ram and the plough lifts until the draft is back at the setting. The depth is what gives way.',
      },
    },
    {
      title: 'Response / damping',
      body:
        'The **response knob** runs from fast to slow. Too fast and the hitch **overshoots** — it can hunt up and down chasing every change; too slow and the draft strays before the plough moves. Watch the plough drop into work at the start of the run and cross the compacted strip at 35–39 m. Compare the traces in **Controls**.',
      camera: { position: [-3.0, 1.6, 2.8], target: [-1.2, 0.4, 0] },
      cut: false,
      select: 'plough-bodies',
      params: { mode: 'draft', response: 1 },
      cites: C.draft,
      check: {
        question: 'The response knob is turned to fully fast. What is the risk?',
        options: ['The draft strays far before the plough moves', 'The hitch overshoots and hunts up and down', 'The ram runs short of pump flow'],
        answer: 1,
        explain: 'A fast, lightly **damped** loop corrects too hard: the plough overshoots the target and hunts up and down. A slow setting has the opposite fault.',
      },
    },
    {
      title: 'Other ways to sense draft',
      body:
        'Some tractors sense **tension in the lower links**, or **torque** in the drive to the differential (suits semi-mounted ploughs). A **double-acting top link** senses tension too. **Pressure control** instead transfers trailed-implement weight to the rear wheels.',
      camera: home,
      select: 'tractor-lower-links',
      params: { response: 0.45 },
      cites: [...C.alt, ...C.other, SRC.hy510('p3–4 double-acting top link')],
    },
  ],
}

export default scene
