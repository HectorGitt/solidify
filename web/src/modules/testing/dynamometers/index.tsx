import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { POS } from './geometry'
import { C, DEFAULTS, SHAFT_Y, useDyno, type DynoParams } from './model'
import { POSE_BED, POSE_PTO, Panel } from './Panel'
import { Scene3D } from './Scene3D'

const Y = SHAFT_Y

const scene: SceneDef = {
  id: 'dynamometers',
  title: 'Dynamometers',
  summary:
    'An engine test bed with five absorption dynamometers — Prony brake, sectioned hydraulic water brake, eddy-current, DC cradle and a shop-type PTO unit on a tractor. The brake load sets the running point on the “Farmland” engine curve; read T = F·l, P = 2πnT/60 000 and the atmospheric correction.',
  Viewport: Scene3D,
  Panel,
  camera: POSE_BED,
  extent: 2.6,
  floorY: 0,
  hatchScale: 0.012,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [0, 1, 0], pos: Y }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [C.prony, C.hydraulic, C.dc, C.pto, C.engine, C.correction, SRC.pm502('dynamometers, OECD test codes')],
  reset: () => useDyno.getState().reset(),
  applyParams: (p) => useDyno.getState().set(p as Partial<DynoParams>),
  tour: [
    {
      title: 'Measuring engine power',
      body:
        'A dynamometer must **control torque, measure torque, measure speed and dissipate power**. Here the “Farmland” tractor engine drives a **hydraulic dynamometer**, cut in half so you can see the water and rotors.\n\nThe brake load sets where the engine runs on its full-throttle curve (Controls tab).',
      camera: POSE_BED,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [SRC.pm502('p2 four essential elements')],
    },
    {
      title: 'Prony brake',
      body:
        'Wooden blocks **a** are clamped round wheel **b** by handwheel **c**. The friction torque turns the block assembly until arm **d** bears on scale **e**. Power = 2π·l·F·n/60 000 kW, and T = F·l.\n\nThe brake torque hardly changes with speed — like the engine’s — so speed control is difficult.',
      camera: { position: [0.9, 1.25, 1.9], target: [POS.pulleyX, Y + 0.1, 0.35] },
      select: 'brake-blocks',
      params: { kind: 'prony', load: 0.7 },
      cites: [C.prony],
      check: {
        question: 'You fit a longer torque arm l. At the same engine torque, the force on the scale will…',
        options: ['Rise', 'Fall', 'Stay the same'],
        answer: 1,
        explain: 'The torque is set by the engine and **T = F·l**, so a longer arm needs a smaller force on the scale to balance it.',
        reveal: { params: { kind: 'prony', load: 0.7, arm: 1.2 } },
      },
    },
    {
      title: 'Hydraulic dynamometer',
      body:
        'Vaned **rotors** churn water against vanes in the **casing**. The casing sits on **ball cradle bearings**, free to turn, so the **torque arm** carries all the torque. The **needle valves** and **exhaust control** set the water load. Error ≈ 0.5 %; capacity ∝ N³D⁵.',
      camera: { position: [0.95, 1.05, 1.15], target: [POS.casingX, Y, 0] },
      select: 'rotors',
      cut: 'half',
      params: { kind: 'hydraulic', load: 0.62 },
      cites: [C.hydraulic],
      check: {
        question: 'Capacity grows as N³D⁵. At the same speed, doubling the rotor diameter raises the power it can absorb about…',
        options: ['4 times', '8 times', '32 times'],
        answer: 2,
        explain: '2⁵ = **32**: capacity grows with the fifth power of rotor diameter, so a modest increase in rotor size absorbs far more power.',
      },
    },
    {
      title: 'Where the power goes',
      body: 'All the absorbed power becomes heat in the water, which leaves through the exhaust ports hotter than it came in — read the outlet thermometer in the Live panel. Raise the load and the water warms up.',
      camera: { position: [1.0, 0.7, 1.3], target: [POS.casingX + 0.2, Y - 0.2, 0] },
      select: 'thermometer',
      params: { kind: 'hydraulic', load: 0.75 },
      cites: [C.hydraulic],
    },
    {
      title: 'Eddy-current dynamometer',
      body: 'A toothed steel rotor turns inside a stator carrying **DC field coils**. The eddy currents drag on the rotor; the excitation current sets the torque. Coolant carries the heat away.',
      camera: { position: [0.95, 1.05, 1.2], target: [POS.casingX, Y, 0] },
      select: 'field-coils',
      params: { kind: 'eddy', load: 0.7 },
      cites: [C.eddy],
    },
    {
      title: 'DC cradle dynamometer',
      body: 'A separately excited shunt-wound generator. Its **field frame is cradled**, so the reaction on the scales gives the torque — accurate to 0.25 %. Run as a motor, it turns the engine over to measure **friction power**.',
      camera: { position: [1.2, 1.2, 1.7], target: [POS.dcX, Y, -0.2] },
      select: 'field-frame',
      params: { kind: 'dc', load: 0.75 },
      cites: [C.dc],
    },
    {
      title: 'Shop-type PTO dynamometer',
      body: 'A portable absorber on a cart, driven from the tractor **PTO**. A pressure gauge reads the torque-arm force and a speed indicator the PTO rpm — fine for checking an engine after an overhaul, less accurate than a laboratory unit.',
      camera: POSE_PTO,
      select: 'pto-dyno',
      cut: false,
      params: { kind: 'pto', load: 0.55 },
      cites: [C.pto],
    },
    {
      title: 'Observed and corrected power',
      body: 'Observed power depends on the air. It is corrected to standard air with **fa = (BPs/BPo)(To/Ts)ⁿ** and **Pbs = fa·Pbo**. Try the “Hot, high site” preset, and switch between the 99 kPa, 25 °C standard and the 101.3 kPa, 15.5 °C sea-level standard.',
      camera: POSE_BED,
      select: null,
      cut: 'half',
      params: { kind: 'hydraulic', load: 0.62, BPo: 94, ToC: 35 },
      cites: [C.correction],
      check: {
        question: 'This test runs at 94 kPa and 35 °C, in thinner air than the 99 kPa, 25 °C standard. How does the corrected power compare with the observed?',
        options: ['It is higher', 'It is lower', 'It is the same'],
        answer: 0,
        explain: 'Thin, hot air carries less oxygen, so the engine makes less power than it would at standard conditions. **fa** = (99/94)(308/298)^0.7 ≈ 1.08 scales it back up.',
      },
    },
  ],
}

export default scene
