import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Fridge3D, FridgePanel, useFridge } from './Rig'

const NOTE = (where: string) => cite('AEE306', 'refrigeration and air conditioning note.docx', where)
const view = { position: [0.9, 1, 5.6] as [number, number, number], target: [0.05, -0.05, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'refrigeration',
  title: 'Vapour-compression refrigeration plant',
  summary: 'Start the compressor and pull a cold room down: read both pressures, watch the coil frost, and see the COP fall as the evaporator gets colder.',
  Viewport: Fridge3D,
  Panel: FridgePanel,
  camera: view,
  extent: 2.8,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the plant', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('vapour compression cycle, worked examples 1 and 2')],
  reset: () => useFridge.getState().reset(),
  applyParams: (p) => useFridge.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Pumping heat uphill',
      body: 'Heat will not flow from a cold room to a warm yard by itself. The plant makes it: refrigerant boils cold in the **evaporator**, is compressed, and condenses hot in the **condenser**.',
      camera: view,
      select: 'evaporator',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [NOTE('main parts')],
    },
    {
      title: 'The compressor sets the lift',
      body: 'Pressure fixes the temperature at which a fluid boils. Low pressure on one side lets it boil below the room’s temperature, and high pressure on the other lets it condense above the air’s.',
      select: 'compressor',
      cites: [NOTE('processes in the cycle')],
    },
    {
      title: 'The valve closes the loop',
      body: 'The expansion valve drops the pressure with no work and no heat, so **h₃ = h₄**. Some of the liquid flashes to vapour, and that chills the rest to the evaporator’s temperature.',
      select: 'valve',
      cites: [NOTE('throttling')],
      check: {
        question: 'What stays constant across the expansion valve?',
        options: ['Temperature', 'Enthalpy', 'Pressure'],
        answer: 1,
        explain: 'Throttling exchanges no work and no heat, so the enthalpy is the same each side.',
      },
    },
  ],
}

export default scene
