import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { preparePumpGeometry } from './geometry'
import { DEFAULTS, GEAR, MG1617, MS1718, VANE, usePumps } from './model'
import { PumpsPanel } from './Panel'
import { Pumps3D } from './Scene3D'

const home = { position: [0.05, 0.2, 0.5] as [number, number, number], target: [0, 0, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'pumps',
  title: 'Gear & vane pumps',
  summary:
    'An external gear pump and a vane pump cut open side by side, with oil carried from the inlet to the outlet. Displacement is worked out from the parts you see, and the calculator works out torque, power and heat, and compares the same unit as a pump and as a motor.',
  Viewport: Pumps3D,
  Panel: PumpsPanel,
  camera: home,
  extent: 0.42,
  floorY: -0.07,
  hatchScale: 0.0018,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'face', label: 'Front cover removed (section through the gears)', planes: [{ normal: [0, 0, 1], pos: 0.002 }] },
    { id: 'ports', label: 'Section through the ports', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0.002 }], sectionMoving: true },
  ],
  defaultPreset: 'face',
  cites: [SRC.hy510('p2–3 (book pp83–84): pumps, relief valve'), MG1617('Q(b)–(c), pump vs motor'), MS1718('Q(d) pump formulas')],
  reset: () => usePumps.getState().reset(),
  prepare: preparePumpGeometry,
  applyParams: (p) => usePumps.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Two positive-displacement pumps',
      body:
        'A **gear pump** (left) is the most common tractor hydraulic pump; some tractors use a multi-piston pump. On the right is a **vane pump**. Both trap oil in closed spaces and carry it from the **inlet** to the **outlet**.',
      camera: home,
      cut: 'face',
      select: null,
      explode: 0,
      playing: true,
      params: { rpm: 2000, ecc: 0.004, flows: true },
      cites: [SRC.hy510('p2 (book p83)')],
    },
    {
      title: 'Gear pump: oil goes round the outside',
      body:
        'The two gears turn in opposite directions in a close-fitting body. Oil fills the **tooth spaces** at the inlet, is carried **round the outside** of both gears and is squeezed out at the outlet where the teeth come back into mesh — it cannot go back through the middle.',
      camera: { position: [GEAR.x, 0.08, 0.2], target: [GEAR.x, 0, 0] },
      select: 'drive-gear',
      cites: [SRC.hy510('p2'), SRC.beyond('gear-pump internals (named but not drawn in the notes)')],
    },
    {
      title: 'Displacement from the gears',
      body:
        'Each revolution delivers D = 2πb(r_a² − r² − p_b²/12) — about **13.9 cm³** for these 3 mm-module, 12-tooth, 20 mm-wide gears. At 2000 rpm that is 27.8 L/min, close to the **27 L/min** typical of a 45 kW tractor.',
      camera: { position: [GEAR.x + 0.02, 0.05, 0.16], target: [GEAR.x, 0, 0] },
      select: 'gear-body',
      cites: [SRC.hy510('p2: 27 L/min (6 gal/min)')],
      check: {
        question: 'This gear pump displaces 13.9 cm³ per revolution. If the drive speed falls from 2000 to 1000 rpm, about how much does it deliver?',
        options: ['27.8 L/min', '13.9 L/min', '55.6 L/min'],
        answer: 1,
        explain: 'A positive-displacement pump moves a fixed volume each turn, so **flow = D × N**: 13.9 cm³ × 1000 rpm ≈ 13.9 L/min, before leakage.',
        reveal: { params: { rpm: 1000 } },
      },
    },
    {
      title: 'Vane pump',
      body:
        'The **rotor** has slots in which **vanes** move radially — thrown out by centrifugal force — so their tips ride on the **cam ring**. The rotor is off-centre in the ring, so each chamber between two vanes grows past the inlet and shrinks past the outlet.',
      camera: { position: [VANE.x, 0.08, 0.2], target: [VANE.x, 0, 0] },
      select: 'vanes',
      cites: [MG1617('Q(b) vane pump')],
    },
    {
      title: 'Variable delivery',
      body: 'Move the ring towards the rotor and the eccentricity falls: the vanes hardly move, and the delivery drops — at e = 0 the pump delivers nothing. Displacement D = 2eL(2πR − n·t).',
      camera: { position: [VANE.x, 0.08, 0.2], target: [VANE.x, 0, 0] },
      select: 'ring',
      params: { ecc: 0.0015 },
      cites: [SRC.beyond('vane-pump displacement')],
      check: {
        question: 'How would you halve the vane pump’s delivery at the same drive speed?',
        options: ['Double the number of vanes', 'Fit a higher relief setting', 'Halve the eccentricity e'],
        answer: 2,
        explain: 'Displacement D = 2eL(2πR − n·t) is proportional to the **eccentricity** e, so halving e halves the delivery. Extra vanes only take up a little more of the chamber volume.',
        reveal: { params: { ecc: 0.002 } },
      },
    },
    {
      title: 'Pump versus motor',
      body:
        'A pump turns shaft power into hydraulic power. Its actual delivery is **less** than D·N (leakage) and its actual torque **more** than Δp·D/2π (friction). A motor is the same machine run backwards: it needs **more** oil than theoretical and gives **less** torque.',
      camera: home,
      select: null,
      params: { ecc: 0.004 },
      cites: [MG1617('pump vs motor table')],
      check: {
        question: 'A worn pump leaks more oil internally. At the same speed and pressure, what happens?',
        options: ['Shaft torque falls below Δp·D/2π', 'Actual delivery falls further below D·N', 'Actual delivery rises above D·N'],
        answer: 1,
        explain: 'Internal **leakage** lets oil slip back from the outlet to the inlet, so the volumetric efficiency and the delivery fall. Friction, not leakage, is what raises the torque above Δp·D/2π.',
      },
    },
    {
      title: 'Pump calculator',
      body:
        'Open **Controls**: with a given D = 150 cm³/rev at 1800 rpm, 18 MPa, ηv 0.8 and ηT 0.9 the calculator gives **TT 429.7 N·m, TA 477.5 N·m, Ph 64.8 kW, Ps 90 kW** and **25.2 kW** of heat. The relief valve on a tractor blows at **150 kg/cm²** (≈ 14.7 MPa).',
      camera: home,
      params: { source: 'manual', D: 150, rpm: 1800, dp: 18, etaV: 0.8, etaT: 0.9 },
      cites: [MG1617('Q(c)'), SRC.hy510('p3 relief valve')],
    },
  ],
}

export default scene
