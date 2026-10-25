import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, TC, useTc } from './model'
import { TcPanel } from './Panel'
import { Tc3D } from './Scene3D'

const home = { position: [0.55, 0.32, 0.5] as [number, number, number], target: [0, 0, 0.0] as [number, number, number] }

const scene: SceneDef = {
  id: 'torque-converter',
  title: 'Torque converter',
  summary:
    'Pump (impeller), turbine and stator on a one-way clutch, cut open. Raise the turbine speed and watch the oil’s vortex flow give way to rotary flow, the stator freewheel at the coupling point, and the torque multiplication fall to 1 : 1.',
  Viewport: Tc3D,
  Panel: TcPanel,
  camera: home,
  extent: 0.6,
  floorY: -TC.housingR - 0.01,
  hatchScale: 0.003,
  timeScale: 1 / 60,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: 0 }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'quarter',
  cites: [SRC.pt510('p8–11 (PDF p9–11)'), SRC.beyond('torque-ratio and efficiency characteristic')],
  reset: () => useTc.getState().reset(),
  applyParams: (p) => useTc.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A hydrodynamic drive',
      body:
        'A **torque converter** transmits engine torque through **high-speed, low-pressure oil**. It has three elements: the **pump** (impeller), driven by the engine; the **turbine**, on the output shaft; and the **stator** between them. It works as a clutch and as a stepless transmission.',
      camera: home,
      cut: 'quarter',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, SR: 0 },
      cites: [SRC.pt510('p9 (PDF p9)')],
    },
    {
      title: 'Pump and turbine',
      body:
        'The pump is welded to the front cover, which the engine turns. Its blades fling the oil outward and across into the **turbine**, whose blades catch it and turn the output shaft. The oil then flows inward and back towards the pump.',
      camera: { position: [0.45, 0.25, 0.1], target: [0, 0.08, 0] },
      select: 'impeller',
      cites: [SRC.pt510('p10')],
    },
    {
      title: 'Stall: vortex flow',
      body:
        'With the turbine held (stall) the oil circulates round and round between pump, turbine and stator: **vortex flow** (orange). The **stator**, held by its one-way clutch, turns the returning oil so it re-enters the pump in the pump’s direction — adding velocity. This regenerating action **multiplies torque**.',
      camera: { position: [0.3, 0.16, 0.18], target: [0, 0.06, 0] },
      select: 'stator',
      params: { SR: 0 },
      cites: [SRC.pt510('p10 stator as a fluid fulcrum')],
      check: {
        question: 'At stall, with the turbine held, how does the turbine torque compare with the engine torque?',
        options: ['Greater: about 2.2 times', 'Equal to it', 'Zero, since the turbine is still'],
        answer: 0,
        explain: 'The stator turns the returning oil to help the pump, so at stall the converter gives its greatest **torque multiplication**, about 2.2 : 1 for this design.',
      },
    },
    {
      title: 'The turbine catches up',
      body:
        'As the engine and turbine speed up, rotary flow increases and vortex flow decreases. The torque gain shrinks smoothly — like shifting gears, but automatically and in infinitely small steps.',
      camera: home,
      select: 'turbine',
      params: { SR: 0.6 },
      cites: [SRC.pt510('p10 decreasing torque')],
      check: {
        question: 'The turbine has reached 0.6 of pump speed. Compared with stall, the output torque is now…',
        options: ['Larger than at stall', 'Lower, but still above engine torque', 'Below engine torque'],
        answer: 1,
        explain: 'The torque gain falls steadily from about 2.2 at stall to **1 : 1 at the coupling point** (0.85 of pump speed here); at 0.6 it is still about 1.35.',
      },
    },
    {
      title: 'Coupling point: rotary flow',
      body:
        'Near equal speeds the oil turns round with pump and turbine as a **rotary flow** (blue). It now strikes the back of the stator blades and the **one-way clutch** lets the stator freewheel. Torque increase stops: the converter is a simple **fluid coupling** sending on the torque it receives.',
      camera: { position: [0.3, 0.12, 0.2], target: [0, 0.03, 0] },
      select: 'one-way',
      params: { SR: 0.9 },
      cites: [SRC.pt510('p10 "locked up"')],
      check: {
        question: 'Above the coupling point, what would happen if the stator were fixed solid instead of on a one-way clutch?',
        options: ['Torque multiplication would carry on', 'Oil hitting the blade backs would cut the torque', 'The turbine would lock to the pump'],
        answer: 1,
        explain: 'The oil now strikes the **back of the stator blades**; a fixed stator would turn it against the pump, wasting power and lowering the output torque. The one-way clutch lets it freewheel instead.',
      },
    },
    {
      title: 'Exploded view',
      body: 'Flywheel, front cover and pump; turbine and output shaft; stator, one-way clutch and stationary sleeve. Open **Controls** for the characteristic curve, the power path and the table of converter designs.',
      camera: { position: [0.75, 0.4, 0.6], target: [0, 0, 0] },
      explode: 1,
      select: null,
      cut: 'half',
    },
  ],
}

export default scene
