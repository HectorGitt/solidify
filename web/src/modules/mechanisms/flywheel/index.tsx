import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Flywheel3D, FlywheelPanel, useFly } from './Rig'

const NOTE = (where: string) => cite('MEE306', 'Chapter 5 - Flywheel.pdf', where)
const view = { position: [0.9, 0.5, 2.5] as [number, number, number], target: [0, -0.06, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'flywheel',
  title: 'Flywheel & turning moment',
  summary: 'An engine’s uneven turning moment and the wheel that smooths it: see the energy it stores, and change its mass, radius and speed to read the fluctuation that remains.',
  Viewport: Flywheel3D,
  Panel: FlywheelPanel,
  camera: view,
  extent: 1.6,
  floorY: FLOOR,
  hatchScale: 0.01,
  timeScale: 1 / 4,
  cutPresets: [{ id: 'mid', label: 'Through the cylinder', planes: [{ normal: [0, 0, 1], pos: 0.27 }] }],
  cites: [NOTE('fluctuation of speed and energy')],
  reset: () => useFly.getState().reset(),
  applyParams: (p) => useFly.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'An uneven push',
      body: 'A four-stroke cylinder only drives during **one stroke in four**: the other three take energy back. Left alone, the shaft would surge and stall. The chart shows the **turning moment** through two full turns, against its mean.',
      camera: view,
      cut: false,
      select: 'cylinder',
      explode: 0,
      playing: true,
      params: { kind: 'four-stroke', Tp: 600, rpm: 300, m: 80, k: 0.32 },
      cites: [NOTE('Examples (a)')],
    },
    {
      title: 'A mechanical capacitor',
      body: 'When the moment is above the mean the wheel **speeds up**, storing the excess. When it falls below, the wheel slows, giving it back. The largest swing in stored energy is **ΔE**, and it sets the size of the wheel: **ΔE = I ω̄² Cs**.',
      select: 'flywheel',
      cites: [NOTE('energy equation')],
      check: {
        question: 'An engine’s mean speed is doubled, with the same energy swing and the same fluctuation allowed. What inertia does the wheel need?',
        options: ['Double', 'A quarter', 'The same'],
        answer: 1,
        explain: 'I = ΔE / (ω̄² Cs), so it falls with the **square** of the speed. Fast engines have small flywheels.',
      },
    },
    {
      title: 'More cylinders',
      body: 'Four cylinders firing in turn give a power stroke every half turn. For the same peak moment, the energy swing collapses, so a far smaller flywheel does the same job.',
      params: { kind: 'four-cylinder' },
      select: 'flywheel',
      cites: [NOTE('Examples')],
    },
    {
      title: 'A flywheel is not a governor',
      body: 'A flywheel smooths speed **within a cycle**. It cannot hold the mean speed when the load changes over many cycles: only a governor can do that, by changing the fuel. A press shows the opposite case: a steady motor and a load in one short stroke.',
      params: { kind: 'press', Tp: 2000, rpm: 120, m: 400 },
      cites: [NOTE('Examples (c)')],
    },
  ],
}

export default scene
