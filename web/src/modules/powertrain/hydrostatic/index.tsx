import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, DIM, useHydro } from './model'
import { HydroPanel } from './Panel'
import { Hydro3D } from './Scene3D'

const home = { position: [0.2, 0.62, 0.78] as [number, number, number], target: [0, -0.02, -0.02] as [number, number, number] }

const scene: SceneDef = {
  id: 'hydrostatic',
  title: 'Hydrostatic drive',
  summary:
    'A variable-displacement swashplate pump driving an axial-piston motor through high- and low-pressure lines. Tilt the swashplate and watch the pistons’ stroke, the oil flow and the motor speed change — through zero to reverse — and compare the four pump/motor combinations.',
  Viewport: Hydro3D,
  Panel: HydroPanel,
  camera: home,
  extent: 0.8,
  floorY: -DIM.housingR - 0.02,
  hatchScale: 0.0035,
  timeScale: 1 / 40,
  cutPresets: [
    { id: 'plan', label: 'Plan section (axes)', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut (front-top)', planes: [{ normal: [0, 1, 0], pos: 0 }, { normal: [0, 0, 1], pos: -0.045 }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 1, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'plan',
  cites: [SRC.pt510('p8–9 (PDF p8–9)'), SRC.tts510('p5'), SRC.beyond('axial-piston unit construction; Q = D·N, T = Δp·D/2π')],
  reset: () => useHydro.getState().reset(),
  applyParams: (p) => useHydro.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A pump driving a motor',
      body:
        'A hydrostatic drive is a **pump–motor pair** joined by two oil lines. The engine turns the **pump** (left); its oil turns the **motor** (right), which drives the wheel. There is no clutch and no gear train. It relies on two facts: liquids take the shape of their container, and they are **incompressible**.',
      camera: home,
      cut: 'plan',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [SRC.pt510('p8')],
    },
    {
      title: 'Pistons on a swashplate',
      body:
        'Each unit has nine pistons in a rotating **cylinder block**. Their slippers slide on an inclined **swashplate**, so every piston moves out and back in once per revolution: stroke = 2R·tan β. Pistons moving out fill with oil; pistons moving in push it out.',
      camera: { position: [-0.12, 0.3, 0.3], target: [-0.22, 0, 0.02] },
      select: 'pump-pistons',
      cut: 'plan',
      cites: [SRC.pt510('p8 piston groups ride on swashplates')],
    },
    {
      title: 'The valve plate',
      body:
        'Behind the block, the stationary **valve plate** has two kidney-shaped ports. Each bore passes over one kidney while it fills and over the other while it delivers, so the plate is the pump’s inlet and outlet valve. The oil in each bore is coloured by the side it is on.',
      camera: { position: [-0.05, 0.3, -0.12], target: [-0.22, 0, -0.04] },
      select: 'pump-valve',
      cut: 'all',
      cites: [SRC.beyond('valve plate (port plate)')],
    },
    {
      title: 'Tilt the swashplate: speed',
      body:
        'The **control lever** tilts the pump swashplate. More tilt = longer stroke = more oil per revolution = a faster motor: **flow rate gives speed**. It is stepless — any speed, shifted on the go with one lever.',
      camera: { position: [0.05, 0.45, 0.55], target: [-0.1, 0, 0] },
      select: 'pump-lever',
      cut: 'plan',
      params: { pumpLever: 1 },
      cites: [SRC.pt510('p8–9')],
      check: {
        question: 'At the same pump speed, the swashplate is tilted further so tan β doubles. What happens to the motor speed?',
        options: ['It roughly doubles', 'It halves', 'It stays the same, but pressure rises'],
        answer: 0,
        explain: 'Stroke = 2R·tan β, so the pump displacement and its flow **Q = D·N** double. The fixed motor must turn twice as fast to swallow that flow.',
      },
    },
    {
      title: 'Through zero to reverse',
      body:
        'At **0°** the pistons stop stroking: no flow, and the motor is held — the tractor stands still. Tilt past zero and the oil flows the other way: the **red high-pressure** line swaps sides and the motor reverses. **Flow direction gives travel direction.**',
      camera: { position: [0.1, 0.55, 0.15], target: [0, 0, -0.1] },
      select: 'line-a',
      params: { pumpLever: -0.6 },
      cites: [SRC.pt510('p8')],
      check: {
        question: 'The pump keeps turning the same way when the lever goes past zero. What reverses the motor?',
        options: ['The pump\'s shaft turning backwards', 'A reverse gear behind the motor', 'Oil flowing the other way round the loop'],
        answer: 2,
        explain: 'Tilting the swashplate past zero swaps which pistons fill and which deliver, so the oil **flows the other way** and the high-pressure line changes sides.',
      },
    },
    {
      title: 'Pressure gives power',
      body:
        'The load sets the pressure in the delivery line, and the motor torque is T = Δp·D/2π: **pressure gives power**. Leakage and friction turn some power into heat in the oil — and too much speed, heat, pressure or dirt greatly shortens a unit’s life.',
      camera: { position: [0.42, 0.35, 0.5], target: [0.22, 0, 0.05] },
      select: 'motor',
      params: { pumpLever: 0.8, dp: 30 },
      cites: [SRC.pt510('p8–9')],
      check: {
        question: 'The tractor meets a heavier load with the lever left where it is. What changes most in the oil loop?',
        options: ['The flow rises', 'The pressure rises', 'The swashplate angle rises'],
        answer: 1,
        explain: 'Flow is set by the pump displacement and speed; the load sets the **pressure**. The motor torque T = Δp·D/2π rises with it, up to the relief-valve setting.',
      },
    },
    {
      title: 'Four combinations',
      body:
        'Pump and motor can each be fixed (FDP, FDM) or variable (VDP, VDM). **VDP → FDM** is the common tractor drive. **VDP → VDM** gives the best performance but is complex and expensive. Try them all in **Controls**, alongside the table of the four combinations.',
      camera: home,
      select: null,
      params: { combo: 'VDP-VDM', pumpLever: 0.8, motorLever: 0.5, dp: 20 },
      cites: [SRC.pt510('p7–8 (PDF p9)')],
    },
  ],
}

export default scene
