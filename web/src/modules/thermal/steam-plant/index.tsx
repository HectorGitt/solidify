import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Steam3D, SteamPanel, useSteam } from './Rig'

const POWER = (where: string) => cite('AEE305', '305 POWER.pdf', where)
const TABLES = (where: string) => cite('AEE305', 'Steam Tables.pdf', where)
const view = { position: [0.9, 1, 6.2] as [number, number, number], target: [0.1, -0.02, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'steam-plant',
  title: 'Rankine steam plant',
  summary: 'Boiler, turbine, condenser and feed pump in one closed loop: raise the pressure and read the work, the exhaust dryness and the efficiency.',
  Viewport: Steam3D,
  Panel: SteamPanel,
  camera: view,
  extent: 3,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the turbine', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [POWER('external combustion engines; the steam power plant'), TABLES('saturated and superheated steam')],
  reset: () => useSteam.getState().reset(),
  applyParams: (p) => useSteam.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'One closed loop',
      body: 'The same water goes round and round. It is pumped to pressure, boiled and superheated, expanded through the turbine, then condensed to water again.',
      camera: view,
      select: 'drum',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [POWER('the steam power plant')],
    },
    {
      title: 'Inside the turbine',
      body: 'Steam falls in pressure and enthalpy, and that drop becomes shaft work. Its volume swells as it goes, so the stages grow along the shaft.',
      cut: 'mid',
      select: 'rotor',
      cites: [POWER('turbine work')],
    },
    {
      title: 'Why condense at all?',
      body: 'A strong vacuum in the condenser lets the steam expand further. Then the pump only has to lift **water**, which takes around 1 % of what the turbine makes.',
      cut: false,
      select: 'pump',
      cites: [POWER('pump work')],
      check: {
        question: 'Raising boiler pressure at the same steam temperature makes the exhaust:',
        options: ['Drier', 'Wetter', 'No different'],
        answer: 1,
        explain: 'The expansion starts at a lower entropy, so it ends further inside the dome. Superheat, or reheat, is the cure.',
      },
    },
  ],
}

export default scene
