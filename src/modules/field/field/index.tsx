import type { CameraPose, SceneDef } from '@/modules/types'
import { C, DEFAULTS, resetLive, useField, type FieldParams } from './model'
import { FieldPanel } from './Panel'
import { Field3D, resetScene } from './Scene3D'

const OVERVIEW: CameraPose = { position: [-16, 13, 19], target: [0, 0, 0] }

const scene: SceneDef = {
  id: 'field',
  title: 'Field operations',
  summary:
    'The Farmland tractor works a field in a racetrack pattern with a plough, disc harrow, cultivator or ridger, lifting the implement at each headland. A live dashboard shows engine speed, gear, travel speed, slip, draft, drawbar and engine power, fuel and field capacity, solved from the drawbar, slip and power equations and the Brixius traction model; the soil records every pass.',
  Viewport: Field3D,
  Panel: FieldPanel,
  camera: OVERVIEW,
  extent: 32,
  floorY: -0.5,
  hatchScale: 0.1,
  timeScale: 1,
  cutPresets: [
    { id: 'lane', label: 'Section across the field', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'centre', label: 'Section along the centre line', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: undefined,
  cites: [C.mech('eqs 2.1–2.15, Fig 2.2'), C.l27('eqs 3–16'), C.am('§12 plough draft'), C.mgmt('p7–8 field capacity'), C.mac('App. II Farmland tractor')],
  reset: () => {
    useField.getState().reset()
    resetLive()
    resetScene()
  },
  applyParams: (p) => useField.getState().set(p as Partial<FieldParams>),
  tour: [
    {
      title: 'Into the field',
      body: 'Everything comes together: the **engine** turns at Ne, the **gearbox** ratio q sets the wheel speed, the **tyres** develop the pull with some **slip**, and the **implement** asks for its draft. The dashboard in **Controls** solves the drawbar, slip and power equations every frame.',
      camera: OVERVIEW,
      cut: false,
      select: null,
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.mech('p1–10')],
    },
    {
      title: 'Ploughing',
      body: 'The plough’s draft is the **unit draft × furrow cross-section**: three 35 cm bottoms at 20 cm in clay (2 N/cm²) need about **4.2 kN**. Watch the furrows and the tyre prints build up in the soil.',
      camera: { position: [-6, 4.5, 6], target: [-1, 0.3, 0] },
      select: 'implement',
      params: { implement: 'plough', unitDraft: 2, depth: 0.2 },
      cites: [C.am('§12')],
    },
    {
      title: 'Gear, pull and slip',
      body: 'In heavy soil the draft is several times larger. In **3rd gear** the governed engine still pulls it, with more slip; in **7th** the same load asks for more torque than the engine has and drags it down its torque curve to a stall (see the speed-against-pull chart).',
      camera: { position: [-9, 6, 10], target: [0, 0.5, 0] },
      select: 'tractor-rear-wheels',
      params: { implement: 'plough', unitDraft: 5, gear: 3 },
      cites: [C.mech('Fig 2.2, eq 2.5'), C.l27('eqs 14–16')],
    },
    {
      title: 'X-ray: the drivetrain at work',
      body: 'With the housings in **X-ray**, the crankshaft, flywheel, clutch, gearbox and crown wheel turn in step with the wheels — the three speed reductions between the engine and the soil.',
      camera: { position: [-3.5, 2.6, 4.2], target: [0.6, 0.8, 0] },
      select: 'tractor-gearbox',
      xray: true,
      params: { internals: true, unitDraft: 2, gear: 5 },
      cites: [C.mech('p8 — 0.98 per gear pair')],
    },
    {
      title: 'Field capacity',
      body: 'Theoretical capacity is **W·S/10** ha/h. Time spent turning at the headlands lowers the **field efficiency**; effective capacity = W·S·FE/10. Try the disc harrow or ridger and compare.',
      camera: OVERVIEW,
      select: null,
      xray: false,
      params: { implement: 'disc', unitDraft: 2, gear: 5 },
      cites: [C.mgmt('p7–8')],
    },
  ],
}

export default scene
